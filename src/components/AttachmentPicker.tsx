import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { FilePicker } from '@capawesome/capacitor-file-picker';
import { Capacitor } from '@capacitor/core';
import type { Attachment, AttachmentEntityType } from '../db/types';
import {
  processAndSaveAttachment,
  resolveFileSrc,
  downloadAndCacheRemoteFile,
} from '../lib/fileStorage';
import {
  createAttachment,
  deleteAttachment,
  listAttachmentsForEntity,
} from '../db/repository';
import { AttachmentViewer } from './AttachmentViewer';
import { uploadQueue } from '../sync/uploadQueue';
import { uuidv7 } from '../lib/ids';

export interface AttachmentPickerProps {
  bookId: string;
  entityType: AttachmentEntityType;
  entityId: string;
  attachments?: Attachment[];
  onAttachmentsChange?: (attachments: Attachment[]) => void;
  compact?: boolean;
}

export function AttachmentPicker({
  bookId,
  entityType,
  entityId,
  attachments: controlledAttachments,
  onAttachmentsChange,
  compact = false,
}: AttachmentPickerProps) {
  const { t } = useTranslation();
  const [internalAttachments, setInternalAttachments] = useState<Attachment[]>([]);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [processing, setProcessing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const attachments = controlledAttachments ?? internalAttachments;

  // Load attachments if entityId exists and no controlled attachments passed
  useEffect(() => {
    if (controlledAttachments !== undefined) return;
    if (!entityId) return;

    let active = true;
    void listAttachmentsForEntity(entityType, entityId).then((list) => {
      if (active) setInternalAttachments(list);
    });

    return () => {
      active = false;
    };
  }, [entityType, entityId, controlledAttachments]);

  const handleProcessFile = async (file: File | Blob, originalName: string) => {
    setProcessing(true);
    try {
      const attId = uuidv7();
      const processed = await processAndSaveAttachment(attId, file, originalName);

      const newAtt = await createAttachment({
        id: attId,
        book_id: bookId,
        entity_type: entityType,
        entity_id: entityId,
        kind: processed.kind,
        mime: processed.mime,
        size: processed.size,
        original_name: originalName,
        sha256: processed.sha256,
        width: processed.width,
        height: processed.height,
        local_path: processed.localPath,
        thumb_local_path: processed.thumbLocalPath,
        upload_state: 'local',
      });

      const updated = [...attachments, newAtt];
      if (controlledAttachments === undefined) {
        setInternalAttachments(updated);
      }
      onAttachmentsChange?.(updated);

      // Trigger background upload
      void uploadQueue.processQueue();
    } catch {
      // Process error
    } finally {
      setProcessing(false);
    }
  };

  const handleTakePhoto = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        const photo = await Camera.getPhoto({
          resultType: CameraResultType.Uri,
          source: CameraSource.Camera,
          quality: 90,
        });

        if (photo.webPath) {
          const res = await fetch(photo.webPath);
          const blob = await res.blob();
          await handleProcessFile(blob, `photo_${Date.now()}.jpg`);
        }
      } catch {
        // User cancelled camera
      }
    } else {
      cameraInputRef.current?.click();
    }
  };

  const handlePickGallery = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        const result = await FilePicker.pickImages({
          readData: false,
        });

        for (const file of result.files) {
          if (file.path) {
            const res = await fetch(Capacitor.convertFileSrc(file.path));
            const blob = await res.blob();
            await handleProcessFile(blob, file.name || `image_${Date.now()}.jpg`);
          }
        }
      } catch {
        // User cancelled picker
      }
    } else {
      fileInputRef.current?.click();
    }
  };

  const handlePickDocument = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        const result = await FilePicker.pickFiles({
          types: ['application/pdf', 'image/*'],
          readData: false,
        });

        for (const file of result.files) {
          if (file.path) {
            const res = await fetch(Capacitor.convertFileSrc(file.path));
            const blob = await res.blob();
            await handleProcessFile(blob, file.name || `doc_${Date.now()}.pdf`);
          }
        }
      } catch {
        // User cancelled picker
      }
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleDeleteAttachment = async (id: string) => {
    await deleteAttachment(id);
    const updated = attachments.filter((a) => a.id !== id);
    if (controlledAttachments === undefined) {
      setInternalAttachments(updated);
    }
    onAttachmentsChange?.(updated);
  };

  return (
    <div className="attachment-picker-container" style={{ margin: '8px 0' }}>
      {/* Hidden inputs for web fallbacks */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*,application/pdf"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          const files = e.target.files;
          if (files) {
            for (let i = 0; i < files.length; i++) {
              void handleProcessFile(files[i], files[i].name);
            }
          }
          e.target.value = '';
        }}
      />
      <input
        type="file"
        ref={cameraInputRef}
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={(e) => {
          const files = e.target.files;
          if (files && files[0]) {
            void handleProcessFile(files[0], files[0].name);
          }
          e.target.value = '';
        }}
      />

      {/* Action Buttons Row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={handleTakePhoto}
          disabled={processing}
          className="attachment-btn"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: compact ? '6px 10px' : '8px 14px',
            borderRadius: 16,
            border: '1px solid var(--app-border)',
            background: 'var(--app-card)',
            color: 'var(--app-text)',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
          }}
          aria-label={t('vault.takePhoto')}
        >
          <span className="material-symbols-rounded" style={{ fontSize: 18, color: '#14B8A6' }}>
            photo_camera
          </span>
          {!compact && <span>{t('vault.camera')}</span>}
        </button>

        <button
          type="button"
          onClick={handlePickGallery}
          disabled={processing}
          className="attachment-btn"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: compact ? '6px 10px' : '8px 14px',
            borderRadius: 16,
            border: '1px solid var(--app-border)',
            background: 'var(--app-card)',
            color: 'var(--app-text)',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
          }}
          aria-label={t('vault.gallery')}
        >
          <span className="material-symbols-rounded" style={{ fontSize: 18, color: '#0EA5E9' }}>
            image
          </span>
          {!compact && <span>{t('vault.gallery')}</span>}
        </button>

        <button
          type="button"
          onClick={handlePickDocument}
          disabled={processing}
          className="attachment-btn"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: compact ? '6px 10px' : '8px 14px',
            borderRadius: 16,
            border: '1px solid var(--app-border)',
            background: 'var(--app-card)',
            color: 'var(--app-text)',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
          }}
          aria-label={t('vault.attachDocument')}
        >
          <span className="material-symbols-rounded" style={{ fontSize: 18, color: '#6366F1' }}>
            attach_file
          </span>
          {!compact && <span>{t('vault.document')}</span>}
        </button>

        {processing && (
          <span style={{ fontSize: 12, color: 'var(--app-muted)' }}>
            {t('common.processing')}...
          </span>
        )}
      </div>

      {/* Thumbnails Strip */}
      {attachments.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 10,
            overflowX: 'auto',
            padding: '10px 0 4px',
            alignItems: 'center',
          }}
        >
          {attachments.map((att, idx) => (
            <ThumbnailItem
              key={att.id}
              attachment={att}
              onClick={() => {
                setViewerIndex(idx);
                setViewerOpen(true);
              }}
              onDelete={() => handleDeleteAttachment(att.id)}
            />
          ))}
        </div>
      )}

      {/* Fullscreen Viewer */}
      <AttachmentViewer
        attachments={attachments}
        initialIndex={viewerIndex}
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
        onDelete={handleDeleteAttachment}
      />
    </div>
  );
}

function ThumbnailItem({
  attachment,
  onClick,
  onDelete,
}: {
  attachment: Attachment;
  onClick: () => void;
  onDelete: () => void;
}) {
  const [thumbSrc, setThumbSrc] = useState<string>('');

  useEffect(() => {
    let active = true;
    const loadThumb = async () => {
      try {
        if (attachment.thumb_local_path) {
          const src = await resolveFileSrc(attachment.thumb_local_path);
          if (active) setThumbSrc(src);
        } else if (attachment.local_path) {
          const src = await resolveFileSrc(attachment.local_path);
          if (active) setThumbSrc(src);
        } else if (attachment.remote_id) {
          const src = await downloadAndCacheRemoteFile(attachment.remote_id, true);
          if (active) setThumbSrc(src);
        }
      } catch {
        // thumb fallback
      }
    };

    void loadThumb();
    return () => {
      active = false;
    };
  }, [attachment]);

  return (
    <div
      style={{
        position: 'relative',
        width: 64,
        height: 64,
        borderRadius: 12,
        overflow: 'hidden',
        border: '1px solid var(--app-border)',
        backgroundColor: 'var(--app-card)',
        flexShrink: 0,
        cursor: 'pointer',
      }}
      onClick={onClick}
    >
      {attachment.kind === 'image' && thumbSrc ? (
        <img
          src={thumbSrc}
          alt={attachment.original_name}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : attachment.kind === 'pdf' ? (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#FEE2E2',
            color: '#DC2626',
          }}
        >
          <span className="material-symbols-rounded" style={{ fontSize: 24 }}>
            picture_as_pdf
          </span>
          <span style={{ fontSize: 9, fontWeight: 700 }}>PDF</span>
        </div>
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#EEF2FF',
            color: '#4F46E5',
          }}
        >
          <span className="material-symbols-rounded" style={{ fontSize: 28 }}>
            description
          </span>
        </div>
      )}

      {/* Upload State Badge */}
      <span
        style={{
          position: 'absolute',
          bottom: 2,
          right: 2,
          fontSize: 13,
          backgroundColor: 'rgba(0,0,0,0.6)',
          borderRadius: '50%',
          width: 16,
          height: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color:
            attachment.upload_state === 'uploaded'
              ? '#22C55E'
              : attachment.upload_state === 'uploading'
                ? '#F59E0B'
                : '#94A3B8',
        }}
      >
        <span className="material-symbols-rounded" style={{ fontSize: 12 }}>
          {attachment.upload_state === 'uploaded'
            ? 'cloud_done'
            : attachment.upload_state === 'uploading'
              ? 'sync'
              : 'cloud_off'}
        </span>
      </span>

      {/* Delete button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        aria-label="Remove"
        style={{
          position: 'absolute',
          top: 2,
          right: 2,
          background: 'rgba(0,0,0,0.6)',
          border: 'none',
          color: '#FFF',
          borderRadius: '50%',
          width: 18,
          height: 18,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          padding: 0,
        }}
      >
        <span className="material-symbols-rounded" style={{ fontSize: 13 }}>
          close
        </span>
      </button>
    </div>
  );
}
