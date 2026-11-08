import { ExtractedReference, PromptMetadata, ValidationIssue } from './prompt';

/**
 * Explicit queue statuses.
 * Copying is strictly decoupled from Submission and Approval.
 */
export type QueueStatus =
  | 'queued'                 // Just imported, ready for processing
  | 'copied'                 // JSON copied to clipboard
  | 'submitted'              // Confirmed submitted to ChatGPT
  | 'awaiting_review'        // Result image attached / dropped into scene
  | 'approved'               // Explicitly approved by user
  | 'regeneration_required'; // Flagged for regeneration with feedback notes

export interface GenerationAttempt {
  id: string; // Unique attempt ID: e.g. att_1731040000000_sc68AD_1
  sceneId: string;
  attemptNumber: number; // 1, 2, 3...
  timestamp: number;
  status: 'awaiting_review' | 'approved' | 'rejected';
  imageBlobId?: string; // Pointer to Dexie generationResults entry
  imageMimeType?: string; // image/png, image/jpeg, image/webp
  imageExtension?: string; // 'png', 'jpg', 'webp'
  notes?: string;
  promptSnapshot?: string; // Verbatim prompt used at the time of this attempt
}

export interface QueueItem {
  id: string; // Unique composite key: e.g. Project_Ep01_P01_Sc68AD
  projectTitle: string;
  episode: string;
  part: string;
  scene: string; // Alphanumeric, e.g. "68AD"
  title?: string;
  rawJsonText: string; // Verbatim original JSON text
  metadata: PromptMetadata;
  extractedReferences: ExtractedReference[];
  validationIssues: ValidationIssue[];
  status: QueueStatus;
  currentAttemptNumber: number;
  attempts: GenerationAttempt[];
  createdAt: number;
  updatedAt: number;
  notes?: string;
}

export interface FilterState {
  searchQuery: string;
  statusFilter: 'all' | QueueStatus;
  projectFilter: string;
  episodeFilter: string;
  sortBy: 'scene_asc' | 'scene_desc' | 'status' | 'updated_desc';
}

export interface LocalReferenceAsset {
  id: string; // filename or hash
  filename: string;
  mimeType: string;
  extension: string;
  size: number;
  dataBlob: Blob;
  lastModified: number;
  linkedSceneIds: string[];
}

export interface GenerationResultAsset {
  id: string;
  sceneId: string;
  attemptNumber: number;
  timestamp: number;
  mimeType: string;
  extension: string;
  imageBlob: Blob;
  userNotes?: string;
}

