import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Share } from '@capacitor/share';
import type { Attachment } from '../db/types';
import { resolveFileSrc, downloadAndCacheRemoteFile } from '../lib/fileStorage';

export interface AttachmentViewerProps {
  attachments: Attachment[];
  initialIndex?: number;
  isOpen: boolean;
  onClose: () => void;
  onDelete?: (id: string) => void;
}

export function AttachmentViewer({
  attachments,
  initialIndex = 0,
  isOpen,
  onClose,
  onDelete,
}: AttachmentViewerProps) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(initialIndex);
  const [currentSrc, setCurrentSrc] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIndex(initialIndex);
  }, [initialIndex]);

  const current = attachments[index];

  useEffect(() => {
    if (!isOpen || !current) return;
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setZoom(1);
    setPan({ x: 0, y: 0 });

    const loadSrc = async () => {
      try {
        if (current.local_path) {
          const src = await resolveFileSrc(current.local_path);
          if (active) setCurrentSrc(src);
        } else if (current.remote_id) {
          const cachedSrc = await downloadAndCacheRemoteFile(current.remote_id, false);
          if (active) setCurrentSrc(cachedSrc);
        } else {
          if (active) setCurrentSrc('');
        }
      } catch {
        if (active) setCurrentSrc('');
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadSrc();
    return () => {
      active = false;
    };
  }, [isOpen, current]);

  if (!isOpen || !current) return null;

  const hasNext = index < attachments.length - 1;
  const hasPrev = index > 0;

  const handleNext = () => {
    if (hasNext) setIndex(index + 1);
  };

  const handlePrev = () => {
    if (hasPrev) setIndex(index - 1);
  };

  const handleShare = async () => {
    if (!currentSrc) return;
    try {
      await Share.share({
        title: current.original_name,
        url: currentSrc,
        dialogTitle: current.original_name,
      });
    } catch {
      // User cancelled share or share unavailable
    }
  };

  const handleDownloadCopy = () => {
    if (!currentSrc) return;
    const a = document.createElement('a');
    a.href = currentSrc;
    a.download = current.original_name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current || zoom > 1) return;
    const touch = e.changedTouches[0];
    const diffX = touch.clientX - touchStartRef.current.x;
    const diffY = touch.clientY - touchStartRef.current.y;
    if (Math.abs(diffX) > 60 && Math.abs(diffX) > Math.abs(diffY)) {
      if (diffX < 0 && hasNext) {
        handleNext();
      } else if (diffX > 0 && hasPrev) {
        handlePrev();
      }
    }
    touchStartRef.current = null;
  };

  const handleDoubleTap = () => {
    setZoom((z) => (z > 1 ? 1 : 2.5));
    setPan({ x: 0, y: 0 });
  };

  return (
    <div
      className="attachment-viewer-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(11, 17, 32, 0.95)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
      }}
    >
      {/* Top Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          color: '#F8FAFC',
          zIndex: 10,
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t('a11y.close')}
          style={{
            background: 'none',
            border: 'none',
            color: '#F8FAFC',
            cursor: 'pointer',
            padding: 8,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <span className="material-symbols-rounded" style={{ fontSize: 28 }}>
            arrow_back
          </span>
        </button>

        <span style={{ fontSize: 15, fontWeight: 500, color: '#94A3B8' }}>
          {index + 1} / {attachments.length}
        </span>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={handleShare}
            aria-label={t('common.share')}
            style={{
              background: 'none',
              border: 'none',
              color: '#F8FAFC',
              cursor: 'pointer',
              padding: 8,
            }}
          >
            <span className="material-symbols-rounded">share</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadCopy}
            aria-label={t('common.save')}
            style={{
              background: 'none',
              border: 'none',
              color: '#F8FAFC',
              cursor: 'pointer',
              padding: 8,
            }}
          >
            <span className="material-symbols-rounded">download</span>
          </button>
          {onDelete && (
            <button
              type="button"
              onClick={() => {
                onDelete(current.id);
                if (attachments.length <= 1) {
                  onClose();
                } else if (index >= attachments.length - 1) {
                  setIndex(index - 1);
                }
              }}
              aria-label={t('common.delete')}
              style={{
                background: 'none',
                border: 'none',
                color: '#F43F5E',
                cursor: 'pointer',
                padding: 8,
              }}
            >
              <span className="material-symbols-rounded">delete</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onDoubleClick={handleDoubleTap}
      >
        {loading ? (
          <div style={{ color: '#94A3B8', fontSize: 16 }}>{t('common.loading')}</div>
        ) : current.kind === 'image' && currentSrc ? (
          <img
            src={currentSrc}
            alt={current.original_name}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
              transition: zoom === 1 ? 'transform 0.2s ease' : 'none',
              cursor: zoom > 1 ? 'grab' : 'zoom-in',
            }}
          />
        ) : current.kind === 'pdf' ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 16,
              color: '#F8FAFC',
              padding: 24,
              textAlign: 'center',
            }}
          >
            <span
              className="material-symbols-rounded"
              style={{ fontSize: 64, color: '#F43F5E' }}
            >
              picture_as_pdf
            </span>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 500 }}>
              {current.original_name}
            </p>
            <p style={{ margin: 0, fontSize: 13, color: '#94A3B8' }}>
              {(current.size / 1024).toFixed(1)} KB
            </p>
            <button
              type="button"
              onClick={handleShare}
              className="primary-btn"
              style={{
                marginTop: 8,
                padding: '10px 20px',
                borderRadius: 20,
                background: '#14B8A6',
                color: '#FFF',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              {t('vault.openPdf')}
            </button>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 16,
              color: '#F8FAFC',
              padding: 24,
            }}
          >
            <span
              className="material-symbols-rounded"
              style={{ fontSize: 64, color: '#6366F1' }}
            >
              description
            </span>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 500 }}>
              {current.original_name}
            </p>
            <button
              type="button"
              onClick={handleShare}
              style={{
                marginTop: 8,
                padding: '10px 20px',
                borderRadius: 20,
                background: '#14B8A6',
                color: '#FFF',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              {t('common.share')}
            </button>
          </div>
        )}

        {/* Navigation Buttons for desktop / large screens */}
        {hasPrev && (
          <button
            type="button"
            onClick={handlePrev}
            aria-label={t('common.previous')}
            style={{
              position: 'absolute',
              left: 16,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'rgba(0,0,0,0.5)',
              border: 'none',
              color: '#FFF',
              borderRadius: '50%',
              width: 44,
              height: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <span className="material-symbols-rounded">chevron_left</span>
          </button>
        )}
        {hasNext && (
          <button
            type="button"
            onClick={handleNext}
            aria-label={t('common.next')}
            style={{
              position: 'absolute',
              right: 16,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'rgba(0,0,0,0.5)',
              border: 'none',
              color: '#FFF',
              borderRadius: '50%',
              width: 44,
              height: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <span className="material-symbols-rounded">chevron_right</span>
          </button>
        )}
      </div>

      {/* Bottom Info Bar */}
      <div
        style={{
          padding: '12px 16px',
          background: 'rgba(15, 23, 42, 0.8)',
          color: '#E2E8F0',
          fontSize: 13,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '70%',
          }}
        >
          {current.original_name}
        </span>
        <span style={{ color: '#94A3B8' }}>
          {(current.size / 1024).toFixed(0)} KB
        </span>
      </div>
    </div>
  );
}
