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
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
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

  // Rename state
  const [isRenaming, setIsRenaming] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');

  // Modals state
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [deleteTargetNote, setDeleteTargetNote] = useState<Note | null>(null);
  const [clearTargetNote, setClearTargetNote] = useState<Note | null>(null);

  const { showToast } = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const activeIndex = Math.max(0, notes.findIndex((n) => n.id === activeNoteId));
  const activeNote = notes[activeIndex] || notes[0];

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

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  const handleSelectNote = (id: string) => {
    setActiveNoteId(id);
    saveActiveNoteId(id);
    setIsRenaming(false);
  };

  const handlePrevNote = () => {
    if (notes.length <= 1) return;
    const prevIndex = (activeIndex - 1 + notes.length) % notes.length;
    handleSelectNote(notes[prevIndex].id);
  };

  const handleNextNote = () => {
    if (notes.length <= 1) return;
    const nextIndex = (activeIndex + 1) % notes.length;
    handleSelectNote(notes[nextIndex].id);
  };

  const handleContentChange = (newContent: string) => {
    if (!activeNote) return;

    setNotes((prev) =>
      prev.map((n) => (n.id === activeNote.id ? { ...n, content: newContent, updatedAt: Date.now() } : n))
    );
    setIsSavedBadgeVisible(false);

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
    setIsRenaming(false);
    showToast(`Created "${newNote.title}"`, 'success');
  };

  const handleStartRename = () => {
    if (!activeNote) return;
    setTitleDraft(activeNote.title);
    setIsRenaming(true);
  };

  const handleSaveRename = () => {
    if (!activeNote) return;
    const trimmed = titleDraft.trim() || 'Untitled Note';
    const updated = updateNote(notes, activeNote.id, { title: trimmed });
    setNotes(updated);
    setIsRenaming(false);
    showToast('Prompt title updated', 'info');
  };

  const handleCopy = async (textToCopy?: string, noteId?: string) => {
    const text = textToCopy ?? activeNote?.content ?? '';
    const targetId = noteId ?? activeNote?.id ?? 'main';

    if (!text.trim()) {
      showToast('Prompt is empty. Nothing to copy.', 'error');
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
    showToast('Cleared prompt text', 'info');
  };

  const handleConfirmDelete = () => {
    if (!deleteTargetNote) return;
    const { updatedNotes, nextActiveId } = deleteNote(notes, deleteTargetNote.id);
    setNotes(updatedNotes);
    setActiveNoteId(nextActiveId);
    setIsRenaming(false);
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
            <span className="text-[10px] text-zinc-500 font-mono">
              ({notes.length})
            </span>
          </div>
        </div>

        {/* Action Icons */}
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCreateNote}
            className="h-7 w-7 p-0 text-zinc-300 hover:text-white"
            title="Create New Prompt"
          >
            <Plus className="w-3.5 h-3.5" />
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

      {/* Row 1: Dropdown Selector with Large Previous & Next Arrow Buttons */}
      <div className="flex items-center gap-1.5 px-3 py-2 bg-zinc-900/90 border-b border-zinc-800 shrink-0">
        {/* Large Previous Button */}
        <button
          type="button"
          onClick={handlePrevNote}
          disabled={notes.length <= 1}
          className="h-9 px-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-650 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-200 hover:text-white border border-zinc-700 transition-colors flex items-center justify-center shrink-0 shadow-sm"
          title="Previous Prompt (<)"
          aria-label="Previous Prompt"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Dropdown Selector */}
        <div className="relative flex-1 min-w-0">
          <select
            value={activeNoteId}
            onChange={(e) => handleSelectNote(e.target.value)}
            className="w-full h-9 appearance-none bg-zinc-950 border border-zinc-700 hover:border-zinc-500 focus:border-zinc-400 rounded-lg pl-3 pr-8 text-xs font-semibold text-zinc-100 outline-none cursor-pointer truncate shadow-inner"
            title="Select Prompt"
          >
            {notes.map((note, index) => (
              <option key={note.id} value={note.id} className="bg-zinc-900 text-zinc-100 py-1 font-sans">
                {index + 1} of {notes.length} · {note.title}
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Large Next Button */}
        <button
          type="button"
          onClick={handleNextNote}
          disabled={notes.length <= 1}
          className="h-9 px-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-650 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-200 hover:text-white border border-zinc-700 transition-colors flex items-center justify-center shrink-0 shadow-sm"
          title="Next Prompt (>)"
          aria-label="Next Prompt"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Inline Title Rename Banner (if renaming active note) */}
      {isRenaming && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-850 border-b border-zinc-750 shrink-0">
          <input
            type="text"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveRename();
              if (e.key === 'Escape') setIsRenaming(false);
            }}
            placeholder="Prompt title..."
            autoFocus
            className="flex-1 bg-zinc-950 border border-zinc-600 px-2 py-1 rounded text-xs text-white font-medium outline-none"
          />
          <Button variant="primary" size="sm" onClick={handleSaveRename} className="h-7 px-2 text-xs">
            Save
          </Button>
          <button
            type="button"
            onClick={() => setIsRenaming(false)}
            className="p-1 rounded text-zinc-400 hover:text-white"
            title="Cancel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Row 2: Persistent Toolbar Immediately Above the Text Editor */}
      <div className="flex items-center justify-between px-3 py-2 bg-zinc-900/60 border-b border-zinc-800 shrink-0">
        {/* Left: Quick Note Controls */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleCreateNote}
            className="h-8 px-2.5 rounded-md bg-zinc-800/80 hover:bg-zinc-750 text-zinc-300 hover:text-white text-xs font-medium border border-zinc-700/60 transition-colors flex items-center gap-1.5"
            title="Create New Note"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">New</span>
          </button>

          <button
            type="button"
            onClick={handleStartRename}
            className="h-8 px-2 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs transition-colors flex items-center gap-1"
            title="Rename this note"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Rename</span>
          </button>

          {notes.length > 1 && (
            <button
              type="button"
              onClick={() => setDeleteTargetNote(activeNote)}
              className="h-8 px-2 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-rose-400 text-xs transition-colors flex items-center gap-1"
              title="Delete this note"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Right: Large, Prominent Copy Button */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => handleCopy()}
            disabled={!activeNote?.content.trim()}
            className={`h-8 px-3.5 sm:px-4 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm ${
              copiedId === activeNote?.id
                ? 'bg-emerald-650 hover:bg-emerald-600 text-white'
                : 'bg-zinc-100 hover:bg-white text-zinc-950 active:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed'
            }`}
            title="Copy entire prompt to clipboard"
          >
            {copiedId === activeNote?.id ? (
              <>
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

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

      {/* Bottom Status / Utility Bar */}
      <footer className="border-t border-zinc-800 bg-zinc-900/90 px-3 py-2 flex items-center justify-between gap-2 shrink-0">
        {/* Left: Counters and Autosave Status */}
        <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-400 min-w-0 truncate">
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

        {/* Right: Paste & Clear Utilities */}
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePasteClipboard}
            className="h-7 px-2 text-xs text-zinc-300 hover:text-white"
            title="Paste text from clipboard"
          >
            <Clipboard className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Paste</span>
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
              <span className="hidden xs:inline">Clear</span>
            </Button>
          )}
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
