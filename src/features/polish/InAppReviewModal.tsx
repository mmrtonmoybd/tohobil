import { useTranslation } from 'react-i18next';
import { handleReviewPromptResponse } from '../../lib/inAppReview';

export function InAppReviewModal({
  open,
  onClose,
  onFeedback,
}: {
  open: boolean;
  onClose: () => void;
  onFeedback?: () => void;
}) {
  const { t } = useTranslation();

  if (!open) return null;

  function handleRate() {
    handleReviewPromptResponse('rated');
    onClose();
    window.open(
      'https://play.google.com/store/apps/details?id=com.tohobil.app',
      '_blank',
    );
  }

  function handleDismiss() {
    handleReviewPromptResponse('dismissed');
    onClose();
  }

  function handleSendFeedback() {
    handleReviewPromptResponse('feedback');
    onClose();
    if (onFeedback) {
      onFeedback();
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99990,
        background: 'rgba(0, 0, 0, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        className="surface-card"
        style={{
          width: '100%',
          maxWidth: 360,
          padding: 28,
          borderRadius: 24,
          textAlign: 'center',
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 20,
            background: 'linear-gradient(135deg, #f59e0b, #ec4899)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            marginBottom: 16,
          }}
        >
          <span className="material-symbols-rounded" style={{ fontSize: 36 }}>
            star
          </span>
        </div>

        <h3 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700 }}>
          {t('review.title')}
        </h3>
        <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--app-muted)', lineHeight: 1.5 }}>
          {t('review.body')}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            type="button"
            onClick={handleRate}
            className="btn-accent"
            style={{
              padding: 13,
              borderRadius: 12,
              border: 'none',
              fontWeight: 600,
              fontSize: 15,
              cursor: 'pointer',
            }}
          >
            {t('review.rateButton')}
          </button>

          <button
            type="button"
            onClick={handleSendFeedback}
            style={{
              padding: 12,
              borderRadius: 12,
              border: '1px solid var(--app-border)',
              background: 'var(--app-card)',
              color: 'var(--app-text)',
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            {t('review.feedbackButton')}
          </button>

          <button
            type="button"
            onClick={handleDismiss}
            style={{
              padding: 8,
              background: 'transparent',
              border: 'none',
              color: 'var(--app-muted)',
              fontSize: 13,
              cursor: 'pointer',
              marginTop: 4,
            }}
          >
            {t('review.laterButton')}
          </button>
        </div>
      </div>
    </div>
  );
}
