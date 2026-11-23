import { Network } from '@capacitor/network';
import { Preferences } from '@capacitor/preferences';
import { token, getApiBaseUrl } from '../app/identity';
import {
  listPendingUploads,
  updateAttachmentUploadState,
} from '../db/repository';
import { readLocalFile } from '../lib/fileStorage';
import { getBackoffDelay } from './backoff';

export const PREF_WIFI_ONLY = 'tohobil.upload.wifi_only';

export interface UploadQueueState {
  isUploading: boolean;
  pendingCount: number;
  wifiOnly: boolean;
  lastError: string | null;
}

export type UploadQueueListener = (state: UploadQueueState) => void;

class UploadQueue {
  private isUploading = false;
  private pendingCount = 0;
  private wifiOnly = false;
  private lastError: string | null = null;
  private retryAttempt = 0;
  private retryTimer: number | null = null;
  private started = false;
  private listeners = new Set<UploadQueueListener>();

  public getState(): UploadQueueState {
    return {
      isUploading: this.isUploading,
      pendingCount: this.pendingCount,
      wifiOnly: this.wifiOnly,
      lastError: this.lastError,
    };
  }

  public subscribe(listener: UploadQueueListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch {
        // ignore subscriber errors
      }
    }
  }

  public async init(): Promise<void> {
    if (this.started) return;
    this.started = true;

    try {
      const { value } = await Preferences.get({ key: PREF_WIFI_ONLY });
      this.wifiOnly = value === 'true';
    } catch {
      this.wifiOnly = false;
    }

    try {
      await Network.addListener('networkStatusChange', (status) => {
        if (status.connected) {
          void this.processQueue();
        }
      });
    } catch {
      // Network listener unavailable in test environments
    }

    void this.refreshPendingCount();
    void this.processQueue();
  }

  public async setWifiOnly(enabled: boolean): Promise<void> {
    this.wifiOnly = enabled;
    await Preferences.set({ key: PREF_WIFI_ONLY, value: enabled ? 'true' : 'false' });
    this.notify();
    if (!enabled) {
      void this.processQueue();
    }
  }

  public async getWifiOnly(): Promise<boolean> {
    return this.wifiOnly;
  }

  public async refreshPendingCount(): Promise<number> {
    try {
      const pending = await listPendingUploads();
      this.pendingCount = pending.length;
      this.notify();
      return this.pendingCount;
    } catch {
      return this.pendingCount;
    }
  }

  public async processQueue(): Promise<void> {
    if (this.isUploading) return;

    const authToken = await token();
    if (!authToken) {
      return;
    }

    try {
      const net = await Network.getStatus();
      if (!net.connected) {
        return;
      }

      // Check Wi-Fi only restriction
      if (this.wifiOnly && net.connectionType === 'cellular') {
        return;
      }
    } catch {
      // Network check fallback
    }

    const pending = await listPendingUploads();
    this.pendingCount = pending.length;
    if (pending.length === 0) {
      this.isUploading = false;
      this.retryAttempt = 0;
      this.notify();
      return;
    }

    this.isUploading = true;
    this.notify();

    try {
      for (const attachment of pending) {
        if (!attachment.local_path) {
          await updateAttachmentUploadState(attachment.id, null, 'failed');
          continue;
        }

        const blob = await readLocalFile(attachment.local_path);
        if (!blob) {
          await updateAttachmentUploadState(attachment.id, null, 'failed');
          continue;
        }

        // Mark as uploading in database
        await updateAttachmentUploadState(attachment.id, null, 'uploading');

        const formData = new FormData();
        formData.append('file', blob, attachment.original_name);

        const url = `${getApiBaseUrl()}/api/v1/files`;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
          body: formData,
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => null);
          const msg = errData?.error?.message ?? `Upload HTTP ${response.status}`;
          throw new Error(msg);
        }

        const data = await response.json();
        const remoteFileId = data.file?.id;
        if (!remoteFileId) {
          throw new Error('Server returned empty file id');
        }

        // Mark as uploaded and associate remote_id
        await updateAttachmentUploadState(attachment.id, remoteFileId, 'uploaded');
        this.retryAttempt = 0;
      }

      this.lastError = null;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Upload failed';
      this.lastError = msg;
      this.retryAttempt++;
      this.scheduleRetry();
    } finally {
      this.isUploading = false;
      await this.refreshPendingCount();
    }
  }

  private scheduleRetry(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
    }
    const delay = getBackoffDelay(this.retryAttempt);
    this.retryTimer = window.setTimeout(() => {
      this.retryTimer = null;
      void this.processQueue();
    }, delay);
  }
}

export const uploadQueue = new UploadQueue();
