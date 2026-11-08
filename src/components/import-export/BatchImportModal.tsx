import React, { useState } from 'react';
import { UploadCloud, Check, AlertCircle, X } from 'lucide-react';
import { parseImagePromptJson } from '../../services/parser';
import { ParsedScenePrompt } from '../../types/prompt';
import { QueueItem } from '../../types/queue';
import { db } from '../../services/db';
import { syncBus } from '../../services/sync';
import { getProjectCharacters, autoMatchCharactersForScene, validateCharacterSelection } from '../../services/characterManager';
import { Button } from '../common/Button';
import { useToast } from '../common/Toast';

interface BatchImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
}

export const BatchImportModal: React.FC<BatchImportModalProps> = ({
  isOpen,
  onClose,
  onImportComplete,
}) => {
  const [tab, setTab] = useState<'files' | 'paste'>('files');
  const [pastedJson, setPastedJson] = useState('');
  const [parsedPreview, setParsedPreview] = useState<ParsedScenePrompt[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { showToast } = useToast();

  if (!isOpen) return null;

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsProcessing(true);
    setParseError(null);

    const collected: ParsedScenePrompt[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.name.endsWith('.json')) continue;
        const text = await file.text();
        const results = parseImagePromptJson(text, file.name);
        collected.push(...results);
      }

      if (collected.length === 0) {
        setParseError('No valid scene prompts could be extracted.');
      } else {
        setParsedPreview(collected);
      }
    } catch (err: any) {
      setParseError(err.message || 'Error parsing JSON files.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleParsePasted = () => {
    setParseError(null);
    if (!pastedJson.trim()) {
      setParseError('Please paste prompt JSON text first.');
      return;
    }

    try {
      const results = parseImagePromptJson(pastedJson, 'Pasted_Batch');
      setParsedPreview(results);
    } catch (err: any) {
      setParseError(err.message || 'Syntax error in pasted JSON.');
      setParsedPreview([]);
    }
  };

  const handleCommitImport = async () => {
    if (parsedPreview.length === 0) return;
    setIsProcessing(true);

    try {
      const newQueueItems: QueueItem[] = [];
      const projectId = 'proj_default';
      const projectCharacters = await getProjectCharacters(projectId);

      for (const item of parsedPreview) {
        const existing = await db.scenes.get(item.id);

        let initialQueueItem: QueueItem = {
          id: item.id,
          projectId,
          projectTitle: item.metadata.project_title || item.metadata.project || 'Project',
          episode: String(item.metadata.episode || '01'),
          part: String(item.metadata.part || '01'),
          scene: String(item.metadata.scene || '01'),
          title: item.metadata.title,
          rawJsonText: item.rawJsonText,
          metadata: item.metadata,
          selectedCharacterIds: existing?.selectedCharacterIds || [],
          extractedReferences: item.extractedReferences,
          validationIssues: item.validationIssues,
          status: existing ? existing.status : 'queued',
          currentAttemptNumber: existing ? existing.currentAttemptNumber : 0,
          attempts: existing ? existing.attempts : [],
          createdAt: existing ? existing.createdAt : Date.now(),
          updatedAt: Date.now(),
        };

        // If newly imported without character assignments, auto-match from project library
        if (!existing || initialQueueItem.selectedCharacterIds.length === 0) {
          const autoMatched = autoMatchCharactersForScene(initialQueueItem, projectCharacters);
          if (autoMatched.length > 0) {
            initialQueueItem.selectedCharacterIds = autoMatched;
            const validation = validateCharacterSelection(initialQueueItem);
            if (validation.isValid) {
              initialQueueItem.status = 'ready';
            }
          }
        }

        await db.scenes.put(initialQueueItem);
        newQueueItems.push(initialQueueItem);
      }

      syncBus.broadcast('SCENES_BATCH_IMPORTED', { count: newQueueItems.length });
      showToast(`Imported ${newQueueItems.length} scene prompt(s)`, 'success');
      onImportComplete?.();
      onClose();
    } catch (err: any) {
      console.error('Import error:', err);
      showToast(err.message || 'Failed to save scenes.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg max-w-xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">Import Prompt JSONs</h3>
            <p className="text-xs text-zinc-400">
              Upload files or paste raw JSON. Preserves exact source text.
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded text-zinc-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-800 px-4 pt-1.5 gap-3 text-xs">
          <button
            onClick={() => setTab('files')}
            className={`pb-2 border-b-2 font-medium transition-colors ${
              tab === 'files'
                ? 'border-zinc-100 text-zinc-100'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Upload JSON Files
          </button>
          <button
            onClick={() => setTab('paste')}
            className={`pb-2 border-b-2 font-medium transition-colors ${
              tab === 'paste'
                ? 'border-zinc-100 text-zinc-100'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Paste Batch Text
          </button>
        </div>

        {/* Content body */}
        <div className="p-4 flex-1 overflow-y-auto flex flex-col gap-3">
          {tab === 'files' ? (
            <div className="border border-dashed border-zinc-750 hover:border-zinc-600 rounded-lg p-7 text-center bg-zinc-950/40 flex flex-col items-center justify-center gap-2 transition-colors">
              <label className="cursor-pointer flex flex-col items-center gap-1.5">
                <UploadCloud className="w-7 h-7 text-zinc-400" />
                <span className="text-xs font-medium text-zinc-200">
                  Select Prompt JSON Files
                </span>
                <span className="text-[11px] text-zinc-500">
                  Drag and drop files here, or click to browse
                </span>
                <input
                  type="file"
                  multiple
                  accept=".json,application/json"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e.target.files)}
                  disabled={isProcessing}
                />
              </label>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <textarea
                value={pastedJson}
                onChange={(e) => setPastedJson(e.target.value)}
                placeholder="Paste Image Prompt JSON or JSON array here..."
                className="w-full h-40 bg-zinc-950 border border-zinc-800 rounded-md p-2.5 text-xs font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
              />
              <div className="flex justify-end">
                <Button variant="secondary" size="sm" onClick={handleParsePasted}>
                  Parse & Validate
                </Button>
              </div>
            </div>
          )}

          {/* Error display */}
          {parseError && (
            <div className="p-2.5 rounded bg-rose-950/40 border border-rose-900/50 text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>{parseError}</span>
            </div>
          )}

          {/* Parsed summary preview */}
          {parsedPreview.length > 0 && (
            <div className="bg-zinc-950/60 border border-zinc-800 rounded-md p-3 flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-zinc-200 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Ready to Import: {parsedPreview.length} Scene(s)</span>
                </span>
                <span className="text-[11px] text-zinc-500 font-mono">
                  Refs: {parsedPreview.reduce((acc, p) => acc + p.extractedReferences.length, 0)}
                </span>
              </div>

              <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pt-1 font-mono text-[11px]">
                {parsedPreview.map((p, idx) => (
                  <span
                    key={idx}
                    className="px-1.5 py-0.5 rounded bg-zinc-850 text-zinc-300 border border-zinc-800"
                  >
                    Sc {p.metadata.scene}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-2.5 border-t border-zinc-800 bg-zinc-900/80">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isProcessing}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleCommitImport}
            disabled={parsedPreview.length === 0 || isProcessing}
          >
            {isProcessing ? 'Importing...' : `Add ${parsedPreview.length} Scene(s)`}
          </Button>
        </div>
      </div>
    </div>
  );
};
