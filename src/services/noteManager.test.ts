import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  loadNotes,
  saveNotes,
  createNewNote,
  updateNote,
  deleteNote,
  exportNotesBackup,
  importNotesFromJson,
  STORAGE_KEY_PRIMARY,
  STORAGE_KEY_LEGACY,
  DEFAULT_NOTES,
} from './noteManager';
import { computeNoteMetadata } from '../types/note';

class MemoryStorage implements Storage {
  private store: Record<string, string> = {};

  get length(): number {
    return Object.keys(this.store).length;
  }

  clear(): void {
    this.store = {};
  }

  getItem(key: string): string | null {
    return this.store[key] ?? null;
  }

  key(index: number): string | null {
    return Object.keys(this.store)[index] ?? null;
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }
}

describe('PromptPad noteManager', () => {
  let mockStorage: MemoryStorage;

  beforeEach(() => {
    mockStorage = new MemoryStorage();
    vi.stubGlobal('localStorage', mockStorage);
    vi.stubGlobal('window', { localStorage: mockStorage });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads default notes when storage is completely empty', () => {
    const notes = loadNotes();
    expect(notes.length).toBe(DEFAULT_NOTES.length);
    expect(notes[0].title).toBe('ChatGPT Prompts');
    expect(notes[1].title).toBe('Grok Video Prompts');
  });

  it('migrates legacy ChatGPT Quick Copy slots without losing data', () => {
    const legacySlots = [
      { id: 'slot-1', title: 'My Custom Prompt', content: 'Cinematic 9:16 portrait' },
      { id: 'slot-2', title: 'Negative Rules', content: 'Do not distort hands' },
    ];
    mockStorage.setItem(STORAGE_KEY_LEGACY, JSON.stringify(legacySlots));

    const migrated = loadNotes();
    expect(migrated.length).toBe(2);
    expect(migrated[0].title).toBe('My Custom Prompt');
    expect(migrated[0].content).toBe('Cinematic 9:16 portrait');
    expect(migrated[1].title).toBe('Negative Rules');
    expect(migrated[1].content).toBe('Do not distort hands');

    // Verify it saved to primary key
    const primarySaved = JSON.parse(mockStorage.getItem(STORAGE_KEY_PRIMARY)!);
    expect(primarySaved.length).toBe(2);
  });

  it('creates new notes and updates them', () => {
    const initialNotes = loadNotes();
    const { newNote, updatedNotes } = createNewNote(initialNotes, 'Master Video Prompt', 'Dolly shot in 4k');

    expect(newNote.title).toBe('Master Video Prompt');
    expect(newNote.content).toBe('Dolly shot in 4k');
    expect(updatedNotes.length).toBe(initialNotes.length + 1);

    const editedNotes = updateNote(updatedNotes, newNote.id, {
      content: 'Updated dolly shot 60fps',
    });

    const found = editedNotes.find((n) => n.id === newNote.id);
    expect(found?.content).toBe('Updated dolly shot 60fps');
  });

  it('deletes a note and selects a fallback active note', () => {
    const notes = loadNotes();
    const targetId = notes[0].id;
    const { updatedNotes, nextActiveId } = deleteNote(notes, targetId);

    expect(updatedNotes.some((n) => n.id === targetId)).toBe(false);
    expect(nextActiveId).toBe(notes[1].id);
  });

  it('preserves complex JSON formatting, indentation, and special characters verbatim', () => {
    const complexJson = `{\n  "scene": "68AD",\n  "title": "Confrontation & Rain",\n  "aspect_ratio": "9:16",\n  "prompt": "Cinematic shot with special quotes \\"ultra-hd\\" and symbols $100 & accents ñ",\n  "characters_visible": ["Rafael", "Mariel"]\n}`;

    const notes = loadNotes();
    const { newNote, updatedNotes } = createNewNote(notes, 'Complex JSON', complexJson);

    expect(newNote.content).toBe(complexJson);

    // Save and re-read from storage
    saveNotes(updatedNotes);
    const reloaded = loadNotes();
    const found = reloaded.find((n) => n.id === newNote.id);

    expect(found?.content).toBe(complexJson);
    expect(found?.content.includes('  "scene": "68AD"')).toBe(true);
    expect(found?.content.includes('\n')).toBe(true);
  });

  it('calculates character, word, and line count accurately', () => {
    const text = 'Cinematic 9:16 portrait\nSecond line with five words';
    const meta = computeNoteMetadata(text);

    expect(meta.lineCount).toBe(2);
    expect(meta.wordCount).toBe(8);
    expect(meta.charCount).toBe(text.length);
  });

  it('exports and imports notes backup cleanly', () => {
    const sampleNotes = [
      { id: '1', title: 'Prompt A', content: 'Hello World', createdAt: 1000, updatedAt: 2000 },
      { id: '2', title: 'Prompt B', content: 'Foo Bar', createdAt: 3000, updatedAt: 4000 },
    ];

    const jsonStr = exportNotesBackup(sampleNotes);
    expect(jsonStr.includes('SceneForge PromptPad')).toBe(true);
    expect(jsonStr.includes('Prompt A')).toBe(true);

    // Test import
    const importRes = importNotesFromJson(jsonStr);
    expect(importRes.success).toBe(true);
    expect(importRes.notes?.length).toBe(2);
    expect(importRes.notes?.[0].title).toBe('Prompt A');
    expect(importRes.notes?.[1].content).toBe('Foo Bar');
  });
});
