import { useState, useEffect } from 'react';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonModal,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useMoney } from '../money/store';
import { searchAll } from '../../db/repository';
import type { GlobalSearchResult } from '../../db/types';
import { formatMinor } from '../../lib/money';

export function GlobalSearchModal({
  isOpen,
  onClose,
  onEditTransaction,
  onViewDebt,
}: {
  isOpen: boolean;
  onClose: () => void;
  onEditTransaction: (id: string) => void;
  onViewDebt: (id: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const bookId = useMoney((s) => s.bookId);
  const books = useMoney((s) => s.books);
  const currency = books.find((x) => x.id === bookId)?.currency ?? 'BDT';

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GlobalSearchResult>({
    transactions: [],
    people: [],
    accounts: [],
    assets: [],
    documents: [],
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!bookId || !query.trim()) {
      return;
    }

    let active = true;
    const timer = setTimeout(() => {
      void searchAll(bookId, query).then((res) => {
        if (active) {
          setResults(res);
          setLoading(false);
        }
      });
    }, 200);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [bookId, query]);

  const activeResults = query.trim() ? results : { transactions: [], people: [], accounts: [], assets: [], documents: [] };

  const totalResults =
    activeResults.transactions.length +
    activeResults.people.length +
    activeResults.accounts.length +
    activeResults.assets.length +
    activeResults.documents.length;

  const { transactions, people, accounts, assets, documents } = activeResults;

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onClose}>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{t('search.title')}</IonTitle>
          <IonButton fill="clear" slot="end" onClick={onClose}>
            <span className="material-symbols-rounded">close</span>
          </IonButton>
        </IonToolbar>
      </IonHeader>

      <IonContent className="shell-content">
        <div className="page-pad" style={{ paddingBottom: 48 }}>
          {/* Search Box */}
          <div style={{ position: 'relative', marginBottom: 16 }}>
            <input
              type="text"
              className="search-box"
              placeholder={t('search.placeholder')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              style={{ width: '100%', paddingRight: 40 }}
            />
            {query && (
              <button
                type="button"
                className="icon-button"
                onClick={() => setQuery('')}
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)' }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: 18 }}>clear</span>
              </button>
            )}
          </div>

          {loading && (
            <p style={{ textAlign: 'center', color: 'var(--app-muted)' }}>{t('common.loading')}</p>
          )}

          {!loading && query && totalResults === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--app-muted)' }}>
              <span className="material-symbols-rounded" style={{ fontSize: 48, opacity: 0.5 }}>
                search_off
              </span>
              <p style={{ marginTop: 8 }}>{t('search.noResults')}</p>
            </div>
          )}

          {/* 1. Transactions Results */}
          {transactions.length > 0 && (
            <div className="surface-card" style={{ padding: 16, borderRadius: 16, marginBottom: 16 }}>
              <h3 style={{ margin: '0 0 12px', fontSize: '0.95rem', fontWeight: 700, color: 'var(--app-muted)' }}>
                {t('tabs.transactions')} ({transactions.length})
              </h3>
              <div className="transaction-list">
                {transactions.map((tx) => (
                  <div className="transaction-row" key={tx.id}>
                    <button
                      className="transaction-main"
                      onClick={() => {
                        onClose();
                        if (tx.debt_id) onViewDebt(tx.debt_id);
                        else onEditTransaction(tx.id);
                      }}
                    >
                      <span
                        className="tile-icon"
                        style={{
                          background: tx.type === 'income' ? '#22c55e20' : '#f43f5e20',
                          color: tx.type === 'income' ? '#22c55e' : '#f43f5e',
                        }}
                      >
                        <span className="material-symbols-rounded">
                          {tx.type === 'transfer'
                            ? 'swap_horiz'
                            : tx.type === 'income'
                              ? 'south_west'
                              : 'north_east'}
                        </span>
                      </span>
                      <span className="transaction-meta">
                        <span className="transaction-title">
                          {tx.category_name ?? (tx.person_name ? `${t('home.payable')}: ${tx.person_name}` : tx.note || t('money.uncategorized'))}
                        </span>
                        <span className="transaction-account">
                          {new Date(tx.occurred_at).toISOString().slice(0, 10)}
                          {tx.note ? ` • ${tx.note}` : ''}
                        </span>
                      </span>
                      <span className={`transaction-amount ${tx.type === 'income' ? 'income' : 'expense'}`}>
                        {formatMinor(tx.amount, tx.currency || currency, i18n.language)}
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. People (Debts) Results */}
          {people.length > 0 && (
            <div className="surface-card" style={{ padding: 16, borderRadius: 16, marginBottom: 16 }}>
              <h3 style={{ margin: '0 0 12px', fontSize: '0.95rem', fontWeight: 700, color: 'var(--app-muted)' }}>
                {t('more.people')} ({people.length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {people.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="surface-card"
                    onClick={() => {
                      onClose();
                      navigate(`/tabs/debts?person=${encodeURIComponent(p.id)}`);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: 12,
                      borderRadius: 12,
                      width: '100%',
                      textAlign: 'left',
                      border: '1px solid var(--app-border)',
                      cursor: 'pointer',
                    }}
                  >
                    <span className="material-symbols-rounded" style={{ color: '#0ea5e9' }}>
                      person
                    </span>
                    <div>
                      <strong style={{ display: 'block', fontSize: '0.95rem' }}>{p.name}</strong>
                      {p.phone && <span style={{ fontSize: '0.8rem', color: 'var(--app-muted)' }}>{p.phone}</span>}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 3. Accounts Results */}
          {accounts.length > 0 && (
            <div className="surface-card" style={{ padding: 16, borderRadius: 16, marginBottom: 16 }}>
              <h3 style={{ margin: '0 0 12px', fontSize: '0.95rem', fontWeight: 700, color: 'var(--app-muted)' }}>
                {t('more.accounts')} ({accounts.length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {accounts.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className="surface-card"
                    onClick={() => {
                      onClose();
                      navigate('/tabs/more/accounts');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: 12,
                      borderRadius: 12,
                      width: '100%',
                      textAlign: 'left',
                      border: '1px solid var(--app-border)',
                      cursor: 'pointer',
                    }}
                  >
                    <span className="material-symbols-rounded" style={{ color: '#14b8a6' }}>
                      account_balance_wallet
                    </span>
                    <div>
                      <strong style={{ display: 'block', fontSize: '0.95rem' }}>{a.name}</strong>
                      <span style={{ fontSize: '0.8rem', color: 'var(--app-muted)' }}>{a.currency}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 4. Assets Results */}
          {assets.length > 0 && (
            <div className="surface-card" style={{ padding: 16, borderRadius: 16, marginBottom: 16 }}>
              <h3 style={{ margin: '0 0 12px', fontSize: '0.95rem', fontWeight: 700, color: 'var(--app-muted)' }}>
                {t('more.assets')} ({assets.length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {assets.map((asset) => (
                  <button
                    key={asset.id}
                    type="button"
                    className="surface-card"
                    onClick={() => {
                      onClose();
                      navigate('/tabs/more/assets');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 12,
                      borderRadius: 12,
                      width: '100%',
                      textAlign: 'left',
                      border: '1px solid var(--app-border)',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span className="material-symbols-rounded" style={{ color: '#6366f1' }}>
                        trending_up
                      </span>
                      <div>
                        <strong style={{ display: 'block', fontSize: '0.95rem' }}>{asset.name}</strong>
                        <span style={{ fontSize: '0.8rem', color: 'var(--app-muted)' }}>{asset.type}</span>
                      </div>
                    </div>
                    <strong>{formatMinor(asset.current_value, asset.currency, i18n.language)}</strong>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 5. Documents Results */}
          {documents.length > 0 && (
            <div className="surface-card" style={{ padding: 16, borderRadius: 16 }}>
              <h3 style={{ margin: '0 0 12px', fontSize: '0.95rem', fontWeight: 700, color: 'var(--app-muted)' }}>
                {t('more.documents')} ({documents.length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {documents.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    className="surface-card"
                    onClick={() => {
                      onClose();
                      navigate('/tabs/more/documents');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: 12,
                      borderRadius: 12,
                      width: '100%',
                      textAlign: 'left',
                      border: '1px solid var(--app-border)',
                      cursor: 'pointer',
                    }}
                  >
                    <span className="material-symbols-rounded" style={{ color: '#64748b' }}>
                      description
                    </span>
                    <div>
                      <strong style={{ display: 'block', fontSize: '0.95rem' }}>{d.title}</strong>
                      <span style={{ fontSize: '0.8rem', color: 'var(--app-muted)' }}>{d.folder}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </IonContent>
    </IonModal>
  );
}
