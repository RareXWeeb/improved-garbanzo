import React, { useState } from 'react';
import { Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { QueueItem } from '../../types/queue';
import { Button } from '../common/Button';
import { useToast } from '../common/Toast';
import { db } from '../../services/db';
import { syncBus } from '../../services/sync';

interface PromptViewerProps {
  scene: QueueItem;
}

export const PromptViewer: React.FC<PromptViewerProps> = ({ scene }) => {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const { showToast } = useToast();

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(scene.rawJsonText);
      setCopied(true);
      showToast(`Prompt JSON for Scene ${scene.scene} copied!`, 'success');

      if (scene.status === 'queued') {
        const updated = {
          ...scene,
          status: 'copied' as const,
          updatedAt: Date.now(),
        };
        await db.scenes.put(updated);
        syncBus.broadcast('STATUS_CHANGED', { sceneId: scene.id, status: 'copied' });
      }

      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast('Could not copy to clipboard.', 'error');
    }
  };

  const hasWarnings = scene.validationIssues && scene.validationIssues.length > 0;

  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg overflow-hidden flex flex-col">
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800/80 bg-zinc-900/90">
        <div className="flex items-center gap-2 text-xs font-mono text-zinc-300">
          <span>Prompt JSON</span>
          <span className="text-[10px] text-zinc-500">
            ({scene.rawJsonText.length.toLocaleString()} chars)
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Collapse' : 'Expand'}
            className="h-6 px-1.5 text-zinc-400 hover:text-zinc-200"
          >
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </Button>

          <Button
            variant={copied ? 'secondary' : 'primary'}
            size="sm"
            onClick={handleCopyPrompt}
            icon={copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            className="h-7 text-xs"
          >
            {copied ? 'Copied' : 'Copy Prompt JSON'}
          </Button>
        </div>
      </div>

      {/* Validation warning notice (subtle) */}
      {hasWarnings && (
        <div className="px-3 py-1.5 border-b border-zinc-800 bg-zinc-950/40 text-[11px] text-zinc-400 flex flex-col gap-0.5">
          {scene.validationIssues.map((issue, idx) => (
            <div key={idx} className="flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-amber-400 shrink-0" />
              <span>{issue.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Code Viewer */}
      <div
        className={`${
          isExpanded ? 'max-h-[500px]' : 'max-h-[160px]'
        } overflow-y-auto p-3 bg-zinc-950/80 font-mono text-[11px] leading-relaxed text-zinc-300 select-text`}
      >
        <pre className="whitespace-pre-wrap break-all font-mono">
          {scene.rawJsonText}
        </pre>
      </div>
    </div>
  );
};
