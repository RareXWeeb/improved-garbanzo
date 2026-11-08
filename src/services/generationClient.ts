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
    const res = await fetch(`${backendUrl}/api/health`, { signal: AbortSignal.timeout(2000) });
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
    const res = await fetch(`${backendUrl}/api/config`, { signal: AbortSignal.timeout(2000) });
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
      signal: AbortSignal.timeout(3000),
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
 * In-browser canvas renderer for zero-cost offline testing.
 * Runs directly inside the browser extension without requiring a backend server.
 */
export function generateBrowserDryRunImage(
  scene: QueueItem,
  assignedCharacters: CharacterRecord[],
  width = 540,
  height = 960
): { dataUri: string; mimeType: string } {
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Cinematic dark vignette background
      const grad = ctx.createRadialGradient(width / 2, height / 2, 50, width / 2, height / 2, height / 1.5);
      grad.addColorStop(0, '#1c1c24');
      grad.addColorStop(1, '#09090b');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Frame border
      ctx.strokeStyle = '#27272a';
      ctx.lineWidth = 10;
      ctx.strokeRect(5, 5, width - 10, height - 10);

      // Inner border
      ctx.strokeStyle = '#3f3f46';
      ctx.lineWidth = 1;
      ctx.strokeRect(18, 18, width - 36, height - 36);

      // Scene typography
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 32px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`SCENE ${scene.scene}`, width / 2, 130);

      ctx.fillStyle = '#a1a1aa';
      ctx.font = '14px ui-monospace, monospace';
      ctx.fillText(`EP ${scene.episode} · PART ${scene.part}`, width / 2, 165);

      if (scene.title) {
        ctx.fillStyle = '#e4e4e7';
        ctx.font = '15px sans-serif';
        ctx.fillText(scene.title.slice(0, 36), width / 2, 215);
      }

      // Characters
      if (assignedCharacters.length > 0) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 15px sans-serif';
        const charNames = assignedCharacters.map((c) => c.name).join(', ');
        ctx.fillText(`Characters: ${charNames}`, width / 2, height / 2 + 10);
      }

      // Camera specs watermark
      ctx.fillStyle = '#71717a';
      ctx.font = '12px ui-monospace, monospace';
      ctx.fillText('ARRI ALEXA 35 · Cooke S4/i Prime', width / 2, height - 90);
      ctx.fillText('9:16 Vertical Portrait · 1080×1920', width / 2, height - 68);

      return { dataUri: canvas.toDataURL('image/png'), mimeType: 'image/png' };
    }
  }

  // Fallback 1x1 png if canvas unavailable
  const fallback = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  return { dataUri: fallback, mimeType: 'image/png' };
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

    let dataUri: string;
    let mimeType = 'image/png';
    let modelUsed: string = settings.provider;
    let costEstimate = 0;

    // 2. Execute generation
    if (settings.provider === 'dryrun') {
      try {
        // Try local server if running
        const res = await fetch(`${backendUrl}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(2500),
        });
        if (res.ok) {
          const data = await res.json();
          dataUri = data.dataUri;
          mimeType = data.mimeType || 'image/png';
          modelUsed = data.modelUsed || 'dryrun';
        } else {
          throw new Error('Server returned error status');
        }
      } catch {
        // Instant direct browser canvas generation (Zero terminal server required for testing!)
        const local = generateBrowserDryRunImage(scene, assignedCharacters);
        dataUri = local.dataUri;
        mimeType = local.mimeType;
        modelUsed = 'local/browser-canvas';
      }
    } else {
      // Fal.ai, Replicate, or OpenAI: Dispatches through local secure backend
      let res: Response;
      try {
        res = await fetch(`${backendUrl}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch {
        throw new Error(
          `Local generation server is offline (${backendUrl}). Please start it in your terminal by running 'npm run server'.`
        );
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(errData.error || `Server generation error (${res.status}): ${res.statusText}`);
      }

      const data = await res.json();
      if (!data.dataUri) {
        throw new Error('Backend did not return image data.');
      }
      dataUri = data.dataUri;
      mimeType = data.mimeType || 'image/png';
      modelUsed = data.modelUsed || settings.provider;
      costEstimate = data.costEstimate || 0;
    }

    // 3. Convert to binary Blob and save to IndexedDB
    const imageBlob = dataUriToBlob(dataUri);
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
      provider: modelUsed,
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
      provider: modelUsed,
      effectivePrompt: payload.prompt,
      characterIdsUsed: scene.selectedCharacterIds,
      costEstimate,
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
