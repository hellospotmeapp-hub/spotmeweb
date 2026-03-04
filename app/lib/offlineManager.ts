/**
 * Offline Manager for SpotMe
 * 
 * Handles:
 * - Network status detection (online/offline)
 * - Caching needs data locally
 * - Queuing actions (contributions, need creations) for sync
 * - Syncing queued actions when back online
 * - Graceful edge function fallbacks
 */

import { Platform } from 'react-native';

// ---- Storage abstraction (mirrors store.tsx) ----
const memoryStore: Record<string, string> = {};

const offlineStorage = {
  get(key: string): string | null {
    if (Platform.OS === 'web') {
      try {
        const val = localStorage.getItem(key);
        if (val !== null) return val;
      } catch {}
    }
    return memoryStore[key] || null;
  },
  set(key: string, value: string): void {
    memoryStore[key] = value;
    if (Platform.OS === 'web') {
      try { localStorage.setItem(key, value); } catch {}
    }
  },
  remove(key: string): void {
    delete memoryStore[key];
    if (Platform.OS === 'web') {
      try { localStorage.removeItem(key); } catch {}
    }
  },
};

// ---- Cache Keys ----
const CACHE_KEYS = {
  NEEDS: 'spotme_cache_needs',
  NEEDS_TIMESTAMP: 'spotme_cache_needs_ts',
  NOTIFICATIONS: 'spotme_cache_notifications',
  NOTIFICATIONS_TIMESTAMP: 'spotme_cache_notifications_ts',
  OFFLINE_QUEUE: 'spotme_offline_queue',
  THANK_YOU_UPDATES: 'spotme_cache_thankyou',
} as const;

// Cache expiry: 24 hours (data is still usable but stale)
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
// Stale threshold: 5 minutes (show cached but try to refresh)
const CACHE_STALE_MS = 5 * 60 * 1000;

// ---- Queued Action Types ----
export interface QueuedAction {
  id: string;
  type: 'contribution' | 'create_need' | 'request_payout' | 'report' | 'thank_you';
  payload: any;
  createdAt: string;
  retryCount: number;
  maxRetries: number;
  lastError?: string;
}

// ---- Network Status ----
export type NetworkStatus = 'online' | 'offline' | 'unknown';
type NetworkListener = (status: NetworkStatus) => void;

class OfflineManager {
  private _status: NetworkStatus = 'unknown';
  private _listeners: NetworkListener[] = [];
  private _syncInProgress = false;
  private _initialized = false;

  // ---- Initialize ----
  init() {
    if (this._initialized) return;
    this._initialized = true;

    if (Platform.OS === 'web') {
      // Use navigator.onLine for initial status
      this._status = typeof navigator !== 'undefined' && navigator.onLine ? 'online' : 'offline';

      // Listen for online/offline events
      if (typeof window !== 'undefined') {
        window.addEventListener('online', () => {
          console.log('[SpotMe Offline] Network: online');
          this._status = 'online';
          this._notifyListeners();
        });
        window.addEventListener('offline', () => {
          console.log('[SpotMe Offline] Network: offline');
          this._status = 'offline';
          this._notifyListeners();
        });
      }
    } else {
      // On native, default to online; we detect offline via failed requests
      this._status = 'online';
    }

    console.log('[SpotMe Offline] Initialized, status:', this._status);
  }

  // ---- Network Status ----
  get isOnline(): boolean {
    return this._status !== 'offline';
  }

  get status(): NetworkStatus {
    return this._status;
  }

  // Mark as offline (called when a request fails with network error)
  markOffline() {
    if (this._status !== 'offline') {
      console.log('[SpotMe Offline] Marked offline due to request failure');
      this._status = 'offline';
      this._notifyListeners();
    }
  }

  // Mark as online (called when a request succeeds)
  markOnline() {
    if (this._status !== 'online') {
      console.log('[SpotMe Offline] Marked online - request succeeded');
      this._status = 'online';
      this._notifyListeners();
    }
  }

  subscribe(listener: NetworkListener): () => void {
    this._listeners.push(listener);
    return () => {
      this._listeners = this._listeners.filter(l => l !== listener);
    };
  }

  private _notifyListeners() {
    for (const listener of this._listeners) {
      try { listener(this._status); } catch {}
    }
  }

  // ---- Data Caching ----

  cacheNeeds(needs: any[]) {
    try {
      offlineStorage.set(CACHE_KEYS.NEEDS, JSON.stringify(needs));
      offlineStorage.set(CACHE_KEYS.NEEDS_TIMESTAMP, Date.now().toString());
      console.log(`[SpotMe Offline] Cached ${needs.length} needs`);
    } catch (e) {
      console.log('[SpotMe Offline] Failed to cache needs:', e);
    }
  }

  getCachedNeeds(): { needs: any[] | null; isStale: boolean; age: number } {
    try {
      const raw = offlineStorage.get(CACHE_KEYS.NEEDS);
      const tsRaw = offlineStorage.get(CACHE_KEYS.NEEDS_TIMESTAMP);
      
      if (!raw) return { needs: null, isStale: true, age: Infinity };

      const needs = JSON.parse(raw);
      const timestamp = tsRaw ? parseInt(tsRaw) : 0;
      const age = Date.now() - timestamp;
      const isStale = age > CACHE_STALE_MS;

      // Don't return data older than max age
      if (age > CACHE_MAX_AGE_MS) {
        return { needs: null, isStale: true, age };
      }

      return { needs, isStale, age };
    } catch {
      return { needs: null, isStale: true, age: Infinity };
    }
  }

  cacheNotifications(notifications: any[]) {
    try {
      offlineStorage.set(CACHE_KEYS.NOTIFICATIONS, JSON.stringify(notifications));
      offlineStorage.set(CACHE_KEYS.NOTIFICATIONS_TIMESTAMP, Date.now().toString());
    } catch {}
  }

  getCachedNotifications(): any[] | null {
    try {
      const raw = offlineStorage.get(CACHE_KEYS.NOTIFICATIONS);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  cacheThankYouUpdates(updates: any[]) {
    try {
      offlineStorage.set(CACHE_KEYS.THANK_YOU_UPDATES, JSON.stringify(updates));
    } catch {}
  }

  getCachedThankYouUpdates(): any[] | null {
    try {
      const raw = offlineStorage.get(CACHE_KEYS.THANK_YOU_UPDATES);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  // ---- Offline Action Queue ----

  getQueue(): QueuedAction[] {
    try {
      const raw = offlineStorage.get(CACHE_KEYS.OFFLINE_QUEUE);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  private _saveQueue(queue: QueuedAction[]) {
    try {
      offlineStorage.set(CACHE_KEYS.OFFLINE_QUEUE, JSON.stringify(queue));
    } catch {}
  }

  enqueue(action: Omit<QueuedAction, 'id' | 'createdAt' | 'retryCount' | 'maxRetries'>): QueuedAction {
    const queued: QueuedAction = {
      ...action,
      id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      retryCount: 0,
      maxRetries: 5,
    };

    const queue = this.getQueue();
    queue.push(queued);
    this._saveQueue(queue);

    console.log(`[SpotMe Offline] Queued ${action.type} action (${queue.length} total in queue)`);
    return queued;
  }

  removeFromQueue(actionId: string) {
    const queue = this.getQueue().filter(a => a.id !== actionId);
    this._saveQueue(queue);
  }

  clearQueue() {
    this._saveQueue([]);
  }

  get pendingCount(): number {
    return this.getQueue().length;
  }

  // ---- Sync Queue ----
  // Returns { synced: number, failed: number }
  async syncQueue(
    executor: (action: QueuedAction) => Promise<boolean>
  ): Promise<{ synced: number; failed: number }> {
    if (this._syncInProgress) {
      console.log('[SpotMe Offline] Sync already in progress, skipping');
      return { synced: 0, failed: 0 };
    }

    const queue = this.getQueue();
    if (queue.length === 0) return { synced: 0, failed: 0 };

    this._syncInProgress = true;
    console.log(`[SpotMe Offline] Starting sync of ${queue.length} queued actions`);

    let synced = 0;
    let failed = 0;
    const remaining: QueuedAction[] = [];

    for (const action of queue) {
      try {
        const success = await executor(action);
        if (success) {
          synced++;
          console.log(`[SpotMe Offline] Synced: ${action.type} (${action.id})`);
        } else {
          action.retryCount++;
          action.lastError = 'Sync returned false';
          if (action.retryCount < action.maxRetries) {
            remaining.push(action);
          }
          failed++;
        }
      } catch (err: any) {
        action.retryCount++;
        action.lastError = err?.message || 'Unknown error';
        if (action.retryCount < action.maxRetries) {
          remaining.push(action);
        }
        failed++;
        console.log(`[SpotMe Offline] Sync failed for ${action.type}: ${err?.message}`);
      }
    }

    this._saveQueue(remaining);
    this._syncInProgress = false;

    console.log(`[SpotMe Offline] Sync complete: ${synced} synced, ${failed} failed, ${remaining.length} remaining`);
    return { synced, failed };
  }

  get isSyncing(): boolean {
    return this._syncInProgress;
  }

  // ---- Utility: Format cache age ----
  formatAge(ms: number): string {
    if (ms < 60000) return 'just now';
    if (ms < 3600000) return `${Math.round(ms / 60000)}m ago`;
    if (ms < 86400000) return `${Math.round(ms / 3600000)}h ago`;
    return 'over a day ago';
  }
}

// Singleton instance
export const offlineManager = new OfflineManager();
