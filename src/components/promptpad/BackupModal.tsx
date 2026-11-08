import React, { useRef, useState } from 'react';
import { X, Download, Upload, Check, AlertCircle } from 'lucide-react';
import { Note } from '../../types/note';
import { triggerBackupDownload, importNotesFromJson } from '../../services/noteManager';
import { Button } from '../common/Button';
import { useToast } from '../common/Toast';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  notes: Note[];
  onNotesImported: (importedNotes: Note[]) => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({
  isOpen,
  onClose,
  notes,
  onNotesImported,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const { showToast } = useToast();

  if (!isOpen) return null;

  const handleExport = () => {
    try {
      triggerBackupDownload(notes);
      showToast('Notes backup downloaded successfully!', 'success');
      setImportStatus({ type: 'success', message: `Exported ${notes.length} notes.` });
    } catch (err: any) {
      showToast('Failed to export notes', 'error');
      setImportStatus({ type: 'error', message: err.message || 'Export failed' });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;

      const result = importNotesFromJson(content);
      if (result.success && result.notes) {
        onNotesImported(result.notes);
        showToast(result.message, 'success');
        setImportStatus({ type: 'success', message: result.message });
      } else {
        showToast(result.message, 'error');
        setImportStatus({ type: 'error', message: result.message });
      }
    };
    reader.onerror = () => {
      showToast('Error reading file', 'error');
      setImportStatus({ type: 'error', message: 'Failed to read file' });
    };
    reader.readAsText(file);

    // reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-zinc-300" />
            <h2 className="text-sm font-semibold text-white">Backup & Restore Notes</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4 text-xs">
          <p className="text-zinc-400 leading-relaxed">
            Export your saved notes to a JSON backup file on your computer, or restore previously saved prompts.
          </p>

          {/* Export Action Card */}
          <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-zinc-200">Export All Notes</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                Download a JSON backup of all {notes.length} note{notes.length === 1 ? '' : 's'}.
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExport}
              icon={<Download className="w-3.5 h-3.5" />}
            >
              Export
            </Button>
          </div>

          {/* Import Action Card */}
          <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-zinc-200">Restore from Backup</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                Import notes from a previously exported JSON file.
              </p>
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={handleFileChange}
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                icon={<Upload className="w-3.5 h-3.5" />}
              >
                Import
              </Button>
            </div>
          </div>

          {/* Status Message */}
          {importStatus && (
            <div
              className={`p-2.5 rounded-lg border flex items-center gap-2 text-[11px] ${
                importStatus.type === 'success'
                  ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-800/60 text-rose-300'
              }`}
            >
              {importStatus.type === 'success' ? (
                <Check className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
              )}
              <span>{importStatus.message}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-4 py-2.5 border-t border-zinc-800 bg-zinc-950/60">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};
