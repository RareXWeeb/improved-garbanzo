import React from 'react';
import { X, Play } from 'lucide-react';
import { QueueItem, GenerationSettings } from '../../types/queue';
import { QuickGenerateView } from './QuickGenerateView';

interface QuickGenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
  generationSettings: GenerationSettings;
  projectId: string;
  onSceneCreated?: (scene: QueueItem) => void;
  onOpenCharacterLibrary?: () => void;
}

export const QuickGenerateModal: React.FC<QuickGenerateModalProps> = ({
  isOpen,
  onClose,
  generationSettings,
  projectId,
  onSceneCreated,
  onOpenCharacterLibrary,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <Play className="w-4 h-4 text-zinc-200 fill-current" />
            <h2 className="text-sm font-semibold text-white">Create Image from JSON</h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300 ml-1">
              {generationSettings.provider.toUpperCase()}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto">
          <QuickGenerateView
            projectId={projectId}
            generationSettings={generationSettings}
            onSceneCreated={onSceneCreated}
            onOpenCharacterLibrary={onOpenCharacterLibrary}
            onClose={onClose}
            isEmbedded={false}
          />
        </div>
      </div>
    </div>
  );
};
