import { useState, useEffect, useMemo, useRef } from 'react';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonModal,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Haptics, NotificationType } from '@capacitor/haptics';
import { useMoney } from '../money/store';
import { getReportData, importTransactionsFromCsv, listTransactions } from '../../db/repository';
import type { ReportData, CsvImportRow } from '../../db/types';
import { formatMinor, parseMinor } from '../../lib/money';
import { generateInsights, type Insight } from '../../lib/insights';
import {
  exportTransactionsToCsv,
  exportTransactionsToExcelXml,
  parseCsvRows,
  shareOrPrintReportPdf,
} from '../../lib/exportImport';

export function ReportsScreen({
  onToast,
}: {
  onToast: (msg: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const bookId = useMoney((s) => s.bookId);
  const books = useMoney((s) => s.books);
  const accounts = useMoney((s) => s.accounts);
  const categories = useMoney((s) => s.categories);
  const activeBook = books.find((b) => b.id === bookId);
  const currency = activeBook?.currency ?? 'BDT';

  // Period State
  const [periodPreset, setPeriodPreset] = useState<'this_month' | 'last_month' | 'quarter' | 'year'>('this_month');
  const [offsetMonths, setOffsetMonths] = useState(0);

  const { from, to, label } = useMemo(() => {
    const now = new Date();
    if (periodPreset === 'this_month' || periodPreset === 'last_month') {
      const targetMonth = now.getMonth() + offsetMonths - (periodPreset === 'last_month' ? 1 : 0);
      const start = new Date(now.getFullYear(), targetMonth, 1).getTime();
      const end = new Date(now.getFullYear(), targetMonth + 1, 1).getTime();
      const d = new Date(now.getFullYear(), targetMonth, 1);
      const str = d.toLocaleDateString(i18n.language === 'bn' ? 'bn-BD' : 'en-GB', {
        month: 'long',
        year: 'numeric',
      });
      return { from: start, to: end, label: str };
    } else if (periodPreset === 'quarter') {
      const q = Math.floor(now.getMonth() / 3);
      const start = new Date(now.getFullYear(), q * 3, 1).getTime();
      const end = new Date(now.getFullYear(), (q + 1) * 3, 1).getTime();
      return { from: start, to: end, label: `Q${q + 1} ${now.getFullYear()}` };
    } else {
      const start = new Date(now.getFullYear(), 0, 1).getTime();
      const end = new Date(now.getFullYear() + 1, 0, 1).getTime();
      return { from: start, to: end, label: `${now.getFullYear()}` };
    }
  }, [periodPreset, offsetMonths, i18n.language]);

  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCatFilter, setSelectedCatFilter] = useState<string | null>(null);

  // Modals
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [csvTextToImport, setCsvTextToImport] = useState('');
  const [parsedImportRows, setParsedImportRows] = useState<CsvImportRow[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load Report Data
  useEffect(() => {
    if (!bookId) return;
    let active = true;
    void getReportData(bookId, from, to)
      .then((data) => {
        if (active) {
          setReport(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [bookId, from, to]);

  // Compute on-device insights
  const insights: Insight[] = useMemo(() => {
    if (!report) return [];
    return generateInsights({
      currentSavingsRate: report.savingsRate,
      previousSavingsRate: report.comparison.prevIncome > 0
        ? Math.round(((report.comparison.prevIncome - report.comparison.prevExpense) / report.comparison.prevIncome) * 100)
        : 0,
      categorySpendings: report.categories.map((c) => ({
        categoryId: c.categoryId,
        categoryName: c.name,
        currentAmount: c.amount,
        previousAmount: 0,
      })),
      budgetsAtRisk: [],
      billsDueSoon: [],
      overdueDebts: [],
    });
  }, [report]);

  // Donut chart angles
  const donutSlices = useMemo(() => {
    if (!report || report.categories.length === 0 || report.totalExpense === 0) return [];
    let cumulativeAngle = 0;
    return report.categories.map((cat) => {
      const angle = (cat.amount / report.totalExpense) * 360;
      const startAngle = cumulativeAngle;
      cumulativeAngle += angle;
      return {
        ...cat,
        startAngle,
        endAngle: cumulativeAngle,
      };
    });
  }, [report]);

  // Handle CSV File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = String(event.target?.result || '');
      setCsvTextToImport(text);
      handleParseCsv(text);
    };
    reader.readAsText(file);
  };

  const handleParseCsv = (text: string) => {
    const rawRows = parseCsvRows(text);
    const defaultAccId = accounts[0]?.id ?? '';

    const converted: CsvImportRow[] = rawRows.map((r) => {
      // Find date
      const dateVal = r.date || r.occurred_at || r['তারিখ'] || new Date().toISOString().slice(0, 10);
      // Find amount
      const rawAmt = r.amount || r['পরিমাণ'] || '0';
      const accountCurrency =
        accounts.find((a) => a.name.toLowerCase() === (r.account || r['অ্যাকাউন্ট'] || '').toLowerCase())
          ?.currency ?? currency;
      let minor: number;
      try {
        minor = Math.abs(parseMinor(String(rawAmt), accountCurrency));
      } catch {
        minor = 0;
      }
      // Find type
      const rawType = (r.type || r['ধরন'] || 'expense').toLowerCase();
      const type: 'expense' | 'income' | 'transfer' =
        rawType.includes('in') ? 'income' : rawType.includes('trans') ? 'transfer' : 'expense';
      // Find account
      const accName = (r.account || r['অ্যাকাউন্ট'] || '').toLowerCase();
      const matchedAcc = accounts.find((a) => a.name.toLowerCase() === accName) ?? accounts[0];
      // Find category
      const catName = (r.category || r['খাত'] || '').toLowerCase();
      const matchedCat = categories.find((c) => c.name?.toLowerCase() === catName);

      return {
        date: dateVal,
        amount: Math.abs(minor),
        type,
        accountId: matchedAcc?.id || defaultAccId,
        categoryId: matchedCat?.id,
        note: r.note || r['নোট'] || r.description || '',
      };
    });

    setParsedImportRows(converted);
  };

  const handleCommitImport = async () => {
    if (!bookId || parsedImportRows.length === 0) return;
    setIsImporting(true);
    try {
      const res = await importTransactionsFromCsv(bookId, parsedImportRows);
      void Haptics.notification({ type: NotificationType.Success }).catch(() => {});
      onToast(t('reports.importSuccess', { imported: res.imported, skipped: res.duplicatesSkipped }));
      setImportModalOpen(false);
      setParsedImportRows([]);
      setCsvTextToImport('');
      // Refresh report
      const updated = await getReportData(bookId, from, to);
      setReport(updated);
    } catch {
      onToast(t('common.error'));
    } finally {
      setIsImporting(false);
    }
  };

  const handleExportCsv = async () => {
    if (!bookId) return;
    const txs = await listTransactions({ bookId, from, to, limit: 1000 });
    const csv = exportTransactionsToCsv(txs, currency, i18n.language);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tohobil-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExportModalOpen(false);
    onToast(t('reports.exportReady'));
  };

  const handleExportExcel = async () => {
    if (!bookId) return;
    const txs = await listTransactions({ bookId, from, to, limit: 1000 });
    const xml = exportTransactionsToExcelXml(txs, currency, activeBook?.name || 'Tohobil');
    const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tohobil-report-${new Date().toISOString().slice(0, 10)}.xls`;
    a.click();
    URL.revokeObjectURL(url);
    setExportModalOpen(false);
    onToast(t('reports.exportReady'));
  };

  const handleExportPdf = async () => {
    if (!report) return;
    setExportModalOpen(false);
    try {
      await shareOrPrintReportPdf(report, currency, i18n.language);
    } catch {
      onToast(t('common.error'));
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButton fill="clear" slot="start" onClick={() => navigate('/tabs/more')}>
            <span className="material-symbols-rounded">arrow_back</span>
          </IonButton>
          <IonTitle>{t('more.reports')}</IonTitle>
          <div slot="end" style={{ display: 'flex', gap: 4 }}>
            <IonButton fill="clear" onClick={() => setImportModalOpen(true)} aria-label="Import">
              <span className="material-symbols-rounded">upload_file</span>
            </IonButton>
            <IonButton fill="clear" onClick={() => setExportModalOpen(true)} aria-label="Export">
              <span className="material-symbols-rounded">ios_share</span>
            </IonButton>
          </div>
        </IonToolbar>
      </IonHeader>

      <IonContent className="shell-content">
        <div className="page-pad" style={{ paddingBottom: 64 }}>
          {/* Preset Buttons */}
          <div className="kind-tabs" style={{ marginBottom: 12 }}>
            <button
              type="button"
              className={`choice ${periodPreset === 'this_month' ? 'selected' : ''}`}
              onClick={() => {
                setPeriodPreset('this_month');
                setOffsetMonths(0);
              }}
            >
              {t('reports.thisMonth')}
            </button>
            <button
              type="button"
              className={`choice ${periodPreset === 'last_month' ? 'selected' : ''}`}
              onClick={() => {
                setPeriodPreset('last_month');
                setOffsetMonths(0);
              }}
            >
              {t('reports.lastMonth')}
            </button>
            <button
              type="button"
              className={`choice ${periodPreset === 'quarter' ? 'selected' : ''}`}
              onClick={() => setPeriodPreset('quarter')}
            >
              {t('reports.quarter')}
            </button>
            <button
              type="button"
              className={`choice ${periodPreset === 'year' ? 'selected' : ''}`}
              onClick={() => setPeriodPreset('year')}
            >
              {t('reports.year')}
            </button>
          </div>

          {/* Period Label with Chevrons */}
          <div
            className="surface-card"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 16px',
              borderRadius: 16,
              marginBottom: 16,
            }}
          >
            <button
              type="button"
              className="icon-button"
              onClick={() => setOffsetMonths((m) => m - 1)}
              disabled={periodPreset === 'year' || periodPreset === 'quarter'}
            >
              <span className="material-symbols-rounded">chevron_left</span>
            </button>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>{label}</h3>
            <button
              type="button"
              className="icon-button"
              onClick={() => setOffsetMonths((m) => m + 1)}
              disabled={periodPreset === 'year' || periodPreset === 'quarter'}
            >
              <span className="material-symbols-rounded">chevron_right</span>
            </button>
          </div>

          {loading ? (
            <p style={{ textAlign: 'center', color: 'var(--app-muted)' }}>{t('common.loading')}</p>
          ) : !report ? (
            <p style={{ textAlign: 'center', color: 'var(--app-muted)' }}>{t('reports.noData')}</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* 1. Hero Grid: Income, Expense, Net, Savings Rate */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="surface-card" style={{ padding: 16, borderRadius: 16 }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--app-muted)' }}>{t('home.income')}</span>
                  <h2 style={{ margin: '4px 0 0', fontSize: '1.4rem', fontWeight: 800, color: '#22c55e' }}>
                    {formatMinor(report.totalIncome, currency, i18n.language)}
                  </h2>
                  {report.comparison.incomeDeltaPct !== 0 && (
                    <span style={{ fontSize: '0.75rem', color: report.comparison.incomeDeltaPct > 0 ? '#22c55e' : '#f43f5e' }}>
                      {report.comparison.incomeDeltaPct > 0 ? '↑' : '↓'} {Math.abs(report.comparison.incomeDeltaPct)}% {t('reports.vsLastPeriod')}
                    </span>
                  )}
                </div>

                <div className="surface-card" style={{ padding: 16, borderRadius: 16 }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--app-muted)' }}>{t('home.expense')}</span>
                  <h2 style={{ margin: '4px 0 0', fontSize: '1.4rem', fontWeight: 800, color: '#f43f5e' }}>
                    {formatMinor(report.totalExpense, currency, i18n.language)}
                  </h2>
                  {report.comparison.expenseDeltaPct !== 0 && (
                    <span style={{ fontSize: '0.75rem', color: report.comparison.expenseDeltaPct > 0 ? '#f43f5e' : '#22c55e' }}>
                      {report.comparison.expenseDeltaPct > 0 ? '↑' : '↓'} {Math.abs(report.comparison.expenseDeltaPct)}% {t('reports.vsLastPeriod')}
                    </span>
                  )}
                </div>

                <div className="surface-card" style={{ padding: 16, borderRadius: 16 }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--app-muted)' }}>{t('reports.netSavings')}</span>
                  <h2 style={{ margin: '4px 0 0', fontSize: '1.4rem', fontWeight: 800, color: report.netSavings >= 0 ? '#0ea5e9' : '#f43f5e' }}>
                    {formatMinor(report.netSavings, currency, i18n.language)}
                  </h2>
                  <span style={{ fontSize: '0.75rem', color: 'var(--app-muted)' }}>
                    {t('reports.savingsRate')}: {report.savingsRate}%
                  </span>
                </div>

                <div className="surface-card" style={{ padding: 16, borderRadius: 16 }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--app-muted)' }}>{t('reports.dailyAverage')}</span>
                  <h2 style={{ margin: '4px 0 0', fontSize: '1.4rem', fontWeight: 800 }}>
                    {formatMinor(report.dailyAverageExpense, currency, i18n.language)}
                  </h2>
                  <span style={{ fontSize: '0.75rem', color: 'var(--app-muted)' }}>
                    {t('reports.monthEndForecast')}: {formatMinor(report.monthEndForecast, currency, i18n.language)}
                  </span>
                </div>
              </div>

              {/* 2. Insights Feed */}
              {insights.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {insights.map((ins) => (
                    <div
                      key={ins.id}
                      className="surface-card"
                      style={{
                        padding: 12,
                        borderRadius: 14,
                        borderLeft: `4px solid ${ins.color}`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                      }}
                    >
                      <span className="material-symbols-rounded" style={{ color: ins.color, fontSize: 24 }}>
                        {ins.icon}
                      </span>
                      <div style={{ flex: 1 }}>
                        <strong style={{ display: 'block', fontSize: '0.9rem' }}>{t(ins.titleKey)}</strong>
                        <span style={{ fontSize: '0.8rem', color: 'var(--app-muted)' }}>
                          {t(ins.messageKey, ins.params ?? {})}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 3. Category Breakdown & Donut Chart */}
              <div className="surface-card" style={{ padding: 16, borderRadius: 16 }}>
                <h3 style={{ margin: '0 0 16px', fontSize: '1rem', fontWeight: 700 }}>
                  {t('reports.spendingByCategory')}
                </h3>

                {/* SVG Donut Chart */}
                {donutSlices.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
                    <svg viewBox="-1.2 -1.2 2.4 2.4" style={{ width: 180, height: 180, transform: 'rotate(-90deg)' }}>
                      {donutSlices.map((slice) => {
                        const startRad = (slice.startAngle * Math.PI) / 180;
                        const endRad = (slice.endAngle * Math.PI) / 180;
                        const x1 = Math.cos(startRad);
                        const y1 = Math.sin(startRad);
                        const x2 = Math.cos(endRad);
                        const y2 = Math.sin(endRad);
                        const largeArc = slice.endAngle - slice.startAngle > 180 ? 1 : 0;
                        const isSelected = selectedCatFilter === slice.categoryId;

                        return (
                          <path
                            key={slice.categoryId}
                            d={`M ${x1} ${y1} A 1 1 0 ${largeArc} 1 ${x2} ${y2} L ${x2 * 0.65} ${y2 * 0.65} A 0.65 0.65 0 ${largeArc} 0 ${x1 * 0.65} ${y1 * 0.65} Z`}
                            fill={slice.color}
                            opacity={selectedCatFilter && !isSelected ? 0.35 : 1}
                            style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
                            onClick={() =>
                              setSelectedCatFilter(selectedCatFilter === slice.categoryId ? null : slice.categoryId)
                            }
                          />
                        );
                      })}
                    </svg>
                  </div>
                )}

                {/* Category Bars */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {report.categories.map((c) => {
                    const isSelected = selectedCatFilter === c.categoryId;
                    return (
                      <div
                        key={c.categoryId}
                        onClick={() => setSelectedCatFilter(isSelected ? null : c.categoryId)}
                        style={{
                          cursor: 'pointer',
                          padding: 8,
                          borderRadius: 8,
                          background: isSelected ? 'var(--app-primary-bg, rgba(14, 165, 233, 0.08))' : 'transparent',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: 4 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span className="material-symbols-rounded" style={{ color: c.color, fontSize: 18 }}>
                              {c.icon}
                            </span>
                            <strong>{c.name}</strong>
                          </span>
                          <span>
                            <strong>{formatMinor(c.amount, currency, i18n.language)}</strong>{' '}
                            <span style={{ fontSize: '0.8rem', color: 'var(--app-muted)' }}>({c.percentage}%)</span>
                          </span>
                        </div>
                        <div style={{ height: 6, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ width: `${c.percentage}%`, height: '100%', background: c.color, borderRadius: 4 }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 4. Top 10 Expenses */}
              {report.topExpenses.length > 0 && (
                <div className="surface-card" style={{ padding: 16, borderRadius: 16 }}>
                  <h3 style={{ margin: '0 0 12px', fontSize: '1rem', fontWeight: 700 }}>
                    {t('reports.topExpenses')}
                  </h3>
                  <div className="transaction-list">
                    {report.topExpenses.map((tx) => (
                      <div className="transaction-row" key={tx.id}>
                        <div className="transaction-main">
                          <span className="tile-icon" style={{ background: '#f43f5e20', color: '#f43f5e' }}>
                            <span className="material-symbols-rounded">north_east</span>
                          </span>
                          <span className="transaction-meta">
                            <span className="transaction-title">
                              {tx.category_name ?? tx.note ?? t('money.uncategorized')}
                            </span>
                            <span className="transaction-account">
                              {new Date(tx.occurred_at).toISOString().slice(0, 10)}
                              {tx.account_name ? ` • ${tx.account_name}` : ''}
                            </span>
                          </span>
                          <span className="transaction-amount expense">
                            {formatMinor(tx.amount, tx.currency || currency, i18n.language)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ==================== EXPORT MODAL ==================== */}
          <IonModal isOpen={exportModalOpen} onDidDismiss={() => setExportModalOpen(false)}>
            <IonHeader>
              <IonToolbar>
                <IonTitle>{t('reports.exportTitle')}</IonTitle>
                <IonButton fill="clear" slot="end" onClick={() => setExportModalOpen(false)}>
                  <span className="material-symbols-rounded">close</span>
                </IonButton>
              </IonToolbar>
            </IonHeader>
            <IonContent className="shell-content">
              <div className="page-pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p style={{ color: 'var(--app-muted)', fontSize: '0.9rem' }}>
                  {t('reports.exportDesc')} ({label})
                </p>

                <button
                  type="button"
                  className="surface-card"
                  onClick={() => void handleExportPdf()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: 16,
                    borderRadius: 14,
                    width: '100%',
                    textAlign: 'left',
                    cursor: 'pointer',
                    border: '1px solid var(--app-border)',
                  }}
                >
                  <span className="material-symbols-rounded" style={{ color: '#f43f5e', fontSize: 28 }}>
                    picture_as_pdf
                  </span>
                  <div>
                    <strong style={{ display: 'block', fontSize: '1rem' }}>{t('reports.exportPdf')}</strong>
                    <span style={{ fontSize: '0.8rem', color: 'var(--app-muted)' }}>{t('reports.exportPdfDesc')}</span>
                  </div>
                </button>

                <button
                  type="button"
                  className="surface-card"
                  onClick={() => void handleExportCsv()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: 16,
                    borderRadius: 14,
                    width: '100%',
                    textAlign: 'left',
                    cursor: 'pointer',
                    border: '1px solid var(--app-border)',
                  }}
                >
                  <span className="material-symbols-rounded" style={{ color: '#0ea5e9', fontSize: 28 }}>
                    csv
                  </span>
                  <div>
                    <strong style={{ display: 'block', fontSize: '1rem' }}>{t('reports.exportCsv')}</strong>
                    <span style={{ fontSize: '0.8rem', color: 'var(--app-muted)' }}>{t('reports.exportCsvDesc')}</span>
                  </div>
                </button>

                <button
                  type="button"
                  className="surface-card"
                  onClick={() => void handleExportExcel()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: 16,
                    borderRadius: 14,
                    width: '100%',
                    textAlign: 'left',
                    cursor: 'pointer',
                    border: '1px solid var(--app-border)',
                  }}
                >
                  <span className="material-symbols-rounded" style={{ color: '#22c55e', fontSize: 28 }}>
                    table_view
                  </span>
                  <div>
                    <strong style={{ display: 'block', fontSize: '1rem' }}>{t('reports.exportExcel')}</strong>
                    <span style={{ fontSize: '0.8rem', color: 'var(--app-muted)' }}>{t('reports.exportExcelDesc')}</span>
                  </div>
                </button>
              </div>
            </IonContent>
          </IonModal>

          {/* ==================== IMPORT MODAL ==================== */}
          <IonModal isOpen={importModalOpen} onDidDismiss={() => setImportModalOpen(false)}>
            <IonHeader>
              <IonToolbar>
                <IonTitle>{t('reports.importTitle')}</IonTitle>
                <IonButton fill="clear" slot="end" onClick={() => setImportModalOpen(false)}>
                  <span className="material-symbols-rounded">close</span>
                </IonButton>
              </IonToolbar>
            </IonHeader>
            <IonContent className="shell-content">
              <div className="page-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <p style={{ color: 'var(--app-muted)', fontSize: '0.9rem' }}>
                  {t('reports.importDesc')}
                </p>

                <input
                  type="file"
                  accept=".csv,text/csv"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />

                <button
                  type="button"
                  className="primary-button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  <span className="material-symbols-rounded">file_open</span>
                  {t('reports.chooseCsvFile')}
                </button>

                {/* Or paste CSV text */}
                <label className="field-label" style={{ marginTop: 8 }}>
                  {t('reports.orPasteCsv')}
                  <textarea
                    className="text-input"
                    rows={4}
                    placeholder="Date,Type,Amount,Note..."
                    value={csvTextToImport}
                    onChange={(e) => {
                      setCsvTextToImport(e.target.value);
                      handleParseCsv(e.target.value);
                    }}
                    style={{ marginTop: 4, fontFamily: 'monospace', fontSize: '0.85rem' }}
                  />
                </label>

                {/* Parsed Preview */}
                {parsedImportRows.length > 0 && (
                  <div className="surface-card" style={{ padding: 14, borderRadius: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <strong>{t('reports.parsedPreview')} ({parsedImportRows.length} rows)</strong>
                    </div>

                    <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {parsedImportRows.slice(0, 10).map((r, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '0.8rem',
                            padding: '6px 8px',
                            background: '#f8fafc',
                            borderRadius: 6,
                          }}
                        >
                          <span>{r.date} • {r.type} {r.note ? `• ${r.note}` : ''}</span>
                          <strong>{formatMinor(r.amount, currency, i18n.language)}</strong>
                        </div>
                      ))}
                      {parsedImportRows.length > 10 && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--app-muted)', textAlign: 'center' }}>
                          ... {parsedImportRows.length - 10} more rows
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => void handleCommitImport()}
                      disabled={isImporting}
                      style={{ width: '100%', marginTop: 14 }}
                    >
                      {isImporting ? t('common.loading') : t('reports.confirmImport')}
                    </button>
                  </div>
                )}
              </div>
            </IonContent>
          </IonModal>
        </div>
      </IonContent>
    </IonPage>
  );
}
