import JSZip from 'jszip';
import { db } from './db';
import { QueueItem } from '../types/queue';

/**
 * Builds standard cinematic filename preserving alphanumeric scene ID and original format.
 * Format: Project_Ep01_P01_Sc68AD_v1.png
 */
export function buildExportImageFilename(
  project: string,
  episode: string,
  part: string,
  scene: string,
  attemptNumber: number,
  extension: string
): string {
  const p = (project || 'Project').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  const ep = String(episode).padStart(2, '0');
  const pt = String(part).padStart(2, '0');
  const sc = String(scene).trim().replace(/[^a-zA-Z0-9_-]/g, '');
  const ext = (extension || 'png').toLowerCase().replace(/^\./, '');
  return `${p}_Ep${ep}_P${pt}_Sc${sc}_v${attemptNumber}.${ext}`;
}

export interface BatchManifest {
  exportDate: string;
  projectTitle: string;
  totalScenes: number;
  approvedCount: number;
  scenes: Array<{
    id: string;
    scene: string;
    episode: string;
    part: string;
    title?: string;
    status: string;
    totalAttempts: number;
    approvedAttemptNumber?: number;
    exportedFilename?: string;
    promptSnapshot: string;
    metadata: Record<string, any>;
    attempts: Array<{
      attemptNumber: number;
      timestamp: number;
      status: string;
      filename?: string;
      notes?: string;
    }>;
  }>;
}

/**
 * Generates a complete Batch Manifest JSON object.
 */
export async function generateBatchManifest(scenes: QueueItem[]): Promise<BatchManifest> {
  const projectTitle = scenes[0]?.projectTitle || 'SceneForge_Project';
  const approved = scenes.filter((s) => s.status === 'approved');

  const manifestScenes = scenes.map((s) => {
    const approvedAttempt = s.attempts.find((a) => a.status === 'approved') || s.attempts[s.attempts.length - 1];
    const ext = approvedAttempt?.imageExtension || 'png';
    const exportedFilename = approvedAttempt
      ? buildExportImageFilename(s.projectTitle, s.episode, s.part, s.scene, approvedAttempt.attemptNumber, ext)
      : undefined;

    return {
      id: s.id,
      scene: s.scene,
      episode: s.episode,
      part: s.part,
      title: s.title,
      status: s.status,
      totalAttempts: s.attempts.length,
      approvedAttemptNumber: approvedAttempt?.attemptNumber,
      exportedFilename,
      promptSnapshot: s.rawJsonText,
      metadata: s.metadata,
      attempts: s.attempts.map((a) => ({
        attemptNumber: a.attemptNumber,
        timestamp: a.timestamp,
        status: a.status,
        filename: a.imageBlobId
          ? buildExportImageFilename(s.projectTitle, s.episode, s.part, s.scene, a.attemptNumber, a.imageExtension || 'png')
          : undefined,
        notes: a.notes,
      })),
    };
  });

  return {
    exportDate: new Date().toISOString(),
    projectTitle,
    totalScenes: scenes.length,
    approvedCount: approved.length,
    scenes: manifestScenes,
  };
}

/**
 * Bundles the batch manifest and all associated image results into a downloadable ZIP archive.
 */
export async function exportBatchAsZip(
  scenes: QueueItem[],
  options: { onlyApproved: boolean; onProgress?: (pct: number, status: string) => void }
): Promise<Blob> {
  const zip = new JSZip();
  const manifest = await generateBatchManifest(scenes);

  // Add manifest.json at root of ZIP
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));

  let processedCount = 0;
  const targetScenes = options.onlyApproved ? scenes.filter((s) => s.status === 'approved') : scenes;
  const totalItems = targetScenes.reduce((acc, s) => acc + (options.onlyApproved ? 1 : s.attempts.length), 0);

  for (const scene of targetScenes) {
    const attemptsToExport = options.onlyApproved
      ? [scene.attempts.find((a) => a.status === 'approved') || scene.attempts[scene.attempts.length - 1]].filter(Boolean)
      : scene.attempts;

    for (const attempt of attemptsToExport) {
      if (!attempt || !attempt.imageBlobId) continue;

      const resultAsset = await db.generationResults.get(attempt.imageBlobId);
      if (resultAsset && resultAsset.imageBlob) {
        const filename = buildExportImageFilename(
          scene.projectTitle,
          scene.episode,
          scene.part,
          scene.scene,
          attempt.attemptNumber,
          attempt.imageExtension || resultAsset.extension || 'png'
        );

        // Put in organized folder structure: Project/EpXX_PYY/Filename
        const epFolder = `Ep${String(scene.episode).padStart(2, '0')}_P${String(scene.part).padStart(2, '0')}`;
        const folderPath = `${scene.projectTitle}/${epFolder}`;
        zip.folder(folderPath)?.file(filename, resultAsset.imageBlob);
      }

      processedCount++;
      if (options.onProgress) {
        const pct = Math.round((processedCount / (totalItems || 1)) * 90);
        options.onProgress(pct, `Packaging ${scene.scene} (Attempt ${attempt.attemptNumber})...`);
      }
    }
  }

  if (options.onProgress) {
    options.onProgress(95, 'Compressing archive...');
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' }, (metadata) => {
    if (options.onProgress) {
      options.onProgress(90 + Math.round(metadata.percent * 0.1), 'Writing ZIP...');
    }
  });

  return zipBlob;
}

/**
 * Triggers a browser file download for a blob or string.
 */
export function triggerFileDownload(content: Blob | string, filename: string, mimeType = 'application/octet-stream') {
  const blob = typeof content === 'string' ? new Blob([content], { type: mimeType }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Full Database backup to a portable JSON file.
 */
export async function backupDatabaseToJson(): Promise<string> {
  const scenes = await db.scenes.toArray();
  const manifest = await generateBatchManifest(scenes);
  const refs = await db.referenceImages.toArray();

  const backupData = {
    version: '1.0.0',
    exportTimestamp: Date.now(),
    manifest,
    scenes,
    referenceMetadata: refs.map((r) => ({
      id: r.id,
      filename: r.filename,
      mimeType: r.mimeType,
      extension: r.extension,
      size: r.size,
      lastModified: r.lastModified,
      linkedSceneIds: r.linkedSceneIds,
    })),
  };

  return JSON.stringify(backupData, null, 2);
}

/**
 * Restores Database from a JSON backup.
 */
export async function restoreDatabaseFromJson(jsonString: string): Promise<number> {
  const data = JSON.parse(jsonString);
  if (!data || !Array.isArray(data.scenes)) {
    throw new Error('Invalid backup file: scenes array missing.');
  }

  // Restore scenes
  for (const scene of data.scenes) {
    await db.scenes.put(scene);
  }

  return data.scenes.length;
}

