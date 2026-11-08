import { ExtractedReference, PromptMetadata, ValidationIssue } from './prompt';

/**
 * Upgraded generation-centric queue statuses.
 */
export type QueueStatus =
  | 'queued'                 // Initial state upon import
  | 'needs_references'       // Missing character or location references
  | 'ready'                  // Fully configured, ready for generation
  | 'generating'             // Actively generating with provider (concurrency = 1)
  | 'copied'                 // Verbatim prompt copied to clipboard (manual workflow)
  | 'submitted'              // Confirmed submitted to ChatGPT (manual workflow)
  | 'awaiting_review'        // Real generated image received, pending user review
  | 'approved'               // Explicitly approved by user for final export
  | 'regeneration_required'  // Flagged for regeneration with revision notes
  | 'failed'                 // Provider API or network error
  | 'paused'                 // Queue paused
  | 'cancelled';             // Generation cancelled by user

export interface GenerationSettings {
  provider: 'fal' | 'replicate' | 'openai' | 'dryrun';
  modelId?: string;
  aspectRatio: '9:16' | '16:9' | '1:1';
  targetResolution: '1080x1920' | '720x1280' | '1024x1792';
  visualStyle: string;
  cameraReference: string;
  lensReference: string;
  colorGrading: string;
  maxBatchSpendUsd: number;
  mode: 'auto_sequential' | 'review_between_scenes';
  backendUrl: string;
}

export interface ProjectRecord {
  id: string; // e.g., 'proj_ang_pagbabalik_ni_rafael'
  title: string;
  description?: string;
  defaultSettings: GenerationSettings;
  createdAt: number;
  updatedAt: number;
}

export interface CharacterRecord {
  id: string; // Unique character ID, e.g., 'char_rafael'
  projectId: string; // Associated project ID
  name: string; // e.g., 'Rafael'
  aliases: string[]; // e.g., ['Rafael Santos', 'Raffy']
  description?: string;
  portraitBlob: Blob; // Master approved reference portrait
  portraitMimeType: string; // 'image/png', 'image/jpeg', 'image/webp'
  additionalReferenceBlobs?: Blob[]; // Extra wardrobe / alternate angle references
  wardrobe?: string; // Standard costume / wardrobe instructions
  createdAt: number;
  updatedAt: number;
}

export interface GenerationAttempt {
  id: string; // Unique attempt ID: e.g. att_1731040000000_sc68AD_1
  sceneId: string;
  attemptNumber: number; // 1, 2, 3...
  timestamp: number;
  status: 'awaiting_review' | 'approved' | 'rejected' | 'failed';
  imageBlobId?: string; // Pointer to Dexie generationResults entry
  imageMimeType?: string; // image/png, image/jpeg, image/webp
  imageExtension?: string; // 'png', 'jpg', 'webp'
  provider: string; // 'fal-ai/flux-pulid', 'replicate/...', 'dall-e-3'
  effectivePrompt: string; // Natural language prompt synthesized for provider
  characterIdsUsed: string[]; // ['char_rafael', 'char_mariel']
  costEstimate?: number;
  notes?: string;
  error?: string;
  promptSnapshot?: string; // Verbatim prompt used at the time of this attempt
}

export interface QueueItem {
  id: string; // Unique composite key: e.g. Project_Ep01_P01_Sc68AD
  projectId: string;
  projectTitle: string;
  episode: string;
  part: string;
  scene: string; // Alphanumeric, e.g. "68AD", "1A"
  title?: string;
  rawJsonText: string; // 100% immutable verbatim original source JSON
  metadata: PromptMetadata;
  selectedCharacterIds: string[]; // Selected project characters for this scene
  characterMismatchWarning?: string; // Warning if selected count != exact_character_count
  characterMismatchAcknowledged?: boolean; // User confirmed bypass of mismatch
  extractedReferences: ExtractedReference[];
  validationIssues: ValidationIssue[];
  status: QueueStatus;
  currentAttemptNumber: number;
  attempts: GenerationAttempt[];
  createdAt: number;
  updatedAt: number;
  notes?: string;
}

export interface GenerationJob {
  id: string;
  sceneId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  orderIndex: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;
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
  provider?: string;
  promptSnapshot?: string;
}
