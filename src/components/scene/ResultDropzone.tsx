import React, { useState, useEffect, useCallback } from 'react';
import { UploadCloud, RotateCcw, Clipboard } from 'lucide-react';
import { QueueItem } from '../../types/queue';
import { ingestGenerationResult, getResultBlobUrl } from '../../services/assetManager';
import { useToast } from '../common/Toast';

interface ResultDropzoneProps {
  scene: QueueItem;
  onResultIngested?: () => void;
}

export const ResultDropzone: React.FC<ResultDropzoneProps> = ({ scene, onResultIngested }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { showToast } = useToast();

  const latestAttempt = scene.attempts && scene.attempts.length > 0
    ? scene.attempts[scene.attempts.length - 1]
    : null;

  useEffect(() => {
    let active = true;
    const loadPreview = async () => {
      if (latestAttempt?.imageBlobId) {
        const url = await getResultBlobUrl(latestAttempt.imageBlobId);
        if (active) setPreviewUrl(url);
      } else {
        if (active) setPreviewUrl(null);
      }
    };

    loadPreview();
    return () => {
      active = false;
    };
  }, [latestAttempt]);

  const ingestBlob = useCallback(
    async (file: File | Blob, filenameHint?: string) => {
      setIsProcessing(true);
      try {
        const attempt = await ingestGenerationResult(scene.id, file, filenameHint);
        showToast(`Saved output as Attempt v${attempt.attemptNumber}`, 'success');
        onResultIngested?.();
      } catch (err: any) {
        console.error('Failed to ingest result image:', err);
        showToast(err.message || 'Error attaching result image.', 'error');
      } finally {
        setIsProcessing(false);
      }
    },
    [scene.id, onResultIngested, showToast]
  );

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];

    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image (PNG, JPG, WebP).', 'error');
      return;
    }

    await ingestBlob(file, file.name);
  };

  // Paste image directly from clipboard (e.g. Right-click image in ChatGPT -> Copy Image -> Ctrl+V)
  const handlePasteFromClipboard = useCallback(async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.read) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          for (const type of item.types) {
            if (type.startsWith('image/')) {
              const blob = await item.getType(type);
              await ingestBlob(blob, `chatgpt_output_${Date.now()}.png`);
              return;
            }
          }
        }
      }
      showToast('No copied image found in clipboard.', 'info');
    } catch {
      showToast('Click here and press Ctrl+V to paste copied image.', 'info');
    }
  }, [ingestBlob, showToast]);

  // Window paste listener
  useEffect(() => {
    const handleWindowPaste = (e: ClipboardEvent) => {
      // Don't intercept paste inside textareas or inputs
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            ingestBlob(file, `chatgpt_output_${Date.now()}.png`);
            return;
          }
        }
      }
    };

    window.addEventListener('paste', handleWindowPaste);
    return () => window.removeEventListener('paste', handleWindowPaste);
  }, [ingestBlob]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleFiles(e.dataTransfer.files);
    }
  };

  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-3 flex flex-col gap-2.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-300">
          Generated Output
        </span>

        <div className="flex items-center gap-1.5">
          {latestAttempt && (
            <span className="text-[10px] font-mono text-zinc-400 bg-zinc-850 px-2 py-0.5 rounded border border-zinc-800">
              Attempt v{latestAttempt.attemptNumber} · {latestAttempt.imageExtension?.toUpperCase()}
            </span>
          )}

          <button
            onClick={handlePasteFromClipboard}
            title="Paste copied image from clipboard (Ctrl+V)"
            className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white bg-zinc-850 hover:bg-zinc-800 px-2 py-0.5 rounded border border-zinc-800 transition-colors"
          >
            <Clipboard className="w-3 h-3" />
            <span>Paste</span>
          </button>
        </div>
      </div>

      {previewUrl ? (
        <div className="flex flex-col items-center gap-2.5 pt-1">
          {/* Vertical 9:16 Portrait Image Preview */}
          <div className="relative group w-full max-w-[220px] aspect-[9/16] rounded-lg overflow-hidden border border-zinc-700 bg-zinc-950 flex items-center justify-center">
            <img
              src={previewUrl}
              alt={`Scene ${scene.scene} Attempt`}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2.5 text-xs text-white">
              <span className="font-mono font-semibold">Scene {scene.scene} · v{latestAttempt?.attemptNumber}</span>
              <span className="text-[10px] text-zinc-300 font-mono">
                {latestAttempt?.timestamp ? new Date(latestAttempt.timestamp).toLocaleTimeString() : ''}
              </span>
            </div>
          </div>

          {/* Quick upload / paste new iteration */}
          <div className="flex items-center gap-2 w-full max-w-[220px]">
            <label className="cursor-pointer flex-1">
              <div className="border border-zinc-800 hover:border-zinc-700 rounded-md py-1.5 px-2 text-center bg-zinc-950 hover:bg-zinc-900 transition-colors flex items-center justify-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200">
                <RotateCcw className="w-3 h-3" />
                <span>Replace (v{(latestAttempt?.attemptNumber || 0) + 1})</span>
              </div>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
                disabled={isProcessing}
              />
            </label>

            <button
              onClick={handlePasteFromClipboard}
              title="Paste new image from clipboard"
              className="border border-zinc-800 hover:border-zinc-700 rounded-md py-1.5 px-2.5 bg-zinc-950 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <Clipboard className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        /* Empty dropzone */
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border border-dashed rounded-lg p-5 text-center transition-colors flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
            isDragging
              ? 'border-zinc-400 bg-zinc-900 text-white'
              : 'border-zinc-800 hover:border-zinc-700 bg-zinc-950/40 text-zinc-400'
          }`}
        >
          <label className="cursor-pointer flex flex-col items-center gap-1.5 w-full">
            <UploadCloud className={`w-5 h-5 ${isDragging ? 'text-white' : 'text-zinc-500'}`} />
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-medium text-zinc-300">
                Drop image here or press Ctrl+V to paste
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">
                Right-click image in ChatGPT → Copy Image → Ctrl+V
              </span>
            </div>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
              disabled={isProcessing}
            />
          </label>
        </div>
      )}
    </div>
  );
};
