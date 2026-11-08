export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export interface NoteMetadata {
  charCount: number;
  wordCount: number;
  lineCount: number;
}

export function computeNoteMetadata(content: string): NoteMetadata {
  const charCount = content.length;
  const trimmed = content.trim();
  const wordCount = trimmed ? trimmed.split(/\s+/).length : 0;
  const lineCount = content ? content.split('\n').length : 0;

  return { charCount, wordCount, lineCount };
}
