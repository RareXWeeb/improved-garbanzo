import React, { useState, useEffect } from 'react';
import { Eye, X } from 'lucide-react';
import { GenerationAttempt, QueueItem } from '../../types/queue';
import { getResultBlobUrl } from '../../services/assetManager';

interface AttemptHistoryProps {
  scene: QueueItem;
}

export const AttemptHistory: React.FC<AttemptHistoryProps> = ({ scene }) => {
  const [selectedAttempt, setSelectedAttempt] = useState<GenerationAttempt | null>(null);
  const [attemptThumbUrls, setAttemptThumbUrls] = useState<Record<string, string>>({});

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
              className="flex items-center justify-between p-1.5 rounded border border-zinc-800/70 bg-zinc-950/40 text-xs"
            >
              <div className="flex items-center gap-2 min-w-0">
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
                    title="View attempt image"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Inspect modal */}
      {selectedAttempt && attemptThumbUrls[selectedAttempt.id] && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg max-w-md w-full p-3 shadow-xl flex flex-col gap-2.5">
            <div className="flex items-center justify-between pb-1.5 border-b border-zinc-800 text-xs">
              <span className="font-mono font-medium text-zinc-200">
                Scene {scene.scene} · Attempt v{selectedAttempt.attemptNumber}
              </span>
              <button
                onClick={() => setSelectedAttempt(null)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex justify-center bg-black/50 rounded p-1">
              <img
                src={attemptThumbUrls[selectedAttempt.id]}
                alt="Attempt detail"
                className="max-h-[60vh] object-contain rounded"
              />
            </div>

            {selectedAttempt.notes && (
              <div className="p-2 rounded bg-zinc-950 border border-zinc-800 text-xs text-zinc-300">
                <span className="text-zinc-500 font-medium">Feedback: </span>
                {selectedAttempt.notes}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
