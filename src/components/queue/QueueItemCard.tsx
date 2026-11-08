import React from 'react';
import { QueueItem } from '../../types/queue';
import { StatusBadge } from '../common/Badge';
import { Image as ImageIcon, Copy } from 'lucide-react';

interface QueueItemCardProps {
  scene: QueueItem;
  isActive: boolean;
  onSelect: (scene: QueueItem) => void;
  onQuickCopy?: (scene: QueueItem, e: React.MouseEvent) => void;
}

export const QueueItemCard: React.FC<QueueItemCardProps> = ({
  scene,
  isActive,
  onSelect,
  onQuickCopy,
}) => {
  const allRefsMatched =
    scene.extractedReferences.length > 0 &&
    scene.extractedReferences.every((r) => r.isMatched);

  const attemptCount = scene.attempts ? scene.attempts.length : 0;

  return (
    <div
      onClick={() => onSelect(scene)}
      className={`group relative flex items-center justify-between p-2 rounded-lg border transition-colors cursor-pointer select-none ${
        isActive
          ? 'bg-zinc-850 border-zinc-600'
          : 'bg-zinc-900/50 border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-900'
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {/* Monospace Scene Number Badge */}
        <div
          className={`w-10 h-7 rounded flex items-center justify-center font-mono font-bold text-xs shrink-0 border ${
            isActive
              ? 'bg-zinc-100 text-zinc-950 border-zinc-100'
              : 'bg-zinc-950 text-zinc-300 border-zinc-800 group-hover:border-zinc-700'
          }`}
        >
          {scene.scene}
        </div>

        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-zinc-200 truncate">
              {scene.title || `Scene ${scene.scene}`}
            </span>
            {attemptCount > 0 && (
              <span className="text-[10px] font-mono text-zinc-500">
                v{attemptCount}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono">
            <span>Ep {scene.episode} · P {scene.part}</span>

            {scene.extractedReferences.length > 0 && (
              <span
                className={`flex items-center gap-0.5 ${
                  allRefsMatched ? 'text-emerald-500' : 'text-zinc-500'
                }`}
              >
                <ImageIcon className="w-2.5 h-2.5" />
                <span>{scene.extractedReferences.length} refs</span>
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0 ml-2">
        <StatusBadge status={scene.status} size="sm" />

        {onQuickCopy && (
          <button
            onClick={(e) => onQuickCopy(scene, e)}
            title="Copy Prompt"
            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-opacity"
          >
            <Copy className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
};
