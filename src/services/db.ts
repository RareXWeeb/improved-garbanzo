import Dexie, { Table } from 'dexie';
import { QueueItem, LocalReferenceAsset, GenerationResultAsset } from '../types/queue';

export class SceneForgeDatabase extends Dexie {
  scenes!: Table<QueueItem, string>;
  referenceImages!: Table<LocalReferenceAsset, string>;
  generationResults!: Table<GenerationResultAsset, string>;

  constructor() {
    super('SceneForgeBulkGeneratorDB');
    this.version(1).stores({
      scenes: 'id, projectTitle, episode, part, scene, status, createdAt, updatedAt',
      referenceImages: 'id, filename, extension, lastModified',
      generationResults: 'id, sceneId, attemptNumber, timestamp, mimeType',
    });
  }
}

export const db = new SceneForgeDatabase();

