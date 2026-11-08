import React, { useState, useEffect, useCallback } from 'react';
import { db, DEFAULT_GENERATION_SETTINGS } from '../services/db';
import { syncBus, SyncMessage } from '../services/sync';
import { QueueItem, FilterState, GenerationSettings } from '../types/queue';
import { QueueFilterBar, QueueCounts } from '../components/queue/QueueFilterBar';
import { QueueList } from '../components/queue/QueueList';
import { SceneDetailHUD } from '../components/scene/SceneDetailHUD';
import { BatchImportModal } from '../components/import-export/BatchImportModal';
import { BatchExportModal } from '../components/import-export/BatchExportModal';
import { CharacterLibraryModal } from '../components/character/CharacterLibraryModal';
import { ProviderSettingsModal } from '../components/settings/ProviderSettingsModal';
import { QuickGenerateModal } from '../components/quick-generate/QuickGenerateModal';
import { Button } from '../components/common/Button';
import { useToast } from '../components/common/Toast';
import {
  Plus,
  Play,
  Archive,
  Menu,
  ChevronLeft,
  Maximize2,
  Trash2,
  Users,
  Settings,
} from 'lucide-react';

export const SidePanelApp: React.FC = () => {
  const [scenes, setScenes] = useState<QueueItem[]>([]);
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  const [generationSettings, setGenerationSettings] = useState<GenerationSettings>(DEFAULT_GENERATION_SETTINGS);
  const [showQueueDrawer, setShowQueueDrawer] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showCharacterModal, setShowCharacterModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showQuickModal, setShowQuickModal] = useState(false);

  const [filter, setFilter] = useState<FilterState>({
    searchQuery: '',
    statusFilter: 'all',
    projectFilter: 'all',
    episodeFilter: 'all',
    sortBy: 'scene_asc',
  });

  const { showToast } = useToast();

  const currentProjectId = scenes[0]?.projectId || 'proj_default';

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

      const project = await db.projects.get(currentProjectId);
      if (project?.defaultSettings) {
        setGenerationSettings(project.defaultSettings);
      }
    } catch (err) {
      console.error('Failed to load scenes from DB:', err);
    }
  }, [currentProjectId]);

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
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [scenes, activeSceneId, activeScene, showToast]);

  const handleOpenDashboard = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
      const url = chrome.runtime.getURL('dashboard.html');
      chrome.tabs.create({ url });
    } else {
      window.open('dashboard.html', '_blank');
    }
  };

  const handleQuickCopy = async (scene: QueueItem, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(scene.rawJsonText);
      showToast(`Prompt JSON for Scene ${scene.scene} copied!`, 'success');
    } catch {
      showToast('Could not copy to clipboard.', 'error');
    }
  };

  const handleClearQueue = async () => {
    if (scenes.length === 0) return;
    if (window.confirm('Clear all scenes and generation history?')) {
      await db.scenes.clear();
      await db.generationResults.clear();
      syncBus.broadcast('ALL_SCENES_CLEARED');
      refreshScenes();
      showToast('Queue cleared', 'info');
    }
  };

  const handleSaveSettings = async (updated: GenerationSettings) => {
    setGenerationSettings(updated);
    try {
      let project = await db.projects.get(currentProjectId);
      if (project) {
        project.defaultSettings = updated;
        project.updatedAt = Date.now();
        await db.projects.put(project);
      }
    } catch (err) {
      console.error('Failed to update project settings in db:', err);
    }
  };

  const counts: QueueCounts = {
    total: scenes.length,
    queued: scenes.filter((s) => s.status === 'queued').length,
    ready: scenes.filter((s) => s.status === 'ready').length,
    generating: scenes.filter((s) => s.status === 'generating').length,
    needs_references: scenes.filter((s) => s.status === 'needs_references').length,
    awaiting_review: scenes.filter((s) => s.status === 'awaiting_review').length,
    approved: scenes.filter((s) => s.status === 'approved').length,
    regeneration_required: scenes.filter((s) => s.status === 'regeneration_required').length,
    failed: scenes.filter((s) => s.status === 'failed').length,
  };

  return (
    <div className="flex flex-col h-screen w-full bg-zinc-950 text-zinc-100 font-sans antialiased overflow-hidden">
      {/* Clean Top Header */}
      <header className="flex items-center justify-between px-3 py-2 bg-zinc-900 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => setShowQueueDrawer(!showQueueDrawer)}
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors shrink-0"
            title={showQueueDrawer ? 'Show Scene Detail' : 'Show Scene Queue'}
          >
            {showQueueDrawer ? <ChevronLeft className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <img src="/logo.png" alt="SceneForge" className="h-5 w-auto object-contain shrink-0" />
            <span className="text-[11px] font-mono text-zinc-400">
              {counts.approved}/{counts.total}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowQuickModal(true)}
            className="h-7 w-7 p-0 text-zinc-300 hover:text-white"
            title="Paste JSON & Generate"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowCharacterModal(true)}
            className="h-7 w-7 p-0 text-zinc-400 hover:text-white"
            title="Character Reference Library"
          >
            <Users className="w-3.5 h-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSettingsModal(true)}
            className="h-7 w-7 p-0 text-zinc-400 hover:text-white"
            title="AI Provider Settings"
          >
            <Settings className="w-3.5 h-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowImportModal(true)}
            className="h-7 w-7 p-0 text-zinc-400 hover:text-white"
            title="Import Prompts"
          >
            <Plus className="w-3.5 h-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowExportModal(true)}
            className="h-7 w-7 p-0 text-zinc-400 hover:text-white"
            title="Export Batch"
          >
            <Archive className="w-3.5 h-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleOpenDashboard}
            className="h-7 w-7 p-0 text-zinc-400 hover:text-white"
            title="Open Full Dashboard Tab"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </header>

      {/* Main Viewport */}
      <main className="flex-1 overflow-hidden relative">
        {showQueueDrawer ? (
          /* Drawer: Queue List & Filters */
          <div className="flex flex-col h-full bg-zinc-950">
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
                onSelectScene={(s) => {
                  setActiveSceneId(s.id);
                  setShowQueueDrawer(false);
                }}
                onQuickCopy={handleQuickCopy}
              />
            </div>
            {scenes.length > 0 && (
              <div className="p-2 border-t border-zinc-800/80 bg-zinc-900/60 flex justify-between items-center text-[11px] text-zinc-500 px-3 font-mono">
                <span>{scenes.length} total scenes</span>
                <button
                  onClick={handleClearQueue}
                  className="text-rose-400 hover:text-rose-300 flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Working Scene HUD */
          <div className="h-full overflow-y-auto p-3">
            {activeScene ? (
              <SceneDetailHUD
                scene={activeScene}
                generationSettings={generationSettings}
                onRefresh={refreshScenes}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-6 gap-2">
                <p className="text-xs font-medium text-zinc-300">No scene selected</p>
                <p className="text-[11px] text-zinc-500 max-w-xs">
                  Import prompt files or choose a scene from the queue to start.
                </p>
                <div className="flex flex-col items-center gap-2 pt-2 w-full max-w-xs">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setShowQuickModal(true)}
                    icon={<Play className="w-3 h-3 fill-current" />}
                    className="w-full"
                  >
                    Paste JSON & Generate
                  </Button>
                  <div className="flex items-center gap-2 w-full">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setShowImportModal(true)}
                      icon={<Plus className="w-3 h-3" />}
                      className="flex-1"
                    >
                      Import Batch
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setShowQueueDrawer(true)}
                      icon={<Menu className="w-3 h-3" />}
                      className="flex-1"
                    >
                      Queue
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modals */}
      <QuickGenerateModal
        isOpen={showQuickModal}
        onClose={() => setShowQuickModal(false)}
        generationSettings={generationSettings}
        projectId={currentProjectId}
        onSceneCreated={(scene) => {
          setActiveSceneId(scene.id);
          refreshScenes();
        }}
      />

      <CharacterLibraryModal
        isOpen={showCharacterModal}
        onClose={() => setShowCharacterModal(false)}
        projectId={currentProjectId}
        onCharactersUpdated={refreshScenes}
      />

      <ProviderSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        settings={generationSettings}
        onSaveSettings={handleSaveSettings}
      />

      <BatchImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportComplete={refreshScenes}
      />

      <BatchExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        scenes={scenes}
      />
    </div>
  );
};
