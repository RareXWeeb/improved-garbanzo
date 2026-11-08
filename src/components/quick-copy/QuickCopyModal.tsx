import React from 'react';
import { X, Clipboard } from 'lucide-react';
import { QuickCopyBox } from './QuickCopyBox';

interface QuickCopyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QuickCopyModal: React.FC<QuickCopyModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-2">
            <Clipboard className="w-4 h-4 text-zinc-300" />
            <h2 className="text-sm font-semibold text-white">ChatGPT Quick Copy</h2>
            <span className="text-[10px] text-zinc-500 font-mono">Scratchpad</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 overflow-y-auto">
          <p className="text-xs text-zinc-400 mb-3">
            Keep redundant words, prompt prefixes, or instructions you frequently copy to ChatGPT. Everything is auto-saved.
          </p>
          <QuickCopyBox compact={false} />
        </div>
      </div>
    </div>
  );
};

