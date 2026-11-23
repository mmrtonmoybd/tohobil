import { create } from 'zustand';
import { syncEngine } from './engine';
import type { SyncState } from './types';

interface SyncStoreState extends SyncState {
  sync: () => Promise<boolean>;
  refreshPending: () => Promise<number>;
}

export const useSyncStore = create<SyncStoreState>((set) => {
  // Subscribe to syncEngine events
  syncEngine.subscribe((engineState) => {
    set({
      status: engineState.status,
      lastSyncTime: engineState.lastSyncTime,
      pendingCount: engineState.pendingCount,
      lastError: engineState.lastError,
      isOnline: engineState.isOnline,
    });
  });

  const initial = syncEngine.getState();

  return {
    ...initial,
    sync: async () => syncEngine.sync(),
    refreshPending: async () => syncEngine.refreshPendingCount(),
  };
});
