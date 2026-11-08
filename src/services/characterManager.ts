import { db } from './db';
import { CharacterRecord, QueueItem } from '../types/queue';
import { syncBus } from './sync';

/**
 * Creates a unique slug ID for a character within a project.
 */
export function buildCharacterId(projectId: string, name: string): string {
  const cleanName = name.toLowerCase().trim().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
  return `char_${projectId}_${cleanName}`;
}

/**
 * Adds or updates a reusable character reference in the Project Character Library.
 */
export async function saveCharacter(
  projectId: string,
  name: string,
  portraitBlob: Blob,
  options?: {
    id?: string;
    aliases?: string[];
    description?: string;
    wardrobe?: string;
    portraitMimeType?: string;
  }
): Promise<CharacterRecord> {
  const charId = options?.id || buildCharacterId(projectId, name);
  const now = Date.now();

  const record: CharacterRecord = {
    id: charId,
    projectId,
    name: name.trim(),
    aliases: options?.aliases || [name.trim()],
    description: options?.description || '',
    portraitBlob,
    portraitMimeType: options?.portraitMimeType || portraitBlob.type || 'image/png',
    wardrobe: options?.wardrobe || '',
    createdAt: now,
    updatedAt: now,
  };

  await db.characters.put(record);
  syncBus.broadcast('REFERENCES_SYNCED', { characterId: charId });
  return record;
}

/**
 * Retrieves all characters for a specific project.
 */
export async function getProjectCharacters(projectId: string): Promise<CharacterRecord[]> {
  return await db.characters.where('projectId').equals(projectId).toArray();
}

/**
 * Deletes a character record. Historical generation attempts preserve their image outputs.
 */
export async function deleteCharacter(charId: string): Promise<void> {
  await db.characters.delete(charId);

  // Unlink from active scenes
  const allScenes = await db.scenes.toArray();
  for (const scene of allScenes) {
    if (scene.selectedCharacterIds?.includes(charId)) {
      scene.selectedCharacterIds = scene.selectedCharacterIds.filter((id) => id !== charId);
      await db.scenes.put(scene);
    }
  }
  syncBus.broadcast('REFERENCES_SYNCED', { characterId: charId });
}

/**
 * Automatically inspects a scene's JSON metadata and matches characters against the project library.
 */
export function autoMatchCharactersForScene(
  scene: QueueItem,
  projectCharacters: CharacterRecord[]
): string[] {
  const matchedIds = new Set<string>();
  const metadata = scene.metadata || {};

  // Build list of terms from JSON
  const termsToMatch: string[] = [];

  // 1. Check characters_visible
  if (Array.isArray(metadata.characters_visible)) {
    metadata.characters_visible.forEach((c) => {
      if (typeof c === 'string') termsToMatch.push(c.toLowerCase().trim());
      else if (c?.name) termsToMatch.push(String(c.name).toLowerCase().trim());
    });
  }

  // 2. Check reference_images
  const refs = metadata.reference_images;
  if (Array.isArray(refs)) {
    refs.forEach((r) => {
      const filename = typeof r === 'string' ? r : r?.filename || r?.name || '';
      termsToMatch.push(filename.toLowerCase().replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' '));
    });
  }

  // 3. Check character_references
  if (Array.isArray(metadata.character_references)) {
    metadata.character_references.forEach((r) => {
      const name = typeof r === 'string' ? r : r?.name || r?.character_name || r?.filename || '';
      termsToMatch.push(name.toLowerCase().replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' '));
    });
  }

  // Check against each character in the project
  for (const char of projectCharacters) {
    const charName = char.name.toLowerCase().trim();
    const allAliases = [charName, ...(char.aliases || []).map((a) => a.toLowerCase().trim())];

    for (const term of termsToMatch) {
      for (const alias of allAliases) {
        if (!alias) continue;
        // Exact or strong substring match (e.g. "Rafael" in "Rafael Santos" or "Char_Rafael_Portrait")
        if (term.includes(alias) || alias.includes(term)) {
          matchedIds.add(char.id);
          break;
        }
      }
    }
  }

  return Array.from(matchedIds);
}

/**
 * Validates character selection against scene constraints.
 * Warns if exact_character_count does not match selected characters count.
 */
export function validateCharacterSelection(
  scene: QueueItem
): { isValid: boolean; warning?: string } {
  const expectedCount = scene.metadata?.exact_character_count;
  if (expectedCount === undefined || expectedCount === null) {
    return { isValid: true };
  }

  const expected = Number(expectedCount);
  if (isNaN(expected)) {
    return { isValid: true };
  }

  const selectedCount = scene.selectedCharacterIds?.length || 0;

  if (expected !== selectedCount) {
    const warning = `Scene JSON requires exactly ${expected} character(s), but ${selectedCount} character reference(s) are currently selected.`;
    return {
      isValid: Boolean(scene.characterMismatchAcknowledged),
      warning,
    };
  }

  return { isValid: true };
}
