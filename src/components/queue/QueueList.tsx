import React, { useMemo } from 'react';
import { QueueItem, FilterState } from '../../types/queue';
import { QueueItemCard } from './QueueItemCard';
import { compareSceneNumbers } from '../../services/parser';
import { Inbox } from 'lucide-react';

interface QueueListProps {
  scenes: QueueItem[];
  activeSceneId: string | null;
  filter: FilterState;
  onSelectScene: (scene: QueueItem) => void;
  onQuickCopy?: (scene: QueueItem, e: React.MouseEvent) => void;
}

export const QueueList: React.FC<QueueListProps> = ({
  scenes,
  activeSceneId,
  filter,
  onSelectScene,
  onQuickCopy,
}) => {
  const filteredScenes = useMemo(() => {
    return scenes
      .filter((s) => {
        if (filter.statusFilter !== 'all' && s.status !== filter.statusFilter) {
          return false;
        }

        if (filter.searchQuery.trim()) {
          const q = filter.searchQuery.toLowerCase().trim();
          const matchScene = s.scene.toLowerCase().includes(q);
          const matchTitle = (s.title || '').toLowerCase().includes(q);
          const matchLocation = JSON.stringify(s.metadata.location || '').toLowerCase().includes(q);
          const matchChars = (s.metadata.characters_visible || []).join(' ').toLowerCase().includes(q);
          if (!matchScene && !matchTitle && !matchLocation && !matchChars) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (filter.sortBy === 'scene_asc') {
          return compareSceneNumbers(a.scene, b.scene);
        }
        if (filter.sortBy === 'scene_desc') {
          return compareSceneNumbers(b.scene, a.scene);
        }
        if (filter.sortBy === 'status') {
          return a.status.localeCompare(b.status);
        }
        if (filter.sortBy === 'updated_desc') {
          return b.updatedAt - a.updatedAt;
        }
        return 0;
      });
  }, [scenes, filter]);

  if (scenes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center text-zinc-500 gap-1.5">
        <Inbox className="w-8 h-8 text-zinc-600 stroke-[1.5]" />
        <p className="text-xs font-medium text-zinc-400">Queue is empty</p>
        <p className="text-[11px] text-zinc-600 max-w-xs">
          Import Image Prompt JSONs to populate your scenes.
        </p>
      </div>
    );
  }

  if (filteredScenes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center text-zinc-500 gap-1">
        <p className="text-xs font-medium text-zinc-400">No matching scenes</p>
        <p className="text-[11px] text-zinc-600">Try adjusting your search or filter.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 p-2 overflow-y-auto">
      {filteredScenes.map((scene) => (
        <QueueItemCard
          key={scene.id}
          scene={scene}
          isActive={scene.id === activeSceneId}
          onSelect={onSelectScene}
          onQuickCopy={onQuickCopy}
        />
      ))}
    </div>
  );
};
