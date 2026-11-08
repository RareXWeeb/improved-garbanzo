import { describe, it, expect } from 'vitest';
import { synthesizeProviderPayload } from './promptSynthesizer';
import { QueueItem, CharacterRecord, GenerationSettings } from '../types/queue';

describe('promptSynthesizer', () => {
  const mockSettings: GenerationSettings = {
    provider: 'fal',
    modelId: 'fal-ai/flux-pulid',
    aspectRatio: '9:16',
    targetResolution: '1080x1920',
    visualStyle: 'Filipino live-action drama',
    cameraReference: 'ARRI ALEXA 35',
    lensReference: 'Cooke S4/i',
    colorGrading: 'Filmic warm-neutral',
    maxBatchSpendUsd: 5.0,
    mode: 'auto_sequential',
    backendUrl: 'http://localhost:3001',
  };

  const mockScene: QueueItem = {
    id: 'proj_1_Ep01_P01_Sc68AD',
    projectId: 'proj_1',
    projectTitle: 'Ang Pagbabalik ni Rafael',
    episode: '01',
    part: '01',
    scene: '68AD',
    title: 'Rafael confrontation in Manila rain',
    rawJsonText: '{"scene": "68AD", "location": "Manila Escolta Street"}',
    metadata: {
      scene: '68AD',
      prompt: 'Medium close-up of Rafael in heavy torrential rain outside Escolta heritage building.',
      location: 'Manila Escolta Street at night',
      lighting: 'Neon reflections, street lamp amber glow, moody rim light',
      camera: 'ARRI ALEXA 35 cinema camera with Cooke S4/i 50mm prime',
      exact_character_count: 1,
      characters_visible: ['Rafael'],
      aspect_ratio: '9:16',
      resolution: '1080x1920',
    },
    selectedCharacterIds: ['char_rafael'],
    extractedReferences: [],
    validationIssues: [],
    status: 'ready',
    currentAttemptNumber: 0,
    attempts: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const mockCharacters: CharacterRecord[] = [
    {
      id: 'char_rafael',
      projectId: 'proj_1',
      name: 'Rafael Santos',
      aliases: ['Rafael'],
      description: '30s Filipino man, determined expression, sharp jawline',
      wardrobe: 'Drenched charcoal linen shirt',
      portraitBlob: null as any, // test without blob to avoid FileReader in node
      portraitMimeType: 'image/png',
      createdAt: 1000,
      updatedAt: 1000,
    },
  ];

  it('synthesizes cinematic natural language prompt with correct camera, lens and vertical 9:16 portrait specs', async () => {
    const payload = await synthesizeProviderPayload(mockScene, mockCharacters, mockSettings);

    expect(payload.sceneId).toBe('proj_1_Ep01_P01_Sc68AD');
    expect(payload.provider).toBe('fal');
    expect(payload.aspectRatio).toBe('9:16');
    expect(payload.width).toBe(1080);
    expect(payload.height).toBe(1920);

    // Verify key prompt components
    expect(payload.prompt).toContain('Cinematic vertical 9:16 portrait still frame');
    expect(payload.prompt).toContain('Medium close-up of Rafael');
    expect(payload.prompt).toContain('Featuring characters: Rafael Santos');
    expect(payload.prompt).toContain('30s Filipino man');
    expect(payload.prompt).toContain('Drenched charcoal linen shirt');
    expect(payload.prompt).toContain('Location: Manila Escolta Street at night');
    expect(payload.prompt).toContain('Cooke S4/i');
    expect(payload.prompt).toContain('1080x1920 portrait framing');
  });

  it('provides negative prompt suppressing illustration, anime, and distorted outputs', async () => {
    const payload = await synthesizeProviderPayload(mockScene, mockCharacters, mockSettings);

    expect(payload.negativePrompt).toContain('cartoon');
    expect(payload.negativePrompt).toContain('bad anatomy');
    expect(payload.negativePrompt).toContain('watermark');
  });

  it('adjusts width and height when targetResolution is 720x1280 or 1024x1792', async () => {
    const customSettings: GenerationSettings = {
      ...mockSettings,
      targetResolution: '720x1280',
    };

    const payload = await synthesizeProviderPayload(mockScene, mockCharacters, customSettings);
    expect(payload.width).toBe(720);
    expect(payload.height).toBe(1280);
  });
});

