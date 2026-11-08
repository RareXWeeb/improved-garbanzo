import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Copy,
  Check,
  Plus,
  Trash2,
  Download,
  Clipboard,
  RotateCcw,
  Search,
  Menu,
  X,
  Edit3,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
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

export const DashboardApp: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>(() => loadNotes());
  const [activeNoteId, setActiveNoteId] = useState<string>(() => loadActiveNoteId(notes));
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isSavedBadgeVisible, setIsSavedBadgeVisible] = useState(true);

  // Search & Navigation
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Rename state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
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

  // Sync with Side Panel and other tabs
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
    setIsEditingTitle(false);
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
    setIsEditingTitle(false);
    showToast(`Created "${newNote.title}"`, 'success');
  };

  const handleStartRename = () => {
    if (!activeNote) return;
    setTitleDraft(activeNote.title);
    setIsEditingTitle(true);
  };

  const handleSaveRename = () => {
    if (!activeNote) return;
    const trimmed = titleDraft.trim() || 'Untitled Note';
    const updated = updateNote(notes, activeNote.id, { title: trimmed });
    setNotes(updated);
    setIsEditingTitle(false);
    showToast('Prompt title updated', 'info');
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

  // Filter notes by search query
  const filteredNotes = notes.filter((n) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q);
  });

  const metadata = computeNoteMetadata(activeNote?.content || '');

  return (
    <div className="flex flex-col h-screen w-full bg-zinc-950 text-zinc-100 font-sans antialiased overflow-hidden">
      {/* Dashboard Top Header */}
      <header className="flex items-center justify-between px-4 py-2.5 bg-zinc-900 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-1.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            title="Toggle Notes Sidebar"
          >
            {isSidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>

          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="SceneForge PromptPad" className="h-6 w-auto object-contain" />
            <span className="font-semibold text-sm tracking-tight text-white hidden sm:inline">
              PromptPad
            </span>
          </div>

          <span className="hidden md:inline-block text-xs font-mono text-zinc-500 border-l border-zinc-800 pl-3">
            {notes.length} note{notes.length === 1 ? '' : 's'} saved
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={handleCreateNote}
            icon={<Plus className="w-3.5 h-3.5" />}
          >
            <span>New Note</span>
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowBackupModal(true)}
            icon={<Download className="w-3.5 h-3.5" />}
          >
            <span className="hidden sm:inline">Backup / Restore</span>
          </Button>
        </div>
      </header>

      {/* Main Dual-Pane Body */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Notes Sidebar */}
        <aside
          className={`
            fixed inset-y-0 left-0 z-30 w-72 sm:w-80 bg-zinc-900 border-r border-zinc-800 flex flex-col transition-all duration-200 ease-in-out
            md:static md:translate-x-0
            ${isSidebarOpen ? 'translate-x-0 top-[49px]' : '-translate-x-full md:hidden'}
          `}
        >
          {/* Search Box */}
          <div className="p-2.5 border-b border-zinc-800">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search notes..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-md pl-8 pr-2.5 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-700"
              />
            </div>
          </div>

          {/* Notes List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredNotes.map((note, index) => {
              const isActive = note.id === activeNoteId;
              const isCopied = copiedId === note.id;
              const noteMeta = computeNoteMetadata(note.content);

              return (
                <div
                  key={note.id}
                  onClick={() => handleSelectNote(note.id)}
                  className={`group relative flex flex-col p-2.5 rounded-lg cursor-pointer transition-all border ${
                    isActive
                      ? 'bg-zinc-800/90 border-zinc-700 text-white shadow-sm'
                      : 'bg-zinc-950/40 border-zinc-850 text-zinc-300 hover:bg-zinc-800/40 hover:border-zinc-750'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-xs truncate max-w-[180px]">
                      {index + 1}. {note.title}
                    </span>

                    {/* Action buttons on hover */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {note.content.trim() && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopy(note.content, note.id);
                          }}
                          className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
                          title="Quick Copy"
                        >
                          {isCopied ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      )}

                      {notes.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTargetNote(note);
                          }}
                          className="p-1 rounded text-zinc-400 hover:text-rose-400 hover:bg-zinc-700 transition-colors"
                          title="Delete note"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Note Preview */}
                  <p className="text-[11px] text-zinc-500 truncate mt-1 font-mono">
                    {note.content.trim() ? note.content.slice(0, 60) : '(Empty note)'}
                  </p>

                  <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono mt-2">
                    <span>{noteMeta.wordCount} words</span>
                    <span>{noteMeta.charCount} chars</span>
                  </div>
                </div>
              );
            })}

            {filteredNotes.length === 0 && (
              <div className="text-center py-8 text-xs text-zinc-500">
                No matching notes found.
              </div>
            )}
          </div>

          {/* Sidebar Footer */}
          <div className="p-2 border-t border-zinc-800 flex justify-between items-center text-[11px] text-zinc-500 font-mono px-3">
            <span>{notes.length} total notes</span>
            <button
              onClick={handleCreateNote}
              className="text-zinc-400 hover:text-white flex items-center gap-1 transition-colors"
            >
              <Plus className="w-3 h-3" />
              <span>New</span>
            </button>
          </div>
        </aside>

        {/* Right Main Note Editor */}
        <main className="flex-1 flex flex-col min-w-0 bg-zinc-950 overflow-hidden">
          {/* Note Navigation & Action Bar Immediately Above the Text Editor */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-2.5 border-b border-zinc-800/80 bg-zinc-900/60 shrink-0">
            {/* Left: Previous / Next + Dropdown Selector */}
            <div className="flex items-center gap-1.5 min-w-0 max-w-md flex-1">
              <button
                type="button"
                onClick={handlePrevNote}
                disabled={notes.length <= 1}
                className="h-8 px-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-650 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-200 hover:text-white border border-zinc-700 transition-colors flex items-center justify-center shrink-0 shadow-sm"
                title="Previous Prompt (<)"
                aria-label="Previous Prompt"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="relative flex-1 min-w-0">
                <select
                  value={activeNoteId}
                  onChange={(e) => handleSelectNote(e.target.value)}
                  className="w-full h-8 appearance-none bg-zinc-950 border border-zinc-700 hover:border-zinc-500 rounded-lg pl-3 pr-8 text-xs font-semibold text-zinc-100 outline-none cursor-pointer truncate shadow-inner"
                  title="Select Prompt"
                >
                  {notes.map((note, index) => (
                    <option key={note.id} value={note.id} className="bg-zinc-900 text-zinc-100 py-1">
                      {index + 1} of {notes.length} · {note.title}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              <button
                type="button"
                onClick={handleNextNote}
                disabled={notes.length <= 1}
                className="h-8 px-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-650 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-200 hover:text-white border border-zinc-700 transition-colors flex items-center justify-center shrink-0 shadow-sm"
                title="Next Prompt (>)"
                aria-label="Next Prompt"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleStartRename}
                className="h-8 px-2 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs transition-colors flex items-center gap-1 shrink-0"
                title="Rename this note"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Rename</span>
              </button>
            </div>

            {/* Right: Actions + Large Copy Button */}
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="secondary"
                size="sm"
                onClick={handlePasteClipboard}
                icon={<Clipboard className="w-3.5 h-3.5" />}
              >
                <span className="hidden sm:inline">Paste</span>
              </Button>

              {activeNote?.content && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setClearTargetNote(activeNote)}
                  icon={<RotateCcw className="w-3.5 h-3.5 text-zinc-400" />}
                  title="Clear note content"
                >
                  <span className="hidden sm:inline">Clear</span>
                </Button>
              )}

              {/* Large Prominent Copy Button Immediately Above Editor */}
              <button
                type="button"
                onClick={() => handleCopy()}
                disabled={!activeNote?.content.trim()}
                className={`h-8 px-4 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm ${
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
                    <span>Copy Prompt</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Inline Rename Banner (if active) */}
          {isEditingTitle && (
            <div className="flex items-center gap-2 px-6 py-2 bg-zinc-850 border-b border-zinc-750 shrink-0">
              <input
                type="text"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveRename();
                  if (e.key === 'Escape') setIsEditingTitle(false);
                }}
                placeholder="Note title..."
                autoFocus
                className="flex-1 max-w-md bg-zinc-950 border border-zinc-600 px-2.5 py-1 rounded text-xs text-white font-medium outline-none"
              />
              <Button variant="primary" size="sm" onClick={handleSaveRename}>
                Save
              </Button>
              <button
                type="button"
                onClick={() => setIsEditingTitle(false)}
                className="p-1 rounded text-zinc-400 hover:text-white"
                title="Cancel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Editor Canvas */}
          <div className="flex-1 p-4 sm:p-6 flex flex-col min-h-0 bg-zinc-950">
            <textarea
              ref={textareaRef}
              value={activeNote?.content || ''}
              onChange={(e) => handleContentChange(e.target.value)}
              onBlur={handleBlurTextarea}
              placeholder="Paste or type your ChatGPT prompts, Grok video instructions, master prompts, or JSON here... Saved automatically."
              spellCheck={false}
              className="w-full h-full flex-1 bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 sm:p-5 text-xs sm:text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 font-mono leading-relaxed resize-none overflow-y-auto selection:bg-zinc-700 selection:text-white"
            />
          </div>

          {/* Bottom Status / Meta Bar */}
          <div className="px-6 py-2.5 border-t border-zinc-800 bg-zinc-900/80 flex items-center justify-between text-xs font-mono text-zinc-400 shrink-0">
            <div className="flex items-center gap-3">
              <span>{metadata.charCount} characters</span>
              <span>·</span>
              <span>{metadata.wordCount} words</span>
              <span>·</span>
              <span>{metadata.lineCount} lines</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-zinc-400">
                {isSavedBadgeVisible ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Autosaved</span>
                  </>
                ) : (
                  <span>Saving changes...</span>
                )}
              </span>
            </div>
          </div>
        </main>
      </div>

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
