import { QueueItem, GenerationSettings } from '../types/queue';
import { generateSceneImage } from './generationClient';
import { getProjectCharacters, validateCharacterSelection } from './characterManager';
import { syncBus } from './sync';

export interface QueueProgressState {
  isRunning: boolean;
  isPaused: boolean;
  activeSceneId: string | null;
  totalScenes: number;
  completedScenes: number;
  failedScenes: number;
  currentSceneNumber?: string;
  statusMessage?: string;
}

class QueueCoordinator {
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private shouldStop: boolean = false;
  private activeSceneId: string | null = null;
  private listeners: Set<(state: QueueProgressState) => void> = new Set();

  public subscribe(callback: (state: QueueProgressState) => void): () => void {
    this.listeners.add(callback);
    callback(this.getState());
    return () => this.listeners.delete(callback);
  }

  public getState(): QueueProgressState {
    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      activeSceneId: this.activeSceneId,
      totalScenes: 0,
      completedScenes: 0,
      failedScenes: 0,
    };
  }

  private notify(update: Partial<QueueProgressState>) {
    const fullState: QueueProgressState = {
      ...this.getState(),
      ...update,
    };
    this.listeners.forEach((listener) => listener(fullState));
  }

  /**
   * Starts sequential generation of all ready scenes.
   * Concurrency is strictly 1: Scene 1 finishes -> Scene 2 starts -> Scene 3 starts.
   */
  public async startQueue(
    targetScenes: QueueItem[],
    settings: GenerationSettings,
    projectId: string
  ): Promise<void> {
    if (this.isRunning) {
      throw new Error('Queue is already running.');
    }

    this.isRunning = true;
    this.isPaused = false;
    this.shouldStop = false;

    const projectCharacters = await getProjectCharacters(projectId);

    // Filter scenes that are eligible for generation (queued, needs_references, ready, failed, regen_required)
    const eligibleScenes = targetScenes.filter(
      (s) =>
        s.status !== 'approved' &&
        s.status !== 'generating' &&
        (validateCharacterSelection(s).isValid || s.characterMismatchAcknowledged)
    );

    let completed = 0;
    let failed = 0;
    const total = eligibleScenes.length;

    this.notify({
      isRunning: true,
      isPaused: false,
      totalScenes: total,
      completedScenes: 0,
      failedScenes: 0,
      statusMessage: `Starting batch generation (${total} scenes)...`,
    });

    for (const scene of eligibleScenes) {
      if (this.shouldStop) {
        console.log('[QueueCoordinator] Stop requested. Halting queue.');
        break;
      }

      // Handle pause
      while (this.isPaused && !this.shouldStop) {
        this.notify({
          isPaused: true,
          statusMessage: 'Queue paused after current scene. Click Resume to continue.',
        });
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      if (this.shouldStop) break;

      this.activeSceneId = scene.id;
      this.notify({
        activeSceneId: scene.id,
        currentSceneNumber: scene.scene,
        statusMessage: `Generating Scene ${scene.scene}...`,
      });

      // Find assigned character objects
      const assigned = projectCharacters.filter((c) =>
        scene.selectedCharacterIds?.includes(c.id)
      );

      try {
        await generateSceneImage(scene, assigned, settings);
        completed++;
        this.notify({
          completedScenes: completed,
          statusMessage: `Completed Scene ${scene.scene}.`,
        });

        // Mode B: Review Between Scenes (Pause after each scene)
        if (settings.mode === 'review_between_scenes' && completed < total) {
          this.isPaused = true;
          this.notify({
            isPaused: true,
            statusMessage: `Scene ${scene.scene} generated. Paused for review.`,
          });
        }
      } catch (err: any) {
        console.error(`[QueueCoordinator] Scene ${scene.scene} failed:`, err);
        failed++;
        this.notify({
          failedScenes: failed,
          statusMessage: `Scene ${scene.scene} failed: ${err.message || 'Error'}`,
        });
      }

      this.activeSceneId = null;

      // Small delay between scenes to prevent rate limits
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    this.isRunning = false;
    this.isPaused = false;
    this.shouldStop = false;
    this.activeSceneId = null;

    this.notify({
      isRunning: false,
      isPaused: false,
      activeSceneId: null,
      completedScenes: completed,
      failedScenes: failed,
      statusMessage: `Batch finished. ${completed} completed, ${failed} failed.`,
    });
    syncBus.broadcast('STATUS_CHANGED');
  }

  public pauseQueue(): void {
    if (this.isRunning) {
      this.isPaused = true;
      this.notify({ isPaused: true, statusMessage: 'Pausing after active scene finishes...' });
    }
  }

  public resumeQueue(): void {
    if (this.isRunning && this.isPaused) {
      this.isPaused = false;
      this.notify({ isPaused: false, statusMessage: 'Resuming sequential generation...' });
    }
  }

  public stopQueue(): void {
    this.shouldStop = true;
    this.isRunning = false;
    this.isPaused = false;
    this.activeSceneId = null;
    this.notify({ isRunning: false, isPaused: false, statusMessage: 'Queue stopped by user.' });
  }
}

export const queueCoordinator = new QueueCoordinator();
