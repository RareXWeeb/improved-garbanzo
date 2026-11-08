import { QueueItem, CharacterRecord, GenerationSettings } from '../types/queue';

export interface ProviderGenerationPayload {
  sceneId: string;
  provider: 'fal' | 'replicate' | 'openai' | 'dryrun';
  prompt: string;
  negativePrompt?: string;
  aspectRatio: string;
  width: number;
  height: number;
  referenceImages: Array<{
    characterId: string;
    characterName: string;
    dataUri: string; // Base64 data URL for API transmission
    weight?: number;
  }>;
  parameters: {
    numInferenceSteps?: number;
    guidanceScale?: number;
    seed?: number;
  };
}

/**
 * Converts a Blob to a base64 Data URI string.
 */
export async function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Synthesizes an internal provider-specific cinematic prompt from the scene JSON and assigned characters.
 * Preserves the original JSON 100% verbatim while delivering optimal instructions to the AI model.
 */
export async function synthesizeProviderPayload(
  scene: QueueItem,
  assignedCharacters: CharacterRecord[],
  settings: GenerationSettings
): Promise<ProviderGenerationPayload> {
  const meta = scene.metadata || {};

  // Extract core visual descriptions
  const sceneDescription =
    meta.prompt ||
    meta.prompt_text ||
    meta.description ||
    meta.shot_description ||
    meta.title ||
    `Scene ${scene.scene}`;

  const locationText = typeof meta.location === 'string' ? meta.location : meta.location?.name || '';
  const wardrobeText = typeof meta.wardrobe === 'string' ? meta.wardrobe : '';
  const lightingText = typeof meta.lighting === 'string' ? meta.lighting : '';
  const cameraText =
    typeof meta.camera === 'string'
      ? meta.camera
      : typeof meta.camera_setup === 'string'
      ? meta.camera_setup
      : 'ARRI ALEXA 35 cinema camera with Cooke S4/i prime lenses';

  // Build character identity context
  const characterDescriptions = assignedCharacters.map((char) => {
    const details = [
      char.name,
      char.description ? `(${char.description})` : '',
      char.wardrobe ? `wearing ${char.wardrobe}` : '',
    ]
      .filter(Boolean)
      .join(' ');
    return details;
  });

  const characterContext =
    characterDescriptions.length > 0
      ? `Featuring characters: ${characterDescriptions.join(', ')}.`
      : '';

  // Compose high-end cinematic prompt
  const promptParts = [
    `Cinematic vertical 9:16 portrait still frame from a premium photorealistic Filipino live-action drama.`,
    sceneDescription,
    characterContext,
    locationText ? `Location: ${locationText}.` : '',
    wardrobeText ? `Wardrobe: ${wardrobeText}.` : '',
    lightingText ? `Lighting: ${lightingText}.` : 'Warm-neutral cinematic lighting with rich natural skin tones.',
    `Filmed on ${cameraText}, 35mm and 50mm Cooke S4/i lenses, filmic optical roll-off and gentle flare.`,
    `Strict vertical 9:16 composition, 1080x1920 portrait framing, hyper-realistic facial anatomy, photorealistic skin pores and natural textures, ultra-detailed film still.`,
  ];

  const fullPrompt = promptParts.filter(Boolean).join(' ');

  const negativePrompt =
    'cartoon, 3d render, anime, cgi, illustration, plastic skin, oversaturated, blurry, bad anatomy, deformed fingers, extra limbs, watermark, text, low quality, wide aspect, horizontal crop';

  // Prepare reference image data URIs
  const referenceImages: ProviderGenerationPayload['referenceImages'] = [];
  for (const char of assignedCharacters) {
    if (char.portraitBlob) {
      try {
        const dataUri = await blobToDataUri(char.portraitBlob);
        referenceImages.push({
          characterId: char.id,
          characterName: char.name,
          dataUri,
          weight: 0.85,
        });
      } catch (err) {
        console.warn(`Failed to convert portrait blob for character ${char.name}:`, err);
      }
    }
  }

  // Determine resolution
  let width = 1080;
  let height = 1920;
  if (settings.targetResolution === '720x1280') {
    width = 720;
    height = 1280;
  } else if (settings.targetResolution === '1024x1792') {
    width = 1024;
    height = 1792;
  }

  return {
    sceneId: scene.id,
    provider: settings.provider,
    prompt: fullPrompt,
    negativePrompt,
    aspectRatio: settings.aspectRatio || '9:16',
    width,
    height,
    referenceImages,
    parameters: {
      numInferenceSteps: 30,
      guidanceScale: 4.5,
    },
  };
}
