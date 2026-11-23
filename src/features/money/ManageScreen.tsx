import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { formatMinor, minorToInput, parseMinor } from '../../lib/money';
import { useMoney } from './store';
import { useFeatureFlag } from '../../lib/featureFlags';
import { SharedBooksModal } from './SharedBooksModal';
import { api } from '../../app/identity';
import type { Account, Category, Book } from '../../db/types';

interface BookInvitation {
  id: string;
  book_id: string;
  book_name: string;
  inviter_name: string;
  role: 'editor' | 'viewer';
}
type Kind = 'accounts' | 'books' | 'categories';
const accountTypes = [
  'cash',
  'mobile_wallet',
  'bank',
  'card',
  'other',
] as const;
export function ManageScreen({
  kind,
  onToast,
}: {
  kind: Kind;
  onToast: (message: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const books = useMoney((s) => s.books),
    bookId = useMoney((s) => s.bookId),
    setBook = useMoney((s) => s.setBook),
    accounts = useMoney((s) => s.accounts),
    balances = useMoney((s) => s.balances),
    categories = useMoney((s) => s.categories),
    tags = useMoney((s) => s.tags),
    createBook = useMoney((s) => s.createBook),
    renameBook = useMoney((s) => s.renameBook),
    saveAccount = useMoney((s) => s.saveAccount),
    archiveAccount = useMoney((s) => s.archiveAccount),
    saveCategory = useMoney((s) => s.saveCategory),
    saveTag = useMoney((s) => s.saveTag);
  const currency = books.find((x) => x.id === bookId)?.currency ?? 'BDT';
  const [form, setForm] = useState<
      'book' | 'account' | 'category' | 'tag' | null
    >(null),
    [editId, setEditId] = useState<string | null>(null),
    [name, setName] = useState(''),
    [selectedCurrency, setSelectedCurrency] = useState(currency),
    [type, setType] = useState<Account['type']>('bank'),
    [provider, setProvider] = useState(''),
    [opening, setOpening] = useState('0'),
    [creditLimit, setCreditLimit] = useState('0'),
    [statementDay, setStatementDay] = useState('1'),
    [dueDay, setDueDay] = useState('15'),
    [kindCategory, setKindCategory] = useState<Category['kind']>('expense'),
    [parentId, setParentId] = useState(''),
    [color, setColor] = useState('#0ea5e9'),
    [error, setError] = useState('');

  const sharedBooksEnabled = useFeatureFlag('sharedBooks');
  const [selectedSharedBook, setSelectedSharedBook] = useState<Book | null>(null);
  const [invitations, setInvitations] = useState<BookInvitation[]>([]);

  const fetchInvitations = useCallback(async () => {
    if (!sharedBooksEnabled) return;
    try {
      const res = await api<{ invitations: BookInvitation[] }>('books/invitations');
      setInvitations(res.invitations || []);
    } catch {
      // ignore
    }
  }, [sharedBooksEnabled]);

  useEffect(() => {
    if (kind === 'books' && sharedBooksEnabled) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void fetchInvitations();
    }
  }, [kind, sharedBooksEnabled, fetchInvitations]);

  const handleAcceptInvite = async (inv: BookInvitation) => {
    try {
      await api(`books/invitations/${inv.id}/accept`, { method: 'POST' });
      onToast(t('sharedBooks.inviteAccepted'));
      void fetchInvitations();
    } catch (e: unknown) {
      onToast(e instanceof Error ? e.message : 'Error');
    }
  };

  const handleDeclineInvite = async (inv: BookInvitation) => {
    try {
      await api(`books/invitations/${inv.id}/decline`, { method: 'POST' });
      onToast(t('sharedBooks.inviteDeclined'));
      void fetchInvitations();
    } catch (e: unknown) {
      onToast(e instanceof Error ? e.message : 'Error');
    }
  };
  const open = (
    what: typeof form,
    existing?: Account | Category | { id: string; name: string },
  ) => {
    setForm(what);
    setEditId(existing?.id ?? null);
    setName(
      existing?.name === 'cash'
        ? t('money.cashInHand')
        : (existing?.name ?? ''),
    );
    setError('');
    if (what === 'account' && existing && 'type' in existing) {
      const a = existing as Account;
      setType(a.type);
      setProvider(a.provider ?? '');
      setSelectedCurrency(a.currency);
      setOpening(
        minorToInput(
          a.type === 'card' ? -a.opening_balance : a.opening_balance,
          a.currency,
        ),
      );
      setCreditLimit(
        a.credit_limit ? minorToInput(a.credit_limit, a.currency) : '0',
      );
      setStatementDay(String(a.statement_day ?? 1));
      setDueDay(String(a.due_day ?? 15));
      setColor(a.color);
    } else {
      setType('bank');
      setProvider('');
      setOpening('0');
      setColor('#0ea5e9');
      setSelectedCurrency(currency);
    }
    if (what === 'category' && existing && 'kind' in existing) {
      const c = existing as Category;
      setKindCategory(c.kind);
      setParentId(c.parent_id ?? '');
      setColor(c.color);
    } else {
      setKindCategory('expense');
      setParentId('');
    }
  };
  const submit = async () => {
    try {
      if (!name.trim()) throw new Error('INVALID_NAME');
      if (form === 'book') {
        if (editId) await renameBook(editId, name);
        else await createBook(name, selectedCurrency);
        onToast(t(editId ? 'money.bookRenamed' : 'money.bookSaved'));
      }
      if (form === 'account') {
        await saveAccount(
          {
            name: name.trim(),
            type,
            provider: provider.trim() || null,
            currency: selectedCurrency,
            openingBalance:
              type === 'card'
                ? -parseMinor(opening, selectedCurrency)
                : parseMinor(opening, selectedCurrency),
            color,
            icon:
              type === 'cash'
                ? 'payments'
                : type === 'bank'
                  ? 'account_balance'
                  : type === 'card'
                    ? 'credit_card'
                    : 'account_balance_wallet',
            creditLimit:
              type === 'card'
                ? parseMinor(creditLimit, selectedCurrency)
                : null,
            statementDay: type === 'card' ? Number(statementDay) : null,
            dueDay: type === 'card' ? Number(dueDay) : null,
          },
          editId ?? undefined,
        );
        onToast(t('money.accountSaved'));
      }
      if (form === 'category') {
        await saveCategory(
          {
            name: name.trim(),
            kind: kindCategory,
            parentId: parentId || null,
            icon: 'category',
            color,
          },
          editId ?? undefined,
        );
        onToast(t('money.categorySaved'));
      }
      if (form === 'tag') {
        await saveTag(name, color);
        onToast(t('money.tagSaved'));
      }
      setForm(null);
    } catch {
      setError(t('money.error'));
    }
  };
  return (
    <div>
      <div className="screen-title-row">
        <h1 className="page-heading">{t(`more.${kind}`)}</h1>
        <button
          className="primary-button compact-button"
          onClick={() =>
            open(
              kind === 'books'
                ? 'book'
                : kind === 'accounts'
                  ? 'account'
                  : 'category',
            )
          }
        >
          {t(
            kind === 'books'
              ? 'money.newBook'
              : kind === 'accounts'
                ? 'money.newAccount'
                : 'money.newCategory',
          )}
        </button>
      </div>
      {kind === 'books' && sharedBooksEnabled && invitations.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
          {invitations.map((inv) => (
            <div
              key={inv.id}
              className="surface-card"
              style={{
                padding: '12px 16px',
                borderRadius: 14,
                border: '1px solid #14b8a660',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                  {t('sharedBooks.invitationTitle', { book: inv.book_name })}
                </div>
                <small style={{ color: 'var(--app-muted)' }}>
                  {t('sharedBooks.invitedBy', { name: inv.inviter_name, role: t(`sharedBooks.role_${inv.role}`) })}
                </small>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="primary-button compact-button"
                  onClick={() => handleAcceptInvite(inv)}
                  style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                >
                  {t('sharedBooks.accept')}
                </button>
                <button
                  type="button"
                  className="choice"
                  onClick={() => handleDeclineInvite(inv)}
                  style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                >
                  {t('sharedBooks.decline')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {kind === 'books' && (
        <div className="manage-list">
          {books.map((book) => (
            <div className="surface-card manage-row" key={book.id}>
              <span
                className="tile-icon"
                style={{ color: book.color, background: `${book.color}20` }}
              >
                <span className="material-symbols-rounded">menu_book</span>
              </span>
              <div>
                <strong>
                  {book.name === 'personal' ? t('money.personal') : book.name}
                </strong>
                <small>{book.currency}</small>
              </div>
              <button className="choice" onClick={() => void setBook(book.id)}>
                {bookId === book.id
                  ? t('money.default')
                  : t('money.switchBook')}
              </button>
              {sharedBooksEnabled && (
                <button
                  className="icon-button"
                  onClick={() => setSelectedSharedBook(book)}
                  aria-label={t('sharedBooks.manageMembers')}
                  title={t('sharedBooks.manageMembers')}
                >
                  <span className="material-symbols-rounded">group</span>
                </button>
              )}
              <button
                className="icon-button"
                onClick={() => open('book', book)}
                aria-label={t('money.rename')}
              >
                <span className="material-symbols-rounded">edit</span>
              </button>
            </div>
          ))}
        </div>
      )}
      {kind === 'accounts' && (
        <div className="manage-list">
          {accounts.map((account) => (
            <div className="surface-card manage-row" key={account.id}>
              <span
                className="tile-icon"
                style={{
                  color: account.color,
                  background: `${account.color}20`,
                }}
              >
                <span className="material-symbols-rounded">{account.icon}</span>
              </span>
              <div>
                <strong>
                  {account.name === 'cash'
                    ? t('money.cashInHand')
                    : account.name}
                </strong>
                <small>
                  {formatMinor(
                    balances.find((x) => x.account_id === account.id)
                      ?.balance ?? 0,
                    account.currency,
                    i18n.language,
                  )}
                </small>
              </div>
              <button
                className="icon-button"
                onClick={() => open('account', account)}
                aria-label={t('money.edit')}
              >
                <span className="material-symbols-rounded">edit</span>
              </button>
              <button
                className="icon-button"
                onClick={() =>
                  void archiveAccount(account.id, !account.is_archived)
                }
                aria-label={t(
                  account.is_archived ? 'money.unarchive' : 'money.archive',
                )}
              >
                <span className="material-symbols-rounded">
                  {account.is_archived ? 'unarchive' : 'archive'}
                </span>
              </button>
            </div>
          ))}
        </div>
      )}
      {kind === 'categories' && (
        <>
          <div className="manage-section">
            <h2 className="section-title">{t('money.expense')}</h2>
            {categories
              .filter((x) => x.kind === 'expense')
              .map((c) => (
                <div className="surface-card manage-row" key={c.id}>
                  <span
                    className="tile-icon"
                    style={{ color: c.color, background: `${c.color}20` }}
                  >
                    <span className="material-symbols-rounded">{c.icon}</span>
                  </span>
                  <strong>{c.name ?? t(`categories.${c.i18n_key}`)}</strong>
                  <button
                    className="icon-button"
                    onClick={() => open('category', c)}
                    aria-label={t('money.edit')}
                  >
                    <span className="material-symbols-rounded">edit</span>
                  </button>
                </div>
              ))}
          </div>
          <div className="manage-section">
            <h2 className="section-title">{t('money.income')}</h2>
            {categories
              .filter((x) => x.kind === 'income')
              .map((c) => (
                <div className="surface-card manage-row" key={c.id}>
                  <span
                    className="tile-icon"
                    style={{ color: c.color, background: `${c.color}20` }}
                  >
                    <span className="material-symbols-rounded">{c.icon}</span>
                  </span>
                  <strong>{c.name ?? t(`categories.${c.i18n_key}`)}</strong>
                  <button
                    className="icon-button"
                    onClick={() => open('category', c)}
                    aria-label={t('money.edit')}
                  >
                    <span className="material-symbols-rounded">edit</span>
                  </button>
                </div>
              ))}
          </div>
          <div className="screen-title-row">
            <h2 className="section-title">{t('money.tags')}</h2>
            <button className="text-button" onClick={() => open('tag')}>
              {t('money.addTag')}
            </button>
          </div>
          {tags.length ? (
            tags.map((tag) => (
              <div className="surface-card manage-row" key={tag.id}>
                <span
                  className="tile-icon"
                  style={{ color: tag.color, background: `${tag.color}20` }}
                >
                  <span className="material-symbols-rounded">sell</span>
                </span>
                <strong>{tag.name}</strong>
              </div>
            ))
          ) : (
            <p className="empty-line">{t('money.emptyTags')}</p>
          )}
        </>
      )}
      {form && (
        <div className="form-overlay" onClick={() => setForm(null)}>
          <div
            className="form-dialog"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <h2>
                {t(
                  form === 'book'
                    ? 'money.bookName'
                    : form === 'account'
                      ? 'money.accountName'
                      : form === 'tag'
                        ? 'money.tagName'
                        : 'money.categoryName',
                )}
              </h2>
              <button
                className="icon-button"
                onClick={() => setForm(null)}
                aria-label={t('a11y.close')}
              >
                <span className="material-symbols-rounded">close</span>
              </button>
            </div>
            <label>
              {t('money.name')}
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                inputMode="text"
              />
            </label>
            {form === 'book' && (
              <label>
                {t('money.currency')}
                <select
                  value={selectedCurrency}
                  onChange={(e) => setSelectedCurrency(e.target.value)}
                >
                  {[
                    'BDT',
                    'USD',
                    'EUR',
                    'GBP',
                    'INR',
                    'PKR',
                    'AED',
                    'SAR',
                    'JPY',
                  ].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
            )}
            {form === 'account' && (
              <>
                <label>
                  {t('money.type')}
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as Account['type'])}
                  >
                    {accountTypes.map((v) => (
                      <option value={v} key={v}>
                        {t(
                          `money.${v === 'mobile_wallet' ? 'mobileWallet' : v}`,
                        )}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t('money.provider')}
                  <input
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                  />
                </label>
                <label>
                  {t('money.openingBalance')}
                  <input
                    value={opening}
                    onChange={(e) => setOpening(e.target.value)}
                    inputMode="decimal"
                  />
                </label>
                {type === 'card' && (
                  <>
                    <label>
                      {t('money.creditLimit')}
                      <input
                        value={creditLimit}
                        onChange={(e) => setCreditLimit(e.target.value)}
                        inputMode="decimal"
                      />
                    </label>
                    <label>
                      {t('money.statementDay')}
                      <input
                        type="number"
                        min="1"
                        max="28"
                        value={statementDay}
                        onChange={(e) => setStatementDay(e.target.value)}
                      />
                    </label>
                    <label>
                      {t('money.dueDay')}
                      <input
                        type="number"
                        min="1"
                        max="28"
                        value={dueDay}
                        onChange={(e) => setDueDay(e.target.value)}
                      />
                    </label>
                  </>
                )}
              </>
            )}
            {form === 'category' && (
              <>
                <label>
                  {t('money.type')}
                  <select
                    value={kindCategory}
                    onChange={(e) =>
                      setKindCategory(e.target.value as Category['kind'])
                    }
                  >
                    <option value="expense">{t('money.expense')}</option>
                    <option value="income">{t('money.income')}</option>
                  </select>
                </label>
                <label>
                  {t('money.parentCategory')}
                  <select
                    value={parentId}
                    onChange={(e) => setParentId(e.target.value)}
                  >
                    <option value="">{t('money.none')}</option>
                    {categories
                      .filter(
                        (c) =>
                          c.kind === kindCategory &&
                          !c.parent_id &&
                          c.id !== editId,
                      )
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name ?? t(`categories.${c.i18n_key}`)}
                        </option>
                      ))}
                  </select>
                </label>
              </>
            )}
            {(form === 'category' || form === 'tag') && (
              <label>
                {t('money.color')}
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                />
              </label>
            )}
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <div className="form-actions">
              <button
                className="secondary-button"
                onClick={() => setForm(null)}
              >
                {t('money.cancel')}
              </button>
              <button className="primary-button" onClick={() => void submit()}>
                {t('money.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {sharedBooksEnabled && (
        <SharedBooksModal
          open={Boolean(selectedSharedBook)}
          onClose={() => setSelectedSharedBook(null)}
          book={selectedSharedBook}
        />
      )}
    </div>
  );
}
