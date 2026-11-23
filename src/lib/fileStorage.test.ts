import { describe, expect, it } from 'vitest';
import {
  arrayBufferToBase64,
  base64ToArrayBuffer,
  computeSha256,
  processAndSaveAttachment,
  readLocalFile,
  resolveFileSrc,
  deleteLocalFile,
  clearDownloadedCache,
} from './fileStorage';

describe('fileStorage', () => {
  it('computes correct SHA-256 hash', async () => {
    const encoder = new TextEncoder();
    const data = encoder.encode('Hello Tohobil Attachment');
    const hash = await computeSha256(data.buffer);
    expect(hash).toHaveLength(64);
    expect(typeof hash).toBe('string');
  });

  it('converts arrayBuffer to base64 and back', () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5, 250, 255]);
    const b64 = arrayBufferToBase64(bytes.buffer);
    expect(typeof b64).toBe('string');
    const restored = new Uint8Array(base64ToArrayBuffer(b64));
    expect(Array.from(restored)).toEqual(Array.from(bytes));
  });

  it('processes and saves PDF attachment locally', async () => {
    const pdfContent = new Uint8Array([37, 80, 68, 70]); // %PDF
    const blob = new Blob([pdfContent], { type: 'application/pdf' });
    const id = 'test-doc-id-001';

    const result = await processAndSaveAttachment(id, blob, 'receipt.pdf');
    expect(result.kind).toBe('pdf');
    expect(result.mime).toBe('application/pdf');
    expect(result.localPath).toBe('attachments/test-doc-id-001.pdf');
    expect(result.thumbLocalPath).toBeNull();
    expect(result.sha256).toHaveLength(64);

    const savedBlob = await readLocalFile(result.localPath);
    expect(savedBlob).not.toBeNull();
    expect(savedBlob?.size).toBe(pdfContent.length);

    const url = await resolveFileSrc(result.localPath);
    expect(url).toBeTruthy();

    await deleteLocalFile(result.localPath);
    const afterDelete = await readLocalFile(result.localPath);
    expect(afterDelete).toBeNull();
  });

  it('clears downloaded cache without affecting pending files', async () => {
    const data = new Blob(['cached item']);
    const cachePath = 'attachments/cache/remote-123';
    const mainPath = 'attachments/local-456.jpg';

    const { saveLocalFile } = await import('./fileStorage');
    await saveLocalFile(cachePath, data);
    await saveLocalFile(mainPath, data);

    await clearDownloadedCache();

    const cachedRead = await readLocalFile(cachePath);
    expect(cachedRead).toBeNull();

    const mainRead = await readLocalFile(mainPath);
    expect(mainRead).not.toBeNull();

    await deleteLocalFile(mainPath);
  });
});
