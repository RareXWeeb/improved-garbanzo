import React, { useState } from 'react';
import { Download, FileText, Database, Upload, X } from 'lucide-react';
import { QueueItem } from '../../types/queue';
import {
  exportBatchAsZip,
  generateBatchManifest,
  backupDatabaseToJson,
  restoreDatabaseFromJson,
  triggerFileDownload,
} from '../../services/exporter';
import { syncBus } from '../../services/sync';
import { Button } from '../common/Button';
import { useToast } from '../common/Toast';

interface BatchExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  scenes: QueueItem[];
}

export const BatchExportModal: React.FC<BatchExportModalProps> = ({ isOpen, onClose, scenes }) => {
  const [onlyApproved, setOnlyApproved] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [progressStatus, setProgressStatus] = useState<string>('');
  const [progressPct, setProgressPct] = useState<number>(0);
  const { showToast } = useToast();

  if (!isOpen) return null;

  const approvedCount = scenes.filter((s) => s.status === 'approved').length;
  const projectTitle = scenes[0]?.projectTitle || 'SceneForge';

  const handleExportZip = async () => {
    setIsExporting(true);
    setProgressPct(5);
    setProgressStatus('Packaging files...');

    try {
      const zipBlob = await exportBatchAsZip(scenes, {
        onlyApproved,
        onProgress: (pct, status) => {
          setProgressPct(pct);
          setProgressStatus(status);
        },
      });

      const filename = `${projectTitle}_Batch_${Date.now()}.zip`;
      triggerFileDownload(zipBlob, filename, 'application/zip');
      showToast('Batch ZIP exported successfully', 'success');
      onClose();
    } catch (err: any) {
      console.error('ZIP export error:', err);
      showToast(err.message || 'Error creating ZIP export.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportManifest = async () => {
    try {
      const manifest = await generateBatchManifest(scenes);
      const jsonStr = JSON.stringify(manifest, null, 2);
      triggerFileDownload(jsonStr, `${projectTitle}_manifest.json`, 'application/json');
      showToast('Manifest JSON exported', 'success');
    } catch {
      showToast('Error exporting manifest.', 'error');
    }
  };

  const handleExportBackup = async () => {
    try {
      const backupJson = await backupDatabaseToJson();
      triggerFileDownload(backupJson, `sceneforge_backup_${Date.now()}.json`, 'application/json');
      showToast('Database backup saved', 'success');
    } catch {
      showToast('Error backing up database.', 'error');
    }
  };

  const handleRestoreBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const count = await restoreDatabaseFromJson(text);
      syncBus.broadcast('SCENES_BATCH_IMPORTED', { count });
      showToast(`Restored ${count} scenes from backup`, 'success');
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Error restoring database backup.', 'error');
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg max-w-md w-full flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">Export Deliverables</h3>
            <p className="text-xs text-zinc-400">
              Download formatted results, manifest, or full backup.
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded text-zinc-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 flex flex-col gap-3.5">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800 flex flex-col gap-0.5">
              <span className="text-zinc-500">Total in Queue</span>
              <span className="text-sm font-mono font-bold text-zinc-200">{scenes.length}</span>
            </div>
            <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800 flex flex-col gap-0.5">
              <span className="text-zinc-500">Approved</span>
              <span className="text-sm font-mono font-bold text-emerald-400">{approvedCount}</span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 p-2.5 rounded bg-zinc-950 border border-zinc-800">
            <label className="flex items-center gap-2 text-xs text-zinc-200 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyApproved}
                onChange={(e) => setOnlyApproved(e.target.checked)}
                className="w-3.5 h-3.5 accent-zinc-100 rounded"
              />
              <span>Export only Approved images ({approvedCount})</span>
            </label>
            <p className="text-[11px] text-zinc-500 font-mono pl-5">
              {projectTitle}_Ep01_P01_Sc68AD_v1.png
            </p>
          </div>

          {/* Progress bar */}
          {isExporting && (
            <div className="flex flex-col gap-1 p-2.5 rounded bg-zinc-950 border border-zinc-800 text-xs">
              <div className="flex justify-between font-mono text-[11px]">
                <span className="text-zinc-400">{progressStatus}</span>
                <span className="text-zinc-200">{progressPct}%</span>
              </div>
              <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-zinc-200 transition-all duration-150"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          {/* Secondary backup actions */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-800 text-xs">
            <button
              onClick={handleExportManifest}
              className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Manifest JSON</span>
            </button>

            <div className="flex items-center gap-3">
              <button
                onClick={handleExportBackup}
                className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200"
              >
                <Database className="w-3.5 h-3.5" />
                <span>DB Backup</span>
              </button>

              <label className="cursor-pointer flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200">
                <Upload className="w-3.5 h-3.5" />
                <span>Restore</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={handleRestoreBackup}
                />
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-2.5 border-t border-zinc-800 bg-zinc-900/80">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isExporting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleExportZip}
            disabled={isExporting || (onlyApproved && approvedCount === 0)}
            icon={<Download className="w-3.5 h-3.5" />}
          >
            {isExporting ? 'Packaging...' : 'Download ZIP'}
          </Button>
        </div>
      </div>
    </div>
  );
};
