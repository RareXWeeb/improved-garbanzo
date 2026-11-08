import { db } from './db';
import { QueueItem, GenerationAttempt, GenerationResultAsset, LocalReferenceAsset } from '../types/queue';
import { syncBus } from './sync';

/**
 * Extracts a normalized file extension from filename or mime type.
 */
export function getExtensionFromFilenameOrMime(filename: string, mimeType?: string): string {
  const match = filename.match(/\.([a-zA-Z0-9]+)$/);
  if (match) {
    const ext = match[1].toLowerCase();
    if (ext === 'jpeg') return 'jpg';
    return ext;
  }
  if (mimeType) {
    if (mimeType.includes('png')) return 'png';
    if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpg';
    if (mimeType.includes('webp')) return 'webp';
  }
  return 'png';
}

/**
 * Ingests a local reference image and associates it with any scenes that require it.
 */
export async function ingestReferenceAsset(file: File): Promise<LocalReferenceAsset> {
  const filename = file.name;
  const ext = getExtensionFromFilenameOrMime(filename, file.type);
  const id = `ref_${filename.toLowerCase()}`;

  // Find scenes that mention this filename
  const allScenes = await db.scenes.toArray();
  const linkedSceneIds: string[] = [];

  const asset: LocalReferenceAsset = {
    id,
    filename,
    mimeType: file.type || `image/${ext}`,
    extension: ext,
    size: file.size,
    dataBlob: file,
    lastModified: file.lastModified || Date.now(),
    linkedSceneIds,
  };

  // Check matching scenes
  for (const scene of allScenes) {
    let matched = false;
    for (const ref of scene.extractedReferences) {
      if (
        ref.filename.toLowerCase() === filename.toLowerCase() ||
        ref.filename.toLowerCase().replace(/\.[^.]+$/, '') === filename.toLowerCase().replace(/\.[^.]+$/, '')
      ) {
        ref.isMatched = true;
        ref.matchedBlobId = id;
        matched = true;
      }
    }
    if (matched) {
      linkedSceneIds.push(scene.id);
      await db.scenes.put(scene);
    }
  }

  await db.referenceImages.put(asset);
  syncBus.broadcast('REFERENCES_SYNCED', { filename });
  return asset;
}

/**
 * Ingests multiple reference images in bulk.
 */
export async function ingestMultipleReferences(files: FileList | File[]): Promise<number> {
  let count = 0;
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name)) {
      await ingestReferenceAsset(file);
      count++;
    }
  }
  return count;
}

/**
 * Ingests a generated result image saved from ChatGPT into the specified scene.
 * Creates an immutable GenerationAttempt record and updates scene status to 'awaiting_review'.
 */
export async function ingestGenerationResult(
  sceneId: string,
  file: File | Blob,
  fileNameHint?: string,
  userNotes?: string
): Promise<GenerationAttempt> {
  const scene = await db.scenes.get(sceneId);
  if (!scene) {
    throw new Error(`Scene "${sceneId}" not found in database.`);
  }

  const filename = fileNameHint || (file instanceof File ? file.name : `generated_${Date.now()}.png`);
  const ext = getExtensionFromFilenameOrMime(filename, file.type);
  const nextAttemptNum = (scene.attempts?.length || 0) + 1;
  const attemptId = `att_${Date.now()}_sc${scene.scene}_v${nextAttemptNum}`;

  const resultAsset: GenerationResultAsset = {
    id: attemptId,
    sceneId: scene.id,
    attemptNumber: nextAttemptNum,
    timestamp: Date.now(),
    mimeType: file.type || `image/${ext}`,
    extension: ext,
    imageBlob: file,
    userNotes: userNotes || '',
  };

  await db.generationResults.put(resultAsset);

  const attemptRecord: GenerationAttempt = {
    id: attemptId,
    sceneId: scene.id,
    attemptNumber: nextAttemptNum,
    timestamp: resultAsset.timestamp,
    status: 'awaiting_review',
    imageBlobId: attemptId,
    imageMimeType: resultAsset.mimeType,
    imageExtension: ext,
    notes: userNotes,
    promptSnapshot: scene.rawJsonText,
  };

  const updatedAttempts = [...(scene.attempts || []), attemptRecord];

  const updatedScene: QueueItem = {
    ...scene,
    status: 'awaiting_review', // Advanced to awaiting review upon dropping output
    currentAttemptNumber: nextAttemptNum,
    attempts: updatedAttempts,
    updatedAt: Date.now(),
  };

  await db.scenes.put(updatedScene);
  syncBus.broadcast('ATTEMPT_ADDED', { sceneId, attemptId });
  return attemptRecord;
}

/**
 * Loads a blob URL for previewing an image.
 */
export async function getResultBlobUrl(blobId: string): Promise<string | null> {
  const asset = await db.generationResults.get(blobId);
  if (!asset || !asset.imageBlob) return null;
  return URL.createObjectURL(asset.imageBlob);
}

export async function getReferenceBlobUrl(blobId: string): Promise<string | null> {
  const asset = await db.referenceImages.get(blobId);
  if (!asset || !asset.dataBlob) return null;
  return URL.createObjectURL(asset.dataBlob);
}

