import React from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '../common/Button';

interface ConfirmClearModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  noteTitle: string;
}

export const ConfirmClearModal: React.FC<ConfirmClearModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  noteTitle,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-amber-950/60 border border-amber-800/60 flex items-center justify-center text-amber-400 shrink-0">
            <RotateCcw className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Clear Note Content?</h3>
            <p className="text-xs text-zinc-400 mt-0.5 truncate max-w-[220px]">
              "{noteTitle}"
            </p>
          </div>
        </div>

        <p className="text-xs text-zinc-400 leading-relaxed">
          Are you sure you want to clear all text in this note?
        </p>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            icon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            Clear Text
          </Button>
        </div>
      </div>
    </div>
  );
};

