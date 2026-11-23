import { describe, it, expect } from 'vitest';
import { encryptBackupPayload, decryptBackupPayload } from './backup';

describe('backup encryption & decryption', () => {
  const sampleData = {
    books: [{ id: 'b1', name: 'Personal', currency: 'BDT' }],
    accounts: [{ id: 'a1', name: 'Cash', balance: 5000 }],
    transactions: [
      { id: 't1', amount: 200, type: 'expense', note: 'Breakfast' },
    ],
  };

  it('encrypts and decrypts payload with correct passphrase', async () => {
    const passphrase = 'MySuperSecretPassphrase123!';
    const encryptedStr = await encryptBackupPayload(sampleData, passphrase);

    expect(typeof encryptedStr).toBe('string');
    const parsed = JSON.parse(encryptedStr);
    expect(parsed.app).toBe('Tohobil');
    expect(parsed.format).toBe('tohobil_encrypted_backup');
    expect(parsed.cipher.data).toBeDefined();

    const restored = await decryptBackupPayload(encryptedStr, passphrase);
    expect(restored).toEqual(sampleData);
  });

  it('throws INCORRECT_PASSPHRASE when passphrase is wrong', async () => {
    const encryptedStr = await encryptBackupPayload(sampleData, 'correctPass');

    await expect(
      decryptBackupPayload(encryptedStr, 'wrongPass'),
    ).rejects.toThrow('INCORRECT_PASSPHRASE');
  });

  it('throws INVALID_BACKUP_FORMAT when file is tampered or unknown format', async () => {
    const fake = JSON.stringify({ app: 'Other', format: 'unknown' });
    await expect(decryptBackupPayload(fake, 'pass')).rejects.toThrow(
      'INVALID_BACKUP_FORMAT',
    );
  });
});
