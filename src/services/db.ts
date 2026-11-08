import Dexie, { Table } from 'dexie';
import {
  QueueItem,
  LocalReferenceAsset,
  GenerationResultAsset,
  ProjectRecord,
  CharacterRecord,
  GenerationJob,
  GenerationSettings,
} from '../types/queue';

export const DEFAULT_GENERATION_SETTINGS: GenerationSettings = {
  provider: 'dryrun',
  modelId: 'fal-ai/flux-pulid',
  aspectRatio: '9:16',
  targetResolution: '1080x1920',
  visualStyle: 'Ultra-photorealistic, premium cinematic Filipino live-action drama',
  cameraReference: 'ARRI ALEXA 35',
  lensReference: 'Cooke S4/i lenses, 35mm & 50mm primes',
  colorGrading: 'Filmic warm-neutral cinematic color grade with rich shadow detail',
  maxBatchSpendUsd: 5.0,
  mode: 'auto_sequential',
  backendUrl: 'http://localhost:3001',
};

export class SceneForgeDatabase extends Dexie {
  scenes!: Table<QueueItem, string>;
  referenceImages!: Table<LocalReferenceAsset, string>;
  generationResults!: Table<GenerationResultAsset, string>;
  projects!: Table<ProjectRecord, string>;
  characters!: Table<CharacterRecord, string>;
  generationJobs!: Table<GenerationJob, string>;

  constructor() {
    super('SceneForgeBulkGeneratorDB');

    // Version 1 (Preserved for safe schema migration)
    this.version(1).stores({
      scenes: 'id, projectTitle, episode, part, scene, status, createdAt, updatedAt',
      referenceImages: 'id, filename, extension, lastModified',
      generationResults: 'id, sceneId, attemptNumber, timestamp, mimeType',
    });

    // Version 2 (Full Real AI Generation Engine Schema)
    this.version(2)
      .stores({
        scenes: 'id, projectId, projectTitle, episode, part, scene, status, createdAt, updatedAt',
        referenceImages: 'id, filename, extension, lastModified',
        generationResults: 'id, sceneId, attemptNumber, timestamp, mimeType, provider',
        projects: 'id, title, createdAt, updatedAt',
        characters: 'id, projectId, name, createdAt, updatedAt',
        generationJobs: 'id, sceneId, status, orderIndex, createdAt',
      })
      .upgrade(async (tx) => {
        // Safe migration for historical scene records
        const defaultProjectId = 'proj_default';
        await tx.table('scenes').toCollection().modify((scene: any) => {
          if (!scene.projectId) {
            scene.projectId = defaultProjectId;
          }
          if (!scene.selectedCharacterIds) {
            scene.selectedCharacterIds = [];
          }
          // Migrate old clipboard statuses to real generation statuses
          if (scene.status === 'copied' || scene.status === 'submitted') {
            scene.status = 'ready';
          }
        });

        // Ensure default project exists
        const projectsTable = tx.table('projects');
        const count = await projectsTable.count();
        if (count === 0) {
          await projectsTable.add({
            id: defaultProjectId,
            title: 'Ang Pagbabalik ni Rafael',
            description: 'Cinematic Filipino Drama Series',
            defaultSettings: DEFAULT_GENERATION_SETTINGS,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
        }
      });
  }
}

export const db = new SceneForgeDatabase();
