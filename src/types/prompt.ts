/**
 * Image Prompt JSON Schema & Metadata Interfaces
 * Supports user's flexible structure while preserving raw original JSON text verbatim.
 */

export interface ReferenceImageItem {
  filename: string;
  type?: 'character' | 'location' | 'prop' | 'style' | 'unknown';
  description?: string;
  character_name?: string;
}

export interface PromptMetadata {
  project_title?: string;
  image_number?: number | string;
  episode?: number | string;
  part?: number | string;
  scene?: string | number; // Alphanumeric support: e.g. "68A", "68AD", "20B"
  title?: string;
  duration_seconds?: number | string;
  aspect_ratio?: string;
  resolution?: string;
  production?: string | Record<string, any>;
  camera_setup?: string | Record<string, any>;
  location?: string | Record<string, any>;
  exact_character_count?: number | string;
  characters_visible?: string[] | any[];
  reference_images?: string[] | ReferenceImageItem[] | Record<string, any>;
  prompt?: string;
  prompt_text?: string;
  description?: string;
  lighting?: string;
  notes?: string;
  // Allow any other creative or project-specific fields
  [key: string]: any;
}

export interface ExtractedReference {
  filename: string;
  category: 'character' | 'location' | 'other';
  label: string;
  isMatched: boolean;
  matchedBlobId?: string;
}

export interface ValidationIssue {
  type: 'error' | 'warning' | 'info';
  field?: string;
  message: string;
}

export interface ParsedScenePrompt {
  id: string; // Unique composite key: e.g., Project_Ep01_P01_Sc68AD
  rawJsonText: string; // Exact immutable verbatim source JSON
  metadata: PromptMetadata;
  extractedReferences: ExtractedReference[];
  validationIssues: ValidationIssue[];
}

