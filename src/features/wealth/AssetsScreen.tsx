import React, { useEffect, useMemo, useState } from 'react';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonLabel,
  IonModal,
  IonPage,
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Haptics, NotificationType } from '@capacitor/haptics';
import { useMoney } from '../money/store';
import {
  listAssetValuations,
  recordAssetValuation,
  getNetWorthHistory,
  fetchAndStoreServerRates,
  saveExchangeRate,
} from '../../db/repository';
import type {
  AssetType,
  AssetValuation,
  AssetView,
  NetWorthHistoryPoint,
} from '../../db/types';
import { formatMinor, parseMinor, minorToInput } from '../../lib/money';

const ASSET_TYPES: { type: AssetType; icon: string; color: string }[] = [
  { type: 'fdr', icon: 'lock_clock', color: '#6366f1' },
  { type: 'dps', icon: 'savings', color: '#0ea5e9' },
  { type: 'sanchayapatra', icon: 'receipt_long', color: '#14b8a6' },
  { type: 'gold', icon: 'monetization_on', color: '#f59e0b' },
  { type: 'land', icon: 'terrain', color: '#22c55e' },
  { type: 'shares', icon: 'show_chart', color: '#ec4899' },
  { type: 'crypto', icon: 'currency_bitcoin', color: '#8b5cf6' },
  { type: 'other', icon: 'inventory_2', color: '#64748b' },
];

export function AssetsScreen({
  onToast,
}: {
  onToast: (msg: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const bookId = useMoney((s) => s.bookId);
  const books = useMoney((s) => s.books);
  const accounts = useMoney((s) => s.accounts);
  const assets = useMoney((s) => s.assets);
  const wealthSummary = useMoney((s) => s.wealthSummary);
  const exchangeRates = useMoney((s) => s.exchangeRates);
  const totalBalance = useMoney((s) => s.total);
  const receivable = useMoney((s) => s.receivable);
  const payable = useMoney((s) => s.payable);
  const createAsset = useMoney((s) => s.createAsset);
  const updateAsset = useMoney((s) => s.updateAsset);
  const deleteAsset = useMoney((s) => s.deleteAsset);
  const refresh = useMoney((s) => s.refresh);

  const [activeTab, setActiveTab] = useState<'assets' | 'net_worth'>('assets');
  const [filterType, setFilterType] = useState<AssetType | 'all'>('all');

  // Asset Form Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState<AssetView | null>(null);
  const [formType, setFormType] = useState<AssetType>('fdr');
  const [formName, setFormName] = useState('');
  const [formInstitution, setFormInstitution] = useState('');
  const [formPrincipal, setFormPrincipal] = useState('');
  const [formCurrentValue, setFormCurrentValue] = useState('');
  const [formProfitRate, setFormProfitRate] = useState('');
  const [formStartDate, setFormStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [formMaturityDate, setFormMaturityDate] = useState('');
  const [formUnit, setFormUnit] = useState('');
  const [formCurrency, setFormCurrency] = useState('BDT');
  const [formNote, setFormNote] = useState('');
  const [formFundingAccount, setFormFundingAccount] = useState('');
  const [saving, setSaving] = useState(false);

  // Detail Modal
  const [selectedAsset, setSelectedAsset] = useState<AssetView | null>(null);
  const [valuations, setValuations] = useState<AssetValuation[]>([]);
  const [loadingValuations, setLoadingValuations] = useState(false);

  // Update Valuation Dialog
  const [showValuationModal, setShowValuationModal] = useState(false);
  const [valAmount, setValAmount] = useState('');
  const [valDate, setValDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Net Worth History
  const [netWorthDays, setNetWorthDays] = useState<number>(30);
  const [netWorthPoints, setNetWorthPoints] = useState<NetWorthHistoryPoint[]>([]);
  const [activePoint, setActivePoint] = useState<NetWorthHistoryPoint | null>(null);

  // Exchange Rates Modal
  const [showRatesModal, setShowRatesModal] = useState(false);
  const [showAddRateModal, setShowAddRateModal] = useState(false);
  const [rateBase, setRateBase] = useState('USD');
  const [rateQuote, setRateQuote] = useState('BDT');
  const [rateValue, setRateValue] = useState('121.50');
  const [refreshingRates, setRefreshingRates] = useState(false);

  const book = books.find((b) => b.id === bookId);
  const currency = book?.currency ?? 'BDT';

  const money = (amount: number, c = currency) =>
    formatMinor(amount, c, i18n.language);

  // Filter assets
  const filteredAssets = useMemo(() => {
    if (filterType === 'all') return assets;
    return assets.filter((a) => a.type === filterType);
  }, [assets, filterType]);

  // Load Valuations when an asset is selected
  useEffect(() => {
    if (!selectedAsset) return;
    let active = true;
    void listAssetValuations(selectedAsset.id).then((res) => {
      if (active) {
        setValuations(res);
        setLoadingValuations(false);
      }
    });
    return () => {
      active = false;
    };
  }, [selectedAsset]);

  // Load Net Worth History
  useEffect(() => {
    if (!bookId || activeTab !== 'net_worth') return;
    void getNetWorthHistory(bookId, netWorthDays).then((pts) => {
      setNetWorthPoints(pts);
      if (pts.length > 0) {
        setActivePoint(pts[pts.length - 1]);
      }
    });
  }, [bookId, activeTab, netWorthDays]);

  const openAddAsset = () => {
    setEditingAsset(null);
    setFormType('fdr');
    setFormName('');
    setFormInstitution('');
    setFormPrincipal('');
    setFormCurrentValue('');
    setFormProfitRate('');
    setFormStartDate(new Date().toISOString().slice(0, 10));
    setFormMaturityDate('');
    setFormUnit('');
    setFormCurrency(currency);
    setFormNote('');
    setFormFundingAccount('');
    setShowAddModal(true);
  };

  const openEditAsset = (asset: AssetView) => {
    setEditingAsset(asset);
    setFormType(asset.type);
    setFormName(asset.name);
    setFormInstitution(asset.institution ?? '');
    setFormPrincipal(minorToInput(asset.principal, asset.currency));
    setFormCurrentValue(minorToInput(asset.current_value, asset.currency));
    setFormProfitRate(asset.profit_rate ? asset.profit_rate.toString() : '');
    setFormStartDate(new Date(asset.start_date).toISOString().slice(0, 10));
    setFormMaturityDate(
      asset.maturity_date ? new Date(asset.maturity_date).toISOString().slice(0, 10) : '',
    );
    setFormUnit(asset.unit ?? '');
    setFormCurrency(asset.currency);
    setFormNote(asset.note);
    setFormFundingAccount('');
    setShowAddModal(true);
  };

  const handleSaveAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || !bookId) return;

    try {
      if (!formName.trim()) {
        onToast(t('wealth.nameRequired'));
        return;
      }
      const principalMinor = parseMinor(formPrincipal || '0', formCurrency);
      const currentMinor = formCurrentValue.trim()
        ? parseMinor(formCurrentValue, formCurrency)
        : principalMinor;
      const profitRateNum = formProfitRate.trim() ? parseFloat(formProfitRate) : null;
      const startMs = new Date(formStartDate).getTime();
      const maturityMs = formMaturityDate.trim()
        ? new Date(formMaturityDate).getTime()
        : null;

      setSaving(true);
      if (editingAsset) {
        await updateAsset(editingAsset.id, {
          type: formType,
          name: formName.trim(),
          institution: formInstitution.trim() || null,
          principal: principalMinor,
          currentValue: currentMinor,
          profitRate: profitRateNum,
          startDate: startMs,
          maturityDate: maturityMs,
          unit: formUnit.trim() || null,
          currency: formCurrency,
          note: formNote.trim(),
        });
        onToast(t('wealth.assetUpdated'));
        if (selectedAsset && selectedAsset.id === editingAsset.id) {
          setSelectedAsset((prev) =>
            prev
              ? {
                  ...prev,
                  type: formType,
                  name: formName.trim(),
                  institution: formInstitution.trim() || null,
                  principal: principalMinor,
                  current_value: currentMinor,
                  profit_rate: profitRateNum,
                  start_date: startMs,
                  maturity_date: maturityMs,
                  unit: formUnit.trim() || null,
                  currency: formCurrency,
                  note: formNote.trim(),
                  profit: currentMinor - principalMinor,
                  profitPercentage:
                    principalMinor > 0
                      ? ((currentMinor - principalMinor) / principalMinor) * 100
                      : 0,
                }
              : null,
          );
        }
      } else {
        await createAsset({
          type: formType,
          name: formName.trim(),
          institution: formInstitution.trim() || null,
          principal: principalMinor,
          currentValue: currentMinor,
          profitRate: profitRateNum,
          startDate: startMs,
          maturityDate: maturityMs,
          unit: formUnit.trim() || null,
          currency: formCurrency,
          note: formNote.trim(),
          fundingAccountId: formFundingAccount || null,
        });
        void Haptics.notification({ type: NotificationType.Success }).catch(() => {});
        onToast(t('wealth.assetCreated'));
      }

      setShowAddModal(false);
    } catch (err) {
      onToast(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAsset = async (asset: AssetView) => {
    if (!window.confirm(t('wealth.confirmDeleteAsset'))) return;
    try {
      await deleteAsset(asset.id);
      setSelectedAsset(null);
      void Haptics.notification({ type: NotificationType.Warning }).catch(() => {});
      onToast(t('wealth.assetDeleted'));
    } catch {
      onToast(t('common.error'));
    }
  };

  const handleRecordValuation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAsset) return;

    try {
      const valMinor = parseMinor(valAmount, selectedAsset.currency);
      const dateMs = new Date(valDate).getTime();

      await recordAssetValuation(selectedAsset.id, {
        value: valMinor,
        date: dateMs,
      });

      void Haptics.notification({ type: NotificationType.Success }).catch(() => {});
      onToast(t('wealth.valuationRecorded'));
      setShowValuationModal(false);

      // Reload asset and valuations
      const updatedList = await listAssetValuations(selectedAsset.id);
      setValuations(updatedList);
      setSelectedAsset((prev) =>
        prev
          ? {
              ...prev,
              current_value: valMinor,
              profit: valMinor - prev.principal,
              profitPercentage:
                prev.principal > 0
                  ? ((valMinor - prev.principal) / prev.principal) * 100
                  : 0,
            }
          : null,
      );
    } catch (err) {
      onToast(err instanceof Error ? err.message : t('common.error'));
    }
  };

  const handleFetchRates = async () => {
    if (!bookId || refreshingRates) return;
    try {
      setRefreshingRates(true);
      await fetchAndStoreServerRates(bookId, currency);
      await refresh();
      void Haptics.notification({ type: NotificationType.Success }).catch(() => {});
      onToast(t('wealth.ratesUpdated'));
    } catch {
      onToast(t('common.error'));
    } finally {
      setRefreshingRates(false);
    }
  };

  const handleSaveCustomRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookId) return;
    try {
      const rateNum = parseFloat(rateValue);
      if (!rateNum || rateNum <= 0) {
        onToast(t('wealth.invalidRate'));
        return;
      }
      await saveExchangeRate(bookId, {
        base: rateBase.toUpperCase().trim(),
        quote: rateQuote.toUpperCase().trim(),
        rate: rateNum,
        source: 'manual',
      });
      await refresh();
      setShowAddRateModal(false);
      onToast(t('wealth.rateSaved'));
    } catch {
      onToast(t('common.error'));
    }
  };

  // Sparkline generator for valuation history
  const renderSparkline = (points: AssetValuation[], width = 280, height = 70) => {
    if (points.length < 2) return null;
    const min = Math.min(...points.map((p) => p.value));
    const max = Math.max(...points.map((p) => p.value));
    const range = max - min || 1;
    const padding = 6;
    const availableW = width - padding * 2;
    const availableH = height - padding * 2;

    const coords = points.map((p, idx) => {
      const x = padding + (idx / (points.length - 1)) * availableW;
      const y = height - padding - ((p.value - min) / range) * availableH;
      return `${x},${y}`;
    });

    const pathD = `M ${coords.join(' L ')}`;
    const areaD = `${pathD} L ${width - padding},${height} L ${padding},${height} Z`;

    return (
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="valGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#valGrad)" />
        <path d={pathD} fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => {
          const [cx, cy] = coords[i].split(',');
          return (
            <circle
              key={p.id}
              cx={cx}
              cy={cy}
              r={i === points.length - 1 ? 4.5 : 3}
              fill={i === points.length - 1 ? '#6366f1' : '#ffffff'}
              stroke="#6366f1"
              strokeWidth="2"
            />
          );
        })}
      </svg>
    );
  };

  // Net Worth SVG Chart
  const renderNetWorthChart = (points: NetWorthHistoryPoint[], width = 340, height = 150) => {
    if (points.length < 2) return null;
    const values = points.map((p) => p.netWorth);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const padding = 12;
    const availableW = width - padding * 2;
    const availableH = height - padding * 2;

    const coords = points.map((p, idx) => {
      const x = padding + (idx / (points.length - 1)) * availableW;
      const y = height - padding - ((p.netWorth - min) / range) * availableH;
      return { x, y, point: p };
    });

    const pathD = `M ${coords.map((c) => `${c.x},${c.y}`).join(' L ')}`;
    const areaD = `${pathD} L ${width - padding},${height} L ${padding},${height} Z`;

    return (
      <div style={{ position: 'relative', width: '100%' }}>
        <svg
          width="100%"
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          style={{ overflow: 'visible', cursor: 'crosshair' }}
        >
          <defs>
            <linearGradient id="nwGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#14b8a6" stopOpacity="0.0" />
            </linearGradient>
          </defs>
          <path d={areaD} fill="url(#nwGrad)" />
          <path
            d={pathD}
            fill="none"
            stroke="#14b8a6"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {coords.map((c) => {
            const isSelected = activePoint?.date === c.point.date;
            return (
              <circle
                key={c.point.date}
                cx={c.x}
                cy={c.y}
                r={isSelected ? 5.5 : 2.5}
                fill={isSelected ? '#14b8a6' : '#ffffff'}
                stroke="#14b8a6"
                strokeWidth="2"
                onClick={() => setActivePoint(c.point)}
              />
            );
          })}
        </svg>

        {activePoint && (
          <div
            style={{
              marginTop: 12,
              padding: '10px 14px',
              borderRadius: 12,
              background: 'var(--app-card-elevated)',
              border: '1px solid var(--app-border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--app-muted)' }}>
                {activePoint.date}
              </span>
              <p style={{ margin: 0, fontWeight: 700, fontSize: '1.1rem' }}>
                {money(activePoint.netWorth)}
              </p>
            </div>
            <div style={{ textAlign: 'right', fontSize: '0.85rem' }}>
              <span style={{ color: '#22c55e' }}>{t('wealth.assets')}: {money(activePoint.assets)}</span>
              <br />
              <span style={{ color: '#f43f5e' }}>{t('wealth.liabilities')}: {money(activePoint.liabilities)}</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  const totalAssetsSum = totalBalance + receivable + (wealthSummary?.currentValue ?? 0);
  const totalLiabilitiesSum = payable;
  const netWorthCalculated = totalAssetsSum - totalLiabilitiesSum;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButton
            slot="start"
            fill="clear"
            aria-label={t('a11y.back')}
            onClick={() => navigate(-1)}
          >
            <span className="material-symbols-rounded">arrow_back</span>
          </IonButton>
          <IonTitle>{t('more.assets')}</IonTitle>
          <IonButton
            slot="end"
            fill="clear"
            aria-label={t('wealth.rates')}
            onClick={() => setShowRatesModal(true)}
          >
            <span className="material-symbols-rounded">currency_exchange</span>
          </IonButton>
          <IonButton
            slot="end"
            fill="clear"
            aria-label={t('wealth.addAsset')}
            onClick={openAddAsset}
          >
            <span className="material-symbols-rounded">add</span>
          </IonButton>
        </IonToolbar>
      </IonHeader>

      <IonContent className="shell-content">
        <div className="page-pad">
          {/* Segment Toggle */}
          <IonSegment
            scrollable
            value={activeTab}
            onIonChange={(e) => setActiveTab(e.detail.value as 'assets' | 'net_worth')}
            style={{ marginBottom: 16 }}
          >
            <IonSegmentButton value="assets">
              <IonLabel>{t('wealth.assetsTab')}</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="net_worth">
              <IonLabel>{t('wealth.netWorthTab')}</IonLabel>
            </IonSegmentButton>
          </IonSegment>

          {activeTab === 'assets' ? (
            <>
              {/* Investments Hero Card */}
              <div
                className="hero"
                style={{
                  background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                  marginBottom: 16,
                }}
              >
                <span className="hero-label">{t('wealth.totalInvestments')}</span>
                <div className="hero-balance">
                  {money(wealthSummary?.currentValue ?? 0)}
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: 12,
                    paddingTop: 10,
                    borderTop: '1px solid rgba(255,255,255,0.15)',
                    fontSize: '0.85rem',
                  }}
                >
                  <div>
                    <span style={{ opacity: 0.8 }}>{t('wealth.principalInvested')}: </span>
                    <strong>{money(wealthSummary?.totalInvested ?? 0)}</strong>
                  </div>
                  <div>
                    <span style={{ opacity: 0.8 }}>{t('wealth.profitReturn')}: </span>
                    <strong style={{ color: '#86efac' }}>
                      {wealthSummary && wealthSummary.totalProfit >= 0 ? '+' : ''}
                      {money(wealthSummary?.totalProfit ?? 0)}
                      {` (${wealthSummary?.profitPercentage.toFixed(1) ?? '0'}%)`}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Maturing Soon Alert Banner */}
              {wealthSummary?.maturingSoon && wealthSummary.maturingSoon.length > 0 && (
                <div
                  className="surface-card"
                  style={{
                    marginBottom: 16,
                    padding: 14,
                    borderLeft: '4px solid #f59e0b',
                    background: '#fef3c720',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span className="material-symbols-rounded" style={{ color: '#f59e0b' }}>
                      warning
                    </span>
                    <strong style={{ color: '#f59e0b', fontSize: '0.95rem' }}>
                      {t('wealth.maturingAlertTitle')}
                    </strong>
                  </div>
                  {wealthSummary.maturingSoon.map((m) => (
                    <div
                      key={m.id}
                      onClick={() => setSelectedAsset(m)}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '6px 0',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        borderBottom: '1px dashed var(--app-border)',
                      }}
                    >
                      <span>
                        <strong>{m.name}</strong>
                        <small style={{ display: 'block', color: 'var(--app-muted)' }}>
                          {m.isMatured
                            ? t('wealth.matured')
                            : t('wealth.maturesInDays', { count: m.daysToMaturity ?? 0 })}
                        </small>
                      </span>
                      <b>{money(m.current_value, m.currency)}</b>
                    </div>
                  ))}
                </div>
              )}

              {/* Type Filter Chips */}
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  overflowX: 'auto',
                  paddingBottom: 10,
                  marginBottom: 12,
                }}
              >
                <button
                  type="button"
                  className={`chip ${filterType === 'all' ? 'chip-active' : ''}`}
                  onClick={() => setFilterType('all')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 20,
                    border: '1px solid var(--app-border)',
                    background: filterType === 'all' ? 'var(--app-primary)' : 'var(--app-card)',
                    color: filterType === 'all' ? '#fff' : 'var(--app-text)',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t('wealth.allTypes')} ({assets.length})
                </button>
                {ASSET_TYPES.map(({ type, icon }) => {
                  const count = wealthSummary?.byType[type]?.count ?? 0;
                  if (count === 0 && filterType !== type) return null;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setFilterType(type)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 20,
                        border: '1px solid var(--app-border)',
                        background: filterType === type ? 'var(--app-primary)' : 'var(--app-card)',
                        color: filterType === type ? '#fff' : 'var(--app-text)',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <span className="material-symbols-rounded" style={{ fontSize: 16 }}>
                        {icon}
                      </span>
                      {t(`wealth.types.${type}`)} ({count})
                    </button>
                  );
                })}
              </div>

              {/* Assets List */}
              {filteredAssets.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {filteredAssets.map((asset) => {
                    const typeConfig =
                      ASSET_TYPES.find((tConfig) => tConfig.type === asset.type) ?? ASSET_TYPES[7];
                    return (
                      <div
                        key={asset.id}
                        className="surface-card"
                        onClick={() => setSelectedAsset(asset)}
                        style={{
                          padding: 16,
                          borderRadius: 16,
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 10,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div
                              style={{
                                width: 44,
                                height: 44,
                                borderRadius: 12,
                                background: `${typeConfig.color}20`,
                                color: typeConfig.color,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <span className="material-symbols-rounded">{typeConfig.icon}</span>
                            </div>
                            <div>
                              <strong style={{ fontSize: '1rem' }}>{asset.name}</strong>
                              <small style={{ display: 'block', color: 'var(--app-muted)' }}>
                                {asset.institution || t(`wealth.types.${asset.type}`)}
                                {asset.unit ? ` • ${asset.unit}` : ''}
                              </small>
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <strong style={{ fontSize: '1.05rem' }}>
                              {money(asset.current_value, asset.currency)}
                            </strong>
                            <small
                              style={{
                                display: 'block',
                                color: asset.profit >= 0 ? '#22c55e' : '#f43f5e',
                                fontWeight: 600,
                              }}
                            >
                              {asset.profit >= 0 ? '+' : ''}
                              {money(asset.profit, asset.currency)} ({asset.profitPercentage.toFixed(1)}%)
                            </small>
                          </div>
                        </div>

                        {/* Extra Badges Row */}
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: '0.8rem' }}>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: 6,
                              background: `${typeConfig.color}15`,
                              color: typeConfig.color,
                              fontWeight: 600,
                            }}
                          >
                            {t(`wealth.types.${asset.type}`)}
                          </span>
                          {asset.profit_rate && (
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: 6,
                                background: '#22c55e15',
                                color: '#22c55e',
                                fontWeight: 600,
                              }}
                            >
                              {asset.profit_rate}% {t('wealth.pa')}
                            </span>
                          )}
                          {asset.daysToMaturity !== null && (
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: 6,
                                background: asset.isMatured ? '#f43f5e15' : '#f59e0b15',
                                color: asset.isMatured ? '#f43f5e' : '#f59e0b',
                                fontWeight: 600,
                              }}
                            >
                              {asset.isMatured
                                ? t('wealth.matured')
                                : t('wealth.maturesInDays', { count: asset.daysToMaturity })}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div
                  className="surface-card compact-empty"
                  style={{
                    padding: 32,
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: 48, color: 'var(--app-muted)' }}>
                    trending_up
                  </span>
                  <div>
                    <strong style={{ fontSize: '1.1rem' }}>{t('wealth.noAssetsTitle')}</strong>
                    <p style={{ margin: '4px 0 0', color: 'var(--app-muted)', fontSize: '0.9rem' }}>
                      {t('wealth.noAssetsDesc')}
                    </p>
                  </div>
                  <IonButton fill="solid" onClick={openAddAsset} style={{ marginTop: 8 }}>
                    {t('wealth.addAsset')}
                  </IonButton>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Net Worth Tab */}
              <div
                className="hero"
                style={{
                  background: 'linear-gradient(135deg, #0d9488 0%, #0284c7 100%)',
                  marginBottom: 16,
                }}
              >
                <span className="hero-label">{t('home.netWorth')}</span>
                <div className="hero-balance">{money(netWorthCalculated)}</div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: 12,
                    paddingTop: 10,
                    borderTop: '1px solid rgba(255,255,255,0.15)',
                    fontSize: '0.85rem',
                  }}
                >
                  <div>
                    <span style={{ opacity: 0.8 }}>{t('wealth.totalAssets')}: </span>
                    <strong>{money(totalAssetsSum)}</strong>
                  </div>
                  <div>
                    <span style={{ opacity: 0.8 }}>{t('wealth.totalLiabilities')}: </span>
                    <strong>{money(totalLiabilitiesSum)}</strong>
                  </div>
                </div>
              </div>

              {/* Time Range Filter */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: 8,
                  marginBottom: 16,
                }}
              >
                {[7, 30, 90, 365].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setNetWorthDays(d)}
                    style={{
                      padding: '6px 16px',
                      borderRadius: 16,
                      border: '1px solid var(--app-border)',
                      background: netWorthDays === d ? 'var(--app-primary)' : 'var(--app-card)',
                      color: netWorthDays === d ? '#fff' : 'var(--app-text)',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                    }}
                  >
                    {d === 365 ? '1Y' : `${d}D`}
                  </button>
                ))}
              </div>

              {/* Net Worth Chart */}
              <div className="surface-card" style={{ padding: 16, marginBottom: 16 }}>
                <h3 style={{ margin: '0 0 12px', fontSize: '1rem', fontWeight: 600 }}>
                  {t('wealth.netWorthOverTime')}
                </h3>
                {renderNetWorthChart(netWorthPoints)}
              </div>

              {/* Breakdown Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div
                  className="surface-card"
                  style={{
                    padding: 14,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="material-symbols-rounded" style={{ color: '#14b8a6' }}>
                      account_balance_wallet
                    </span>
                    <span>{t('wealth.cashAndBank')}</span>
                  </div>
                  <b>{money(totalBalance)}</b>
                </div>

                <div
                  className="surface-card"
                  style={{
                    padding: 14,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="material-symbols-rounded" style={{ color: '#0ea5e9' }}>
                      handshake
                    </span>
                    <span>{t('home.receivable')}</span>
                  </div>
                  <b>{money(receivable)}</b>
                </div>

                <div
                  className="surface-card"
                  style={{
                    padding: 14,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="material-symbols-rounded" style={{ color: '#6366f1' }}>
                      trending_up
                    </span>
                    <span>{t('wealth.investmentsLabel')}</span>
                  </div>
                  <b>{money(wealthSummary?.currentValue ?? 0)}</b>
                </div>

                <div
                  className="surface-card"
                  style={{
                    padding: 14,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="material-symbols-rounded" style={{ color: '#f59e0b' }}>
                      request_quote
                    </span>
                    <span>{t('home.payable')}</span>
                  </div>
                  <b style={{ color: '#f43f5e' }}>−{money(payable)}</b>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Add / Edit Asset Modal */}
        <IonModal isOpen={showAddModal} onDidDismiss={() => setShowAddModal(false)}>
          <IonHeader>
            <IonToolbar>
              <IonButton slot="start" fill="clear" onClick={() => setShowAddModal(false)}>
                {t('common.cancel')}
              </IonButton>
              <IonTitle>{editingAsset ? t('wealth.editAsset') : t('wealth.addAsset')}</IonTitle>
              <IonButton slot="end" fill="solid" onClick={(e) => void handleSaveAsset(e)}>
                {t('common.save')}
              </IonButton>
            </IonToolbar>
          </IonHeader>
          <IonContent className="shell-content">
            <form onSubmit={(e) => void handleSaveAsset(e)} className="page-pad">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <label>
                  {t('wealth.assetType')}
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as AssetType)}
                    style={{
                      width: '100%',
                      marginTop: 4,
                      padding: 12,
                      borderRadius: 12,
                      border: '1px solid var(--app-border)',
                      background: 'var(--app-card)',
                      color: 'var(--app-text)',
                    }}
                  >
                    {ASSET_TYPES.map((tConfig) => (
                      <option key={tConfig.type} value={tConfig.type}>
                        {t(`wealth.types.${tConfig.type}`)}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  {t('wealth.assetName')}
                  <input
                    type="text"
                    required
                    placeholder="e.g. EBL 5-Year FDR"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    style={{
                      width: '100%',
                      marginTop: 4,
                      padding: 12,
                      borderRadius: 12,
                      border: '1px solid var(--app-border)',
                      background: 'var(--app-card)',
                      color: 'var(--app-text)',
                    }}
                  />
                </label>

                <label>
                  {t('wealth.institution')}
                  <input
                    type="text"
                    placeholder="e.g. Eastern Bank PLC"
                    value={formInstitution}
                    onChange={(e) => setFormInstitution(e.target.value)}
                    style={{
                      width: '100%',
                      marginTop: 4,
                      padding: 12,
                      borderRadius: 12,
                      border: '1px solid var(--app-border)',
                      background: 'var(--app-card)',
                      color: 'var(--app-text)',
                    }}
                  />
                </label>

                <div style={{ display: 'flex', gap: 12 }}>
                  <label style={{ flex: 1 }}>
                    {t('wealth.principalAmount')}
                    <input
                      type="text"
                      required
                      placeholder="100000"
                      value={formPrincipal}
                      onChange={(e) => setFormPrincipal(e.target.value)}
                      style={{
                        width: '100%',
                        marginTop: 4,
                        padding: 12,
                        borderRadius: 12,
                        border: '1px solid var(--app-border)',
                        background: 'var(--app-card)',
                        color: 'var(--app-text)',
                      }}
                    />
                  </label>
                  <label style={{ flex: 1 }}>
                    {t('wealth.currentValuation')}
                    <input
                      type="text"
                      placeholder="110000"
                      value={formCurrentValue}
                      onChange={(e) => setFormCurrentValue(e.target.value)}
                      style={{
                        width: '100%',
                        marginTop: 4,
                        padding: 12,
                        borderRadius: 12,
                        border: '1px solid var(--app-border)',
                        background: 'var(--app-card)',
                        color: 'var(--app-text)',
                      }}
                    />
                  </label>
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                  <label style={{ flex: 1 }}>
                    {t('wealth.profitRate')} (%)
                    <input
                      type="number"
                      step="0.01"
                      placeholder="11.5"
                      value={formProfitRate}
                      onChange={(e) => setFormProfitRate(e.target.value)}
                      style={{
                        width: '100%',
                        marginTop: 4,
                        padding: 12,
                        borderRadius: 12,
                        border: '1px solid var(--app-border)',
                        background: 'var(--app-card)',
                        color: 'var(--app-text)',
                      }}
                    />
                  </label>
                  <label style={{ flex: 1 }}>
                    {t('wealth.unitQty')}
                    <input
                      type="text"
                      placeholder="e.g. 11.66g / 100 shares"
                      value={formUnit}
                      onChange={(e) => setFormUnit(e.target.value)}
                      style={{
                        width: '100%',
                        marginTop: 4,
                        padding: 12,
                        borderRadius: 12,
                        border: '1px solid var(--app-border)',
                        background: 'var(--app-card)',
                        color: 'var(--app-text)',
                      }}
                    />
                  </label>
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                  <label style={{ flex: 1 }}>
                    {t('wealth.startDate')}
                    <input
                      type="date"
                      required
                      value={formStartDate}
                      onChange={(e) => setFormStartDate(e.target.value)}
                      style={{
                        width: '100%',
                        marginTop: 4,
                        padding: 12,
                        borderRadius: 12,
                        border: '1px solid var(--app-border)',
                        background: 'var(--app-card)',
                        color: 'var(--app-text)',
                      }}
                    />
                  </label>
                  <label style={{ flex: 1 }}>
                    {t('wealth.maturityDate')}
                    <input
                      type="date"
                      value={formMaturityDate}
                      onChange={(e) => setFormMaturityDate(e.target.value)}
                      style={{
                        width: '100%',
                        marginTop: 4,
                        padding: 12,
                        borderRadius: 12,
                        border: '1px solid var(--app-border)',
                        background: 'var(--app-card)',
                        color: 'var(--app-text)',
                      }}
                    />
                  </label>
                </div>

                {!editingAsset && (
                  <label>
                    {t('wealth.fundingAccount')} ({t('wealth.optionalDebit')})
                    <select
                      value={formFundingAccount}
                      onChange={(e) => setFormFundingAccount(e.target.value)}
                      style={{
                        width: '100%',
                        marginTop: 4,
                        padding: 12,
                        borderRadius: 12,
                        border: '1px solid var(--app-border)',
                        background: 'var(--app-card)',
                        color: 'var(--app-text)',
                      }}
                    >
                      <option value="">{t('wealth.noAccountMovement')}</option>
                      {accounts
                        .filter((a) => !a.is_archived)
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name} ({money(a.opening_balance, a.currency)})
                          </option>
                        ))}
                    </select>
                  </label>
                )}

                <label>
                  {t('wealth.note')}
                  <textarea
                    rows={2}
                    placeholder={t('wealth.notePlaceholder')}
                    value={formNote}
                    onChange={(e) => setFormNote(e.target.value)}
                    style={{
                      width: '100%',
                      marginTop: 4,
                      padding: 12,
                      borderRadius: 12,
                      border: '1px solid var(--app-border)',
                      background: 'var(--app-card)',
                      color: 'var(--app-text)',
                    }}
                  />
                </label>
              </div>
            </form>
          </IonContent>
        </IonModal>

        {/* Asset Detail Modal */}
        <IonModal isOpen={selectedAsset !== null} onDidDismiss={() => setSelectedAsset(null)}>
          <IonHeader>
            <IonToolbar>
              <IonButton slot="start" fill="clear" onClick={() => setSelectedAsset(null)}>
                {t('common.close')}
              </IonButton>
              <IonTitle>{selectedAsset?.name}</IonTitle>
              {selectedAsset && (
                <IonButton
                  slot="end"
                  fill="clear"
                  onClick={() => {
                    openEditAsset(selectedAsset);
                  }}
                >
                  <span className="material-symbols-rounded">edit</span>
                </IonButton>
              )}
            </IonToolbar>
          </IonHeader>
          <IonContent className="shell-content">
            {selectedAsset && (
              <div className="page-pad">
                {/* Hero Stat Box */}
                <div
                  className="surface-card"
                  style={{
                    padding: 20,
                    borderRadius: 18,
                    textAlign: 'center',
                    marginBottom: 16,
                  }}
                >
                  <span style={{ fontSize: '0.85rem', color: 'var(--app-muted)' }}>
                    {t('wealth.currentValuation')}
                  </span>
                  <h2 style={{ fontSize: '2rem', margin: '4px 0 8px', fontWeight: 800 }}>
                    {money(selectedAsset.current_value, selectedAsset.currency)}
                  </h2>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'center',
                      gap: 16,
                      fontSize: '0.9rem',
                    }}
                  >
                    <span>
                      {t('wealth.principalInvested')}:{' '}
                      <strong>{money(selectedAsset.principal, selectedAsset.currency)}</strong>
                    </span>
                    <span
                      style={{
                        color: selectedAsset.profit >= 0 ? '#22c55e' : '#f43f5e',
                        fontWeight: 700,
                      }}
                    >
                      {selectedAsset.profit >= 0 ? '+' : ''}
                      {money(selectedAsset.profit, selectedAsset.currency)} ({selectedAsset.profitPercentage.toFixed(1)}%)
                    </span>
                  </div>

                  <IonButton
                    fill="outline"
                    onClick={() => {
                      setValAmount(minorToInput(selectedAsset.current_value, selectedAsset.currency));
                      setValDate(new Date().toISOString().slice(0, 10));
                      setShowValuationModal(true);
                    }}
                    style={{ marginTop: 14 }}
                  >
                    <span className="material-symbols-rounded" slot="start">
                      update
                    </span>
                    {t('wealth.updateValuation')}
                  </IonButton>
                </div>

                {/* Valuation History Chart */}
                <div className="surface-card" style={{ padding: 16, marginBottom: 16 }}>
                  <h3 style={{ margin: '0 0 12px', fontSize: '1rem', fontWeight: 600 }}>
                    {t('wealth.valuationHistory')}
                  </h3>
                  {loadingValuations ? (
                    <p>{t('common.loading')}</p>
                  ) : valuations.length > 1 ? (
                    renderSparkline(valuations)
                  ) : (
                    <p style={{ color: 'var(--app-muted)', fontSize: '0.85rem' }}>
                      {t('wealth.singleValuationNote')}
                    </p>
                  )}

                  {/* Valuation list */}
                  <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {valuations
                      .slice()
                      .reverse()
                      .map((v) => (
                        <div
                          key={v.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '6px 0',
                            fontSize: '0.85rem',
                            borderBottom: '1px solid var(--app-border)',
                          }}
                        >
                          <span style={{ color: 'var(--app-muted)' }}>
                            {new Date(v.date).toLocaleDateString(
                              i18n.language === 'bn' ? 'bn-BD' : 'en-GB',
                              { day: 'numeric', month: 'short', year: 'numeric' },
                            )}
                          </span>
                          <strong>{money(v.value, selectedAsset.currency)}</strong>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Details Breakdown */}
                <div className="surface-card" style={{ padding: 16, marginBottom: 16 }}>
                  <h3 style={{ margin: '0 0 12px', fontSize: '1rem', fontWeight: 600 }}>
                    {t('wealth.assetDetails')}
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.9rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--app-muted)' }}>{t('wealth.assetType')}</span>
                      <strong>{t(`wealth.types.${selectedAsset.type}`)}</strong>
                    </div>
                    {selectedAsset.institution && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--app-muted)' }}>{t('wealth.institution')}</span>
                        <strong>{selectedAsset.institution}</strong>
                      </div>
                    )}
                    {selectedAsset.profit_rate && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--app-muted)' }}>{t('wealth.profitRate')}</span>
                        <strong style={{ color: '#22c55e' }}>{selectedAsset.profit_rate}% p.a.</strong>
                      </div>
                    )}
                    {selectedAsset.unit && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--app-muted)' }}>{t('wealth.unitQty')}</span>
                        <strong>{selectedAsset.unit}</strong>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--app-muted)' }}>{t('wealth.startDate')}</span>
                      <strong>
                        {new Date(selectedAsset.start_date).toLocaleDateString(
                          i18n.language === 'bn' ? 'bn-BD' : 'en-GB',
                          { day: 'numeric', month: 'short', year: 'numeric' },
                        )}
                      </strong>
                    </div>
                    {selectedAsset.maturity_date && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--app-muted)' }}>{t('wealth.maturityDate')}</span>
                        <strong>
                          {new Date(selectedAsset.maturity_date).toLocaleDateString(
                            i18n.language === 'bn' ? 'bn-BD' : 'en-GB',
                            { day: 'numeric', month: 'short', year: 'numeric' },
                          )}
                        </strong>
                      </div>
                    )}
                    {selectedAsset.note && (
                      <div style={{ marginTop: 4 }}>
                        <span style={{ color: 'var(--app-muted)', display: 'block', marginBottom: 2 }}>
                          {t('wealth.note')}
                        </span>
                        <p style={{ margin: 0 }}>{selectedAsset.note}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Delete Button */}
                <IonButton
                  fill="clear"
                  color="danger"
                  expand="block"
                  onClick={() => void handleDeleteAsset(selectedAsset)}
                >
                  <span className="material-symbols-rounded" slot="start">
                    delete
                  </span>
                  {t('wealth.deleteAsset')}
                </IonButton>
              </div>
            )}
          </IonContent>
        </IonModal>

        {/* Update Valuation Dialog */}
        <IonModal isOpen={showValuationModal} onDidDismiss={() => setShowValuationModal(false)}>
          <IonHeader>
            <IonToolbar>
              <IonButton slot="start" fill="clear" onClick={() => setShowValuationModal(false)}>
                {t('common.cancel')}
              </IonButton>
              <IonTitle>{t('wealth.updateValuation')}</IonTitle>
              <IonButton slot="end" fill="solid" onClick={(e) => void handleRecordValuation(e)}>
                {t('common.save')}
              </IonButton>
            </IonToolbar>
          </IonHeader>
          <IonContent className="shell-content">
            <form onSubmit={(e) => void handleRecordValuation(e)} className="page-pad">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <label>
                  {t('wealth.newValuation')} ({selectedAsset?.currency})
                  <input
                    type="text"
                    required
                    placeholder="120000"
                    value={valAmount}
                    onChange={(e) => setValAmount(e.target.value)}
                    style={{
                      width: '100%',
                      marginTop: 4,
                      padding: 12,
                      borderRadius: 12,
                      border: '1px solid var(--app-border)',
                      background: 'var(--app-card)',
                      color: 'var(--app-text)',
                    }}
                  />
                </label>
                <label>
                  {t('wealth.valuationDate')}
                  <input
                    type="date"
                    required
                    value={valDate}
                    onChange={(e) => setValDate(e.target.value)}
                    style={{
                      width: '100%',
                      marginTop: 4,
                      padding: 12,
                      borderRadius: 12,
                      border: '1px solid var(--app-border)',
                      background: 'var(--app-card)',
                      color: 'var(--app-text)',
                    }}
                  />
                </label>
              </div>
            </form>
          </IonContent>
        </IonModal>

        {/* Exchange Rates Modal */}
        <IonModal isOpen={showRatesModal} onDidDismiss={() => setShowRatesModal(false)}>
          <IonHeader>
            <IonToolbar>
              <IonButton slot="start" fill="clear" onClick={() => setShowRatesModal(false)}>
                {t('common.close')}
              </IonButton>
              <IonTitle>{t('wealth.exchangeRatesTitle')}</IonTitle>
              <IonButton
                slot="end"
                fill="clear"
                onClick={() => setShowAddRateModal(true)}
              >
                <span className="material-symbols-rounded">add</span>
              </IonButton>
            </IonToolbar>
          </IonHeader>
          <IonContent className="shell-content">
            <div className="page-pad">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
                    {t('wealth.activeRates')}
                  </h3>
                  <small style={{ color: 'var(--app-muted)' }}>
                    {t('wealth.baseCurrency')}: {currency}
                  </small>
                </div>
                <IonButton
                  fill="outline"
                  size="small"
                  onClick={() => void handleFetchRates()}
                  disabled={refreshingRates}
                >
                  <span className="material-symbols-rounded" slot="start">
                    sync
                  </span>
                  {refreshingRates ? t('common.loading') : t('wealth.refreshServerRates')}
                </IonButton>
              </div>

              {exchangeRates.length > 0 ? (
                <div className="surface-card" style={{ padding: 12 }}>
                  {exchangeRates.map((r) => (
                    <div
                      key={r.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 0',
                        borderBottom: '1px solid var(--app-border)',
                      }}
                    >
                      <div>
                        <strong>1 {r.base} = {r.rate} {r.quote}</strong>
                        <small style={{ display: 'block', color: 'var(--app-muted)', fontSize: '0.75rem' }}>
                          {r.source === 'server' ? t('wealth.serverRate') : t('wealth.manualRate')} •{' '}
                          {new Date(r.date).toLocaleDateString()}
                        </small>
                      </div>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          padding: '2px 8px',
                          borderRadius: 6,
                          background: r.source === 'server' ? '#0ea5e920' : '#8b5cf620',
                          color: r.source === 'server' ? '#0ea5e9' : '#8b5cf6',
                          fontWeight: 600,
                        }}
                      >
                        {r.source}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="surface-card compact-empty" style={{ padding: 24, textAlign: 'center' }}>
                  <p>{t('wealth.noRatesYet')}</p>
                  <IonButton fill="solid" onClick={() => void handleFetchRates()} style={{ marginTop: 8 }}>
                    {t('wealth.fetchBenchmarkRates')}
                  </IonButton>
                </div>
              )}
            </div>
          </IonContent>
        </IonModal>

        {/* Add Custom Rate Modal */}
        <IonModal isOpen={showAddRateModal} onDidDismiss={() => setShowAddRateModal(false)}>
          <IonHeader>
            <IonToolbar>
              <IonButton slot="start" fill="clear" onClick={() => setShowAddRateModal(false)}>
                {t('common.cancel')}
              </IonButton>
              <IonTitle>{t('wealth.addCustomRate')}</IonTitle>
              <IonButton slot="end" fill="solid" onClick={(e) => void handleSaveCustomRate(e)}>
                {t('common.save')}
              </IonButton>
            </IonToolbar>
          </IonHeader>
          <IonContent className="shell-content">
            <form onSubmit={(e) => void handleSaveCustomRate(e)} className="page-pad">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', gap: 12 }}>
                  <label style={{ flex: 1 }}>
                    {t('wealth.baseCurrency')}
                    <input
                      type="text"
                      maxLength={3}
                      required
                      placeholder="USD"
                      value={rateBase}
                      onChange={(e) => setRateBase(e.target.value.toUpperCase())}
                      style={{
                        width: '100%',
                        marginTop: 4,
                        padding: 12,
                        borderRadius: 12,
                        border: '1px solid var(--app-border)',
                        background: 'var(--app-card)',
                        color: 'var(--app-text)',
                      }}
                    />
                  </label>
                  <label style={{ flex: 1 }}>
                    {t('wealth.quoteCurrency')}
                    <input
                      type="text"
                      maxLength={3}
                      required
                      placeholder="BDT"
                      value={rateQuote}
                      onChange={(e) => setRateQuote(e.target.value.toUpperCase())}
                      style={{
                        width: '100%',
                        marginTop: 4,
                        padding: 12,
                        borderRadius: 12,
                        border: '1px solid var(--app-border)',
                        background: 'var(--app-card)',
                        color: 'var(--app-text)',
                      }}
                    />
                  </label>
                </div>
                <label>
                  {t('wealth.rateValue')} (e.g. 1 USD = 121.50 BDT)
                  <input
                    type="number"
                    step="0.000001"
                    required
                    placeholder="121.50"
                    value={rateValue}
                    onChange={(e) => setRateValue(e.target.value)}
                    style={{
                      width: '100%',
                      marginTop: 4,
                      padding: 12,
                      borderRadius: 12,
                      border: '1px solid var(--app-border)',
                      background: 'var(--app-card)',
                      color: 'var(--app-text)',
                    }}
                  />
                </label>
              </div>
            </form>
          </IonContent>
        </IonModal>
      </IonContent>
    </IonPage>
  );
}
export default AssetsScreen;
