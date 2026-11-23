import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Haptics, NotificationType } from '@capacitor/haptics';
import { calculateMinor } from '../../lib/calculator';
import {
  addMinor,
  formatMinor,
  minorToInput,
} from '../../lib/money';
import { calculateCrossCurrencyTarget } from '../../lib/currency';
import { getTransaction, createRecurringRule } from '../../db/repository';
import { useMoney } from './store';
import type { RecurringFrequency, RecurringMode, Transaction } from '../../db/types';
import { AttachmentPicker } from '../../components/AttachmentPicker';
import { uuidv7 } from '../../lib/ids';
import { parseFinancialSms } from '../../lib/smsParser';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { Script, TextRecognition } from '@capacitor-mlkit/text-recognition';
import { useFeatureFlag } from '../../lib/featureFlags';
import { parseReceiptText, type ParsedReceipt } from '../../lib/ocr';
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const dateToMs = (value: string) => new Date(`${value}T12:00:00`).getTime();
const symbols = [
  '7',
  '8',
  '9',
  '÷',
  '4',
  '5',
  '6',
  '×',
  '1',
  '2',
  '3',
  '−',
  '0',
  '.',
  '=',
  '+',
  '⌫',
];
type Kind = Transaction['type'] | 'loan';
export function QuickAdd({
  open,
  onClose,
  editId,
  onSaved,
  onLoan,
}: {
  open: boolean;
  onClose: () => void;
  editId: string | null;
  onSaved: (message: string) => void;
  onLoan: () => void;
}) {
  const { t, i18n } = useTranslation();
  const books = useMoney((s) => s.books),
    bookId = useMoney((s) => s.bookId),
    accounts = useMoney((s) => s.accounts),
    categories = useMoney((s) => s.categories),
    tags = useMoney((s) => s.tags),
    favorites = useMoney((s) => s.favorites),
    transactions = useMoney((s) => s.transactions),
    saveTransaction = useMoney((s) => s.saveTransaction),
    exchangeRates = useMoney((s) => s.exchangeRates),
    saveFavorite = useMoney((s) => s.saveFavorite);
  const [kind, setKind] = useState<Kind>('expense'),
    [amount, setAmount] = useState(''),
    [accountId, setAccountId] = useState(''),
    [toAccountId, setToAccountId] = useState(''),
    [exchangeRate, setExchangeRate] = useState('1.0'),
    [categoryId, setCategoryId] = useState(''),
    [date, setDate] = useState(today()),
    [note, setNote] = useState(''),
    [tagIds, setTagIds] = useState<string[]>([]),
    [split, setSplit] = useState(false),
    [splitRows, setSplitRows] = useState<
      { categoryId: string; amount: string }[]
    >([
      { categoryId: '', amount: '' },
      { categoryId: '', amount: '' },
    ]),
    [activeField, setActiveField] = useState(-1),
    [fee, setFee] = useState(''),
    [remember, setRemember] = useState(false),
    [repeat, setRepeat] = useState(false),
    [repeatFrequency, setRepeatFrequency] = useState<RecurringFrequency>('monthly'),
    [repeatMode, setRepeatMode] = useState<RecurringMode>('remind'),
    [favoriteName, setFavoriteName] = useState(''),
    [error, setError] = useState(''),
    [saving, setSaving] = useState(false),
    [txId, setTxId] = useState(() => uuidv7()),
    [smsModalOpen, setSmsModalOpen] = useState(false),
    [smsInput, setSmsInput] = useState(''),
    [ocrModalOpen, setOcrModalOpen] = useState(false),
    [ocrInput, setOcrInput] = useState(''),
    [parsedReceipt, setParsedReceipt] = useState<ParsedReceipt | null>(null),
    [scanningPhoto, setScanningPhoto] = useState(false);
  const receiptOcrEnabled = useFeatureFlag('receiptOcr');
  const currency = books.find((x) => x.id === bookId)?.currency ?? 'BDT';
  const sourceAcc = accounts.find((a) => a.id === accountId);
  const amountCurrency = sourceAcc?.currency ?? currency;
  const targetAcc = accounts.find((a) => a.id === toAccountId);
  const isCrossCurrency =
    kind === 'transfer' &&
    sourceAcc !== undefined &&
    targetAcc !== undefined &&
    sourceAcc.currency !== targetAcc.currency;
  const targetPreview = (() => {
    if (!isCrossCurrency || !sourceAcc || !targetAcc || !amount || Number(exchangeRate) <= 0) return null;
    try {
      return calculateCrossCurrencyTarget(
        calculateMinor(amount, sourceAcc.currency),
        sourceAcc.currency,
        targetAcc.currency,
        Number(exchangeRate),
      );
    } catch { return null; }
  })();

  useEffect(() => {
    if (isCrossCurrency && sourceAcc && targetAcc) {
      const direct = exchangeRates.find(
        (r) => r.base === sourceAcc.currency && r.quote === targetAcc.currency,
      );
      if (direct && direct.rate > 0) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setExchangeRate(direct.rate.toString());
      } else {
        const inverse = exchangeRates.find(
          (r) => r.base === targetAcc.currency && r.quote === sourceAcc.currency,
        );
        if (inverse && inverse.rate > 0) {
          setExchangeRate((1 / inverse.rate).toFixed(4));
        }
      }
    }
  }, [isCrossCurrency, sourceAcc, targetAcc, exchangeRates]);
  useEffect(() => {
    if (!open) return;
    const available = useMoney
      .getState()
      .accounts.filter((a) => !a.is_archived);
    const first = available[0]?.id ?? '';
    // Reset the editor only when it opens or changes target transaction.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAccountId(first);
    setToAccountId(available.find((a) => a.id !== first)?.id ?? '');
    setError('');
    if (editId) {
      setTxId(editId);
      void getTransaction(editId).then((result) => {
        if (!result) return;
        const tx = result.transaction;
        setKind(tx.type);
        setAmount(minorToInput(tx.amount, tx.currency));
        setAccountId(tx.account_id);
        setToAccountId(tx.to_account_id ?? '');
        setCategoryId(tx.category_id ?? '');
        setDate(new Date(tx.occurred_at).toISOString().slice(0, 10));
        setNote(tx.note);
        setTagIds(result.tagIds);
        setFee(minorToInput(tx.fee, tx.currency));
        setSplit(result.splits.length > 0);
        if (result.splits.length)
          setSplitRows(
            result.splits.map((x) => ({
              categoryId: x.categoryId,
              amount: minorToInput(x.amount, tx.currency),
            })),
          );
      });
    } else {
      setTxId(uuidv7());
      setKind('expense');
      setAmount('');
      setCategoryId('');
      setNote('');
      setTagIds([]);
      setSplit(false);
      setSplitRows([
        { categoryId: '', amount: '' },
        { categoryId: '', amount: '' },
      ]);
      setDate(today());
      setFee('');
      setRemember(false);
      setFavoriteName('');
      setActiveField(-1);
    }
  }, [open, editId]);
  const orderedCategories = useMemo(() => {
    const recent = new Map<string, number>();
    for (const [index, tx] of transactions.entries())
      if (tx.category_id && !recent.has(tx.category_id))
        recent.set(tx.category_id, index);
    return categories
      .filter((c) => c.kind === kind)
      .sort(
        (a, b) =>
          (recent.get(a.id) ?? 10000) - (recent.get(b.id) ?? 10000) ||
          a.sort_order - b.sort_order,
      );
  }, [categories, kind, transactions]);
  const active =
    activeField === -2
      ? fee
      : activeField < 0
        ? amount
        : (splitRows[activeField]?.amount ?? '');
  const write = (next: string) => {
    if (activeField === -2) setFee(next);
    else if (activeField < 0) setAmount(next);
    else
      setSplitRows((rows) =>
        rows.map((row, index) =>
          index === activeField ? { ...row, amount: next } : row,
        ),
      );
  };
  const key = (value: string) => {
    setError('');
    if (value === '⌫') {
      write(active.slice(0, -1));
      return;
    }
    if (value === '=') {
      try {
        write(minorToInput(calculateMinor(active, amountCurrency), amountCurrency));
      } catch {
        setError(t('money.invalidAmount'));
      }
      return;
    }
    if (value === '.' && active.endsWith('.')) return;
    write(active + (value === '−' ? '−' : value));
  };
  const applyFavorite = (favorite: (typeof favorites)[number]) => {
    setKind(favorite.type);
    setAmount(minorToInput(favorite.amount, accounts.find((a) => a.id === favorite.account_id)?.currency ?? currency));
    setAccountId(favorite.account_id);
    setCategoryId(favorite.category_id ?? '');
  };
  const save = async (addAnother: boolean) => {
    if (saving) return;
    try {
      const amountMinor = calculateMinor(amount, amountCurrency);
      if (amountMinor <= 0) throw new Error('INVALID_AMOUNT');
      if (!accountId) throw new Error('ACCOUNT_NOT_FOUND');
      if (kind === 'loan') throw new Error('LOAN_LATER');
      if (kind === 'transfer' && (!toAccountId || toAccountId === accountId))
        throw new Error('INVALID_TRANSFER');
      if (kind !== 'transfer' && !split && !categoryId)
        throw new Error('INVALID_CATEGORY');
      const splits = split
        ? splitRows.map((row) => ({
            categoryId: row.categoryId,
            amount: calculateMinor(row.amount, amountCurrency),
          }))
        : undefined;
      if (
        split &&
        (!splits ||
          splits.length < 2 ||
          splits.some((x) => !x.categoryId || x.amount <= 0) ||
          addMinor(...splits.map((x) => x.amount)) !== amountMinor)
      )
        throw new Error('SPLIT_MISMATCH');
      setSaving(true);
      let recurringRuleId: string | null = null;
      if (repeat && !editId && bookId) {
        const rule = await createRecurringRule(bookId, {
          name: note.trim() || t(`money.${kind}`),
          type: kind,
          amount: amountMinor,
          currency: amountCurrency,
          accountId,
          toAccountId: kind === 'transfer' ? toAccountId : null,
          categoryId: kind !== 'transfer' && !split ? categoryId || null : null,
          frequency: repeatFrequency,
          intervalStep: 1,
          startDate: dateToMs(date),
          mode: repeatMode,
          note: note.trim(),
        });
        recurringRuleId = rule.id;
      }
      await saveTransaction(
        {
          type: kind,
          amount: amountMinor,
          accountId,
          toAccountId: kind === 'transfer' ? toAccountId : null,
          fee:
            kind === 'transfer' && fee
              ? calculateMinor(fee, amountCurrency)
              : 0,
          exchangeRate:
            kind === 'transfer' && isCrossCurrency
              ? Number(exchangeRate) || 1.0
              : null,
          categoryId: kind === 'transfer' || split ? null : categoryId,
          occurredAt: dateToMs(date),
          note: note.trim(),
          tagIds,
          splits: kind === 'expense' || kind === 'income' ? splits : undefined,
          recurringRuleId,
        },
        editId ?? txId,
      );
      if (
        remember &&
        !split &&
        !editId &&
        (kind === 'income' || kind === 'expense')
      )
        await saveFavorite({
          name: favoriteName.trim() || note.trim() || t(`money.${kind}`),
          type: kind,
          amount: amountMinor,
          accountId,
          categoryId: categoryId || null,
        });
      void Haptics.notification({ type: NotificationType.Success }).catch(
        () => {},
      );
      onSaved(
        t(editId ? 'money.transactionUpdated' : 'money.transactionSaved'),
      );
      if (addAnother) {
        setTxId(uuidv7());
        setAmount('');
        setNote('');
        setSplitRows([
          { categoryId: '', amount: '' },
          { categoryId: '', amount: '' },
        ]);
        setActiveField(-1);
      } else onClose();
    } catch (e) {
      void Haptics.notification({ type: NotificationType.Error }).catch(
        () => {},
      );
      const code = e instanceof Error ? e.message : '';
      setError(
        t(
          code === 'SPLIT_MISMATCH'
            ? 'money.splitMismatch'
            : code === 'INVALID_CATEGORY'
              ? 'money.selectCategory'
              : code === 'INVALID_TRANSFER'
                ? 'money.sameAccount'
                : code === 'LOAN_LATER'
                  ? 'money.loanLater'
                  : code === 'INVALID_AMOUNT' || code === 'INVALID_EXPRESSION'
                    ? 'money.invalidAmount'
                    : 'money.error',
        ),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleParseSms = () => {
    const parsed = parseFinancialSms(smsInput);
    if (!parsed) {
      setError(t('sms.parseFailed'));
      return;
    }
    setKind(parsed.kind);
    setAmount(minorToInput(parsed.amount, 'BDT'));
    const noteParts = [parsed.counterparty, parsed.trxId ? `TrxID: ${parsed.trxId}` : ''].filter(Boolean);
    if (noteParts.length > 0) {
      setNote(noteParts.join(' • '));
    }
    if (parsed.fee && parsed.fee > 0) {
      setFee(minorToInput(parsed.fee, 'BDT'));
    }
    if (parsed.suggestedAccount) {
      const matched = accounts.find(
        (a) =>
          a.name.toLowerCase().includes(parsed.suggestedAccount!) ||
          a.type.toLowerCase().includes(parsed.suggestedAccount!),
      );
      if (matched) {
        setAccountId(matched.id);
      }
    }
    void Haptics.notification({ type: NotificationType.Success }).catch(() => {});
    setSmsModalOpen(false);
    setSmsInput('');
  };

  const handleScanPhoto = async () => {
    try {
      setScanningPhoto(true);
      const photo = await Camera.getPhoto({
        quality: 85,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Prompt,
      });
      const path = photo.path;
      if (Capacitor.isNativePlatform() && path) {
        try {
          const recognized = await TextRecognition.processImage({
            path,
            script: Script.Latin,
          });
          const text = recognized.text.trim();
          if (text) {
            setOcrInput(text);
            setParsedReceipt(parseReceiptText(text, currency));
            setError('');
            return;
          }
        } catch {
          // ML Kit is unavailable in the browser and can fail on an unreadable photo.
        }
      }
      setOcrInput('');
      setParsedReceipt(null);
      setError(t('money.ocrNeedsPaste'));
    } catch {
      // user cancelled
    } finally {
      setScanningPhoto(false);
    }
  };

  const handleParseReceipt = () => {
    if (!ocrInput.trim()) return;
    const result = parseReceiptText(ocrInput, currency);
    setParsedReceipt(result);
  };

  const handleApplyReceipt = async () => {
    if (!parsedReceipt) return;
    if (parsedReceipt.amount !== null) {
      setAmount(minorToInput(parsedReceipt.amount, currency));
    }
    if (parsedReceipt.date) {
      setDate(parsedReceipt.date);
    }
    if (parsedReceipt.merchant) {
      setNote(parsedReceipt.merchant);
    }
    try {
      await Haptics.notification({ type: NotificationType.Success });
    } catch {
      // ignore
    }
    setOcrModalOpen(false);
    setOcrInput('');
    setParsedReceipt(null);
  };

  if (!open) return null;
  return (
    <div className="quick-sheet">
      <div className="modal-head">
        <h1 className="page-heading">
          {t(editId ? 'money.editTransaction' : 'money.quickAdd')}
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {receiptOcrEnabled && (
            <button
              type="button"
              className="icon-button"
              onClick={() => setOcrModalOpen(true)}
              aria-label={t('ocr.scanReceipt')}
              title={t('ocr.scanReceipt')}
            >
              <span className="material-symbols-rounded">document_scanner</span>
            </button>
          )}
          <button
            type="button"
            className="icon-button"
            onClick={() => setSmsModalOpen(true)}
            aria-label={t('sms.pasteSms')}
            title={t('sms.pasteSms')}
          >
            <span className="material-symbols-rounded">sms</span>
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label={t('a11y.close')}
          >
            <span className="material-symbols-rounded">close</span>
          </button>
        </div>
      </div>
      {receiptOcrEnabled && ocrModalOpen && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'var(--app-card)',
            zIndex: 100,
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            borderRadius: 24,
            overflowY: 'auto',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>{t('ocr.scanReceiptTitle')}</h2>
            <button
              type="button"
              className="icon-button"
              onClick={() => setOcrModalOpen(false)}
              aria-label={t('a11y.close')}
            >
              <span className="material-symbols-rounded">close</span>
            </button>
          </div>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--app-muted)' }}>
            {t('ocr.scanReceiptDesc')}
          </p>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="primary-button compact-button"
              onClick={handleScanPhoto}
              disabled={scanningPhoto}
              style={{ flex: 1 }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: 18 }}>photo_camera</span>
              {scanningPhoto ? t('common.loading') : t('ocr.takePhoto')}
            </button>
          </div>

          <textarea
            className="text-input"
            rows={4}
            placeholder={t('ocr.ocrPlaceholder')}
            value={ocrInput}
            onChange={(e) => setOcrInput(e.target.value)}
            style={{ fontSize: '0.85rem', fontFamily: 'monospace' }}
          />

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="choice"
              onClick={handleParseReceipt}
              disabled={!ocrInput.trim()}
              style={{ flex: 1 }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: 18 }}>search</span>
              {t('ocr.parseReceipt')}
            </button>
          </div>

          {parsedReceipt && (
            <div
              style={{
                padding: 12,
                borderRadius: 14,
                border: '1px solid var(--app-border)',
                background: 'var(--app-surface-variant, rgba(255,255,255,0.05))',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ fontSize: '0.85rem', color: 'var(--app-muted)' }}>
                {t('ocr.extractedFields')}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span>{t('ocr.merchant')}:</span>
                <strong>{parsedReceipt.merchant || '—'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span>{t('ocr.date')}:</span>
                <strong>{parsedReceipt.date || '—'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span>{t('ocr.totalAmount')}:</span>
                <strong style={{ color: '#14b8a6' }}>
                  {parsedReceipt.amount !== null ? formatMinor(parsedReceipt.amount, currency, i18n.language) : '—'}
                </strong>
              </div>
              {parsedReceipt.tax !== null && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span>{t('ocr.tax')}:</span>
                  <small>{formatMinor(parsedReceipt.tax, currency, i18n.language)}</small>
                </div>
              )}
              <button
                type="button"
                className="primary-button"
                onClick={handleApplyReceipt}
                style={{ marginTop: 6 }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: 18 }}>check_circle</span>
                {t('ocr.applyToQuickAdd')}
              </button>
            </div>
          )}
        </div>
      )}
      {smsModalOpen && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'var(--app-card)',
            zIndex: 100,
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            borderRadius: 24,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>{t('sms.pasteSmsTitle')}</h2>
            <button
              type="button"
              className="icon-button"
              onClick={() => setSmsModalOpen(false)}
              aria-label={t('a11y.close')}
            >
              <span className="material-symbols-rounded">close</span>
            </button>
          </div>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--app-muted)' }}>
            {t('sms.pasteSmsDesc')}
          </p>
          <textarea
            className="text-input"
            rows={5}
            placeholder={t('sms.smsPlaceholder')}
            value={smsInput}
            onChange={(e) => setSmsInput(e.target.value)}
            style={{ fontSize: '0.9rem' }}
          />
          <button
            type="button"
            className="primary-button"
            onClick={handleParseSms}
            disabled={!smsInput.trim()}
          >
            <span className="material-symbols-rounded" style={{ fontSize: 18 }}>auto_fix_high</span>
            {t('sms.parseAndFill')}
          </button>
        </div>
      )}
      <div className="kind-tabs">
        {(['expense', 'income', 'transfer', 'loan'] as const).map((value) => (
          <button
            key={value}
            className={kind === value ? 'selected' : ''}
            onClick={() => {
              setKind(value);
              setCategoryId('');
              setSplit(false);
            }}
          >
            {t(`money.${value}`)}
          </button>
        ))}
      </div>
      {kind === 'loan' ? (
        <div className="surface-card empty-state">
          <p>{t('debtFlow.loanIntro')}</p>
          <button className="primary-button" onClick={onLoan}>
            {t('debtFlow.openDebts')}
          </button>
        </div>
      ) : (
        <>
          <div className="amount-display" aria-label={t('money.amount')}>
            <small>{amountCurrency}</small>
            <strong>{active || t('money.amountPlaceholder')}</strong>
            {activeField >= 0 && (
              <small>
                {t('money.split')} {activeField + 1}
              </small>
            )}
          </div>
          {favorites.length > 0 && !editId && (
            <div className="favorite-strip">
              {favorites
                .filter((x) => x.type === kind)
                .map((favorite) => (
                  <button
                    key={favorite.id}
                    onClick={() => applyFavorite(favorite)}
                  >
                    {favorite.name} ·{' '}
                    {formatMinor(favorite.amount, accounts.find((a) => a.id === favorite.account_id)?.currency ?? currency, i18n.language)}
                  </button>
                ))}
            </div>
          )}
          <div className="keypad">
            {symbols.map((value) => (
              <button
                key={value}
                className={value === '=' ? 'key-equals' : ''}
                onClick={() => key(value)}
                aria-label={
                  value === '⌫'
                    ? t('money.backspace')
                    : value === '='
                      ? t('money.equals')
                      : value
                }
              >
                {value}
              </button>
            ))}
          </div>
          <div className="quick-fields">
            <label>
              {t('money.account')}
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
              >
                {accounts
                  .filter((a) => !a.is_archived)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name === 'cash' ? t('money.cashInHand') : a.name}
                    </option>
                  ))}
              </select>
            </label>
            {kind === 'transfer' && (
              <>
                <label>
                  {t('money.toAccount')}
                  <select
                    value={toAccountId}
                    onChange={(e) => setToAccountId(e.target.value)}
                  >
                    {accounts
                      .filter((a) => !a.is_archived && a.id !== accountId)
                      .map((a) => (
                        <option value={a.id} key={a.id}>
                          {a.name === 'cash' ? t('money.cashInHand') : a.name}
                        </option>
                      ))}
                  </select>
                </label>
                {isCrossCurrency && sourceAcc && targetAcc && (
                  <div
                    style={{
                      marginTop: 8,
                      marginBottom: 12,
                      padding: 12,
                      borderRadius: 12,
                      background: 'var(--app-card-elevated)',
                      border: '1px solid var(--app-border)',
                    }}
                  >
                    <label style={{ display: 'block', fontSize: '0.85rem' }}>
                      {t('wealth.exchangeRate')} (1 {sourceAcc.currency} = ? {targetAcc.currency})
                      <input
                        type="number"
                        step="0.0001"
                        value={exchangeRate}
                        onChange={(e) => setExchangeRate(e.target.value)}
                        style={{
                          width: '100%',
                          marginTop: 6,
                          padding: '8px 12px',
                          borderRadius: 8,
                          border: '1px solid var(--app-border)',
                          background: 'var(--app-card)',
                          color: 'var(--app-text)',
                        }}
                      />
                    </label>
                    {targetPreview !== null && (
                      <p style={{ margin: '6px 0 0', fontSize: '0.85rem', color: 'var(--app-muted)' }}>
                        {t('wealth.targetAmount')}: ~
                        {formatMinor(
                          targetPreview,
                          targetAcc.currency,
                          i18n.language,
                        )}
                      </p>
                    )}
                  </div>
                )}
                <label>
                  {t('money.transferFee')}
                  <button
                    className="field-button"
                    onClick={() => setActiveField(-2)}
                  >
                    {fee || t('money.amountPlaceholder')}
                  </button>
                </label>
              </>
            )}
            {kind !== 'transfer' && (
              <>
                <div className="field-title">{t('money.category')}</div>
                <div className="category-grid">
                  {orderedCategories.map((category) => (
                    <button
                      className={
                        categoryId === category.id && !split ? 'selected' : ''
                      }
                      key={category.id}
                      onClick={() => {
                        setCategoryId(category.id);
                        setActiveField(-1);
                      }}
                    >
                      <span
                        className="tile-icon"
                        style={{
                          background: `${category.color}20`,
                          color: category.color,
                        }}
                      >
                        <span className="material-symbols-rounded">
                          {category.icon}
                        </span>
                      </span>
                      <span>
                        {category.name ?? t(`categories.${category.i18n_key}`)}
                      </span>
                    </button>
                  ))}
                </div>
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={split}
                    onChange={(e) => setSplit(e.target.checked)}
                  />
                  {t('money.split')}
                </label>
                {split && (
                  <div className="split-rows">
                    {splitRows.map((row, index) => (
                      <div className="split-row" key={index}>
                        <select
                          aria-label={t('money.category')}
                          value={row.categoryId}
                          onChange={(e) =>
                            setSplitRows((rows) =>
                              rows.map((x, i) =>
                                i === index
                                  ? { ...x, categoryId: e.target.value }
                                  : x,
                              ),
                            )
                          }
                        >
                          <option value="">{t('money.selectCategory')}</option>
                          {orderedCategories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name ?? t(`categories.${c.i18n_key}`)}
                            </option>
                          ))}
                        </select>
                        <button
                          className={
                            activeField === index
                              ? 'field-button selected'
                              : 'field-button'
                          }
                          onClick={() => setActiveField(index)}
                        >
                          {row.amount || t('money.amountPlaceholder')}
                        </button>
                      </div>
                    ))}
                    <button
                      className="text-button"
                      onClick={() =>
                        setSplitRows((rows) => [
                          ...rows,
                          { categoryId: '', amount: '' },
                        ])
                      }
                    >
                      {t('money.addSplit')}
                    </button>
                  </div>
                )}
              </>
            )}
            <div className="date-row">
              <button
                className={date === today() ? 'choice selected' : 'choice'}
                onClick={() => setDate(today())}
              >
                {t('money.today')}
              </button>
              <button
                className="choice"
                onClick={() =>
                  setDate(
                    (() => {
                      const d = new Date();
                      d.setDate(d.getDate() - 1);
                      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                    })(),
                  )
                }
              >
                {t('money.yesterday')}
              </button>
              <input
                aria-label={t('money.pickDate')}
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <label>
              {t('money.note')}
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t('money.note')}
              />
            </label>
            {bookId && (
              <div style={{ margin: '4px 0 8px' }}>
                <AttachmentPicker
                  bookId={bookId}
                  entityType="transaction"
                  entityId={txId}
                  compact
                />
              </div>
            )}
            <div className="tag-row">
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  className={
                    tagIds.includes(tag.id) ? 'choice selected' : 'choice'
                  }
                  onClick={() =>
                    setTagIds((ids) =>
                      ids.includes(tag.id)
                        ? ids.filter((x) => x !== tag.id)
                        : [...ids, tag.id],
                    )
                  }
                >
                  {tag.name}
                </button>
              ))}
            </div>
            {!editId && kind !== 'transfer' && !split && (
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                {t('money.saveFavorite')}
              </label>
            )}
            {remember && (
              <label>
                {t('money.favoriteName')}
                <input
                  value={favoriteName}
                  onChange={(e) => setFavoriteName(e.target.value)}
                />
              </label>
            )}
            {!editId && (kind as string) !== 'loan' && (
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={repeat}
                  onChange={(e) => setRepeat(e.target.checked)}
                />
                {t('planning.repeatRule')}
              </label>
            )}
            {repeat && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', margin: '4px 0 12px' }}>
                <select
                  aria-label={t('planning.frequency')}
                  value={repeatFrequency}
                  onChange={(e) => setRepeatFrequency(e.target.value as RecurringFrequency)}
                >
                  <option value="daily">{t('planning.freq_daily')}</option>
                  <option value="weekly">{t('planning.freq_weekly')}</option>
                  <option value="monthly">{t('planning.freq_monthly')}</option>
                  <option value="yearly">{t('planning.freq_yearly')}</option>
                </select>
                <select
                  aria-label={t('planning.executionMode')}
                  value={repeatMode}
                  onChange={(e) => setRepeatMode(e.target.value as RecurringMode)}
                >
                  <option value="remind">{t('planning.modeRemind')}</option>
                  <option value="auto_create">{t('planning.modeAuto')}</option>
                </select>
              </div>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="form-actions">
              <button
                className="primary-button"
                disabled={saving}
                onClick={() => void save(false)}
              >
                {t('money.save')}
              </button>
              {!editId && (
                <button
                  className="secondary-button"
                  disabled={saving}
                  onClick={() => void save(true)}
                >
                  {t('money.saveAndAdd')}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
