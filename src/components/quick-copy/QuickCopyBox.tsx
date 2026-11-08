import React, { useState, useEffect } from 'react';
import { Copy, Check, Plus, Trash2, Clipboard, RotateCcw } from 'lucide-react';
import { Button } from '../common/Button';
import { useToast } from '../common/Toast';

export interface Snippet {
  id: string;
  title: string;
  content: string;
}

const STORAGE_KEY = 'sceneforge_chatgpt_snippets';
const ACTIVE_SNIPPET_KEY = 'sceneforge_active_snippet_id';

const DEFAULT_SNIPPETS: Snippet[] = [
  {
    id: 'slot-1',
    title: 'ChatGPT Prompts',
    content: '',
  },
];

interface QuickCopyBoxProps {
  className?: string;
  compact?: boolean;
}

export const QuickCopyBox: React.FC<QuickCopyBoxProps> = ({
  className = '',
  compact = false,
}) => {
  const [snippets, setSnippets] = useState<Snippet[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Failed to load snippets from localStorage', e);
    }
    return DEFAULT_SNIPPETS;
  });

  const [activeId, setActiveId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(ACTIVE_SNIPPET_KEY);
      if (saved) return saved;
    } catch {
      // ignore
    }
    return 'slot-1';
  });

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const { showToast } = useToast();

  const activeSnippet = snippets.find((s) => s.id === activeId) || snippets[0] || DEFAULT_SNIPPETS[0];

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snippets));
    } catch (e) {
      console.warn('Failed to save snippets to localStorage', e);
    }
  }, [snippets]);

  useEffect(() => {
    try {
      localStorage.setItem(ACTIVE_SNIPPET_KEY, activeId);
    } catch {
      // ignore
    }
  }, [activeId]);

  const handleContentChange = (text: string) => {
    setSnippets((prev) =>
      prev.map((s) => (s.id === activeSnippet.id ? { ...s, content: text } : s))
    );
  };

  const handleCopy = async (textToCopy?: string, snippetId?: string) => {
    const text = textToCopy ?? activeSnippet.content;
    const targetId = snippetId ?? activeSnippet.id;

    if (!text.trim()) {
      showToast('Text is empty. Nothing to copy.', 'error');
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(targetId);
      showToast('Copied to clipboard!', 'success');
      setTimeout(() => {
        setCopiedId((current) => (current === targetId ? null : current));
      }, 2000);
    } catch (err) {
      // Fallback for older environments
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setCopiedId(targetId);
        showToast('Copied to clipboard!', 'success');
        setTimeout(() => {
          setCopiedId((current) => (current === targetId ? null : current));
        }, 2000);
      } catch (fallbackErr) {
        console.error('Clipboard copy error:', fallbackErr);
        showToast('Failed to copy to clipboard', 'error');
      }
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        handleContentChange(activeSnippet.content ? `${activeSnippet.content}\n${text}` : text);
        showToast('Pasted from clipboard', 'info');
      }
    } catch {
      showToast('Could not read clipboard. Please paste with Ctrl+V', 'error');
    }
  };

  const handleClear = () => {
    if (!activeSnippet.content) return;
    handleContentChange('');
    showToast('Cleared text', 'info');
  };

  const handleAddSnippet = () => {
    const newId = `slot-${Date.now()}`;
    const newTitle = `Slot ${snippets.length + 1}`;
    const updated = [...snippets, { id: newId, title: newTitle, content: '' }];
    setSnippets(updated);
    setActiveId(newId);
  };

  const handleDeleteSnippet = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (snippets.length <= 1) {
      handleContentChange('');
      return;
    }
    const filtered = snippets.filter((s) => s.id !== id);
    setSnippets(filtered);
    if (activeId === id) {
      setActiveId(filtered[0].id);
    }
  };

  const handleStartRename = () => {
    setEditedTitle(activeSnippet.title);
    setIsEditingTitle(true);
  };

  const handleSaveRename = () => {
    const trimmed = editedTitle.trim() || 'Untitled';
    setSnippets((prev) =>
      prev.map((s) => (s.id === activeSnippet.id ? { ...s, title: trimmed } : s))
    );
    setIsEditingTitle(false);
  };

  const wordCount = activeSnippet.content.trim()
    ? activeSnippet.content.trim().split(/\s+/).length
    : 0;
  const charCount = activeSnippet.content.length;

  return (
    <div className={`w-full bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex flex-col shadow-sm ${className}`}>
      {/* Header Bar */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-zinc-800/80 bg-zinc-900/90">
        <div className="flex items-center gap-2 min-w-0">
          <Clipboard className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          {isEditingTitle ? (
            <input
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              onBlur={handleSaveRename}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveRename()}
              autoFocus
              className="bg-zinc-950 border border-zinc-700 px-1.5 py-0.5 rounded text-xs text-white outline-none w-36"
            />
          ) : (
            <span
              onClick={handleStartRename}
              title="Click to rename"
              className="text-xs font-semibold text-zinc-200 truncate cursor-pointer hover:text-white hover:underline"
            >
              {activeSnippet.title}
            </span>
          )}
          <span className="text-[10px] text-zinc-500 font-mono hidden sm:inline">
            (Quick Copy)
          </span>
        </div>

        {/* Copy Button */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            variant={copiedId === activeSnippet.id ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => handleCopy()}
            disabled={!activeSnippet.content.trim()}
            icon={
              copiedId === activeSnippet.id ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )
            }
            className={`transition-colors h-7 text-xs ${
              copiedId === activeSnippet.id
                ? 'bg-emerald-950 border border-emerald-700 text-emerald-300'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
            }`}
          >
            <span>{copiedId === activeSnippet.id ? 'Copied!' : 'Copy'}</span>
          </Button>
        </div>
      </div>

      {/* Snippet Tabs / Slots */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-zinc-800/60 bg-zinc-950/60 overflow-x-auto no-scrollbar">
        {snippets.map((snip) => {
          const isActive = snip.id === activeSnippet.id;
          const isCopied = copiedId === snip.id;

          return (
            <div
              key={snip.id}
              onClick={() => setActiveId(snip.id)}
              className={`group flex items-center gap-1 px-2 py-1 rounded text-[11px] cursor-pointer select-none transition-colors border shrink-0 ${
                isActive
                  ? 'bg-zinc-800 border-zinc-700 text-white font-medium'
                  : 'bg-zinc-900 border-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
              }`}
            >
              <span className="truncate max-w-[100px]">{snip.title}</span>

              {/* Quick copy directly on tab */}
              {snip.content.trim() && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopy(snip.content, snip.id);
                  }}
                  className="opacity-60 hover:opacity-100 p-0.5 rounded hover:bg-zinc-700"
                  title="Quick Copy"
                >
                  {isCopied ? (
                    <Check className="w-2.5 h-2.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-2.5 h-2.5" />
                  )}
                </button>
              )}

              {snippets.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => handleDeleteSnippet(snip.id, e)}
                  className="opacity-0 group-hover:opacity-60 hover:!opacity-100 p-0.5 rounded hover:text-rose-400 ml-0.5"
                  title="Delete slot"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          );
        })}

        {snippets.length < 8 && (
          <button
            type="button"
            onClick={handleAddSnippet}
            className="flex items-center gap-1 px-1.5 py-1 rounded text-[10px] text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60 transition-colors shrink-0"
            title="Add another snippet slot"
          >
            <Plus className="w-3 h-3" />
            <span>New Slot</span>
          </button>
        )}
      </div>

      {/* Input Textarea */}
      <div className="relative p-2.5 bg-zinc-950">
        <textarea
          value={activeSnippet.content}
          onChange={(e) => handleContentChange(e.target.value)}
          placeholder="Paste or type words you frequently use in ChatGPT here... Then click 'Copy' to use them anytime."
          rows={compact ? 4 : 5}
          className="w-full bg-zinc-900/90 border border-zinc-800 rounded-lg p-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 font-sans leading-relaxed resize-y"
        />

        {/* Footer toolbar inside box */}
        <div className="flex items-center justify-between mt-1.5 text-[10px] font-mono text-zinc-500 px-1">
          <div className="flex items-center gap-3">
            <span>{charCount} chars · {wordCount} words</span>
            {activeSnippet.content.trim() && (
              <span className="text-zinc-600 hidden sm:inline">Auto-saved</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePasteFromClipboard}
              className="text-zinc-400 hover:text-zinc-200 transition-colors flex items-center gap-1"
              title="Paste from clipboard"
            >
              <span>Paste Clipboard</span>
            </button>

            {activeSnippet.content.trim() && (
              <button
                type="button"
                onClick={handleClear}
                className="text-zinc-500 hover:text-rose-400 transition-colors flex items-center gap-1"
                title="Clear text"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                <span>Clear</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
