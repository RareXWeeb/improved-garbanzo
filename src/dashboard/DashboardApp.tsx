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
  Sparkles,
  Loader2,
} from 'lucide-react';

export const DashboardApp: React.FC = () => {
  const [scenes, setScenes] = useState<QueueItem[]>([]);
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  const [generationSettings, setGenerationSettings] = useState<GenerationSettings>(DEFAULT_GENERATION_SETTINGS);
  const [queueProgress, setQueueProgress] = useState<QueueProgressState>(queueCoordinator.getState());

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
  const projectTitle = scenes[0]?.projectTitle || 'SceneForge';

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

      // Load project settings if available
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

  // Queue runner controls
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

  return (
    <div className="flex flex-col h-screen w-full bg-zinc-950 text-zinc-100 font-sans antialiased overflow-hidden">
      {/* Clean Desktop Navigation Bar */}
      <header className="flex items-center justify-between px-5 py-2.5 bg-zinc-900 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="SceneForge" className="h-6 w-auto object-contain shrink-0" />
          <span className="text-xs font-mono text-zinc-400">
            {projectTitle} · {counts.approved} of {counts.total} approved
          </span>
        </div>

        {/* Global Action Toolbar */}
        <div className="flex items-center gap-2">
          {/* Character Reference Library */}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowCharacterModal(true)}
            icon={<Users className="w-3.5 h-3.5 text-zinc-300" />}
          >
            Character Library
          </Button>

          {/* Provider Settings */}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowSettingsModal(true)}
            icon={<Settings className="w-3.5 h-3.5 text-zinc-300" />}
            title="Configure AI Provider, Keys & Spending Limits"
          >
            Provider ({generationSettings.provider.toUpperCase()})
          </Button>

          {/* Generate All Sequential Runner */}
          {!queueProgress.isRunning ? (
            <Button
              variant="primary"
              size="sm"
              onClick={handleStartQueue}
              disabled={scenes.length === 0}
              icon={<Play className="w-3.5 h-3.5 fill-current" />}
              title="Generate all eligible scenes sequentially (Concurrency = 1)"
            >
              Generate All
            </Button>
          ) : (
            <div className="flex items-center gap-1 bg-zinc-800/80 p-0.5 rounded-md border border-zinc-700">
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
                title="Stop generation queue"
              >
                Stop
              </Button>
            </div>
          )}

          <div className="h-4 w-px bg-zinc-800 mx-1" />

          {/* Import JSONs */}
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
              <span>{isUploadingRefs ? 'Mapping...' : 'Map Location Refs'}</span>
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

          {/* Export Zip */}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowExportModal(true)}
            icon={<Archive className="w-3.5 h-3.5" />}
          >
            Export Batch
          </Button>

          {/* Optional ChatGPT web fallback */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleOpenChatGPT}
            icon={<ExternalLink className="w-3 h-3 text-zinc-500" />}
            title="Open ChatGPT website (manual fallback)"
          >
            ChatGPT
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

      {/* Active Sequential Queue Banner */}
      {queueProgress.isRunning && (
        <div className="bg-gradient-to-r from-orange-950/60 via-zinc-900 to-zinc-900 border-b border-orange-900/40 px-5 py-2 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-orange-400 font-semibold">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>
                {queueProgress.isPaused ? 'QUEUE PAUSED' : 'SEQUENTIAL GENERATION IN PROGRESS'}
              </span>
            </div>
            <span className="text-zinc-300">
              {queueProgress.statusMessage || 'Processing queue...'}
            </span>
          </div>

          <div className="flex items-center gap-3 text-zinc-400">
            <span>
              Scene {queueProgress.completedScenes} of {queueProgress.totalScenes} completed
            </span>
            {queueProgress.failedScenes > 0 && (
              <span className="text-rose-400 font-semibold">({queueProgress.failedScenes} failed)</span>
            )}
            <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[10px] border border-zinc-700">
              Concurrency: 1
            </span>
          </div>
        </div>
      )}

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
              <SceneDetailHUD
                scene={activeScene}
                generationSettings={generationSettings}
                onRefresh={refreshScenes}
              />
            ) : (
              <div className="flex flex-col items-center justify-center min-h-[50vh] text-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-base font-semibold text-zinc-200">
                    Welcome to SceneForge
                  </p>
                  <p className="text-xs text-zinc-500 max-w-sm mt-1">
                    Upload your character portraits, import your cinematic Image Prompt JSONs, and generate your scenes sequentially.
                  </p>
                </div>
                <div className="flex items-center gap-2.5 pt-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setShowCharacterModal(true)}
                    icon={<Users className="w-3.5 h-3.5" />}
                  >
                    1. Setup Characters
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

      {/* Character Library Modal */}
      <CharacterLibraryModal
        isOpen={showCharacterModal}
        onClose={() => setShowCharacterModal(false)}
        projectId={currentProjectId}
        onCharactersUpdated={refreshScenes}
      />

      {/* Provider & Generation Settings Modal */}
      <ProviderSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        settings={generationSettings}
        onSaveSettings={handleSaveSettings}
      />

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
