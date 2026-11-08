import React, { useState, useEffect } from 'react';
import { Users, AlertTriangle, Check, RefreshCw } from 'lucide-react';
import { QueueItem, CharacterRecord } from '../../types/queue';
import { db } from '../../services/db';
import { syncBus } from '../../services/sync';
import { autoMatchCharactersForScene, validateCharacterSelection } from '../../services/characterManager';
import { Button } from '../common/Button';
import { useToast } from '../common/Toast';

interface SceneCharacterSelectorProps {
  scene: QueueItem;
  projectCharacters: CharacterRecord[];
  onUpdated?: () => void;
}

export const SceneCharacterSelector: React.FC<SceneCharacterSelectorProps> = ({
  scene,
  projectCharacters,
  onUpdated,
}) => {
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  const { showToast } = useToast();

  useEffect(() => {
    const urls: Record<string, string> = {};
    projectCharacters.forEach((c) => {
      if (c.portraitBlob) {
        urls[c.id] = URL.createObjectURL(c.portraitBlob);
      }
    });
    setThumbUrls(urls);

    return () => {
      Object.values(urls).forEach((u) => URL.revokeObjectURL(u));
    };
  }, [projectCharacters]);

  const selectedIds = new Set(scene.selectedCharacterIds || []);
  const validation = validateCharacterSelection(scene);

  const toggleCharacter = async (charId: string) => {
    const updated = new Set(selectedIds);
    if (updated.has(charId)) {
      updated.delete(charId);
    } else {
      updated.add(charId);
    }

    const updatedScene: QueueItem = {
      ...scene,
      selectedCharacterIds: Array.from(updated),
      characterMismatchAcknowledged: false, // Reset acknowledgment on manual toggle
      updatedAt: Date.now(),
    };

    // Update status to ready or needs_references based on selection
    if (updated.size === 0 && Number(scene.metadata.exact_character_count || 0) > 0) {
      updatedScene.status = 'needs_references';
    } else if (scene.status === 'needs_references' || scene.status === 'queued') {
      updatedScene.status = 'ready';
    }

    await db.scenes.put(updatedScene);
    syncBus.broadcast('STATUS_CHANGED', { sceneId: scene.id });
    onUpdated?.();
  };

  const handleAutoDetect = async () => {
    const matched = autoMatchCharactersForScene(scene, projectCharacters);
    const updatedScene: QueueItem = {
      ...scene,
      selectedCharacterIds: matched,
      characterMismatchAcknowledged: false,
      status: matched.length > 0 || (scene.metadata.exact_character_count || 0) === 0 ? 'ready' : 'needs_references',
      updatedAt: Date.now(),
    };
    await db.scenes.put(updatedScene);
    syncBus.broadcast('STATUS_CHANGED', { sceneId: scene.id });
    showToast(`Auto-matched ${matched.length} character reference(s)`, 'success');
    onUpdated?.();
  };

  const handleAcknowledgeMismatch = async () => {
    const updatedScene: QueueItem = {
      ...scene,
      characterMismatchAcknowledged: true,
      status: 'ready',
      updatedAt: Date.now(),
    };
    await db.scenes.put(updatedScene);
    syncBus.broadcast('STATUS_CHANGED', { sceneId: scene.id });
    showToast('Character count mismatch acknowledged. Generation unblocked.', 'info');
    onUpdated?.();
  };

  const expectedCount = scene.metadata.exact_character_count;

  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-3 flex flex-col gap-2.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-zinc-300" />
          <span className="text-xs font-semibold text-zinc-200">
            Assigned Characters
          </span>
          <span className="text-[11px] font-mono text-zinc-500">
            ({selectedIds.size}{expectedCount !== undefined ? ` / ${expectedCount} required` : ''})
          </span>
        </div>

        {projectCharacters.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleAutoDetect}
            className="text-[11px] h-6 px-1.5 text-zinc-400 hover:text-zinc-200"
            icon={<RefreshCw className="w-3 h-3" />}
          >
            Auto-Detect
          </Button>
        )}
      </div>

      {/* Mismatch Warning Alert */}
      {validation.warning && (
        <div className="p-2 rounded bg-amber-950/40 border border-amber-800/40 text-[11px] text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>{validation.warning}</span>
          </div>

          {!scene.characterMismatchAcknowledged && (
            <button
              onClick={handleAcknowledgeMismatch}
              className="text-[10px] font-medium bg-amber-900/60 hover:bg-amber-900 text-amber-100 px-2 py-0.5 rounded border border-amber-700/60 shrink-0 transition-colors"
            >
              Acknowledge & Unblock
            </button>
          )}
        </div>
      )}

      {/* Selectable Character Cards */}
      {projectCharacters.length === 0 ? (
        <div className="text-[11px] text-zinc-500 italic py-2 text-center bg-zinc-950/40 rounded border border-dashed border-zinc-850">
          No characters registered in library. Open the Character Library to add portraits.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {projectCharacters.map((char) => {
            const isSelected = selectedIds.has(char.id);
            const thumb = thumbUrls[char.id];

            return (
              <div
                key={char.id}
                onClick={() => toggleCharacter(char.id)}
                className={`flex items-center gap-2 p-1.5 rounded-md border cursor-pointer select-none transition-all ${
                  isSelected
                    ? 'bg-zinc-800 border-zinc-500 text-white shadow-sm'
                    : 'bg-zinc-950/50 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                }`}
              >
                {thumb ? (
                  <img
                    src={thumb}
                    alt={char.name}
                    className={`w-7 h-9 object-cover rounded shrink-0 border ${
                      isSelected ? 'border-zinc-400' : 'border-zinc-800'
                    }`}
                  />
                ) : (
                  <div className="w-7 h-9 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[10px] font-mono text-zinc-500 shrink-0">
                    {char.name.charAt(0)}
                  </div>
                )}

                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-xs font-semibold truncate leading-tight">{char.name}</span>
                  <span className="text-[10px] text-zinc-500 truncate">
                    {isSelected ? 'Selected' : 'Click to add'}
                  </span>
                </div>

                {isSelected && (
                  <Check className="w-3.5 h-3.5 text-zinc-200 shrink-0 mr-1" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
