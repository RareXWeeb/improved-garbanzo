import React from 'react';
import { QueueItem } from '../../types/queue';
import { StatusTransitionBar } from './StatusTransitionBar';
import { PromptViewer } from './PromptViewer';
import { RefChecklist } from './RefChecklist';
import { ResultDropzone } from './ResultDropzone';
import { AttemptHistory } from './AttemptHistory';

interface SceneDetailHUDProps {
  scene: QueueItem;
  onRefresh?: () => void;
}

export const SceneDetailHUD: React.FC<SceneDetailHUDProps> = ({ scene, onRefresh }) => {
  const metadata = scene.metadata;

  return (
    <div className="flex flex-col gap-3.5 pb-8 max-w-3xl mx-auto">
      {/* Minimalist Scene Title & Specs */}
      <div className="flex flex-col gap-1.5 pb-3 border-b border-zinc-800/80">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-2.5">
            <h2 className="text-lg font-bold text-white font-mono tracking-tight">
              SCENE {scene.scene}
            </h2>
            <span className="text-xs text-zinc-400 font-mono">
              Ep {scene.episode} · Part {scene.part}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-400">
            <span className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800">
              {metadata.aspect_ratio || '9:16'}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800">
              {metadata.resolution || '1080×1920'}
            </span>
            {metadata.exact_character_count !== undefined && (
              <span className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800">
                Chars: {metadata.exact_character_count}
              </span>
            )}
          </div>
        </div>

        {scene.title && (
          <p className="text-xs text-zinc-400 leading-normal">
            {scene.title}
          </p>
        )}
      </div>

      {/* Primary Action & Status Transition */}
      <StatusTransitionBar scene={scene} onStatusChange={onRefresh} />

      {/* Generated Result Inspection & Dropzone */}
      <ResultDropzone scene={scene} onResultIngested={onRefresh} />

      {/* Reference Checklist */}
      <RefChecklist scene={scene} onRefresh={onRefresh} />

      {/* Verbatim Prompt Source */}
      <PromptViewer scene={scene} />

      {/* Iteration Timeline */}
      <AttemptHistory scene={scene} />
    </div>
  );
};
