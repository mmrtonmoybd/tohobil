import { describe, expect, it } from 'vitest';
import { resolveConflict, type SyncRecord } from './merge';
import { getBackoffDelay } from './backoff';

describe('Sync conflict resolution (Last-Write-Wins)', () => {
  it('applies incoming when no local record exists', () => {
    const incoming: SyncRecord = {
      id: 'tx-1',
      updated_at: 1000,
    };
    expect(resolveConflict(null, incoming)).toBe('apply_incoming');
    expect(resolveConflict(undefined, incoming)).toBe('apply_incoming');
  });

  it('applies incoming when local record is already synced', () => {
    const local: SyncRecord = {
      id: 'tx-1',
      updated_at: 2000,
      sync_state: 'synced',
    };
    const incoming: SyncRecord = {
      id: 'tx-1',
      updated_at: 1000,
    };
    expect(resolveConflict(local, incoming)).toBe('apply_incoming');
  });

  it('keeps local when local is pending and newer than incoming', () => {
    const local: SyncRecord = {
      id: 'tx-1',
      updated_at: 3000,
      sync_state: 'pending',
    };
    const incoming: SyncRecord = {
      id: 'tx-1',
      updated_at: 2000,
    };
    expect(resolveConflict(local, incoming)).toBe('keep_local');
  });

  it('applies incoming when local is pending but incoming is newer or equal', () => {
    const local: SyncRecord = {
      id: 'tx-1',
      updated_at: 2000,
      sync_state: 'pending',
    };
    const incoming: SyncRecord = {
      id: 'tx-1',
      updated_at: 2500,
    };
    expect(resolveConflict(local, incoming)).toBe('apply_incoming');

    const equalIncoming: SyncRecord = {
      id: 'tx-1',
      updated_at: 2000,
    };
    expect(resolveConflict(local, equalIncoming)).toBe('apply_incoming');
  });
});

describe('Sync exponential backoff with jitter', () => {
  it('scales exponentially with attempts and applies jitter', () => {
    // With dummy random returning 0.5 (jitter factor = 0.8 + 0.5*0.4 = 1.0)
    const midRandom = () => 0.5;

    expect(getBackoffDelay(0, 1000, 30000, midRandom)).toBe(1000);
    expect(getBackoffDelay(1, 1000, 30000, midRandom)).toBe(2000);
    expect(getBackoffDelay(2, 1000, 30000, midRandom)).toBe(4000);
    expect(getBackoffDelay(3, 1000, 30000, midRandom)).toBe(8000);
    expect(getBackoffDelay(4, 1000, 30000, midRandom)).toBe(16000);
  });

  it('clamps delay to maxMs', () => {
    const midRandom = () => 0.5;
    expect(getBackoffDelay(10, 1000, 30000, midRandom)).toBe(30000);
  });

  it('stays within 0.8 to 1.2 bounds of base delay', () => {
    const minRandom = () => 0; // jitter = 0.8
    const maxRandom = () => 1; // jitter = 1.2

    expect(getBackoffDelay(1, 1000, 30000, minRandom)).toBe(1600);
    expect(getBackoffDelay(1, 1000, 30000, maxRandom)).toBe(2400);
  });
});
