import { Note } from '../types/note';

export const STORAGE_KEY_PRIMARY = 'sceneforge_promptpad_notes';
export const STORAGE_KEY_LEGACY = 'sceneforge_chatgpt_snippets';
export const ACTIVE_NOTE_KEY = 'sceneforge_active_note_id';
export const SYNC_CHANNEL_NAME = 'sceneforge_promptpad_sync';

export const DEFAULT_NOTES: Note[] = [
  {
    id: 'note-chatgpt',
    title: 'ChatGPT Prompts',
    content: `You are an expert cinematic prompt engineer and visual screenwriter.
Follow these master production rules:
- Aspect Ratio: 9:16 vertical portrait
- Style: Photorealistic cinematic photography, 35mm film grain, volumetric lighting
- Preserve character facial identity, proportions, and wardrobe continuity across scenes.`,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  },
  {
    id: 'note-grok',
    title: 'Grok Video Prompts',
    content: `Cinematic slow-motion tracking shot, smooth dolly push-in, photorealistic 4k resolution, volumetric atmospheric smoke, dramatic rim lighting, Sony FX9 cinema look, 60fps.`,
    createdAt: 1700000001000,
    updatedAt: 1700000001000,
  },
  {
    id: 'note-json',
    title: 'Image JSON',
    content: `{
  "scene": "01",
  "title": "Confrontation in Courtyard",
  "aspect_ratio": "9:16",
  "prompt": "Cinematic vertical portrait shot of protagonist in heavy rain...",
  "characters_visible": ["Rafael"]
}`,
    createdAt: 1700000002000,
    updatedAt: 1700000002000,
  },
  {
    id: 'note-master',
    title: 'Master Prompt',
    content: `Master Production Guidelines:
1. Character Facial Consistency: Never alter jawline, eye color, or key facial features between generations.
2. Lighting Continuity: Maintain warm golden-hour rim lighting with moody shadows.
3. Color Grade: Moody teal and amber cinematic grade, balanced contrast.`,
    createdAt: 1700000003000,
    updatedAt: 1700000003000,
  },
];

let broadcastChannel: BroadcastChannel | null = null;
try {
  if (typeof BroadcastChannel !== 'undefined') {
    broadcastChannel = new BroadcastChannel(SYNC_CHANNEL_NAME);
  }
} catch {
  // BroadcastChannel might be disabled in some test environments
  broadcastChannel = null;
}

function getStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    if (typeof localStorage !== 'undefined') {
      return localStorage;
    }
  } catch {
    // Storage might be restricted
  }
  return null;
}

/**
 * Load all notes with automated migration from legacy ChatGPT Quick Copy slots.
 */
export function loadNotes(): Note[] {
  const storage = getStorage();
  try {
    // 1. Try reading primary storage
    const primaryRaw = storage?.getItem(STORAGE_KEY_PRIMARY);
    if (primaryRaw) {
      const parsed = JSON.parse(primaryRaw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(sanitizeNote);
      }
    }

    // 2. Try migrating from legacy Quick Copy storage if primary doesn't exist
    const legacyRaw = storage?.getItem(STORAGE_KEY_LEGACY);
    if (legacyRaw) {
      const legacyParsed = JSON.parse(legacyRaw);
      if (Array.isArray(legacyParsed) && legacyParsed.length > 0) {
        const migrated: Note[] = legacyParsed.map((item, index) => ({
          id: item.id || `migrated-slot-${index + 1}`,
          title: item.title || `Note ${index + 1}`,
          content: item.content || '',
          createdAt: Date.now() - (legacyParsed.length - index) * 1000,
          updatedAt: Date.now(),
        }));

        // Persist migrated notes
        saveNotes(migrated, false);
        return migrated;
      }
    }
  } catch (err) {
    console.warn('Failed to load notes from storage, falling back to defaults', err);
  }

  // 3. Fallback to default notes
  return DEFAULT_NOTES;
}

/**
 * Persist notes to storage and broadcast to all open windows/tabs.
 */
export function saveNotes(notes: Note[], broadcast = true): void {
  const storage = getStorage();
  try {
    const serialized = JSON.stringify(notes);
    storage?.setItem(STORAGE_KEY_PRIMARY, serialized);

    // Keep legacy key in sync for backward compatibility
    const legacyFormat = notes.map((n) => ({
      id: n.id,
      title: n.title,
      content: n.content,
    }));
    storage?.setItem(STORAGE_KEY_LEGACY, JSON.stringify(legacyFormat));

    if (broadcast && broadcastChannel) {
      broadcastChannel.postMessage({
        type: 'NOTES_UPDATED',
        timestamp: Date.now(),
      });
    }
  } catch (err) {
    console.error('Failed to save notes to localStorage', err);
  }
}

/**
 * Load the last active note ID from storage.
 */
export function loadActiveNoteId(availableNotes: Note[]): string {
  const storage = getStorage();
  try {
    const savedId = storage?.getItem(ACTIVE_NOTE_KEY);
    if (savedId && availableNotes.some((n) => n.id === savedId)) {
      return savedId;
    }
  } catch {
    // ignore
  }
  return availableNotes[0]?.id || DEFAULT_NOTES[0].id;
}

/**
 * Persist the active note ID.
 */
export function saveActiveNoteId(id: string, broadcast = true): void {
  const storage = getStorage();
  try {
    storage?.setItem(ACTIVE_NOTE_KEY, id);
    if (broadcast && broadcastChannel) {
      broadcastChannel.postMessage({
        type: 'ACTIVE_NOTE_CHANGED',
        activeId: id,
        timestamp: Date.now(),
      });
    }
  } catch {
    // ignore
  }
}

/**
 * Create a new note with a unique ID and optional default title/content.
 */
export function createNewNote(existingNotes: Note[], title?: string, content = ''): { newNote: Note; updatedNotes: Note[] } {
  const count = existingNotes.length + 1;
  const newNote: Note = {
    id: `note-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    title: title?.trim() || `New Note ${count}`,
    content,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const updatedNotes = [...existingNotes, newNote];
  saveNotes(updatedNotes);
  saveActiveNoteId(newNote.id);

  return { newNote, updatedNotes };
}

/**
 * Update an existing note by ID.
 */
export function updateNote(
  existingNotes: Note[],
  id: string,
  updates: Partial<Pick<Note, 'title' | 'content'>>
): Note[] {
  const updatedNotes = existingNotes.map((note) => {
    if (note.id === id) {
      return {
        ...note,
        ...updates,
        updatedAt: Date.now(),
      };
    }
    return note;
  });

  saveNotes(updatedNotes);
  return updatedNotes;
}

/**
 * Delete a note by ID.
 */
export function deleteNote(existingNotes: Note[], id: string): { updatedNotes: Note[]; nextActiveId: string } {
  if (existingNotes.length <= 1) {
    // If only one note exists, clear its content rather than deleting it
    const cleared = existingNotes.map((n) =>
      n.id === id ? { ...n, content: '', updatedAt: Date.now() } : n
    );
    saveNotes(cleared);
    return { updatedNotes: cleared, nextActiveId: id };
  }

  const remaining = existingNotes.filter((n) => n.id !== id);
  const nextActive = remaining[0]?.id || '';

  saveNotes(remaining);
  saveActiveNoteId(nextActive);

  return { updatedNotes: remaining, nextActiveId: nextActive };
}

/**
 * Copy text verbatim to clipboard.
 */
export async function copyTextVerbatim(text: string): Promise<boolean> {
  if (!text) return false;

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.warn('navigator.clipboard.writeText failed, trying textarea fallback', err);
  }

  try {
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(el);
    return successful;
  } catch (fallbackErr) {
    console.error('Copy fallback failed', fallbackErr);
    return false;
  }
}

/**
 * Read text from clipboard.
 */
export async function readTextFromClipboard(): Promise<string | null> {
  try {
    if (navigator.clipboard && navigator.clipboard.readText) {
      return await navigator.clipboard.readText();
    }
  } catch (err) {
    console.warn('Could not read clipboard', err);
  }
  return null;
}

/**
 * Export notes as a backup JSON string.
 */
export function exportNotesBackup(notes: Note[]): string {
  const payload = {
    app: 'SceneForge PromptPad',
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    notesCount: notes.length,
    notes,
  };
  return JSON.stringify(payload, null, 2);
}

/**
 * Trigger browser file download for backup.
 */
export function triggerBackupDownload(notes: Note[]): void {
  const jsonStr = exportNotesBackup(notes);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `PromptPad_Backup_${dateStr}.json`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Import notes from a backup JSON string.
 */
export function importNotesFromJson(jsonStr: string): { success: boolean; notes?: Note[]; message: string } {
  try {
    const data = JSON.parse(jsonStr);
    let importedList: any[] = [];

    if (Array.isArray(data)) {
      importedList = data;
    } else if (data && Array.isArray(data.notes)) {
      importedList = data.notes;
    } else {
      return { success: false, message: 'Invalid backup format: missing notes array.' };
    }

    if (importedList.length === 0) {
      return { success: false, message: 'Backup file contains no notes.' };
    }

    const sanitizedNotes: Note[] = importedList.map((item, idx) => ({
      id: item.id || `imported-${Date.now()}-${idx}`,
      title: (item.title || `Imported Note ${idx + 1}`).trim(),
      content: typeof item.content === 'string' ? item.content : String(item.content || ''),
      createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now(),
      updatedAt: typeof item.updatedAt === 'number' ? item.updatedAt : Date.now(),
    }));

    saveNotes(sanitizedNotes);
    if (sanitizedNotes[0]) {
      saveActiveNoteId(sanitizedNotes[0].id);
    }

    return {
      success: true,
      notes: sanitizedNotes,
      message: `Successfully imported ${sanitizedNotes.length} notes!`,
    };
  } catch (err: any) {
    return { success: false, message: `Failed to parse backup JSON: ${err.message || 'Syntax error'}` };
  }
}

/**
 * Subscribe to sync events from other windows (side panel <-> dashboard).
 */
export function subscribeToSync(onSync: () => void): () => void {
  const handleStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY_PRIMARY || e.key === ACTIVE_NOTE_KEY) {
      onSync();
    }
  };

  const handleBroadcast = (e: MessageEvent) => {
    if (e.data?.type === 'NOTES_UPDATED' || e.data?.type === 'ACTIVE_NOTE_CHANGED') {
      onSync();
    }
  };

  window.addEventListener('storage', handleStorage);
  if (broadcastChannel) {
    broadcastChannel.addEventListener('message', handleBroadcast);
  }

  return () => {
    window.removeEventListener('storage', handleStorage);
    if (broadcastChannel) {
      broadcastChannel.removeEventListener('message', handleBroadcast);
    }
  };
}

function sanitizeNote(item: any): Note {
  return {
    id: String(item.id || `note-${Date.now()}`),
    title: String(item.title || 'Untitled Note'),
    content: typeof item.content === 'string' ? item.content : String(item.content || ''),
    createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now(),
    updatedAt: typeof item.updatedAt === 'number' ? item.updatedAt : Date.now(),
  };
}
