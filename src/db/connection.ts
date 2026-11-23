import { Capacitor } from '@capacitor/core';
import {
  CapacitorSQLite,
  SQLiteConnection,
  type SQLiteDBConnection,
} from '@capacitor-community/sqlite';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import { defineCustomElements } from 'jeep-sqlite/loader';
import { migrate, DB_VERSION } from './migrations';
const NAME = 'tohobil';
const sqlite = new SQLiteConnection(CapacitorSQLite);
let databasePromise: Promise<SQLiteDBConnection> | undefined;
const isWeb = Capacitor.getPlatform() === 'web';
async function initialize(): Promise<SQLiteDBConnection> {
  if (isWeb) {
    defineCustomElements(window);
    if (!document.querySelector('jeep-sqlite')) {
      const element = document.createElement('jeep-sqlite');
      element.setAttribute('wasmPath', '/assets');
      element.setAttribute('autoSave', 'true');
      document.body.appendChild(element);
    }
    await customElements.whenDefined('jeep-sqlite');
    await sqlite.initWebStore();
  } else {
    let key = await SecureStorage.getItem('tohobil.db.key');
    if (!key) {
      const random = crypto.getRandomValues(new Uint8Array(32));
      key = btoa(String.fromCharCode(...random));
      await SecureStorage.setItem('tohobil.db.key', key);
    }
    if (!(await sqlite.isSecretStored()).result)
      await sqlite.setEncryptionSecret(key);
    else if (!(await sqlite.checkEncryptionSecret(key)).result)
      throw new Error('DATABASE_KEY_MISMATCH');
  }
  const consistent = (await sqlite.checkConnectionsConsistency()).result;
  const exists = (await sqlite.isConnection(NAME, false)).result;
  const db =
    consistent && exists
      ? await sqlite.retrieveConnection(NAME, false)
      : await sqlite.createConnection(
          NAME,
          !isWeb,
          isWeb ? 'no-encryption' : 'secret',
          DB_VERSION,
          false,
        );
  await db.open();
  await migrate(db);
  if (isWeb) await sqlite.saveToStore(NAME);
  return db;
}
export function getDatabase(): Promise<SQLiteDBConnection> {
  return (databasePromise ??= initialize().catch((error) => {
    databasePromise = undefined;
    throw error;
  }));
}
export async function persistWeb(): Promise<void> {
  if (isWeb) await sqlite.saveToStore(NAME);
}
export async function transaction<T>(
  operation: (db: SQLiteDBConnection) => Promise<T>,
): Promise<T> {
  const db = await getDatabase();
  await db.beginTransaction();
  try {
    const value = await operation(db);
    await db.commitTransaction();
    await persistWeb();
    return value;
  } catch (error) {
    try {
      await db.rollbackTransaction();
    } catch {
      /* preserve the original database error */
    }
    throw error;
  }
}
