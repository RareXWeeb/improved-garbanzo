import React, { useState, useEffect } from 'react';
import { Sparkles, Loader2, RefreshCw } from 'lucide-react';
import { QueueItem, CharacterRecord, GenerationSettings } from '../../types/queue';
import { StatusTransitionBar } from './StatusTransitionBar';
import { PromptViewer } from './PromptViewer';
import { RefChecklist } from './RefChecklist';
import { ResultDropzone } from './ResultDropzone';
import { AttemptHistory } from './AttemptHistory';
import { SceneCharacterSelector } from './SceneCharacterSelector';
import { getProjectCharacters } from '../../services/characterManager';
import { generateSceneImage } from '../../services/generationClient';
import { DEFAULT_GENERATION_SETTINGS } from '../../services/db';
import { Button } from '../common/Button';
import { useToast } from '../common/Toast';

interface SceneDetailHUDProps {
  scene: QueueItem;
  generationSettings?: GenerationSettings;
  onRefresh?: () => void;
}

export const SceneDetailHUD: React.FC<SceneDetailHUDProps> = ({
  scene,
  generationSettings = DEFAULT_GENERATION_SETTINGS,
  onRefresh,
}) => {
  const [projectCharacters, setProjectCharacters] = useState<CharacterRecord[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const { showToast } = useToast();
  const metadata = scene.metadata;

  const loadCharacters = async () => {
    try {
      const chars = await getProjectCharacters(scene.projectId || 'proj_default');
      setProjectCharacters(chars);
    } catch (err) {
      console.error('Failed to load project characters:', err);
    }
  };

  useEffect(() => {
    loadCharacters();
  }, [scene.projectId]);

  const handleGenerate = async () => {
    if (isGenerating) return;
    setIsGenerating(true);

    try {
      const assigned = projectCharacters.filter((c) =>
        scene.selectedCharacterIds?.includes(c.id)
      );

      showToast(`Generating Scene ${scene.scene} with ${generationSettings.provider.toUpperCase()}...`, 'info');
      const attempt = await generateSceneImage(scene, assigned, generationSettings);
      showToast(`Scene ${scene.scene} generated! (v${attempt.attemptNumber})`, 'success');
      onRefresh?.();
    } catch (err: any) {
      console.error('Generation failed:', err);
      showToast(`Generation failed: ${err.message || 'Error'}`, 'error');
      onRefresh?.();
    } finally {
      setIsGenerating(false);
    }
  };

  const hasGeneratedOutputs = (scene.attempts?.length || 0) > 0;

  return (
    <div className="flex flex-col gap-4 pb-12 max-w-3xl mx-auto">
      {/* Minimalist Scene Title & Specs */}
      <div className="flex flex-col gap-1.5 pb-3 border-b border-zinc-800/80">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-2.5">
            <h2 className="text-xl font-bold text-white font-mono tracking-tight">
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
                Exact Chars: {metadata.exact_character_count}
              </span>
            )}
          </div>
        </div>

        {scene.title && (
          <p className="text-xs text-zinc-300 leading-normal">
            {scene.title}
          </p>
        )}
      </div>

      {/* Primary Generation Action Bar */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-orange-950/20 via-zinc-900 to-zinc-900 border border-orange-900/30">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-zinc-100">
                {hasGeneratedOutputs ? 'Regenerate Scene' : 'Generate Cinematic Image'}
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                {generationSettings.provider.toUpperCase()}
              </span>
            </div>
            <p className="text-[11px] text-zinc-400">
              Direct AI rendering with assigned character references · Concurrency = 1
            </p>
          </div>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={handleGenerate}
          disabled={isGenerating || scene.status === 'generating'}
          icon={
            isGenerating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : hasGeneratedOutputs ? (
              <RefreshCw className="w-3.5 h-3.5" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )
          }
        >
          {isGenerating ? 'Generating...' : hasGeneratedOutputs ? 'Regenerate' : 'Generate Scene'}
        </Button>
      </div>

      {/* Character Reference Selector for this Scene */}
      <SceneCharacterSelector
        scene={scene}
        projectCharacters={projectCharacters}
        onUpdated={onRefresh}
      />

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
