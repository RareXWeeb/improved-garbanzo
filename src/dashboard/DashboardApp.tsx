import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../services/db';
import { syncBus, SyncMessage } from '../services/sync';
import { QueueItem, FilterState } from '../types/queue';
import { QueueFilterBar } from '../components/queue/QueueFilterBar';
import { QueueList } from '../components/queue/QueueList';
import { SceneDetailHUD } from '../components/scene/SceneDetailHUD';
import { BatchImportModal } from '../components/import-export/BatchImportModal';
import { BatchExportModal } from '../components/import-export/BatchExportModal';
import { Button } from '../components/common/Button';
import { useToast } from '../components/common/Toast';
import { ingestMultipleReferences } from '../services/assetManager';
import {
  ExternalLink,
  Plus,
  Archive,
  FolderOpen,
  Trash2,
} from 'lucide-react';

export const DashboardApp: React.FC = () => {
  const [scenes, setScenes] = useState<QueueItem[]>([]);
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [isUploadingRefs, setIsUploadingRefs] = useState(false);
  const [filter, setFilter] = useState<FilterState>({
    searchQuery: '',
    statusFilter: 'all',
    projectFilter: 'all',
    episodeFilter: 'all',
    sortBy: 'scene_asc',
  });

  const { showToast } = useToast();

  const refreshScenes = useCallback(async () => {
    try {
      const all = await db.scenes.toArray();
      setScenes(all);

      setActiveSceneId((prev) => {
        if (prev && all.some((s) => s.id === prev)) {
          return prev;
        }
        return all.length > 0 ? all[0].id : null;
      });
    } catch (err) {
      console.error('Failed to load scenes:', err);
    }
  }, []);

  useEffect(() => {
    refreshScenes();

    const unsubscribe = syncBus.subscribe((_msg: SyncMessage) => {
      refreshScenes();
    });

    return () => {
      unsubscribe();
    };
  }, [refreshScenes]);

  const activeScene = scenes.find((s) => s.id === activeSceneId) || null;

  // Keyboard navigation shortcuts: Alt+Down/Right for next scene, Alt+Up/Left for prev, Alt+C to copy
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.altKey || scenes.length === 0) return;

      const currentIndex = scenes.findIndex((s) => s.id === activeSceneId);

      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        const nextIndex = (currentIndex + 1) % scenes.length;
        setActiveSceneId(scenes[nextIndex].id);
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const prevIndex = (currentIndex - 1 + scenes.length) % scenes.length;
        setActiveSceneId(scenes[prevIndex].id);
      } else if (e.key.toLowerCase() === 'c' && activeScene) {
        e.preventDefault();
        navigator.clipboard.writeText(activeScene.rawJsonText);
        showToast(`Prompt for Scene ${activeScene.scene} copied!`, 'success');
        if (activeScene.status === 'queued') {
          const updated = { ...activeScene, status: 'copied' as const, updatedAt: Date.now() };
          db.scenes.put(updated);
          syncBus.broadcast('STATUS_CHANGED', { sceneId: activeScene.id, status: 'copied' });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [scenes, activeSceneId, activeScene, showToast]);

  const handleOpenChatGPT = () => {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url: 'https://chatgpt.com' });
    } else {
      window.open('https://chatgpt.com', '_blank');
    }
  };

  const handleQuickCopy = async (scene: QueueItem, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(scene.rawJsonText);
      showToast(`Prompt JSON for Scene ${scene.scene} copied!`, 'success');
      if (scene.status === 'queued') {
        const updated = { ...scene, status: 'copied' as const, updatedAt: Date.now() };
        await db.scenes.put(updated);
        syncBus.broadcast('STATUS_CHANGED', { sceneId: scene.id, status: 'copied' });
      }
    } catch {
      showToast('Could not copy to clipboard.', 'error');
    }
  };

  const handleBulkReferenceUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploadingRefs(true);
    try {
      const count = await ingestMultipleReferences(files);
      showToast(`Matched ${count} reference image(s)`, 'success');
      refreshScenes();
    } catch (err) {
      console.error('Failed bulk reference ingest:', err);
      showToast('Error uploading reference assets.', 'error');
    } finally {
      setIsUploadingRefs(false);
    }
  };

  const handleClearAll = async () => {
    if (scenes.length === 0) return;
    if (window.confirm('Clear all scenes, reference mappings, and generation history from local storage?')) {
      await db.scenes.clear();
      await db.generationResults.clear();
      await db.referenceImages.clear();
      syncBus.broadcast('ALL_SCENES_CLEARED');
      refreshScenes();
      showToast('All local batch data cleared', 'info');
    }
  };

  const counts = {
    total: scenes.length,
    queued: scenes.filter((s) => s.status === 'queued').length,
    copied: scenes.filter((s) => s.status === 'copied').length,
    submitted: scenes.filter((s) => s.status === 'submitted').length,
    awaiting_review: scenes.filter((s) => s.status === 'awaiting_review').length,
    approved: scenes.filter((s) => s.status === 'approved').length,
    regeneration_required: scenes.filter((s) => s.status === 'regeneration_required').length,
  };

  const projectTitle = scenes[0]?.projectTitle || 'SceneForge';

  return (
    <div className="flex flex-col h-screen w-full bg-zinc-950 text-zinc-100 font-sans antialiased overflow-hidden">
      {/* Clean Desktop Navigation Bar */}
      <header className="flex items-center justify-between px-5 py-2.5 bg-zinc-900 border-b border-zinc-800 shrink-0">
        <div className="flex items-baseline gap-3">
          <h1 className="text-sm font-semibold tracking-tight text-white">
            SceneForge Generator
          </h1>
          <span className="text-xs font-mono text-zinc-500">
            {projectTitle} · {counts.approved} of {counts.total} approved
          </span>
        </div>

        {/* Global Action Toolbar */}
        <div className="flex items-center gap-1.5">
          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenChatGPT}
            icon={<ExternalLink className="w-3.5 h-3.5" />}
          >
            Open ChatGPT
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowImportModal(true)}
            icon={<Plus className="w-3.5 h-3.5" />}
          >
            Import Prompts
          </Button>

          {/* Reference Folder/File Mapping */}
          <label className="cursor-pointer">
            <span className="inline-flex items-center justify-center font-medium rounded-md text-xs px-3 py-1.5 gap-1.5 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 border border-zinc-800 transition-colors h-8">
              <FolderOpen className="w-3.5 h-3.5 text-zinc-400" />
              <span>{isUploadingRefs ? 'Mapping...' : 'Map Reference Assets'}</span>
            </span>
            <input
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={(e) => handleBulkReferenceUpload(e.target.files)}
              disabled={isUploadingRefs}
            />
          </label>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowExportModal(true)}
            icon={<Archive className="w-3.5 h-3.5" />}
          >
            Export Batch
          </Button>

          {scenes.length > 0 && (
            <button
              onClick={handleClearAll}
              className="text-zinc-500 hover:text-rose-400 p-1.5 rounded transition-colors ml-1"
              title="Clear all local data"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </header>

      {/* Main Split Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar: Queue List & Filters (320px) */}
        <aside className="w-[320px] border-r border-zinc-800 flex flex-col bg-zinc-900/40 shrink-0">
          <QueueFilterBar
            filter={filter}
            onChange={setFilter}
            counts={counts}
          />
          <div className="flex-1 overflow-y-auto">
            <QueueList
              scenes={scenes}
              activeSceneId={activeSceneId}
              filter={filter}
              onSelectScene={(s) => setActiveSceneId(s.id)}
              onQuickCopy={handleQuickCopy}
            />
          </div>
          <div className="p-2.5 border-t border-zinc-800 text-[11px] font-mono text-zinc-500 bg-zinc-900/60 flex justify-between items-center">
            <span>{counts.approved} approved · {counts.regeneration_required} regen</span>
            <span>{counts.total} items</span>
          </div>
        </aside>

        {/* Right Main Pane: Scene Detail & Action HUD */}
        <main className="flex-1 overflow-y-auto p-6 bg-zinc-950">
          <div className="max-w-3xl mx-auto">
            {activeScene ? (
              <SceneDetailHUD scene={activeScene} onRefresh={refreshScenes} />
            ) : (
              <div className="flex flex-col items-center justify-center min-h-[50vh] text-center gap-2">
                <p className="text-sm font-medium text-zinc-300">
                  Select a Scene from the Queue
                </p>
                <p className="text-xs text-zinc-500 max-w-sm">
                  Or click "Import Prompts" above to load your cinematic Image Prompt JSON batch.
                </p>
                <div className="flex items-center gap-2 pt-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setShowImportModal(true)}
                    icon={<Plus className="w-3.5 h-3.5" />}
                  >
                    Import Batch JSONs
                  </Button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Import Modal */}
      <BatchImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportComplete={refreshScenes}
      />

      {/* Export Modal */}
      <BatchExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        scenes={scenes}
      />
    </div>
  );
};
