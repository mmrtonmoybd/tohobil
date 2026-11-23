import { getDatabase, transaction, persistWeb } from '../db/connection';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';

export interface EncryptedBackupEnvelope {
  app: 'Tohobil';
  format: 'tohobil_encrypted_backup';
  version: number;
  created_at: number;
  kdf: {
    algorithm: 'PBKDF2';
    hash: 'SHA-256';
    iterations: number;
    salt: string;
  };
  cipher: {
    algorithm: 'AES-GCM';
    iv: string;
    data: string;
  };
}

export const BACKUP_TABLES = [
  'books',
  'accounts',
  'categories',
  'tags',
  'people',
  'debts',
  'debt_installments',
  'transactions',
  'transaction_tags',
  'recurring_rules',
  'budgets',
  'goals',
  'assets',
  'asset_valuations',
  'documents',
  'attachments',
] as const;

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBuf(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes.buffer;
}

export async function deriveKey(passphrase: string, salt: Uint8Array, iterations = 100000): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptBackupPayload(payload: object, passphrase: string): Promise<string> {
  const enc = new TextEncoder();
  const plainBytes = enc.encode(JSON.stringify(payload));

  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);

  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);

  const key = await deriveKey(passphrase, salt);
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plainBytes,
  );

  const envelope: EncryptedBackupEnvelope = {
    app: 'Tohobil',
    format: 'tohobil_encrypted_backup',
    version: 1,
    created_at: Date.now(),
    kdf: {
      algorithm: 'PBKDF2',
      hash: 'SHA-256',
      iterations: 100000,
      salt: bufToHex(salt.buffer),
    },
    cipher: {
      algorithm: 'AES-GCM',
      iv: bufToHex(iv.buffer),
      data: bufToHex(cipherBuffer),
    },
  };

  return JSON.stringify(envelope, null, 2);
}

export async function decryptBackupPayload(envelopeStr: string, passphrase: string): Promise<Record<string, unknown[]>> {
  let envelope: EncryptedBackupEnvelope;
  try {
    envelope = JSON.parse(envelopeStr);
  } catch {
    throw new Error('INVALID_BACKUP_FILE');
  }

  if (envelope.app !== 'Tohobil' || envelope.format !== 'tohobil_encrypted_backup') {
    throw new Error('INVALID_BACKUP_FORMAT');
  }

  const salt = new Uint8Array(hexToBuf(envelope.kdf.salt));
  const iv = new Uint8Array(hexToBuf(envelope.cipher.iv));
  const cipherData = hexToBuf(envelope.cipher.data);

  const key = await deriveKey(passphrase, salt, envelope.kdf.iterations || 100000);

  let decryptedBuffer: ArrayBuffer;
  try {
    decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      cipherData,
    );
  } catch {
    throw new Error('INCORRECT_PASSPHRASE');
  }

  const dec = new TextDecoder();
  const plainText = dec.decode(decryptedBuffer);
  return JSON.parse(plainText);
}

export async function exportEncryptedBackup(passphrase: string): Promise<string> {
  const db = await getDatabase();
  const dump: Record<string, unknown[]> = {};

  for (const table of BACKUP_TABLES) {
    try {
      const res = await db.query(`SELECT * FROM ${table}`);
      dump[table] = res.values ?? [];
    } catch {
      dump[table] = [];
    }
  }

  return encryptBackupPayload(dump, passphrase);
}

export async function restoreEncryptedBackup(
  envelopeStr: string,
  passphrase: string,
): Promise<{ restoredTables: number; restoredRows: number }> {
  const data = await decryptBackupPayload(envelopeStr, passphrase);

  let restoredTables = 0;
  let restoredRows = 0;

  await transaction(async (db) => {
    for (const table of BACKUP_TABLES) {
      const rows = data[table];
      if (!Array.isArray(rows) || rows.length === 0) continue;

      restoredTables++;
      for (const row of rows as Record<string, unknown>[]) {
        const columns = Object.keys(row);
        if (columns.length === 0) continue;

        const placeholders = columns.map(() => '?').join(',');
        const values = columns.map((col) => row[col]);
        const sql = `INSERT OR REPLACE INTO ${table} (${columns.join(',')}) VALUES (${placeholders})`;
        await db.run(sql, values);
        restoredRows++;
      }
    }
  });

  await persistWeb();
  return { restoredTables, restoredRows };
}

export async function shareOrDownloadBackup(backupContent: string, fileName?: string): Promise<void> {
  const name = fileName ?? `tohobil-backup-${new Date().toISOString().slice(0, 10)}.tohobil`;
  if (Capacitor.isNativePlatform()) {
    try {
      await Share.share({
        title: 'Tohobil Encrypted Backup',
        text: 'Encrypted backup of Tohobil personal financial manager.',
        dialogTitle: 'Save Tohobil Backup',
      });
      return;
    } catch {
      // Fall through to browser download
    }
  }

  // Web download
  const blob = new Blob([backupContent], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
