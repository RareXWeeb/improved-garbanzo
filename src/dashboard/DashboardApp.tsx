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
import { queueCoordinator, QueueProgressState } from '../services/queueCoordinator';
import { Button } from '../components/common/Button';
import { useToast } from '../components/common/Toast';
import { ingestMultipleReferences } from '../services/assetManager';
import {
  ExternalLink,
  Plus,
  Archive,
  FolderOpen,
  Trash2,
  Users,
  Settings,
  Play,
  Pause,
  Square,
  Menu,
  X,
  Layers,
} from 'lucide-react';

export const DashboardApp: React.FC = () => {
  const [scenes, setScenes] = useState<QueueItem[]>([]);
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  const [generationSettings, setGenerationSettings] = useState<GenerationSettings>(DEFAULT_GENERATION_SETTINGS);
  const [queueProgress, setQueueProgress] = useState<QueueProgressState>(queueCoordinator.getState());
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Modals
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showCharacterModal, setShowCharacterModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isUploadingRefs, setIsUploadingRefs] = useState(false);

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
      console.error('Failed to load scenes:', err);
    }
  }, [currentProjectId]);

  useEffect(() => {
    refreshScenes();

    const unsubscribeSync = syncBus.subscribe((_msg: SyncMessage) => {
      refreshScenes();
    });

    const unsubscribeQueue = queueCoordinator.subscribe((state) => {
      setQueueProgress(state);
      if (state.activeSceneId) {
        setActiveSceneId(state.activeSceneId);
      }
    });

    return () => {
      unsubscribeSync();
      unsubscribeQueue();
    };
  }, [refreshScenes]);

  const activeScene = scenes.find((s) => s.id === activeSceneId) || null;

  // Keyboard navigation shortcuts
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
      showToast(`Prompt for Scene ${scene.scene} copied!`, 'success');
    } catch {
      showToast('Could not copy to clipboard.', 'error');
    }
  };

  const handleBulkReferenceUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploadingRefs(true);
    try {
      const count = await ingestMultipleReferences(files);
      showToast(`Mapped ${count} reference file(s)`, 'success');
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
    if (window.confirm('Clear all scenes, references, and generation history?')) {
      await db.scenes.clear();
      await db.generationResults.clear();
      await db.referenceImages.clear();
      syncBus.broadcast('ALL_SCENES_CLEARED');
      refreshScenes();
      showToast('All local batch data cleared', 'info');
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

  const handleStartQueue = async () => {
    try {
      await queueCoordinator.startQueue(scenes, generationSettings, currentProjectId);
    } catch (err: any) {
      showToast(err.message || 'Error starting generation queue', 'error');
    }
  };

  const handlePauseQueue = () => {
    queueCoordinator.pauseQueue();
    showToast('Pausing queue after current scene...', 'info');
  };

  const handleResumeQueue = () => {
    queueCoordinator.resumeQueue();
    showToast('Resuming sequential generation...', 'success');
  };

  const handleStopQueue = () => {
    queueCoordinator.stopQueue();
    showToast('Generation queue stopped', 'info');
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

  const percentComplete =
    queueProgress.totalScenes > 0
      ? Math.round((queueProgress.completedScenes / queueProgress.totalScenes) * 100)
      : 0;

  return (
    <div className="flex flex-col h-screen w-full bg-zinc-950 text-zinc-100 font-sans antialiased overflow-hidden">
      {/* Clean Minimalist Header */}
      <header className="flex items-center justify-between px-3 sm:px-5 py-2.5 bg-zinc-900 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-3">
          {/* Mobile Sidebar Toggle Button */}
          <button
            onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
            className="p-1.5 rounded lg:hidden text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            title="Toggle Queue"
          >
            {isMobileSidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>

          {/* Logo Only */}
          <img src="/logo.png" alt="SceneForge" className="h-6 w-auto object-contain shrink-0" />

          {/* Discreet Scene Count */}
          <span className="hidden sm:inline-block text-xs font-mono text-zinc-400">
            {counts.approved}/{counts.total} approved
          </span>
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Character Reference Library */}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowCharacterModal(true)}
            icon={<Users className="w-3.5 h-3.5 text-zinc-400" />}
            title="Character Library"
          >
            <span className="hidden sm:inline">Characters</span>
          </Button>

          {/* Provider Settings */}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowSettingsModal(true)}
            icon={<Settings className="w-3.5 h-3.5 text-zinc-400" />}
            title="Provider Settings"
          >
            <span className="hidden md:inline">{generationSettings.provider.toUpperCase()}</span>
          </Button>

          {/* Sequential Queue Runner */}
          {!queueProgress.isRunning ? (
            <Button
              variant="primary"
              size="sm"
              onClick={handleStartQueue}
              disabled={scenes.length === 0}
              icon={<Play className="w-3.5 h-3.5 fill-current" />}
              title="Generate eligible scenes sequentially"
            >
              <span>Generate All</span>
            </Button>
          ) : (
            <div className="flex items-center gap-1 bg-zinc-800 p-0.5 rounded border border-zinc-700">
              {queueProgress.isPaused ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleResumeQueue}
                  icon={<Play className="w-3.5 h-3.5 fill-current" />}
                >
                  Resume
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handlePauseQueue}
                  icon={<Pause className="w-3.5 h-3.5" />}
                >
                  Pause
                </Button>
              )}
              <Button
                variant="danger"
                size="sm"
                onClick={handleStopQueue}
                icon={<Square className="w-3 h-3 fill-current" />}
                title="Stop queue"
              >
                Stop
              </Button>
            </div>
          )}

          <div className="hidden sm:block h-4 w-px bg-zinc-800 mx-0.5" />

          {/* Import JSONs */}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowImportModal(true)}
            icon={<Plus className="w-3.5 h-3.5" />}
            title="Import Prompts"
          >
            <span className="hidden sm:inline">Import</span>
          </Button>

          {/* Map Location References */}
          <label className="hidden lg:inline-flex cursor-pointer">
            <span className="inline-flex items-center justify-center font-medium rounded-md text-xs px-2.5 py-1 gap-1.5 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white border border-zinc-800 transition-colors h-7">
              <FolderOpen className="w-3.5 h-3.5 text-zinc-400" />
              <span>{isUploadingRefs ? 'Mapping...' : 'Location Refs'}</span>
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

          {/* Export Deliverables */}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowExportModal(true)}
            icon={<Archive className="w-3.5 h-3.5" />}
            title="Export Deliverables"
          >
            <span className="hidden sm:inline">Export</span>
          </Button>

          {/* ChatGPT web fallback */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleOpenChatGPT}
            icon={<ExternalLink className="w-3 h-3 text-zinc-500" />}
            title="Open ChatGPT"
            className="hidden xl:inline-flex"
          >
            ChatGPT
          </Button>

          {scenes.length > 0 && (
            <button
              onClick={handleClearAll}
              className="text-zinc-500 hover:text-rose-400 p-1.5 rounded transition-colors"
              title="Clear all data"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </header>

      {/* Sequential Generation Status Bar */}
      {queueProgress.isRunning && (
        <div className="bg-zinc-900 border-b border-zinc-800 px-4 py-2 flex flex-col gap-1.5 text-xs font-mono">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-zinc-200">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-semibold">
                {queueProgress.isPaused ? 'Queue Paused' : 'Generating Batch'}
              </span>
              <span className="text-zinc-400 font-sans">
                {queueProgress.statusMessage}
              </span>
            </div>

            <div className="flex items-center gap-3 text-zinc-400 text-[11px]">
              <span>
                {queueProgress.completedScenes} / {queueProgress.totalScenes} ({percentComplete}%)
              </span>
              {queueProgress.failedScenes > 0 && (
                <span className="text-rose-400 font-semibold">{queueProgress.failedScenes} failed</span>
              )}
            </div>
          </div>

          {/* Minimalist Progress Line */}
          <div className="w-full bg-zinc-800 h-1 rounded-full overflow-hidden">
            <div
              className="bg-zinc-200 h-full transition-all duration-300"
              style={{ width: `${percentComplete}%` }}
            />
          </div>
        </div>
      )}

      {/* Main Workspace Layout */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Sidebar: Queue List & Filters */}
        <aside
          className={`
            fixed inset-y-0 left-0 z-40 w-72 sm:w-80 bg-zinc-900 border-r border-zinc-800 flex flex-col transition-transform duration-200 ease-in-out
            lg:static lg:translate-x-0 lg:z-auto
            ${isMobileSidebarOpen ? 'translate-x-0 top-[49px]' : '-translate-x-full lg:translate-x-0'}
          `}
        >
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
                setIsMobileSidebarOpen(false); // Close drawer on selection on mobile
              }}
              onQuickCopy={handleQuickCopy}
            />
          </div>
          <div className="p-2.5 border-t border-zinc-800 text-[11px] font-mono text-zinc-500 bg-zinc-950 flex justify-between items-center">
            <span>{counts.approved} approved · {counts.regeneration_required} regen</span>
            <span>{counts.total} items</span>
          </div>
        </aside>

        {/* Mobile Backdrop */}
        {isMobileSidebarOpen && (
          <div
            onClick={() => setIsMobileSidebarOpen(false)}
            className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
          />
        )}

        {/* Right Main Content Pane */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-zinc-950">
          <div className="max-w-3xl mx-auto">
            {activeScene ? (
              <SceneDetailHUD
                scene={activeScene}
                generationSettings={generationSettings}
                onRefresh={refreshScenes}
              />
            ) : (
              /* Serene, Minimalist Empty State */
              <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 gap-3">
                <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-zinc-200">
                    No Scene Selected
                  </h3>
                  <p className="text-xs text-zinc-500 max-w-sm mt-1">
                    Upload your character portraits, import your cinematic prompt JSONs, and generate images sequentially.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setShowCharacterModal(true)}
                    icon={<Users className="w-3.5 h-3.5" />}
                  >
                    1. Character Library
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowImportModal(true)}
                    icon={<Plus className="w-3.5 h-3.5" />}
                  >
                    2. Import Prompts
                  </Button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Modals */}
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
