import React, { useState } from 'react';
import { Send, Check, RotateCcw } from 'lucide-react';
import { QueueItem, QueueStatus } from '../../types/queue';
import { Button } from '../common/Button';
import { StatusBadge } from '../common/Badge';
import { db } from '../../services/db';
import { syncBus } from '../../services/sync';
import { useToast } from '../common/Toast';

interface StatusTransitionBarProps {
  scene: QueueItem;
  onStatusChange?: () => void;
}

export const StatusTransitionBar: React.FC<StatusTransitionBarProps> = ({ scene, onStatusChange }) => {
  const [showRegenInput, setShowRegenInput] = useState(false);
  const [regenNotes, setRegenNotes] = useState('');
  const { showToast } = useToast();

  const updateStatus = async (newStatus: QueueStatus, notes?: string) => {
    try {
      const updatedAttempts = [...scene.attempts];
      if (newStatus === 'approved' && updatedAttempts.length > 0) {
        updatedAttempts[updatedAttempts.length - 1].status = 'approved';
      } else if (newStatus === 'regeneration_required' && updatedAttempts.length > 0) {
        updatedAttempts[updatedAttempts.length - 1].status = 'rejected';
        if (notes) {
          updatedAttempts[updatedAttempts.length - 1].notes = notes;
        }
      }

      const updatedScene: QueueItem = {
        ...scene,
        status: newStatus,
        attempts: updatedAttempts,
        updatedAt: Date.now(),
        notes: notes || scene.notes,
      };

      await db.scenes.put(updatedScene);
      syncBus.broadcast('STATUS_CHANGED', { sceneId: scene.id, status: newStatus });
      showToast(`Status: ${newStatus.replace('_', ' ')}`, 'success');
      onStatusChange?.();
    } catch (err) {
      console.error('Failed to update status:', err);
      showToast('Error updating status.', 'error');
    }
  };

  const handleConfirmRegeneration = async () => {
    if (!regenNotes.trim()) {
      showToast('Please add brief revision feedback.', 'info');
      return;
    }
    await updateStatus('regeneration_required', regenNotes);
    setShowRegenInput(false);
    setRegenNotes('');
  };

  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-3 flex flex-col gap-2.5">
      {/* Status & Quick Transition Controls */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400">Status:</span>
          <StatusBadge status={scene.status} />
        </div>

        <div className="flex items-center gap-1.5">
          {/* If Copied or Queued: Offer Mark as Submitted */}
          {(scene.status === 'copied' || scene.status === 'queued') && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => updateStatus('submitted')}
              icon={<Send className="w-3 h-3 text-zinc-300" />}
              title="Confirm prompt was pasted into ChatGPT"
            >
              Mark Submitted
            </Button>
          )}

          {/* Approve button */}
          <Button
            variant={scene.status === 'approved' ? 'secondary' : 'primary'}
            size="sm"
            onClick={() => updateStatus('approved')}
            icon={<Check className="w-3.5 h-3.5" />}
            disabled={scene.status === 'approved'}
          >
            {scene.status === 'approved' ? 'Approved' : 'Approve Scene'}
          </Button>

          {/* Request Revision */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowRegenInput(!showRegenInput)}
            icon={<RotateCcw className="w-3 h-3 text-zinc-400" />}
            className="text-zinc-400 hover:text-zinc-200"
          >
            Regen
          </Button>

          {scene.status !== 'queued' && (
            <button
              onClick={() => updateStatus('queued')}
              className="text-[11px] text-zinc-500 hover:text-zinc-300 ml-1"
              title="Reset status back to Queued"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Inline Regeneration Feedback Drawer */}
      {showRegenInput && (
        <div className="pt-2 border-t border-zinc-800/80 flex flex-col gap-2">
          <label className="text-xs text-zinc-300 font-medium">
            Revision Feedback / Notes for Next Attempt:
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={regenNotes}
              onChange={(e) => setRegenNotes(e.target.value)}
              placeholder="e.g. Needs higher contrast on Cooke lens bokeh, increase rim light..."
              className="flex-1 bg-zinc-950 border border-zinc-700/80 rounded-md px-2.5 py-1 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
              onKeyDown={(e) => e.key === 'Enter' && handleConfirmRegeneration()}
            />
            <Button variant="danger" size="sm" onClick={handleConfirmRegeneration}>
              Save & Mark Regen
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowRegenInput(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
