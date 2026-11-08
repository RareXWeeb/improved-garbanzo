import { describe, it, expect } from 'vitest';
import { buildExportImageFilename, generateBatchManifest, restoreDatabaseFromJson } from './exporter';
import { QueueItem } from '../types/queue';

describe('exporter service', () => {
  it('formats filenames with exact scene identity, zero padding, and original extension', () => {
    const fn1 = buildExportImageFilename('Bayani Series', '1', '2', '68AD', 1, 'png');
    expect(fn1).toBe('Bayani_Series_Ep01_P02_Sc68AD_v1.png');

    const fn2 = buildExportImageFilename('Bayani Series', '1', '2', '68AD', 2, 'webp');
    expect(fn2).toBe('Bayani_Series_Ep01_P02_Sc68AD_v2.webp');

    const fn3 = buildExportImageFilename('Project', '10', '1', '20B', 3, 'jpeg');
    expect(fn3).toBe('Project_Ep10_P01_Sc20B_v3.jpeg');
  });

  it('generates a comprehensive batch manifest without corrupting metadata', async () => {
    const mockScenes: QueueItem[] = [
      {
        id: 'Proj_Ep01_P01_Sc68AD',
        projectTitle: 'Proj',
        episode: '01',
        part: '01',
        scene: '68AD',
        title: 'Courtyard Confrontation',
        rawJsonText: '{"scene": "68AD"}',
        metadata: { scene: '68AD', aspect_ratio: '9:16' },
        extractedReferences: [],
        validationIssues: [],
        status: 'approved',
        currentAttemptNumber: 2,
        attempts: [
          {
            id: 'att_1',
            sceneId: 'Proj_Ep01_P01_Sc68AD',
            attemptNumber: 1,
            timestamp: 1000,
            status: 'rejected',
            notes: 'Lighting too soft, needs Cooke bokeh contrast',
          },
          {
            id: 'att_2',
            sceneId: 'Proj_Ep01_P01_Sc68AD',
            attemptNumber: 2,
            timestamp: 2000,
            status: 'approved',
            imageBlobId: 'blob_2',
            imageExtension: 'png',
          },
        ],
        createdAt: 1000,
        updatedAt: 2000,
      },
    ];

    const manifest = await generateBatchManifest(mockScenes);

    expect(manifest.totalScenes).toBe(1);
    expect(manifest.approvedCount).toBe(1);
    expect(manifest.scenes[0].scene).toBe('68AD');
    expect(manifest.scenes[0].exportedFilename).toBe('Proj_Ep01_P01_Sc68AD_v2.png');
    expect(manifest.scenes[0].attempts).toHaveLength(2);
    expect(manifest.scenes[0].attempts[0].notes).toBe('Lighting too soft, needs Cooke bokeh contrast');
  });

  it('validates backup JSON structure during restore', async () => {
    // Malformed JSON should throw
    await expect(restoreDatabaseFromJson('{}')).rejects.toThrow('scenes array missing');
    await expect(restoreDatabaseFromJson('invalid-json')).rejects.toThrow();
  });
});

