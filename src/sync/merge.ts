export interface SyncRecord {
  id: string;
  updated_at: number;
  sync_state?: 'pending' | 'synced';
  [key: string]: unknown;
}

/**
 * Last-write-wins resolution between local and server incoming records.
 *
 * If local record is pending and local updated_at is newer than server updated_at,
 * local record wins (returns 'keep_local') so pending edits are preserved for next push.
 * Otherwise, incoming server record wins (returns 'apply_incoming').
 */
export function resolveConflict(
  local: SyncRecord | null | undefined,
  incoming: SyncRecord,
): 'keep_local' | 'apply_incoming' {
  if (!local) {
    return 'apply_incoming';
  }

  if (local.sync_state === 'pending' && local.updated_at > incoming.updated_at) {
    return 'keep_local';
  }

  return 'apply_incoming';
}
