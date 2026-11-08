import { db } from './db';
import { QueueItem, CharacterRecord, GenerationSettings, GenerationAttempt, GenerationResultAsset } from '../types/queue';
import { synthesizeProviderPayload } from './promptSynthesizer';
import { syncBus } from './sync';

export interface ServerHealth {
  status: 'ok' | 'error' | 'disconnected';
  uptime?: number;
  activeProvider?: string;
  isQueueRunning?: boolean;
  isQueuePaused?: boolean;
  budget?: {
    maxBatchSpendUsd: number;
    totalSpentUsd: number;
  };
}

export interface ServerConfig {
  provider: 'fal' | 'replicate' | 'openai' | 'dryrun';
  modelId: string;
  configuredKeys: {
    fal: boolean;
    replicate: boolean;
    openai: boolean;
    falMasked?: string;
    replicateMasked?: string;
    openaiMasked?: string;
  };
  budget: {
    maxBatchSpendUsd: number;
    totalSpentUsd: number;
  };
}

/**
 * Checks connection to the local secure generation backend.
 */
export async function checkServerHealth(backendUrl = 'http://localhost:3001'): Promise<ServerHealth> {
  try {
    const res = await fetch(`${backendUrl}/api/health`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return { status: 'error' };
    const data = await res.json();
    return { status: 'ok', ...data };
  } catch {
    return { status: 'disconnected' };
  }
}

/**
 * Retrieves the current server provider and spending configuration.
 */
export async function getServerConfig(backendUrl = 'http://localhost:3001'): Promise<ServerConfig | null> {
  try {
    const res = await fetch(`${backendUrl}/api/config`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Updates server provider settings and API keys.
 */
export async function updateServerConfig(
  updates: Partial<{
    provider: string;
    modelId: string;
    falKey: string;
    replicateKey: string;
    openaiKey: string;
    maxBatchSpendUsd: number;
  }>,
  backendUrl = 'http://localhost:3001'
): Promise<boolean> {
  try {
    const res = await fetch(`${backendUrl}/api/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Converts a Base64 data URL into a binary Blob.
 */
export function dataUriToBlob(dataUri: string): Blob {
  const parts = dataUri.split(',');
  const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
  const bstr = atob(parts[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

/**
 * Generates an actual AI image for a single scene.
 * Persists the resulting image binary in IndexedDB and creates a versioned attempt record.
 */
export async function generateSceneImage(
  scene: QueueItem,
  assignedCharacters: CharacterRecord[],
  settings: GenerationSettings
): Promise<GenerationAttempt> {
  const backendUrl = settings.backendUrl || 'http://localhost:3001';

  // Mark scene as actively generating
  const generatingScene: QueueItem = {
    ...scene,
    status: 'generating',
    updatedAt: Date.now(),
  };
  await db.scenes.put(generatingScene);
  syncBus.broadcast('STATUS_CHANGED', { sceneId: scene.id, status: 'generating' });

  try {
    // 1. Synthesize provider payload
    const payload = await synthesizeProviderPayload(scene, assignedCharacters, settings);

    // 2. Dispatch to backend
    const res = await fetch(`${backendUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(errData.error || `Server generation error: ${res.statusText}`);
    }

    const data = await res.json();
    if (!data.dataUri) {
      throw new Error('Backend did not return image data.');
    }

    // 3. Convert to binary Blob and save to IndexedDB
    const imageBlob = dataUriToBlob(data.dataUri);
    const mimeType = data.mimeType || 'image/png';
    const ext = mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'jpg' : mimeType.includes('webp') ? 'webp' : 'png';
    const nextAttemptNum = (scene.attempts?.length || 0) + 1;
    const attemptId = `att_${Date.now()}_sc${scene.scene}_v${nextAttemptNum}`;

    const resultAsset: GenerationResultAsset = {
      id: attemptId,
      sceneId: scene.id,
      attemptNumber: nextAttemptNum,
      timestamp: Date.now(),
      mimeType,
      extension: ext,
      imageBlob,
      provider: data.modelUsed || settings.provider,
      promptSnapshot: scene.rawJsonText,
    };
    await db.generationResults.put(resultAsset);

    const attemptRecord: GenerationAttempt = {
      id: attemptId,
      sceneId: scene.id,
      attemptNumber: nextAttemptNum,
      timestamp: Date.now(),
      status: 'awaiting_review',
      imageBlobId: attemptId,
      imageMimeType: mimeType,
      imageExtension: ext,
      provider: data.modelUsed || settings.provider,
      effectivePrompt: payload.prompt,
      characterIdsUsed: scene.selectedCharacterIds,
      costEstimate: data.costEstimate || 0,
      promptSnapshot: scene.rawJsonText,
    };

    const updatedScene: QueueItem = {
      ...scene,
      status: 'awaiting_review',
      currentAttemptNumber: nextAttemptNum,
      attempts: [...(scene.attempts || []), attemptRecord],
      updatedAt: Date.now(),
    };
    await db.scenes.put(updatedScene);
    syncBus.broadcast('ATTEMPT_ADDED', { sceneId: scene.id, attemptId });

    return attemptRecord;
  } catch (err: any) {
    const failedScene: QueueItem = {
      ...scene,
      status: 'failed',
      updatedAt: Date.now(),
      notes: err.message,
    };
    await db.scenes.put(failedScene);
    syncBus.broadcast('STATUS_CHANGED', { sceneId: scene.id, status: 'failed' });
    throw err;
  }
}
