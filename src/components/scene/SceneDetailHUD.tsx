import React, { useState, useEffect } from 'react';
import { Loader2, RefreshCw, Play } from 'lucide-react';
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

      showToast(`Generating Scene ${scene.scene}...`, 'info');
      const attempt = await generateSceneImage(scene, assigned, generationSettings);
      showToast(`Scene ${scene.scene} generated (v${attempt.attemptNumber})`, 'success');
      onRefresh?.();
    } catch (err: any) {
      console.error('Generation failed:', err);
      showToast(`Failed: ${err.message || 'Error'}`, 'error');
      onRefresh?.();
    } finally {
      setIsGenerating(false);
    }
  };

  const hasGeneratedOutputs = (scene.attempts?.length || 0) > 0;

  return (
    <div className="flex flex-col gap-4 pb-12 w-full max-w-3xl mx-auto">
      {/* Scene Header & Specs */}
      <div className="flex flex-col gap-1.5 pb-3 border-b border-zinc-800">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-baseline gap-2.5">
            <h2 className="text-xl font-bold text-white font-mono tracking-tight">
              SCENE {scene.scene}
            </h2>
            <span className="text-xs text-zinc-400 font-mono">
              Ep {scene.episode} · Part {scene.part}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-400">
            <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800">
              {metadata.aspect_ratio || '9:16'}
            </span>
            <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800">
              {metadata.resolution || '1080×1920'}
            </span>
            {metadata.exact_character_count !== undefined && (
              <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800">
                Chars: {metadata.exact_character_count}
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

      {/* Primary Generation Action Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg bg-zinc-900 border border-zinc-800">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-zinc-100">
              {hasGeneratedOutputs ? 'Regenerate Scene' : 'Generate Cinematic Frame'}
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300">
              {generationSettings.provider.toUpperCase()}
            </span>
          </div>
          <p className="text-[11px] text-zinc-400">
            Conditions on assigned character portraits · Concurrency: 1
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={handleGenerate}
          disabled={isGenerating || scene.status === 'generating'}
          icon={
            isGenerating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : hasGeneratedOutputs ? (
              <RefreshCw className="w-3.5 h-3.5" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )
          }
          className="shrink-0 w-full sm:w-auto"
        >
          {isGenerating ? 'Generating...' : hasGeneratedOutputs ? 'Regenerate' : 'Generate Scene'}
        </Button>
      </div>

      {/* Character Reference Selector */}
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
      <AttemptHistory scene={scene} onRefresh={onRefresh} />
    </div>
  );
};
