import React, { useEffect, useState } from 'react';
import { Upload, Copy, Check, User, MapPin } from 'lucide-react';
import { QueueItem } from '../../types/queue';
import { ExtractedReference } from '../../types/prompt';
import { Button } from '../common/Button';
import { useToast } from '../common/Toast';
import { ingestReferenceAsset, getReferenceBlobUrl } from '../../services/assetManager';
import { db } from '../../services/db';

interface RefChecklistProps {
  scene: QueueItem;
  onRefresh?: () => void;
}

export const RefChecklist: React.FC<RefChecklistProps> = ({ scene, onRefresh }) => {
  const { showToast } = useToast();
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    let active = true;
    const loadUrls = async () => {
      const urls: Record<string, string> = {};
      for (const ref of scene.extractedReferences) {
        if (ref.matchedBlobId) {
          const url = await getReferenceBlobUrl(ref.matchedBlobId);
          if (url) urls[ref.filename] = url;
        }
      }
      if (active) setThumbUrls(urls);
    };

    loadUrls();
    return () => {
      active = false;
      Object.values(thumbUrls).forEach((u) => URL.revokeObjectURL(u));
    };
  }, [scene]);

  const handleCopyRefFilenames = async () => {
    const filenames = scene.extractedReferences.map((r) => r.filename).join('\n');
    if (!filenames) return;
    try {
      await navigator.clipboard.writeText(filenames);
      showToast('Reference filenames copied!', 'success');
    } catch {
      showToast('Failed to copy reference filenames.', 'error');
    }
  };

  const handleCopyImageToClipboard = async (ref: ExtractedReference) => {
    if (!ref.matchedBlobId) return;
    try {
      const asset = await db.referenceImages.get(ref.matchedBlobId);
      if (!asset || !asset.dataBlob) {
        showToast('Image file data not found in local storage.', 'error');
        return;
      }

      let pngBlob = asset.dataBlob;
      if (asset.mimeType !== 'image/png') {
        const bitmap = await createImageBitmap(asset.dataBlob);
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(bitmap, 0, 0);
        const converted = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
        if (converted) pngBlob = converted;
      }

      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': pngBlob }),
      ]);
      showToast(`Copied ${ref.filename} to clipboard (Paste in ChatGPT)`, 'success');
    } catch (err) {
      console.error('Clipboard copy error:', err);
      showToast('Could not copy image binary to clipboard.', 'error');
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        await ingestReferenceAsset(files[i]);
      }
      showToast(`Mapped ${files.length} reference asset(s)`, 'success');
      onRefresh?.();
    } catch (err) {
      console.error('Failed to map reference asset:', err);
      showToast('Error uploading reference asset.', 'error');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const refs = scene.extractedReferences;

  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-3 flex flex-col gap-2.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-zinc-300">
            Reference Checklist
          </span>
          <span className="text-[11px] text-zinc-500 font-mono">
            ({refs.filter((r) => r.isMatched).length}/{refs.length})
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {refs.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyRefFilenames}
              className="text-[11px] text-zinc-400 hover:text-zinc-200 h-6 px-1.5"
            >
              Copy Names
            </Button>
          )}

          <label className="cursor-pointer">
            <span className="inline-flex items-center justify-center font-medium rounded-md text-xs px-2.5 py-1 gap-1.5 bg-zinc-850 hover:bg-zinc-800 text-zinc-300 border border-zinc-700/80 transition-colors">
              <Upload className="w-3 h-3 text-zinc-400" />
              <span>{isUploading ? 'Mapping...' : 'Map Files'}</span>
            </span>
            <input
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
              disabled={isUploading}
            />
          </label>
        </div>
      </div>

      {/* Checklist items */}
      {refs.length === 0 ? (
        <div className="text-[11px] text-zinc-500 italic py-2 text-center bg-zinc-950/40 rounded border border-dashed border-zinc-850">
          No external character or location references extracted.
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {refs.map((ref, idx) => {
            const hasThumb = Boolean(thumbUrls[ref.filename]);
            const isCharacter = ref.category === 'character';

            return (
              <div
                key={idx}
                className="flex items-center justify-between p-2 rounded border border-zinc-800/80 bg-zinc-950/50 hover:bg-zinc-900/40 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {hasThumb ? (
                    <img
                      src={thumbUrls[ref.filename]}
                      alt={ref.filename}
                      className="w-7 h-7 rounded object-cover border border-zinc-700 shrink-0"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded flex items-center justify-center border border-zinc-800 bg-zinc-900 text-zinc-500 shrink-0">
                      {isCharacter ? <User className="w-3.5 h-3.5" /> : <MapPin className="w-3.5 h-3.5" />}
                    </div>
                  )}

                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-mono text-zinc-200 truncate" title={ref.filename}>
                      {ref.filename}
                    </span>
                    <span className="text-[10px] text-zinc-500 capitalize">
                      {ref.category} {ref.label ? `· ${ref.label}` : ''}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  {ref.isMatched ? (
                    <>
                      <button
                        onClick={() => handleCopyImageToClipboard(ref)}
                        title="Copy image binary to clipboard (Ctrl+V into ChatGPT)"
                        className="inline-flex items-center gap-1 text-[10px] font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 px-2 py-0.5 rounded border border-zinc-700 transition-colors"
                      >
                        <Copy className="w-2.5 h-2.5" />
                        <span>Copy Image</span>
                      </button>
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-900/60 font-mono">
                        <Check className="w-2.5 h-2.5" />
                        <span>Ready</span>
                      </span>
                    </>
                  ) : (
                    <span className="text-[10px] text-zinc-500 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800 font-mono">
                      Unmapped
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
