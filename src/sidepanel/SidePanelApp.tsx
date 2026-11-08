import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Copy,
  Check,
  Plus,
  Trash2,
  Download,
  Maximize2,
  Clipboard,
  RotateCcw,
  Edit2,
  FileText,
} from 'lucide-react';
import { Note, computeNoteMetadata } from '../types/note';
import {
  loadNotes,
  loadActiveNoteId,
  saveActiveNoteId,
  createNewNote,
  updateNote,
  deleteNote,
  copyTextVerbatim,
  readTextFromClipboard,
  subscribeToSync,
} from '../services/noteManager';
import { Button } from '../components/common/Button';
import { useToast } from '../components/common/Toast';
import { BackupModal } from '../components/promptpad/BackupModal';
import { ConfirmDeleteModal } from '../components/promptpad/ConfirmDeleteModal';
import { ConfirmClearModal } from '../components/promptpad/ConfirmClearModal';

export const SidePanelApp: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>(() => loadNotes());
  const [activeNoteId, setActiveNoteId] = useState<string>(() => loadActiveNoteId(notes));
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isSavedBadgeVisible, setIsSavedBadgeVisible] = useState(true);

  // Inline rename state
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [tempTitle, setTempTitle] = useState('');

  // Modals state
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [deleteTargetNote, setDeleteTargetNote] = useState<Note | null>(null);
  const [clearTargetNote, setClearTargetNote] = useState<Note | null>(null);

  const { showToast } = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const activeNote = notes.find((n) => n.id === activeNoteId) || notes[0];

  // Refresh from storage (e.g. when synced from dashboard tab)
  const refreshFromStorage = useCallback(() => {
    const updatedList = loadNotes();
    setNotes(updatedList);
    const updatedActiveId = loadActiveNoteId(updatedList);
    setActiveNoteId(updatedActiveId);
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToSync(refreshFromStorage);
    return () => unsubscribe();
  }, [refreshFromStorage]);

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  const handleSelectNote = (id: string) => {
    setActiveNoteId(id);
    saveActiveNoteId(id);
  };

  const handleContentChange = (newContent: string) => {
    if (!activeNote) return;

    // Immediate local state update for zero lag
    setNotes((prev) =>
      prev.map((n) => (n.id === activeNote.id ? { ...n, content: newContent, updatedAt: Date.now() } : n))
    );
    setIsSavedBadgeVisible(false);

    // Debounced persistence to avoid thrashing disk
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      updateNote(notes, activeNote.id, { content: newContent });
      setIsSavedBadgeVisible(true);
    }, 150);
  };

  const handleBlurTextarea = () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    if (activeNote) {
      updateNote(notes, activeNote.id, { content: activeNote.content });
      setIsSavedBadgeVisible(true);
    }
  };

  const handleCreateNote = () => {
    const { newNote, updatedNotes } = createNewNote(notes);
    setNotes(updatedNotes);
    setActiveNoteId(newNote.id);
    showToast(`Created "${newNote.title}"`, 'success');
  };

  const handleStartRename = (note: Note, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingTitleId(note.id);
    setTempTitle(note.title);
  };

  const handleSaveRename = () => {
    if (!editingTitleId) return;
    const trimmed = tempTitle.trim() || 'Untitled Note';
    const updated = updateNote(notes, editingTitleId, { title: trimmed });
    setNotes(updated);
    setEditingTitleId(null);
  };

  const handleCopy = async (textToCopy?: string, noteId?: string) => {
    const text = textToCopy ?? activeNote?.content ?? '';
    const targetId = noteId ?? activeNote?.id ?? 'main';

    if (!text.trim()) {
      showToast('Note is empty. Nothing to copy.', 'error');
      return;
    }

    const ok = await copyTextVerbatim(text);
    if (ok) {
      setCopiedId(targetId);
      showToast('Copied to clipboard!', 'success');
      setTimeout(() => {
        setCopiedId((curr) => (curr === targetId ? null : curr));
      }, 2000);
    } else {
      showToast('Failed to copy to clipboard', 'error');
    }
  };

  const handlePasteClipboard = async () => {
    const text = await readTextFromClipboard();
    if (text) {
      const merged = activeNote.content ? `${activeNote.content}\n${text}` : text;
      handleContentChange(merged);
      showToast('Pasted from clipboard', 'info');
    } else {
      showToast('Could not read clipboard. Please paste with Ctrl+V', 'error');
    }
  };

  const handleConfirmClear = () => {
    if (!activeNote) return;
    const updated = updateNote(notes, activeNote.id, { content: '' });
    setNotes(updated);
    showToast('Cleared note text', 'info');
  };

  const handleConfirmDelete = () => {
    if (!deleteTargetNote) return;
    const { updatedNotes, nextActiveId } = deleteNote(notes, deleteTargetNote.id);
    setNotes(updatedNotes);
    setActiveNoteId(nextActiveId);
    showToast(`Deleted "${deleteTargetNote.title}"`, 'info');
  };

  const handleOpenDashboard = () => {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
    } else {
      window.open('dashboard.html', '_blank');
    }
  };

  const metadata = computeNoteMetadata(activeNote?.content || '');

  return (
    <div className="flex flex-col h-screen w-full bg-zinc-950 text-zinc-100 font-sans antialiased overflow-hidden select-none">
      {/* Top Header */}
      <header className="flex items-center justify-between px-3 py-2 bg-zinc-900 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <img src="/logo.png" alt="SceneForge" className="h-5 w-auto object-contain shrink-0" />
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-xs tracking-tight text-white">PromptPad</span>
            <span className="text-[10px] text-zinc-500 font-mono hidden xs:inline">
              ({notes.length})
            </span>
          </div>
        </div>

        {/* Header Action Icons */}
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCreateNote}
            className="h-7 px-2 text-xs text-zinc-300 hover:text-white gap-1"
            title="Create New Note"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Note</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowBackupModal(true)}
            className="h-7 w-7 p-0 text-zinc-400 hover:text-white"
            title="Backup & Restore Notes"
          >
            <Download className="w-3.5 h-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleOpenDashboard}
            className="h-7 w-7 p-0 text-zinc-400 hover:text-white"
            title="Open Full Dashboard Tab"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </header>

      {/* Note Tabs Strip */}
      <nav aria-label="Notes tabs" className="flex items-center gap-1 px-2.5 py-1.5 border-b border-zinc-800/80 bg-zinc-900/60 overflow-x-auto no-scrollbar shrink-0">
        {notes.map((note) => {
          const isActive = note.id === activeNoteId;
          const isCopied = copiedId === note.id;

          return (
            <div
              key={note.id}
              onClick={() => handleSelectNote(note.id)}
              className={`group flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs cursor-pointer select-none transition-all border shrink-0 ${
                isActive
                  ? 'bg-zinc-800 border-zinc-700 text-white font-medium shadow-sm'
                  : 'bg-zinc-900/90 border-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
              }`}
            >
              <FileText className="w-3 h-3 text-zinc-500 shrink-0" />

              {editingTitleId === note.id ? (
                <input
                  type="text"
                  value={tempTitle}
                  onChange={(e) => setTempTitle(e.target.value)}
                  onBlur={handleSaveRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveRename();
                    if (e.key === 'Escape') setEditingTitleId(null);
                  }}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                  className="bg-zinc-950 border border-zinc-600 px-1 py-0.5 rounded text-xs text-white outline-none w-28"
                />
              ) : (
                <span
                  onDoubleClick={(e) => handleStartRename(note, e)}
                  title="Double-click to rename"
                  className="truncate max-w-[120px]"
                >
                  {note.title}
                </span>
              )}

              {/* Quick actions on tab */}
              {note.content.trim() && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopy(note.content, note.id);
                  }}
                  className="opacity-50 hover:opacity-100 p-0.5 rounded hover:bg-zinc-750 transition-opacity"
                  title="Copy this note"
                >
                  {isCopied ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={(e) => handleStartRename(note, e)}
                className="opacity-0 group-hover:opacity-60 hover:!opacity-100 p-0.5 rounded hover:text-zinc-200 transition-opacity"
                title="Rename note"
              >
                <Edit2 className="w-2.5 h-2.5" />
              </button>

              {notes.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTargetNote(note);
                  }}
                  className="opacity-0 group-hover:opacity-60 hover:!opacity-100 p-0.5 rounded hover:text-rose-400 transition-opacity"
                  title="Delete note"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          );
        })}

        <button
          type="button"
          onClick={handleCreateNote}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors shrink-0"
          title="Add another note"
        >
          <Plus className="w-3 h-3" />
          <span>New Note</span>
        </button>
      </nav>

      {/* Main Text Editor Canvas */}
      <main className="flex-1 flex flex-col min-h-0 bg-zinc-950 p-2 sm:p-3">
        <textarea
          ref={textareaRef}
          value={activeNote?.content || ''}
          onChange={(e) => handleContentChange(e.target.value)}
          onBlur={handleBlurTextarea}
          placeholder="Paste or type your ChatGPT prompts, Grok video instructions, master prompts, or JSON here... Saved automatically."
          spellCheck={false}
          className="w-full h-full flex-1 bg-zinc-900/60 border border-zinc-800 rounded-lg p-3 sm:p-4 text-xs sm:text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 font-mono leading-relaxed resize-none overflow-y-auto selection:bg-zinc-700 selection:text-white"
        />
      </main>

      {/* Bottom Controls / Status Bar */}
      <footer className="border-t border-zinc-800 bg-zinc-900/90 px-3 py-2 flex items-center justify-between gap-2 shrink-0">
        {/* Left: Counters and Autosave Status */}
        <div className="flex items-center gap-2.5 text-[11px] font-mono text-zinc-400">
          <span>{metadata.charCount} chars · {metadata.wordCount} words</span>
          <span className="hidden xs:inline text-zinc-600">|</span>
          <span className="hidden xs:flex items-center gap-1 text-zinc-400">
            {isSavedBadgeVisible ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span>Saved</span>
              </>
            ) : (
              <span>Saving...</span>
            )}
          </span>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePasteClipboard}
            className="h-7 px-2 text-xs text-zinc-300 hover:text-white"
            title="Paste text from clipboard"
          >
            <Clipboard className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Paste</span>
          </Button>

          {activeNote?.content && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setClearTargetNote(activeNote)}
              className="h-7 px-2 text-xs text-zinc-400 hover:text-rose-400"
              title="Clear this note"
            >
              <RotateCcw className="w-3 h-3" />
              <span className="hidden sm:inline">Clear</span>
            </Button>
          )}

          {/* Primary Copy Button */}
          <Button
            variant={copiedId === activeNote?.id ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => handleCopy()}
            disabled={!activeNote?.content.trim()}
            icon={
              copiedId === activeNote?.id ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )
            }
            className={`h-7 px-3 text-xs font-semibold transition-colors ${
              copiedId === activeNote?.id
                ? 'bg-emerald-950 border border-emerald-700 text-emerald-300'
                : 'bg-zinc-800 hover:bg-zinc-700 text-white'
            }`}
          >
            <span>{copiedId === activeNote?.id ? 'Copied!' : 'Copy'}</span>
          </Button>
        </div>
      </footer>

      {/* Modals */}
      <BackupModal
        isOpen={showBackupModal}
        onClose={() => setShowBackupModal(false)}
        notes={notes}
        onNotesImported={(imported) => {
          setNotes(imported);
          if (imported[0]) setActiveNoteId(imported[0].id);
        }}
      />

      <ConfirmDeleteModal
        isOpen={!!deleteTargetNote}
        onClose={() => setDeleteTargetNote(null)}
        onConfirm={handleConfirmDelete}
        noteTitle={deleteTargetNote?.title || ''}
      />

      <ConfirmClearModal
        isOpen={!!clearTargetNote}
        onClose={() => setClearTargetNote(null)}
        onConfirm={handleConfirmClear}
        noteTitle={clearTargetNote?.title || ''}
      />
    </div>
  );
};
