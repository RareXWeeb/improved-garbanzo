import React, { useState, useEffect } from 'react';
import { Play, Loader2, Download, Check, Users, ArrowRight, RefreshCw, AlertCircle, Upload, Plus } from 'lucide-react';
import { QueueItem, CharacterRecord, GenerationSettings, GenerationAttempt } from '../../types/queue';
import { parseImagePromptJson } from '../../services/parser';
import { getProjectCharacters, autoMatchCharactersForScene } from '../../services/characterManager';
import { generateSceneImage } from '../../services/generationClient';
import { getResultBlobUrl } from '../../services/assetManager';
import { db } from '../../services/db';
import { syncBus } from '../../services/sync';
import { triggerFileDownload, buildExportImageFilename } from '../../services/exporter';
import { Button } from '../common/Button';
import { useToast } from '../common/Toast';

export interface QuickGenerateViewProps {
  projectId: string;
  generationSettings: GenerationSettings;
  onSceneCreated?: (scene: QueueItem) => void;
  onOpenCharacterLibrary?: () => void;
  onClose?: () => void;
  isEmbedded?: boolean;
}

export const QuickGenerateView: React.FC<QuickGenerateViewProps> = ({
  projectId,
  generationSettings,
  onSceneCreated,
  onOpenCharacterLibrary,
  onClose,
  isEmbedded = false,
}) => {
  const [jsonInput, setJsonInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [projectCharacters, setProjectCharacters] = useState<CharacterRecord[]>([]);
  const [selectedCharIds, setSelectedCharIds] = useState<string[]>([]);
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});

  // Parsed metadata preview
  const [detectedSceneNumber, setDetectedSceneNumber] = useState<string | null>(null);
  const [detectedTitle, setDetectedTitle] = useState<string | null>(null);
  const [detectedAspectRatio, setDetectedAspectRatio] = useState<string>('9:16');
  const [parsedCount, setParsedCount] = useState<number>(0);
  const [parseError, setParseError] = useState<string | null>(null);

  // Result state
  const [generatedAttempt, setGeneratedAttempt] = useState<GenerationAttempt | null>(null);
  const [resultImageUrl, setResultImageUrl] = useState<string | null>(null);
  const [createdScene, setCreatedScene] = useState<QueueItem | null>(null);

  const { showToast } = useToast();

  useEffect(() => {
    loadCharacters();
    return () => {
      Object.values(thumbUrls).forEach((u) => URL.revokeObjectURL(u));
      if (resultImageUrl) URL.revokeObjectURL(resultImageUrl);
    };
  }, [projectId]);

  const loadCharacters = async () => {
    try {
      const chars = await getProjectCharacters(projectId);
      setProjectCharacters(chars);

      const urls: Record<string, string> = {};
      chars.forEach((c) => {
        if (c.portraitBlob) {
          urls[c.id] = URL.createObjectURL(c.portraitBlob);
        }
      });
      setThumbUrls(urls);
    } catch (err) {
      console.error('Failed to load characters:', err);
    }
  };

  // Live parse JSON input as user pastes, types, or drops file
  useEffect(() => {
    if (!jsonInput.trim()) {
      setDetectedSceneNumber(null);
      setDetectedTitle(null);
      setParsedCount(0);
      setParseError(null);
      return;
    }

    try {
      const parsedItems = parseImagePromptJson(jsonInput);
      setParsedCount(parsedItems.length);
      if (parsedItems.length > 0) {
        const first = parsedItems[0];
        setDetectedSceneNumber(first.metadata.scene ? String(first.metadata.scene) : '01');
        setDetectedTitle(first.metadata.title || first.metadata.prompt?.slice(0, 60) || null);
        setDetectedAspectRatio(first.metadata.aspect_ratio || '9:16');
        setParseError(null);

        // Auto-match characters from library
        const dummyQueueItem: any = {
          metadata: first.metadata,
          rawJsonText: first.rawJsonText,
        };
        const matched = autoMatchCharactersForScene(dummyQueueItem, projectCharacters);
        setSelectedCharIds(matched);
      }
    } catch (err: any) {
      setParseError(err.message || 'Invalid JSON format');
      setDetectedSceneNumber(null);
      setDetectedTitle(null);
      setParsedCount(0);
    }
  }, [jsonInput, projectCharacters]);

  const toggleCharacter = (charId: string) => {
    setSelectedCharIds((prev) =>
      prev.includes(charId) ? prev.filter((id) => id !== charId) : [...prev, charId]
    );
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) setJsonInput(text);
      };
      reader.readAsText(file);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) setJsonInput(text);
      };
      reader.readAsText(file);
    }
  };

  const handleGenerate = async () => {
    if (!jsonInput.trim()) {
      showToast('Please paste your Image Prompt JSON.', 'error');
      return;
    }

    let parsedItems;
    try {
      parsedItems = parseImagePromptJson(jsonInput);
    } catch (err: any) {
      showToast(err.message || 'Invalid JSON format', 'error');
      return;
    }

    if (parsedItems.length === 0) {
      showToast('No scenes found in JSON.', 'error');
      return;
    }

    setIsGenerating(true);
    setGeneratedAttempt(null);
    setResultImageUrl(null);

    try {
      let activeQueueItem: QueueItem | null = null;

      // Save all parsed scenes to queue
      for (let i = 0; i < parsedItems.length; i++) {
        const item = parsedItems[i];
        const existing = await db.scenes.get(item.id);

        const charIds =
          i === 0
            ? selectedCharIds
            : autoMatchCharactersForScene({ metadata: item.metadata } as any, projectCharacters);

        const queueItem: QueueItem = {
          id: item.id,
          projectId,
          projectTitle: item.metadata.project_title || item.metadata.project || 'Project',
          episode: String(item.metadata.episode || '01'),
          part: String(item.metadata.part || '01'),
          scene: String(item.metadata.scene || '01'),
          title: item.metadata.title,
          rawJsonText: item.rawJsonText,
          metadata: item.metadata,
          selectedCharacterIds: charIds,
          extractedReferences: item.extractedReferences,
          validationIssues: item.validationIssues,
          status: 'ready',
          currentAttemptNumber: existing ? existing.currentAttemptNumber : 0,
          attempts: existing ? existing.attempts : [],
          createdAt: existing ? existing.createdAt : Date.now(),
          updatedAt: Date.now(),
        };

        await db.scenes.put(queueItem);
        if (i === 0) activeQueueItem = queueItem;
      }

      if (!activeQueueItem) throw new Error('Could not create scene record');
      setCreatedScene(activeQueueItem);

      // Generate the primary scene
      const assigned = projectCharacters.filter((c) => selectedCharIds.includes(c.id));
      showToast(`Generating Scene ${activeQueueItem.scene}...`, 'info');

      const attempt = await generateSceneImage(activeQueueItem, assigned, generationSettings);
      setGeneratedAttempt(attempt);

      if (attempt.imageBlobId) {
        const url = await getResultBlobUrl(attempt.imageBlobId);
        setResultImageUrl(url);
      }

      showToast(
        parsedItems.length > 1
          ? `Generated Scene ${activeQueueItem.scene} (${parsedItems.length} scenes queued)`
          : `Scene ${activeQueueItem.scene} generated!`,
        'success'
      );

      syncBus.broadcast('SCENES_BATCH_IMPORTED', { count: parsedItems.length });
      onSceneCreated?.(activeQueueItem);
    } catch (err: any) {
      console.error('Generation error:', err);
      showToast(err.message || 'Generation failed', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async () => {
    if (!generatedAttempt || !generatedAttempt.imageBlobId || !createdScene) return;
    try {
      const asset = await db.generationResults.get(generatedAttempt.imageBlobId);
      if (asset?.imageBlob) {
        const filename = buildExportImageFilename(
          createdScene.projectTitle,
          createdScene.episode,
          createdScene.part,
          createdScene.scene,
          generatedAttempt.attemptNumber,
          asset.extension || 'png'
        );
        triggerFileDownload(asset.imageBlob, filename, asset.mimeType);
        showToast('Image downloaded', 'success');
      }
    } catch (err) {
      console.error('Download error:', err);
      showToast('Error downloading image', 'error');
    }
  };

  const handleResetForNext = () => {
    setJsonInput('');
    setGeneratedAttempt(null);
    setResultImageUrl(null);
    setCreatedScene(null);
    setDetectedSceneNumber(null);
    setDetectedTitle(null);
  };

  return (
    <div className={`w-full flex flex-col ${isEmbedded ? 'max-w-3xl mx-auto' : ''}`}>
      {/* Generated Result Preview */}
      {generatedAttempt && resultImageUrl ? (
        <div className="flex flex-col items-center gap-4 py-2 w-full bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between w-full pb-3 border-b border-zinc-800 gap-2">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-white text-sm">
                Scene {createdScene?.scene} · v{generatedAttempt.attemptNumber}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/60">
                Generated Successfully
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleDownload}
                icon={<Download className="w-3.5 h-3.5" />}
              >
                Download PNG
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleResetForNext}
                icon={<RefreshCw className="w-3.5 h-3.5" />}
              >
                Generate Another
              </Button>
            </div>
          </div>

          {/* 9:16 Portrait Image Container */}
          <div className="relative w-full max-w-[280px] sm:max-w-[320px] aspect-[9/16] rounded-lg overflow-hidden border border-zinc-700 bg-black shadow-lg">
            <img
              src={resultImageUrl}
              alt={`Scene ${createdScene?.scene}`}
              className="w-full h-full object-cover"
            />
          </div>

          {createdScene && (
            <div className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-zinc-400 font-mono text-xs flex flex-wrap justify-between items-center gap-2">
              <span>Saved in project queue: {createdScene.id}</span>
              <button
                onClick={() => {
                  onClose?.();
                  onSceneCreated?.(createdScene);
                }}
                className="text-white hover:underline flex items-center gap-1 font-sans text-xs"
              >
                Inspect in Workspace <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Prompt Input & Character Assignment */
        <div className="flex flex-col gap-4 bg-zinc-900 border border-zinc-800 rounded-xl p-4 sm:p-6 shadow-sm">
          {/* Header Row */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-zinc-800">
            <div>
              <h2 className="text-sm font-semibold text-white">Create Image from JSON</h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Paste your Image Prompt JSON below to generate directly.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-zinc-400">
                {generationSettings.provider.toUpperCase()}
              </span>
              <label className="cursor-pointer inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-white px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-750 transition-colors">
                <Upload className="w-3.5 h-3.5" />
                <span>Drop or Upload .json</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={handleFileInput}
                />
              </label>
            </div>
          </div>

          {/* JSON Textarea with Drop Handler */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-zinc-300">
                Image Prompt JSON
              </label>
              {detectedSceneNumber && (
                <span className="font-mono text-zinc-200 bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700 text-[11px]">
                  Scene {detectedSceneNumber} · {detectedAspectRatio}
                  {parsedCount > 1 ? ` (${parsedCount} scenes in batch)` : ''}
                </span>
              )}
            </div>

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
              className="relative"
            >
              <textarea
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder={`{\n  "scene": "68AD",\n  "title": "Confrontation in Courtyard",\n  "aspect_ratio": "9:16",\n  "prompt": "Cinematic vertical portrait shot of Mateo Santos in rain...",\n  "characters_visible": ["Mateo Santos"]\n}`}
                rows={isEmbedded ? 9 : 8}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 font-mono leading-relaxed resize-y"
                disabled={isGenerating}
              />
            </div>

            {parseError && (
              <div className="flex items-center gap-1.5 text-rose-400 text-xs">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{parseError}</span>
              </div>
            )}

            {detectedTitle && (
              <p className="text-zinc-400 text-xs truncate">
                Title: <span className="text-zinc-200 font-medium">{detectedTitle}</span>
              </p>
            )}
          </div>

          {/* Character References Section */}
          <div className="flex flex-col gap-2.5 pt-3 border-t border-zinc-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-zinc-400" />
                <span className="text-xs font-semibold text-zinc-200">
                  Character Reference Conditioning
                </span>
                <span className="text-[10px] text-zinc-500 font-mono">
                  ({selectedCharIds.length} attached)
                </span>
              </div>

              {onOpenCharacterLibrary && (
                <button
                  type="button"
                  onClick={onOpenCharacterLibrary}
                  className="text-xs text-zinc-400 hover:text-white flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Manage Characters</span>
                </button>
              )}
            </div>

            {projectCharacters.length === 0 ? (
              <div className="bg-zinc-950 p-3 rounded-lg border border-dashed border-zinc-800 text-center flex flex-col items-center gap-1.5">
                <p className="text-xs text-zinc-400">
                  No character portraits uploaded in the project library.
                </p>
                {onOpenCharacterLibrary && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={onOpenCharacterLibrary}
                    icon={<Users className="w-3.5 h-3.5" />}
                  >
                    Upload Character Portraits
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {projectCharacters.map((char) => {
                  const isSelected = selectedCharIds.includes(char.id);
                  const thumb = thumbUrls[char.id];

                  return (
                    <div
                      key={char.id}
                      onClick={() => toggleCharacter(char.id)}
                      className={`flex items-center gap-2 p-1.5 rounded-lg border cursor-pointer select-none transition-all ${
                        isSelected
                          ? 'bg-zinc-800 border-zinc-400 text-white shadow-sm'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      {thumb ? (
                        <img
                          src={thumb}
                          alt={char.name}
                          className={`w-8 h-10 object-cover rounded shrink-0 border ${
                            isSelected ? 'border-zinc-300' : 'border-zinc-800'
                          }`}
                        />
                      ) : (
                        <div className="w-8 h-10 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center text-xs font-mono text-zinc-500 shrink-0">
                          {char.name.charAt(0)}
                        </div>
                      )}

                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-xs font-semibold truncate leading-tight">
                          {char.name}
                        </span>
                        <span className="text-[10px] text-zinc-500">
                          {isSelected ? 'Active reference' : 'Click to add'}
                        </span>
                      </div>

                      {isSelected && (
                        <Check className="w-4 h-4 text-white shrink-0 mr-1" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between pt-3 border-t border-zinc-800">
            {onClose && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                disabled={isGenerating}
              >
                Cancel
              </Button>
            )}
            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="primary"
                size="md"
                onClick={handleGenerate}
                disabled={isGenerating || !jsonInput.trim() || !!parseError}
                icon={
                  isGenerating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4 fill-current" />
                  )
                }
              >
                {isGenerating ? 'Generating Image...' : 'Generate Image'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
