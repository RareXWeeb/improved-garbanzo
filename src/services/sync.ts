/**
 * Reactive Cross-Surface Synchronizer using BroadcastChannel.
 * Keeps Side Panel HUD and Dashboard in live 1:1 sync with zero lost updates.
 */

export type SyncEventType =
  | 'SCENE_UPDATED'
  | 'SCENES_BATCH_IMPORTED'
  | 'SCENE_DELETED'
  | 'ALL_SCENES_CLEARED'
  | 'STATUS_CHANGED'
  | 'ATTEMPT_ADDED'
  | 'REFERENCES_SYNCED';

export interface SyncMessage {
  type: SyncEventType;
  payload?: any;
  timestamp: number;
  origin: 'sidepanel' | 'dashboard' | 'background';
}

const CHANNEL_NAME = 'sceneforge_bulk_generator_sync';

class SyncBus {
  private channel: BroadcastChannel | null = null;
  private listeners: Set<(msg: SyncMessage) => void> = new Set();

  constructor() {
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.channel = new BroadcastChannel(CHANNEL_NAME);
        this.channel.onmessage = (event) => {
          this.notify(event.data);
        };
      } catch (err) {
        console.warn('[SyncBus] BroadcastChannel initialization failed:', err);
      }
    }
  }

  public subscribe(callback: (msg: SyncMessage) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  public broadcast(type: SyncEventType, payload?: any, origin: 'sidepanel' | 'dashboard' | 'background' = 'sidepanel') {
    const msg: SyncMessage = {
      type,
      payload,
      timestamp: Date.now(),
      origin,
    };

    // Notify local listeners
    this.notify(msg);

    // Notify other tabs/windows
    if (this.channel) {
      try {
        this.channel.postMessage(msg);
      } catch (err) {
        console.error('[SyncBus] Failed to broadcast message:', err);
      }
    }
  }

  private notify(msg: SyncMessage) {
    this.listeners.forEach((listener) => {
      try {
        listener(msg);
      } catch (err) {
        console.error('[SyncBus] Listener error:', err);
      }
    });
  }
}

export const syncBus = new SyncBus();

