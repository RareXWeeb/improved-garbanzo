import React, { useState, useEffect } from 'react';
import { Eye, X, Check } from 'lucide-react';
import { GenerationAttempt, QueueItem } from '../../types/queue';
import { getResultBlobUrl } from '../../services/assetManager';
import { db } from '../../services/db';
import { syncBus } from '../../services/sync';
import { Button } from '../common/Button';
import { useToast } from '../common/Toast';

interface AttemptHistoryProps {
  scene: QueueItem;
  onRefresh?: () => void;
}

export const AttemptHistory: React.FC<AttemptHistoryProps> = ({ scene, onRefresh }) => {
  const [selectedAttempt, setSelectedAttempt] = useState<GenerationAttempt | null>(null);
  const [attemptThumbUrls, setAttemptThumbUrls] = useState<Record<string, string>>({});
  const { showToast } = useToast();

  const attempts = scene.attempts || [];

  useEffect(() => {
    let active = true;
    const loadUrls = async () => {
      const urls: Record<string, string> = {};
      for (const att of attempts) {
        if (att.imageBlobId) {
          const url = await getResultBlobUrl(att.imageBlobId);
          if (url) urls[att.id] = url;
        }
      }
      if (active) setAttemptThumbUrls(urls);
    };

    loadUrls();
    return () => {
      active = false;
      Object.values(attemptThumbUrls).forEach((u) => URL.revokeObjectURL(u));
    };
  }, [scene]);

  const handlePromoteAttempt = async (attempt: GenerationAttempt) => {
    try {
      const updatedAttempts = attempts.map((a) => {
        if (a.id === attempt.id) {
          return { ...a, status: 'approved' as const };
        }
        if (a.status === 'approved') {
          return { ...a, status: 'rejected' as const };
        }
        return a;
      });

      const updatedScene: QueueItem = {
        ...scene,
        status: 'approved',
        attempts: updatedAttempts,
        updatedAt: Date.now(),
      };

      await db.scenes.put(updatedScene);
      syncBus.broadcast('STATUS_CHANGED', { sceneId: scene.id, status: 'approved' });
      showToast(`v${attempt.attemptNumber} marked as Approved deliverable!`, 'success');
      setSelectedAttempt(null);
      onRefresh?.();
    } catch (err) {
      console.error('Failed to promote attempt:', err);
      showToast('Error updating attempt status', 'error');
    }
  };

  if (attempts.length === 0) {
    return null;
  }

  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-300">
          History ({attempts.length} Attempt{attempts.length > 1 ? 's' : ''})
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        {attempts.map((att) => {
          const thumbUrl = attemptThumbUrls[att.id];
          const isApproved = att.status === 'approved';
          const isRejected = att.status === 'rejected';

          return (
            <div
              key={att.id}
              className="flex items-center justify-between p-1.5 rounded border border-zinc-800/70 bg-zinc-950/40 text-xs hover:border-zinc-700 transition-colors"
            >
              <div
                className="flex items-center gap-2 min-w-0 cursor-pointer flex-1"
                onClick={() => setSelectedAttempt(att)}
              >
                {thumbUrl ? (
                  <img
                    src={thumbUrl}
                    alt={`v${att.attemptNumber}`}
                    className="w-7 h-10 object-cover rounded border border-zinc-800 shrink-0"
                  />
                ) : (
                  <div className="w-7 h-10 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[10px] text-zinc-500 font-mono shrink-0">
                    v{att.attemptNumber}
                  </div>
                )}

                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-semibold text-zinc-200">
                      v{att.attemptNumber}
                    </span>
                    {att.provider && (
                      <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-zinc-800 text-zinc-400">
                        {att.provider}
                      </span>
                    )}
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {new Date(att.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {att.notes && (
                    <p className="text-[11px] text-zinc-400 truncate max-w-[220px]" title={att.notes}>
                      {att.notes}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                {isApproved && (
                  <span className="text-[10px] text-emerald-400 bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-900/60 font-mono">
                    Approved
                  </span>
                )}
                {isRejected && (
                  <span className="text-[10px] text-rose-400 bg-rose-950/40 px-1.5 py-0.5 rounded border border-rose-900/60 font-mono">
                    Rejected
                  </span>
                )}
                {thumbUrl && (
                  <button
                    onClick={() => setSelectedAttempt(att)}
                    className="p-1 text-zinc-400 hover:text-white rounded hover:bg-zinc-800"
                    title="View attempt detail"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Inspect attempt modal */}
      {selectedAttempt && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-lg w-full p-4 shadow-2xl flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-white text-sm">
                  Scene {scene.scene} · Attempt v{selectedAttempt.attemptNumber}
                </span>
                {selectedAttempt.provider && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
                    {selectedAttempt.provider}
                  </span>
                )}
              </div>
              <button
                onClick={() => setSelectedAttempt(null)}
                className="text-zinc-400 hover:text-white p-1 rounded hover:bg-zinc-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {attemptThumbUrls[selectedAttempt.id] && (
              <div className="flex justify-center bg-black/60 rounded-lg p-2 border border-zinc-800/80">
                <img
                  src={attemptThumbUrls[selectedAttempt.id]}
                  alt="Attempt detail"
                  className="max-h-[55vh] object-contain rounded"
                />
              </div>
            )}

            {selectedAttempt.effectivePrompt && (
              <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800/80 text-xs">
                <span className="text-zinc-400 font-medium block mb-1">Synthesized Prompt:</span>
                <p className="text-zinc-300 leading-relaxed max-h-24 overflow-y-auto text-[11px] font-mono">
                  {selectedAttempt.effectivePrompt}
                </p>
              </div>
            )}

            {selectedAttempt.notes && (
              <div className="p-2 rounded-lg bg-zinc-950 border border-zinc-800/80 text-xs text-zinc-300">
                <span className="text-zinc-500 font-medium">Feedback: </span>
                {selectedAttempt.notes}
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <Button variant="ghost" size="sm" onClick={() => setSelectedAttempt(null)}>
                Close
              </Button>
              {selectedAttempt.status !== 'approved' && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handlePromoteAttempt(selectedAttempt)}
                  icon={<Check className="w-3.5 h-3.5" />}
                >
                  Approve This Version
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
