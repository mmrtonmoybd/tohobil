import { api } from '../app/identity';
import type { SyncChangeSet, SyncPullResult, SyncPushResult } from './types';

export async function pushChanges(changes: SyncChangeSet): Promise<SyncPushResult> {
  return api<SyncPushResult>('sync/push', {
    method: 'POST',
    body: JSON.stringify({ changes }),
  });
}

export async function pullChanges(since: number, limit = 500): Promise<SyncPullResult> {
  const params = new URLSearchParams({
    since: String(since),
    limit: String(limit),
  });
  return api<SyncPullResult>(`sync/pull?${params.toString()}`);
}
