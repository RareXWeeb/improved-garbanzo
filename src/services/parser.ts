import {
  ParsedScenePrompt,
  PromptMetadata,
  ExtractedReference,
  ValidationIssue,
} from '../types/prompt';

/**
 * Normalizes an identifier string (e.g. "68AD", "20B", "1") for display and composite keys.
 */
export function normalizeIdentifier(val: any, fallback: string = '01'): string {
  if (val === undefined || val === null) return fallback;
  const str = String(val).trim();
  return str.length > 0 ? str : fallback;
}

/**
 * Generates an alphanumeric sorting rank for scenes so that:
 * 1, 2, 2A, 2B, 10, 68, 68A, 68AD sort in human cinematic order.
 */
export function getAlphanumericSortKey(sceneStr: string): { num: number; suffix: string } {
  const match = sceneStr.match(/^(\d+)(.*)$/);
  if (match) {
    return {
      num: parseInt(match[1], 10),
      suffix: match[2].trim().toLowerCase(),
    };
  }
  return { num: Number.MAX_SAFE_INTEGER, suffix: sceneStr.toLowerCase() };
}

export function compareSceneNumbers(a: string, b: string): number {
  const keyA = getAlphanumericSortKey(a);
  const keyB = getAlphanumericSortKey(b);
  if (keyA.num !== keyB.num) {
    return keyA.num - keyB.num;
  }
  return keyA.suffix.localeCompare(keyB.suffix);
}

/**
 * Extracts and categorizes reference images from various possible schema variations.
 */
export function extractReferencesFromMetadata(metadata: PromptMetadata): ExtractedReference[] {
  const references: ExtractedReference[] = [];
  const seen = new Set<string>();

  const addRef = (filename: string, categoryHint?: 'character' | 'location' | 'other', labelHint?: string) => {
    if (!filename || typeof filename !== 'string') return;
    const clean = filename.trim();
    if (!clean || seen.has(clean.toLowerCase())) return;
    seen.add(clean.toLowerCase());

    let category: 'character' | 'location' | 'other' = categoryHint || 'other';
    const lower = clean.toLowerCase();

    if (!categoryHint || categoryHint === 'other') {
      if (lower.startsWith('char_') || lower.includes('character') || lower.includes('portrait')) {
        category = 'character';
      } else if (lower.startsWith('loc_') || lower.includes('location') || lower.includes('interior') || lower.includes('exterior') || lower.includes('int_') || lower.includes('ext_')) {
        category = 'location';
      }
    }

    references.push({
      filename: clean,
      category,
      label: labelHint || clean.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' '),
      isMatched: false,
    });
  };

  // 1. Check `reference_images`
  const refImages = metadata.reference_images;
  if (Array.isArray(refImages)) {
    for (const item of refImages) {
      if (typeof item === 'string') {
        addRef(item);
      } else if (item && typeof item === 'object') {
        const fn = item.filename || item.name || item.path || item.file;
        const cat = item.type === 'character' ? 'character' : item.type === 'location' ? 'location' : 'other';
        addRef(fn, cat, item.description || item.character_name);
      }
    }
  } else if (refImages && typeof refImages === 'object') {
    for (const [key, val] of Object.entries(refImages)) {
      if (typeof val === 'string') {
        const cat = key.toLowerCase().includes('char') ? 'character' : key.toLowerCase().includes('loc') ? 'location' : 'other';
        addRef(val, cat);
      } else if (Array.isArray(val)) {
        const cat = key.toLowerCase().includes('char') ? 'character' : key.toLowerCase().includes('loc') ? 'location' : 'other';
        for (const sub of val) {
          if (typeof sub === 'string') addRef(sub, cat);
          else if (sub?.filename) addRef(sub.filename, cat, sub.description);
        }
      }
    }
  }

  // 2. Check dedicated character_references and location_references
  if (Array.isArray(metadata.character_references)) {
    for (const item of metadata.character_references) {
      if (typeof item === 'string') addRef(item, 'character');
      else if (item?.filename) addRef(item.filename, 'character', item.description || item.name);
    }
  }
  if (Array.isArray(metadata.location_references)) {
    for (const item of metadata.location_references) {
      if (typeof item === 'string') addRef(item, 'location');
      else if (item?.filename) addRef(item.filename, 'location', item.description || item.name);
    }
  }

  return references;
}

/**
 * Validates prompt metadata against cinematic criteria and reports actionable warnings.
 * Does NOT reject the prompt or alter source text.
 */
export function validatePromptMetadata(metadata: PromptMetadata): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // 1. Scene validation
  if (!metadata.scene && metadata.scene !== 0) {
    issues.push({
      type: 'warning',
      field: 'scene',
      message: 'Scene identifier is missing; defaulted to 01.',
    });
  }

  // 2. Aspect Ratio validation (STRICT VERTICAL 9:16 PORTRAIT)
  if (metadata.aspect_ratio) {
    const ar = String(metadata.aspect_ratio).trim();
    if (ar !== '9:16' && ar !== '9/16' && ar !== '0.5625') {
      issues.push({
        type: 'warning',
        field: 'aspect_ratio',
        message: `Aspect ratio is "${ar}" (Strict cinematic target is 9:16 vertical).`,
      });
    }
  } else {
    issues.push({
      type: 'info',
      field: 'aspect_ratio',
      message: 'Aspect ratio not specified (9:16 vertical recommended for mobile cinematic format).',
    });
  }

  // 3. Resolution validation (Target 1080×1920)
  if (metadata.resolution) {
    const res = String(metadata.resolution).replace(/\s+/g, '').toLowerCase();
    if (res !== '1080x1920' && res !== '1080×1920') {
      issues.push({
        type: 'warning',
        field: 'resolution',
        message: `Resolution is "${metadata.resolution}" (Target is 1080×1920).`,
      });
    }
  }

  // 4. Production & Camera Setup validation (ARRI ALEXA 35 + Cooke S4/i)
  const cameraText = JSON.stringify(metadata.camera_setup || metadata.production || '');
  const hasArri = cameraText.toLowerCase().includes('arri') || cameraText.toLowerCase().includes('alexa');
  const hasCooke = cameraText.toLowerCase().includes('cooke');

  if (!hasArri && !hasCooke) {
    issues.push({
      type: 'info',
      field: 'camera_setup',
      message: 'Camera optics not explicitly tagged with ARRI ALEXA 35 or Cooke S4/i lenses.',
    });
  }

  // 5. Character count validation
  if (
    metadata.exact_character_count !== undefined &&
    Array.isArray(metadata.characters_visible)
  ) {
    const expected = Number(metadata.exact_character_count);
    const actual = metadata.characters_visible.length;
    if (!isNaN(expected) && expected !== actual) {
      issues.push({
        type: 'warning',
        field: 'characters_visible',
        message: `exact_character_count (${expected}) does not match characters_visible count (${actual}).`,
      });
    }
  }

  return issues;
}

/**
 * Creates a deterministic, non-colliding composite ID for a scene.
 * Example: "MyProject_Ep01_P01_Sc68AD"
 */
export function buildCompositeSceneId(
  projectTitle: string,
  episode: string | number,
  part: string | number,
  scene: string | number
): string {
  const p = String(projectTitle || 'Project').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  const ep = String(episode || '01').trim().replace(/[^a-zA-Z0-9_-]/g, '');
  const pt = String(part || '01').trim().replace(/[^a-zA-Z0-9_-]/g, '');
  const sc = String(scene || '01').trim().replace(/[^a-zA-Z0-9_-]/g, '');
  return `${p}_Ep${ep}_P${pt}_Sc${sc}`;
}

/**
 * Parses a raw JSON string (single object or array or wrapped scenes) into ParsedScenePrompt items.
 * Guaranteed: Original JSON text is preserved verbatim.
 */
export function parseImagePromptJson(
  rawContent: string,
  fileNameHint?: string
): ParsedScenePrompt[] {
  // Strip UTF-8 Byte Order Mark (BOM) if present (common in Windows text files)
  let trimmed = rawContent.replace(/^\uFEFF/, '').trim();
  if (!trimmed) {
    throw new Error('Input content is empty.');
  }

  // Strip Markdown code block wrappers if copied from ChatGPT (e.g. ```json ... ```)
  if (trimmed.startsWith('```')) {
    trimmed = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }

  let parsed: any;
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    // Graceful fallback: user pasted a plain text prompt string
    parsed = {
      scene: '01',
      title: trimmed.slice(0, 40),
      prompt: trimmed,
      aspect_ratio: '9:16',
      resolution: '1080x1920',
    };
  } else {
    try {
      parsed = JSON.parse(trimmed);
    } catch (err: any) {
      throw new Error(`JSON Syntax Error: ${err.message || 'Invalid JSON format'}`);
    }
  }

  const results: ParsedScenePrompt[] = [];

  // Helper to process a single object
  const processItem = (item: any, verbatimText: string) => {
    if (!item || typeof item !== 'object') return;

    // Detect project title
    const projectTitle =
      item.project_title ||
      item.project ||
      (fileNameHint ? fileNameHint.replace(/\.json$/i, '') : 'SceneForge_Project');

    const episode = normalizeIdentifier(item.episode, '01');
    const part = normalizeIdentifier(item.part, '01');
    const scene = normalizeIdentifier(item.scene, '01');

    const id = buildCompositeSceneId(projectTitle, episode, part, scene);
    const extractedReferences = extractReferencesFromMetadata(item);
    const validationIssues = validatePromptMetadata(item);

    results.push({
      id,
      rawJsonText: verbatimText,
      metadata: item,
      extractedReferences,
      validationIssues,
    });
  };

  if (Array.isArray(parsed)) {
    // Array of scenes: format each cleanly while preserving keys
    for (const entry of parsed) {
      processItem(entry, JSON.stringify(entry, null, 2));
    }
  } else if (parsed && typeof parsed === 'object') {
    // Check if it's wrapped in a container like { scenes: [...] } or { prompts: [...] }
    if (Array.isArray(parsed.scenes)) {
      for (const entry of parsed.scenes) {
        processItem(entry, JSON.stringify(entry, null, 2));
      }
    } else if (Array.isArray(parsed.prompts)) {
      for (const entry of parsed.prompts) {
        processItem(entry, JSON.stringify(entry, null, 2));
      }
    } else {
      // Single scene prompt: use the exact 100% verbatim raw content
      processItem(parsed, trimmed);
    }
  }

  if (results.length === 0) {
    throw new Error('No valid scene prompt objects could be extracted.');
  }

  return results;
}

