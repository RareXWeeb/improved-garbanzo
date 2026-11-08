import React from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '../common/Button';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  noteTitle: string;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
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
          <div className="w-9 h-9 rounded-full bg-rose-950/60 border border-rose-800/60 flex items-center justify-center text-rose-400 shrink-0">
            <Trash2 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Delete Note?</h3>
            <p className="text-xs text-zinc-400 mt-0.5 truncate max-w-[220px]">
              "{noteTitle}"
            </p>
          </div>
        </div>

        <p className="text-xs text-zinc-400 leading-relaxed">
          Are you sure you want to delete this note? This action cannot be undone.
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
            icon={<Trash2 className="w-3.5 h-3.5" />}
          >
            Delete Note
          </Button>
        </div>
      </div>
    </div>
  );
};
