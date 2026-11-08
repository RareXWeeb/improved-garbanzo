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
  FileText,
  Menu,
  X,
  Edit3,
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

  // Inline rename state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');

  // Modals state
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [deleteTargetNote, setDeleteTargetNote] = useState<Note | null>(null);
  const [clearTargetNote, setClearTargetNote] = useState<Note | null>(null);

  const { showToast } = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const activeNote = notes.find((n) => n.id === activeNoteId) || notes[0];

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
            {filteredNotes.map((note) => {
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
                      {note.title}
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
          {/* Note Title & Header Action Bar */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-zinc-800/80 bg-zinc-900/40 shrink-0">
            {/* Title / Rename */}
            <div className="flex items-center gap-2 min-w-0 flex-1 mr-3">
              <FileText className="w-4 h-4 text-zinc-400 shrink-0" />
              {isEditingTitle ? (
                <div className="flex items-center gap-1.5 flex-1">
                  <input
                    type="text"
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveRename();
                      if (e.key === 'Escape') setIsEditingTitle(false);
                    }}
                    autoFocus
                    className="bg-zinc-950 border border-zinc-600 px-2 py-1 rounded text-sm text-white font-semibold outline-none w-full max-w-sm"
                  />
                  <Button variant="primary" size="sm" onClick={handleSaveRename}>
                    Save
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 group min-w-0 cursor-pointer" onClick={handleStartRename}>
                  <h1 className="text-sm sm:text-base font-semibold text-white truncate group-hover:text-zinc-200">
                    {activeNote?.title || 'PromptPad'}
                  </h1>
                  <button
                    type="button"
                    className="opacity-0 group-hover:opacity-70 hover:!opacity-100 text-zinc-400 hover:text-white p-1 rounded"
                    title="Click to rename"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="secondary"
                size="sm"
                onClick={handlePasteClipboard}
                icon={<Clipboard className="w-3.5 h-3.5" />}
              >
                <span className="hidden sm:inline">Paste Clipboard</span>
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

              {/* Primary 1-Click Copy Button */}
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
                className={`font-semibold transition-colors ${
                  copiedId === activeNote?.id
                    ? 'bg-emerald-950 border border-emerald-700 text-emerald-300'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-white'
                }`}
              >
                <span>{copiedId === activeNote?.id ? 'Copied!' : 'Copy to Clipboard'}</span>
              </Button>
            </div>
          </div>

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
