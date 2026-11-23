import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { token, getApiBaseUrl } from '../app/identity';
import type { AttachmentKind } from '../db/types';

// In-memory web fallback store for browser development and unit testing
const webBlobStore = new Map<string, Blob>();
const webObjectUrlMap = new Map<string, string>();

export async function computeSha256(data: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return blob.arrayBuffer();
}

/**
 * Strips EXIF location and compresses an image to maxDimension (default 2000px) and quality (0.8).
 */
export async function compressImage(
  blob: Blob,
  maxDimension = 2000,
  quality = 0.8,
): Promise<{ blob: Blob; width: number; height: number }> {
  // If running in environment without Image/canvas (e.g. Node tests without DOM canvas), fallback safely
  if (typeof document === 'undefined') {
    return { blob, width: 800, height: 600 };
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve({ blob, width: img.width, height: img.height });
        return;
      }

      // Drawing to canvas automatically strips EXIF metadata
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (compressedBlob) => {
          if (!compressedBlob) {
            resolve({ blob, width, height });
          } else {
            resolve({ blob: compressedBlob, width, height });
          }
        },
        'image/jpeg',
        quality,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for compression'));
    };
    img.src = url;
  });
}

/**
 * Creates a ~300px thumbnail from an image blob.
 */
export async function generateThumbnail(
  blob: Blob,
  maxDimension = 300,
  quality = 0.75,
): Promise<Blob> {
  if (typeof document === 'undefined') {
    return blob;
  }

  const { blob: thumbBlob } = await compressImage(blob, maxDimension, quality);
  return thumbBlob;
}

/**
 * Saves a file into local private storage (Directory.Data on native, web blob store on web).
 */
export async function saveLocalFile(
  relativePath: string,
  data: Blob | ArrayBuffer,
): Promise<string> {
  const blob = data instanceof Blob ? data : new Blob([data]);

  if (Capacitor.isNativePlatform()) {
    const buffer = await blob.arrayBuffer();
    const base64 = arrayBufferToBase64(buffer);
    await Filesystem.writeFile({
      path: relativePath,
      data: base64,
      directory: Directory.Data,
      recursive: true,
    });
    return relativePath;
  }

  // Web fallback
  webBlobStore.set(relativePath, blob);
  return relativePath;
}

/**
 * Reads a local file from storage as a Blob.
 */
export async function readLocalFile(relativePath: string): Promise<Blob | null> {
  if (Capacitor.isNativePlatform()) {
    try {
      const result = await Filesystem.readFile({
        path: relativePath,
        directory: Directory.Data,
      });
      const buffer = base64ToArrayBuffer(result.data as string);
      return new Blob([buffer]);
    } catch {
      return null;
    }
  }

  return webBlobStore.get(relativePath) ?? null;
}

/**
 * Resolves a local path to a displayable URL.
 */
export async function resolveFileSrc(
  relativePath: string | null | undefined,
): Promise<string> {
  if (!relativePath) return '';

  if (Capacitor.isNativePlatform()) {
    try {
      const uri = await Filesystem.getUri({
        path: relativePath,
        directory: Directory.Data,
      });
      return Capacitor.convertFileSrc(uri.uri);
    } catch {
      return '';
    }
  }

  // Web fallback: convert stored blob to Object URL
  const existing = webObjectUrlMap.get(relativePath);
  if (existing) return existing;

  const blob = webBlobStore.get(relativePath);
  if (blob) {
    const url = URL.createObjectURL(blob);
    webObjectUrlMap.set(relativePath, url);
    return url;
  }

  return relativePath;
}

/**
 * Deletes a local file.
 */
export async function deleteLocalFile(
  relativePath: string | null | undefined,
): Promise<void> {
  if (!relativePath) return;

  if (Capacitor.isNativePlatform()) {
    try {
      await Filesystem.deleteFile({
        path: relativePath,
        directory: Directory.Data,
      });
    } catch {
      // ignore
    }
  } else {
    webBlobStore.delete(relativePath);
    const url = webObjectUrlMap.get(relativePath);
    if (url) {
      URL.revokeObjectURL(url);
      webObjectUrlMap.delete(relativePath);
    }
  }
}

/**
 * Processes an incoming file/blob and saves it to local private storage with compressed image & thumbnail.
 */
export async function processAndSaveAttachment(
  id: string,
  rawBlob: Blob,
  originalName: string,
): Promise<{
  localPath: string;
  thumbLocalPath: string | null;
  sha256: string;
  size: number;
  width: number | null;
  height: number | null;
  kind: AttachmentKind;
  mime: string;
}> {
  const mime = rawBlob.type || 'application/octet-stream';
  const isImage = mime.startsWith('image/') || /\.(jpg|jpeg|png|webp|heic)$/i.test(originalName);
  const isPdf = mime === 'application/pdf' || originalName.toLowerCase().endsWith('.pdf');

  let kind: AttachmentKind = 'file';
  if (isImage) kind = 'image';
  else if (isPdf) kind = 'pdf';

  if (isImage) {
    // Compress image (max 2000px, 0.8 JPEG)
    const compressed = await compressImage(rawBlob, 2000, 0.8);
    const thumbBlob = await generateThumbnail(compressed.blob, 300, 0.75);

    const mainBuffer = await compressed.blob.arrayBuffer();
    const sha256 = await computeSha256(mainBuffer);

    const localPath = `attachments/${id}.jpg`;
    const thumbLocalPath = `attachments/thumbs/${id}.jpg`;

    await saveLocalFile(localPath, compressed.blob);
    await saveLocalFile(thumbLocalPath, thumbBlob);

    return {
      localPath,
      thumbLocalPath,
      sha256,
      size: compressed.blob.size,
      width: compressed.width,
      height: compressed.height,
      kind: 'image',
      mime: 'image/jpeg',
    };
  }

  // Non-image (e.g. PDF or document)
  const buffer = await rawBlob.arrayBuffer();
  const sha256 = await computeSha256(buffer);

  const ext = originalName.includes('.')
    ? originalName.split('.').pop()?.toLowerCase() ?? 'bin'
    : isPdf
      ? 'pdf'
      : 'bin';
  const localPath = `attachments/${id}.${ext}`;

  await saveLocalFile(localPath, rawBlob);

  return {
    localPath,
    thumbLocalPath: null,
    sha256,
    size: rawBlob.size,
    width: null,
    height: null,
    kind,
    mime,
  };
}

/**
 * Downloads a remote file from server and caches it locally.
 */
export async function downloadAndCacheRemoteFile(
  remoteId: string,
  isThumb = false,
): Promise<string> {
  const subpath = isThumb ? `cache/thumbs/${remoteId}.jpg` : `cache/${remoteId}`;
  const relativePath = `attachments/${subpath}`;

  // Check if already in cache
  const existing = await readLocalFile(relativePath);
  if (existing) {
    return resolveFileSrc(relativePath);
  }

  const authToken = await token();
  const url = `${getApiBaseUrl()}/api/v1/files/${remoteId}${isThumb ? '/thumb' : ''}`;

  const response = await fetch(url, {
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
  });

  if (!response.ok) {
    throw new Error(`Failed to download remote file: ${response.status}`);
  }

  const blob = await response.blob();
  await saveLocalFile(relativePath, blob);
  return resolveFileSrc(relativePath);
}

/**
 * Clears cached downloads on device.
 */
export async function clearDownloadedCache(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await Filesystem.rmdir({
        path: 'attachments/cache',
        directory: Directory.Data,
        recursive: true,
      });
    } catch {
      // directory might not exist yet
    }
  } else {
    for (const key of Array.from(webBlobStore.keys())) {
      if (key.startsWith('attachments/cache/')) {
        webBlobStore.delete(key);
        const url = webObjectUrlMap.get(key);
        if (url) {
          URL.revokeObjectURL(url);
          webObjectUrlMap.delete(key);
        }
      }
    }
  }
}
