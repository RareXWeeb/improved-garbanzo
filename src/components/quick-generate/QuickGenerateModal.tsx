import React, { useState, useEffect } from 'react';
import { X, Play, Loader2, Download, Check, Users, ArrowRight, RefreshCw, AlertCircle } from 'lucide-react';
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

interface QuickGenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
  generationSettings: GenerationSettings;
  projectId: string;
  onSceneCreated?: (scene: QueueItem) => void;
}

export const QuickGenerateModal: React.FC<QuickGenerateModalProps> = ({
  isOpen,
  onClose,
  generationSettings,
  projectId,
  onSceneCreated,
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
  const [parseError, setParseError] = useState<string | null>(null);

  // Result state
  const [generatedAttempt, setGeneratedAttempt] = useState<GenerationAttempt | null>(null);
  const [resultImageUrl, setResultImageUrl] = useState<string | null>(null);
  const [createdScene, setCreatedScene] = useState<QueueItem | null>(null);

  const { showToast } = useToast();

  useEffect(() => {
    if (isOpen) {
      loadCharacters();
    }
    return () => {
      Object.values(thumbUrls).forEach((u) => URL.revokeObjectURL(u));
      if (resultImageUrl) URL.revokeObjectURL(resultImageUrl);
    };
  }, [isOpen, projectId]);

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

  // Live parse JSON input as the user pastes or types
  useEffect(() => {
    if (!jsonInput.trim()) {
      setDetectedSceneNumber(null);
      setDetectedTitle(null);
      setParseError(null);
      return;
    }

    try {
      const parsedItems = parseImagePromptJson(jsonInput);
      if (parsedItems.length > 0) {
        const first = parsedItems[0];
        setDetectedSceneNumber(first.metadata.scene ? String(first.metadata.scene) : '01');
        setDetectedTitle(first.metadata.title || first.metadata.prompt?.slice(0, 50) || null);
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
    }
  }, [jsonInput, projectCharacters]);

  if (!isOpen) return null;

  const toggleCharacter = (charId: string) => {
    setSelectedCharIds((prev) =>
      prev.includes(charId) ? prev.filter((id) => id !== charId) : [...prev, charId]
    );
  };

  const handleGenerate = async () => {
    if (!jsonInput.trim()) {
      showToast('Please paste your Image Prompt JSON first.', 'error');
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
      showToast('No scene found in pasted JSON.', 'error');
      return;
    }

    const first = parsedItems[0];
    setIsGenerating(true);
    setGeneratedAttempt(null);
    setResultImageUrl(null);

    try {
      // 1. Create or retrieve QueueItem in database
      const existing = await db.scenes.get(first.id);
      const queueItem: QueueItem = {
        id: first.id,
        projectId,
        projectTitle: first.metadata.project_title || first.metadata.project || 'Project',
        episode: String(first.metadata.episode || '01'),
        part: String(first.metadata.part || '01'),
        scene: String(first.metadata.scene || '01'),
        title: first.metadata.title,
        rawJsonText: first.rawJsonText,
        metadata: first.metadata,
        selectedCharacterIds: selectedCharIds,
        extractedReferences: first.extractedReferences,
        validationIssues: first.validationIssues,
        status: 'queued',
        currentAttemptNumber: existing ? existing.currentAttemptNumber : 0,
        attempts: existing ? existing.attempts : [],
        createdAt: existing ? existing.createdAt : Date.now(),
        updatedAt: Date.now(),
      };

      await db.scenes.put(queueItem);
      setCreatedScene(queueItem);

      // 2. Resolve assigned character records with portraits
      const assigned = projectCharacters.filter((c) => selectedCharIds.includes(c.id));

      showToast(`Generating image for Scene ${queueItem.scene}...`, 'info');

      // 3. Generate image
      const attempt = await generateSceneImage(queueItem, assigned, generationSettings);
      setGeneratedAttempt(attempt);

      // 4. Retrieve blob URL for immediate preview
      if (attempt.imageBlobId) {
        const url = await getResultBlobUrl(attempt.imageBlobId);
        setResultImageUrl(url);
      }

      showToast(`Scene ${queueItem.scene} generated successfully!`, 'success');
      syncBus.broadcast('SCENES_BATCH_IMPORTED', { count: 1 });
      onSceneCreated?.(queueItem);
    } catch (err: any) {
      console.error('Quick generation error:', err);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <Play className="w-4 h-4 text-zinc-200 fill-current" />
            <h2 className="text-sm font-semibold text-white">Paste JSON & Generate</h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300 ml-1">
              {generationSettings.provider.toUpperCase()}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
          {/* Result View if generated */}
          {generatedAttempt && resultImageUrl ? (
            <div className="flex flex-col items-center gap-4 py-2">
              <div className="flex items-center justify-between w-full pb-2 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-white text-sm">
                    Scene {createdScene?.scene} · Attempt v{generatedAttempt.attemptNumber}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/40 text-emerald-300 border border-emerald-800/50">
                    Generated
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" onClick={handleDownload} icon={<Download className="w-3.5 h-3.5" />}>
                    Download
                  </Button>
                  <Button variant="primary" size="sm" onClick={handleResetForNext} icon={<RefreshCw className="w-3.5 h-3.5" />}>
                    Generate Another
                  </Button>
                </div>
              </div>

              {/* 9:16 Portrait Result Display */}
              <div className="relative w-full max-w-[260px] aspect-[9/16] rounded-lg overflow-hidden border border-zinc-700 bg-black shadow-lg">
                <img
                  src={resultImageUrl}
                  alt={`Scene ${createdScene?.scene}`}
                  className="w-full h-full object-cover"
                />
              </div>

              {createdScene && (
                <div className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-zinc-400 font-mono text-[11px] flex justify-between items-center">
                  <span>Saved to project queue: {createdScene.id}</span>
                  <button
                    onClick={() => {
                      onClose();
                      onSceneCreated?.(createdScene);
                    }}
                    className="text-white hover:underline flex items-center gap-1 font-sans text-xs"
                  >
                    View in Workspace <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Input & Generation Setup */
            <>
              {/* Input Field / Textarea */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-zinc-200">
                    Paste Image Prompt JSON
                  </label>
                  {detectedSceneNumber && (
                    <span className="font-mono text-zinc-300 bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700 text-[11px]">
                      Detected Scene {detectedSceneNumber} · {detectedAspectRatio}
                    </span>
                  )}
                </div>

                <textarea
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                  placeholder={`{\n  "scene": "68AD",\n  "title": "Confrontation in San Agustin Courtyard",\n  "aspect_ratio": "9:16",\n  "prompt": "Cinematic vertical portrait shot of Mateo Santos in rain...",\n  "characters_visible": ["Mateo Santos"]\n}`}
                  rows={8}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 font-mono leading-relaxed resize-y"
                  disabled={isGenerating}
                />

                {parseError && (
                  <div className="flex items-center gap-1.5 text-rose-400 text-[11px] pt-0.5">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>{parseError}</span>
                  </div>
                )}
                {detectedTitle && (
                  <p className="text-zinc-400 text-[11px] truncate">
                    Title: <span className="text-zinc-200">{detectedTitle}</span>
                  </p>
                )}
              </div>

              {/* Character Reference Conditioning */}
              <div className="flex flex-col gap-2 pt-2 border-t border-zinc-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-zinc-400" />
                    <span className="font-semibold text-zinc-200">Condition on Character Reference</span>
                    <span className="text-[10px] text-zinc-500 font-mono">({selectedCharIds.length} active)</span>
                  </div>
                  <span className="text-[10px] text-zinc-500">Auto-detected from library</span>
                </div>

                {projectCharacters.length === 0 ? (
                  <p className="text-zinc-500 text-[11px] italic bg-zinc-950 p-2.5 rounded border border-dashed border-zinc-800 text-center">
                    No characters registered in library yet. Image will generate from prompt text.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {projectCharacters.map((char) => {
                      const isSelected = selectedCharIds.includes(char.id);
                      const thumb = thumbUrls[char.id];

                      return (
                        <div
                          key={char.id}
                          onClick={() => toggleCharacter(char.id)}
                          className={`flex items-center gap-2 p-1.5 rounded-md border cursor-pointer select-none transition-all ${
                            isSelected
                              ? 'bg-zinc-800 border-zinc-300 text-white'
                              : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                          }`}
                        >
                          {thumb ? (
                            <img
                              src={thumb}
                              alt={char.name}
                              className={`w-7 h-9 object-cover rounded shrink-0 border ${
                                isSelected ? 'border-zinc-300' : 'border-zinc-800'
                              }`}
                            />
                          ) : (
                            <div className="w-7 h-9 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[10px] font-mono text-zinc-500 shrink-0">
                              {char.name.charAt(0)}
                            </div>
                          )}

                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="text-xs font-semibold truncate leading-tight">{char.name}</span>
                            <span className="text-[10px] text-zinc-500">{isSelected ? 'Active' : 'Click to add'}</span>
                          </div>

                          {isSelected && <Check className="w-3.5 h-3.5 text-white shrink-0 mr-1" />}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!generatedAttempt && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-800 bg-zinc-950/60 shrink-0">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={isGenerating}>
              Cancel
            </Button>
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
        )}
      </div>
    </div>
  );
};
