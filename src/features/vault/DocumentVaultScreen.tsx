import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonModal,
  IonPage,
  IonSearchbar,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { useMoney } from '../money/store';
import {
  createDocument,
  deleteDocument,
  listDocuments,
  updateDocument,
} from '../../db/repository';
import type { DocumentFolder, DocumentView, Attachment } from '../../db/types';
import { AttachmentPicker } from '../../components/AttachmentPicker';
import { uuidv7 } from '../../lib/ids';

const FOLDERS: { key: DocumentFolder; icon: string; color: string }[] = [
  { key: 'receipts', icon: 'receipt_long', color: '#14B8A6' },
  { key: 'invoices', icon: 'request_quote', color: '#0EA5E9' },
  { key: 'loan_agreements', icon: 'handshake', color: '#F59E0B' },
  { key: 'warranty', icon: 'verified', color: '#22C55E' },
  { key: 'bank_statements', icon: 'account_balance', color: '#6366F1' },
  { key: 'ids_certificates', icon: 'badge', color: '#EC4899' },
  { key: 'property', icon: 'home', color: '#8B5CF6' },
  { key: 'other', icon: 'folder', color: '#64748B' },
];

export function DocumentVaultScreen({
  onToast,
}: {
  onToast?: (message: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const bookId = useMoney((s) => s.bookId);

  const [documents, setDocuments] = useState<DocumentView[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  // Modal state
  const [editorOpen, setEditorOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<DocumentView | null>(null);

  // Editor form state
  const [editId, setEditId] = useState<string | null>(null);
  const [formDocId, setFormDocId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [folder, setFolder] = useState<DocumentFolder>('receipts');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [hasExpiry, setHasExpiry] = useState(false);
  const [expiryDate, setExpiryDate] = useState('');
  const [tags, setTags] = useState('');
  const [note, setNote] = useState('');
  const [editorAttachments, setEditorAttachments] = useState<Attachment[]>([]);

  const reload = async () => {
    if (!bookId) return;
    setLoading(true);
    try {
      const rows = await listDocuments(bookId, {
        folder: selectedFolder === 'all' ? undefined : selectedFolder,
        search: search.trim() || undefined,
      });
      setDocuments(rows);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId, selectedFolder, search]);

  const openNewDoc = () => {
    const newId = uuidv7();
    setEditId(null);
    setFormDocId(newId);
    setTitle('');
    setFolder(selectedFolder !== 'all' ? (selectedFolder as DocumentFolder) : 'receipts');
    setDate(new Date().toISOString().slice(0, 10));
    setHasExpiry(false);
    setExpiryDate('');
    setTags('');
    setNote('');
    setEditorAttachments([]);
    setEditorOpen(true);
  };

  const openEditDoc = (doc: DocumentView) => {
    setEditId(doc.id);
    setFormDocId(doc.id);
    setTitle(doc.title);
    setFolder(doc.folder);
    setDate(new Date(doc.date).toISOString().slice(0, 10));
    setHasExpiry(doc.expiry_date !== null);
    setExpiryDate(
      doc.expiry_date ? new Date(doc.expiry_date).toISOString().slice(0, 10) : '',
    );
    setTags(doc.tags ?? '');
    setNote(doc.note);
    setEditorAttachments(doc.attachments ?? []);
    setEditorOpen(true);
  };

  const openDetail = (doc: DocumentView) => {
    setSelectedDoc(doc);
    setDetailOpen(true);
  };

  const handleSave = async () => {
    if (!bookId || !title.trim()) return;

    const dateMs = new Date(`${date}T12:00:00`).getTime();
    const expiryMs = hasExpiry && expiryDate ? new Date(`${expiryDate}T12:00:00`).getTime() : null;

    if (editId) {
      await updateDocument(editId, {
        title: title.trim(),
        folder,
        date: dateMs,
        expiry_date: expiryMs,
        tags: tags.trim() || null,
        note: note.trim(),
      });
      onToast?.(t('vault.saved'));
    } else {
      await createDocument({
        id: formDocId,
        book_id: bookId,
        title: title.trim(),
        folder,
        date: dateMs,
        expiry_date: expiryMs,
        tags: tags.trim() || null,
        note: note.trim(),
      });
      onToast?.(t('vault.created'));
    }

    setEditorOpen(false);
    void reload();
  };

  const handleDelete = async (id: string) => {
    await deleteDocument(id);
    onToast?.(t('vault.deleted'));
    setDetailOpen(false);
    void reload();
  };

  const formatDate = (ms: number) => {
    return new Date(ms).toLocaleDateString(
      i18n.language === 'bn' ? 'bn-BD' : 'en-GB',
      { day: 'numeric', month: 'short', year: 'numeric' },
    );
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButton slot="start" fill="clear" aria-label={t('a11y.back')} onClick={() => navigate(-1)}>
            <span className="material-symbols-rounded">arrow_back</span>
          </IonButton>
          <IonTitle>{t('vault.title')}</IonTitle>
          <IonButton
            slot="end"
            fill="clear"
            onClick={openNewDoc}
            aria-label={t('vault.addDocument')}
          >
            <span className="material-symbols-rounded">add</span>
          </IonButton>
        </IonToolbar>
      </IonHeader>

      <IonContent className="shell-content">
        <div className="page-pad">
          {/* Search bar */}
          <IonSearchbar
            value={search}
            placeholder={t('vault.searchPlaceholder')}
            onIonInput={(e) => setSearch(e.detail.value ?? '')}
            debounce={250}
            style={{ padding: '0 0 12px' }}
          />

          {/* Folder Filter Chips */}
          <div
            style={{
              display: 'flex',
              gap: 8,
              overflowX: 'auto',
              paddingBottom: 12,
              scrollbarWidth: 'none',
            }}
          >
            <button
              type="button"
              className={`choice ${selectedFolder === 'all' ? 'selected' : ''}`}
              onClick={() => setSelectedFolder('all')}
              style={{ flexShrink: 0 }}
            >
              {t('vault.allFolders')}
            </button>
            {FOLDERS.map((f) => (
              <button
                key={f.key}
                type="button"
                className={`choice ${selectedFolder === f.key ? 'selected' : ''}`}
                onClick={() => setSelectedFolder(f.key)}
                style={{
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span
                  className="material-symbols-rounded"
                  style={{ fontSize: 16, color: f.color }}
                >
                  {f.icon}
                </span>
                {t(`vault.folder_${f.key}`)}
              </button>
            ))}
          </div>

          {/* Documents List */}
          {documents.length === 0 && !loading ? (
            <div className="surface-card empty-state" style={{ marginTop: 24 }}>
              <div
                className="feature-illustration"
                style={{ background: '#64748B20', color: '#64748B' }}
              >
                <span className="material-symbols-rounded">description</span>
              </div>
              <h2>{t('vault.emptyTitle')}</h2>
              <p>{t('vault.emptyDescription')}</p>
              <button
                type="button"
                className="primary-btn"
                style={{
                  marginTop: 16,
                  padding: '10px 24px',
                  borderRadius: 24,
                  background: '#14B8A6',
                  color: '#FFF',
                  border: 'none',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
                onClick={openNewDoc}
              >
                {t('vault.addDocument')}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {documents.map((doc) => {
                const folderInfo =
                  FOLDERS.find((f) => f.key === doc.folder) ?? FOLDERS[7];
                return (
                  <div
                    key={doc.id}
                    className="surface-card"
                    onClick={() => openDetail(doc)}
                    style={{
                      padding: 14,
                      borderRadius: 16,
                      border: '1px solid var(--app-border)',
                      background: 'var(--app-card)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      cursor: 'pointer',
                    }}
                  >
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        backgroundColor: `${folderInfo.color}20`,
                        color: folderInfo.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <span className="material-symbols-rounded" style={{ fontSize: 24 }}>
                        {folderInfo.icon}
                      </span>
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          margin: 0,
                          fontWeight: 600,
                          fontSize: 15,
                          color: 'var(--app-text)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {doc.title}
                      </p>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          marginTop: 4,
                          fontSize: 12,
                          color: 'var(--app-muted)',
                        }}
                      >
                        <span>{formatDate(doc.date)}</span>
                        <span>•</span>
                        <span>{t(`vault.folder_${doc.folder}`)}</span>
                        {(doc.attachment_count ?? 0) > 0 && (
                          <>
                            <span>•</span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                              <span
                                className="material-symbols-rounded"
                                style={{ fontSize: 14 }}
                              >
                                attach_file
                              </span>
                              {doc.attachment_count}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Expiry Badge */}
                      {doc.expiry_date && (
                        <div style={{ marginTop: 6 }}>
                          {doc.is_expired ? (
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: 10,
                                fontSize: 11,
                                fontWeight: 600,
                                backgroundColor: '#FEE2E2',
                                color: '#DC2626',
                              }}
                            >
                              {t('vault.expired')} ({formatDate(doc.expiry_date)})
                            </span>
                          ) : doc.is_expiring_soon ? (
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: 10,
                                fontSize: 11,
                                fontWeight: 600,
                                backgroundColor: '#FEF3C7',
                                color: '#D97706',
                              }}
                            >
                              {t('vault.expiringSoon', {
                                days: doc.days_to_expiry,
                              })}
                            </span>
                          ) : (
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: 10,
                                fontSize: 11,
                                color: 'var(--app-muted)',
                                backgroundColor: 'var(--app-bg)',
                              }}
                            >
                              {t('vault.expires')}: {formatDate(doc.expiry_date)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <span
                      className="material-symbols-rounded"
                      style={{ color: 'var(--app-muted)', fontSize: 20 }}
                    >
                      chevron_right
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </IonContent>

      {/* Add / Edit Document Modal */}
      <IonModal isOpen={editorOpen} onDidDismiss={() => setEditorOpen(false)}>
        <IonHeader>
          <IonToolbar>
            <IonButton slot="start" fill="clear" onClick={() => setEditorOpen(false)}>
              <span className="material-symbols-rounded">close</span>
            </IonButton>
            <IonTitle>
              {editId ? t('vault.editDocument') : t('vault.addDocument')}
            </IonTitle>
            <IonButton
              slot="end"
              fill="clear"
              disabled={!title.trim()}
              onClick={handleSave}
            >
              {t('common.save')}
            </IonButton>
          </IonToolbar>
        </IonHeader>
        <IonContent className="shell-content">
          <div className="page-pad" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--app-muted)' }}>
                {t('vault.docTitle')} *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('vault.titlePlaceholder')}
                className="input-field"
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: 12,
                  border: '1px solid var(--app-border)',
                  background: 'var(--app-card)',
                  color: 'var(--app-text)',
                  fontSize: 16,
                  marginTop: 4,
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--app-muted)' }}>
                {t('vault.folder')}
              </label>
              <select
                value={folder}
                onChange={(e) => setFolder(e.target.value as DocumentFolder)}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: 12,
                  border: '1px solid var(--app-border)',
                  background: 'var(--app-card)',
                  color: 'var(--app-text)',
                  fontSize: 15,
                  marginTop: 4,
                }}
              >
                {FOLDERS.map((f) => (
                  <option key={f.key} value={f.key}>
                    {t(`vault.folder_${f.key}`)}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--app-muted)' }}>
                  {t('common.date')}
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 12,
                    border: '1px solid var(--app-border)',
                    background: 'var(--app-card)',
                    color: 'var(--app-text)',
                    fontSize: 14,
                    marginTop: 4,
                  }}
                />
              </div>

              <div style={{ flex: 1 }}>
                <label
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--app-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={hasExpiry}
                    onChange={(e) => setHasExpiry(e.target.checked)}
                  />
                  {t('vault.hasExpiry')}
                </label>
                {hasExpiry && (
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 12,
                      border: '1px solid var(--app-border)',
                      background: 'var(--app-card)',
                      color: 'var(--app-text)',
                      fontSize: 14,
                      marginTop: 4,
                    }}
                  />
                )}
              </div>
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--app-muted)' }}>
                {t('vault.tags')}
              </label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="warranty, tax, passport"
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: 12,
                  border: '1px solid var(--app-border)',
                  background: 'var(--app-card)',
                  color: 'var(--app-text)',
                  fontSize: 14,
                  marginTop: 4,
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--app-muted)' }}>
                {t('common.notes')}
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder={t('vault.notesPlaceholder')}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: 12,
                  border: '1px solid var(--app-border)',
                  background: 'var(--app-card)',
                  color: 'var(--app-text)',
                  fontSize: 14,
                  marginTop: 4,
                  resize: 'vertical',
                }}
              />
            </div>

            {/* Attachments Section */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--app-muted)' }}>
                {t('vault.attachedFiles')}
              </label>
              {bookId && (
                <AttachmentPicker
                  bookId={bookId}
                  entityType="document"
                  entityId={formDocId}
                  attachments={editorAttachments}
                  onAttachmentsChange={setEditorAttachments}
                />
              )}
            </div>
          </div>
        </IonContent>
      </IonModal>

      {/* Document Detail Modal */}
      <IonModal isOpen={detailOpen} onDidDismiss={() => setDetailOpen(false)}>
        {selectedDoc && (
          <>
            <IonHeader>
              <IonToolbar>
                <IonButton slot="start" fill="clear" onClick={() => setDetailOpen(false)}>
                  <span className="material-symbols-rounded">arrow_back</span>
                </IonButton>
                <IonTitle>{selectedDoc.title}</IonTitle>
                <IonButton
                  slot="end"
                  fill="clear"
                  onClick={() => {
                    setDetailOpen(false);
                    openEditDoc(selectedDoc);
                  }}
                >
                  <span className="material-symbols-rounded">edit</span>
                </IonButton>
              </IonToolbar>
            </IonHeader>
            <IonContent className="shell-content">
              <div className="page-pad" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Header Card */}
                <div
                  className="surface-card"
                  style={{
                    padding: 16,
                    borderRadius: 16,
                    border: '1px solid var(--app-border)',
                    background: 'var(--app-card)',
                  }}
                >
                  <h2 style={{ margin: '0 0 8px', fontSize: 18, color: 'var(--app-text)' }}>
                    {selectedDoc.title}
                  </h2>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 13, color: 'var(--app-muted)' }}>
                    <div>
                      <strong>{t('vault.folder')}:</strong> {t(`vault.folder_${selectedDoc.folder}`)}
                    </div>
                    <div>
                      <strong>{t('common.date')}:</strong> {formatDate(selectedDoc.date)}
                    </div>
                  </div>

                  {selectedDoc.expiry_date && (
                    <div style={{ marginTop: 12 }}>
                      {selectedDoc.is_expired ? (
                        <span
                          style={{
                            padding: '4px 10px',
                            borderRadius: 12,
                            fontSize: 12,
                            fontWeight: 600,
                            backgroundColor: '#FEE2E2',
                            color: '#DC2626',
                          }}
                        >
                          {t('vault.expired')} ({formatDate(selectedDoc.expiry_date)})
                        </span>
                      ) : selectedDoc.is_expiring_soon ? (
                        <span
                          style={{
                            padding: '4px 10px',
                            borderRadius: 12,
                            fontSize: 12,
                            fontWeight: 600,
                            backgroundColor: '#FEF3C7',
                            color: '#D97706',
                          }}
                        >
                          {t('vault.expiringSoon', {
                            days: selectedDoc.days_to_expiry,
                          })}
                        </span>
                      ) : (
                        <span style={{ fontSize: 13, color: 'var(--app-muted)' }}>
                          {t('vault.expires')}: {formatDate(selectedDoc.expiry_date)}
                        </span>
                      )}
                    </div>
                  )}

                  {selectedDoc.tags && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
                      {selectedDoc.tags.split(',').map((tag, i) => (
                        <span
                          key={i}
                          style={{
                            padding: '2px 8px',
                            borderRadius: 8,
                            fontSize: 11,
                            backgroundColor: 'var(--app-bg)',
                            color: 'var(--app-text)',
                            border: '1px solid var(--app-border)',
                          }}
                        >
                          #{tag.trim()}
                        </span>
                      ))}
                    </div>
                  )}

                  {selectedDoc.note && (
                    <p style={{ margin: '14px 0 0', fontSize: 14, color: 'var(--app-text)', whiteSpace: 'pre-wrap' }}>
                      {selectedDoc.note}
                    </p>
                  )}
                </div>

                {/* Attached Files Card */}
                <div
                  className="surface-card"
                  style={{
                    padding: 16,
                    borderRadius: 16,
                    border: '1px solid var(--app-border)',
                    background: 'var(--app-card)',
                  }}
                >
                  <h3 style={{ margin: '0 0 12px', fontSize: 15, color: 'var(--app-text)' }}>
                    {t('vault.attachedFiles')}
                  </h3>

                  {bookId && (
                    <AttachmentPicker
                      bookId={bookId}
                      entityType="document"
                      entityId={selectedDoc.id}
                      onAttachmentsChange={() => void reload()}
                    />
                  )}
                </div>

                {/* Delete button */}
                <button
                  type="button"
                  onClick={() => handleDelete(selectedDoc.id)}
                  style={{
                    padding: '12px',
                    borderRadius: 16,
                    border: '1px solid #F43F5E',
                    background: 'transparent',
                    color: '#F43F5E',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                    marginTop: 8,
                  }}
                >
                  {t('vault.deleteDocument')}
                </button>
              </div>
            </IonContent>
          </>
        )}
      </IonModal>
    </IonPage>
  );
}
