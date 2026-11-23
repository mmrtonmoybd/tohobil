import { useState, useEffect, useMemo } from 'react';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Haptics, NotificationType } from '@capacitor/haptics';
import { useMoney } from '../money/store';
import { getBalances } from '../../db/repository';
import { convertMinor } from '../../lib/currency';
import { estimateZakat, quoteDps, quoteFdr, quoteLoan } from '../../lib/financeTools';
import { formatMinor, minorToInput, parseMinor } from '../../lib/money';

export function ToolsScreen({
  onToast,
}: {
  onToast: (msg: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const bookId = useMoney((s) => s.bookId);
  const books = useMoney((s) => s.books);
  const accounts = useMoney((s) => s.accounts);
  const wealthSummary = useMoney((s) => s.wealthSummary);
  const exchangeRates = useMoney((s) => s.exchangeRates);

  const activeBook = books.find((b) => b.id === bookId);
  const currency = activeBook?.currency ?? 'BDT';

  const [activeTab, setActiveTab] = useState<'zakat' | 'loan' | 'fdr_dps' | 'converter' | null>(null);

  // --- 1. Zakat Calculator State ---
  const [zakatNisabStandard, setZakatNisabStandard] = useState<'silver' | 'gold'>('silver');
  const goldGrams = '87.48'; // 7.5 tola/bhori
  const silverGrams = '612.36'; // 52.5 tola/bhori
  const [pricePerGram, setPricePerGram] = useState('110'); // ~110 BDT/g silver, ~11,000 BDT/g gold
  const [zakatCash, setZakatCash] = useState('0');
  const [zakatBank, setZakatBank] = useState('0');
  const [zakatReceivables, setZakatReceivables] = useState('0');
  const [zakatGoldAssets, setZakatGoldAssets] = useState('0');
  const [zakatOtherAssets, setZakatOtherAssets] = useState('0');
  const [zakatLiabilities, setZakatLiabilities] = useState('0');

  // Auto-fill Zakat from active Tohobil book
  const handleAutoFillZakat = async () => {
    if (!bookId) return;
    try {
      const balances = await getBalances(bookId);
      const balMap = new Map(balances.map((b) => [b.account_id, b.balance]));
      const cashAccs = accounts.filter((a) => a.type === 'cash');
      const bankAccs = accounts.filter((a) => a.type === 'bank' || a.type === 'mobile_wallet' || a.type === 'card');

      const bookCurrency = books.find((book) => book.id === bookId)?.currency ?? 'BDT';
      const sumCurrency = (list: typeof accounts) =>
        list
          .filter((account) => account.currency === bookCurrency)
          .reduce((sum, account) => sum + (balMap.get(account.id) ?? account.opening_balance), 0);

      setZakatCash(minorToInput(Math.max(0, sumCurrency(cashAccs)), bookCurrency));
      setZakatBank(minorToInput(Math.max(0, sumCurrency(bankAccs)), bookCurrency));

      if (wealthSummary) {
        const goldVal = wealthSummary.byType.gold?.totalValue ?? 0;
        const sharesVal = (wealthSummary.byType.shares?.totalValue ?? 0) + (wealthSummary.byType.fdr?.totalValue ?? 0);
        setZakatGoldAssets(minorToInput(Math.max(0, goldVal), bookCurrency));
        setZakatOtherAssets(minorToInput(Math.max(0, sharesVal), bookCurrency));
      }

      void Haptics.notification({ type: NotificationType.Success }).catch(() => {});
      onToast(t('tools.zakatAutofilled'));
    } catch {
      onToast(t('common.error'));
    }
  };

  const zakat = estimateZakat({
    currency,
    standard: zakatNisabStandard,
    goldGrams,
    silverGrams,
    pricePerGram,
    cash: zakatCash,
    bank: zakatBank,
    receivables: zakatReceivables,
    goldAssets: zakatGoldAssets,
    otherAssets: zakatOtherAssets,
    liabilities: zakatLiabilities,
  });
  const zakatThreshold = zakat.thresholdMinor;
  const netZakatable = zakat.netMinor;
  const isZakatObligatory = zakat.obligatory;
  const zakatDue = zakat.dueMinor;

  // --- 2. Loan / EMI Calculator State ---
  const [loanPrincipal, setLoanPrincipal] = useState('500000');
  const [loanInterestRate, setLoanInterestRate] = useState('9.0'); // % per year
  const [loanTenureYears, setLoanTenureYears] = useState('3');
  const [loanTenureMonths, setLoanTenureMonths] = useState('0');

  const nVal = (parseInt(loanTenureYears, 10) || 0) * 12 + (parseInt(loanTenureMonths, 10) || 0);
  const loan = quoteLoan(loanPrincipal, loanInterestRate, nVal, currency);
  const monthlyEmi = loan.emiMinor;
  const totalLoanPayment = loan.totalMinor;
  const totalLoanInterest = loan.interestMinor;

  // --- 3. FDR & DPS Maturity Calculator State ---
  const [investmentCalcMode, setInvestmentCalcMode] = useState<'fdr' | 'dps'>('fdr');
  const [fdrPrincipal, setFdrPrincipal] = useState('100000');
  const [fdrRate, setFdrRate] = useState('8.5');
  const [fdrTenureMonths, setFdrTenureMonths] = useState('12');
  const [fdrTaxRate, setFdrTaxRate] = useState('10'); // 10% with TIN, 15% without

  const fdrMonths = parseInt(fdrTenureMonths, 10) || 0;
  const fdr = quoteFdr(fdrPrincipal, fdrRate, fdrMonths, fdrTaxRate, currency);
  const fdrGrossProfit = fdr.grossProfitMinor;
  const fdrTax = fdr.taxMinor;
  const fdrNetPayout = fdr.netPayoutMinor;

  const [dpsMonthly, setDpsMonthly] = useState('5000');
  const [dpsRate, setDpsRate] = useState('9.0');
  const [dpsTenureYears, setDpsTenureYears] = useState('5');
  const [dpsTaxRate, setDpsTaxRate] = useState('10');

  const dps = quoteDps(dpsMonthly, dpsRate, parseInt(dpsTenureYears, 10) || 0, dpsTaxRate, currency);
  const dpsTotalDeposit = dps.totalDepositMinor;
  const dpsInterest = dps.grossProfitMinor;
  const dpsNetPayout = dps.netPayoutMinor;

  // --- 4. Currency Converter State ---
  const [convAmount, setConvAmount] = useState('100');
  const [convBase, setConvBase] = useState('USD');
  const [convQuote, setConvQuote] = useState('BDT');
  const [convCustomRate, setConvCustomRate] = useState('121.50');

  // Look up rate when base or quote changes
  useEffect(() => {
    const direct = exchangeRates.find((r) => r.base === convBase && r.quote === convQuote);
    if (direct && direct.rate > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setConvCustomRate(direct.rate.toString());
      return;
    }
    const inv = exchangeRates.find((r) => r.base === convQuote && r.quote === convBase);
    if (inv && inv.rate > 0) {
      setConvCustomRate((1 / inv.rate).toFixed(4));
    }
  }, [convBase, convQuote, exchangeRates]);

  const convertedResult = useMemo(() => {
    try {
      const rate = Number(convCustomRate);
      if (!(rate > 0)) return null;
      return convertMinor(parseMinor(convAmount, convBase), convBase, convQuote, rate);
    } catch {
      return null;
    }
  }, [convAmount, convBase, convQuote, convCustomRate]);

  const handleSwapCurrencies = () => {
    const prevBase = convBase;
    const prevQuote = convQuote;
    setConvBase(prevQuote);
    setConvQuote(prevBase);
    const rate = parseFloat(convCustomRate) || 0;
    if (rate > 0) {
      setConvCustomRate((1 / rate).toFixed(4));
    }
  };

  const toolTitle =
    activeTab === 'zakat' ? t('tools.zakat')
    : activeTab === 'loan' ? t('tools.loanEmi')
    : activeTab === 'fdr_dps' ? t('tools.fdrDps')
    : activeTab === 'converter' ? t('tools.converter')
    : t('more.tools');

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButton
            fill="clear"
            slot="start"
            aria-label={t('a11y.back')}
            onClick={() => (activeTab ? setActiveTab(null) : navigate('/tabs/more'))}
          >
            <span className="material-symbols-rounded">arrow_back</span>
          </IonButton>
          <IonTitle>{toolTitle}</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="shell-content">
        <div className="page-pad">
          {activeTab === null && (
            <div className="tool-menu">
              <p className="tool-help">{t('tools.pickTitle')}</p>
              {([
                ['zakat', 'calculate', '#10b981', 'tools.zakat', 'tools.zakatBlurb'],
                ['loan', 'account_balance_wallet', '#6366f1', 'tools.loanEmi', 'tools.loanBlurb'],
                ['fdr_dps', 'trending_up', '#0ea5e9', 'tools.fdrDps', 'tools.savingsBlurb'],
                ['converter', 'currency_exchange', '#8b5cf6', 'tools.converter', 'tools.currencyBlurb'],
              ] as const).map(([id, icon, color, label, blurb]) => (
                <button key={id} type="button" className="tool-choice" onClick={() => setActiveTab(id)}>
                  <span className="tile-icon" style={{ background: `${color}20`, color }}>
                    <span className="material-symbols-rounded">{icon}</span>
                  </span>
                  <span>
                    <strong>{t(label)}</strong>
                    {t(blurb)}
                  </span>
                </button>
              ))}
            </div>
          )}
          {/* ==================== 1. ZAKAT CALCULATOR ==================== */}
          {activeTab === 'zakat' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div
                className="surface-card"
                style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#fff',
                  borderRadius: 20,
                  padding: 20,
                  boxShadow: '0 8px 24px rgba(16, 185, 129, 0.25)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontSize: '0.85rem', opacity: 0.9 }}>{t('tools.zakatDue')}</span>
                    <h1 style={{ margin: '4px 0 0', fontSize: '2rem', fontWeight: 800, overflowWrap: 'anywhere' }}>
                      {formatMinor(zakatDue, currency, i18n.language)}
                    </h1>
                  </div>
                  <span
                    style={{
                      background: isZakatObligatory ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
                      padding: '4px 10px',
                      borderRadius: 12,
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      flex: '0 0 auto',
                    }}
                  >
                    {isZakatObligatory ? t('tools.nisabMet') : t('tools.belowNisab')}
                  </span>
                </div>
                <p style={{ margin: '10px 0 0', fontSize: '0.9rem', lineHeight: 1.4 }}>
                  {isZakatObligatory ? t('tools.zakatDueHelp') : t('tools.zakatBelowHelp')}
                </p>
                <div className="tool-result-meta">
                  <div>
                    <span style={{ opacity: 0.8 }}>{t('tools.netZakatable')}</span>
                    <strong style={{ display: 'block' }}>{formatMinor(netZakatable, currency, i18n.language)}</strong>
                  </div>
                  <div>
                    <span style={{ opacity: 0.8 }}>{t('tools.nisabThreshold')}</span>
                    <strong style={{ display: 'block' }}>{formatMinor(zakatThreshold, currency, i18n.language)}</strong>
                  </div>
                </div>
              </div>

              {/* Autofill Button */}
              <button
                type="button"
                className="secondary-button"
                onClick={() => void handleAutoFillZakat()}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 16px' }}
              >
                <span className="material-symbols-rounded">auto_fix_high</span>
                {t('tools.autoFillFromTohobil')}
              </button>

              <details className="surface-card tool-details">
                <summary>{t('tools.nisabSettings')}</summary>
                <div className="form-stack">
                  <p className="tool-help">{t('tools.nisabExplain')}</p>
                  <label className="field-label">
                    {t('tools.standard')}
                    <select
                      className="text-input"
                      value={zakatNisabStandard}
                      onChange={(e) => {
                        const std = e.target.value as 'silver' | 'gold';
                        setZakatNisabStandard(std);
                        setPricePerGram(std === 'gold' ? '11000' : '110');
                      }}
                    >
                      <option value="silver">{t('tools.silverNisab')}</option>
                      <option value="gold">{t('tools.goldNisab')}</option>
                    </select>
                  </label>
                  <label className="field-label">
                    {t('tools.pricePerGram')} ({currency})
                    <input
                      className="text-input"
                      inputMode="decimal"
                      value={pricePerGram}
                      onChange={(e) => setPricePerGram(e.target.value)}
                    />
                  </label>
                </div>
              </details>

              <div className="surface-card" style={{ padding: 16, borderRadius: 16 }}>
                <h3 style={{ margin: '0 0 12px', fontSize: '1rem', fontWeight: 700 }}>{t('tools.zakatableAssets')}</h3>
                <div className="form-stack">
                  <label className="field-label">
                    {t('tools.cashInHand')}
                    <input className="text-input" inputMode="decimal" value={zakatCash} onChange={(e) => setZakatCash(e.target.value)} />
                  </label>
                  <label className="field-label">
                    {t('tools.bankBalances')}
                    <input className="text-input" inputMode="decimal" value={zakatBank} onChange={(e) => setZakatBank(e.target.value)} />
                  </label>
                  <label className="field-label">
                    {t('tools.receivables')}
                    <input className="text-input" inputMode="decimal" value={zakatReceivables} onChange={(e) => setZakatReceivables(e.target.value)} />
                  </label>
                  <label className="field-label">
                    {t('tools.goldSilverValue')}
                    <input className="text-input" inputMode="decimal" value={zakatGoldAssets} onChange={(e) => setZakatGoldAssets(e.target.value)} />
                  </label>
                  <label className="field-label">
                    {t('tools.otherLiquidAssets')}
                    <input className="text-input" inputMode="decimal" value={zakatOtherAssets} onChange={(e) => setZakatOtherAssets(e.target.value)} />
                  </label>
                </div>
              </div>

              {/* Liabilities */}
              <div className="surface-card" style={{ padding: 16, borderRadius: 16 }}>
                <h3 style={{ margin: '0 0 12px', fontSize: '1rem', fontWeight: 700 }}>{t('tools.liabilities')}</h3>
                <label className="field-label">
                  {t('tools.immediateDebtsDue')}
                  <input className="text-input" inputMode="decimal" value={zakatLiabilities} onChange={(e) => setZakatLiabilities(e.target.value)} />
                </label>
              </div>

              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--app-muted)', textAlign: 'center', fontStyle: 'italic' }}>
                {t('tools.zakatDisclaimer')}
              </p>
            </div>
          )}

          {/* ==================== 2. LOAN / EMI CALCULATOR ==================== */}
          {activeTab === 'loan' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div
                className="surface-card"
                style={{
                  background: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
                  color: '#fff',
                  borderRadius: 20,
                  padding: 20,
                  boxShadow: '0 8px 24px rgba(99, 102, 241, 0.25)',
                }}
              >
                <span style={{ fontSize: '0.85rem', opacity: 0.9 }}>{t('tools.monthlyEmi')}</span>
                <h1 style={{ margin: '4px 0 0', fontSize: '2.2rem', fontWeight: 800 }}>
                  {formatMinor(monthlyEmi, currency, i18n.language)}
                </h1>
                <div className="tool-result-meta">
                  <div>
                    <span style={{ opacity: 0.8 }}>{t('tools.totalInterest')}</span>
                    <strong style={{ display: 'block' }}>{formatMinor(totalLoanInterest, currency, i18n.language)}</strong>
                  </div>
                  <div>
                    <span style={{ opacity: 0.8 }}>{t('tools.totalPayment')}</span>
                    <strong style={{ display: 'block' }}>{formatMinor(totalLoanPayment, currency, i18n.language)}</strong>
                  </div>
                </div>
              </div>

              {/* Inputs */}
              <div className="surface-card" style={{ padding: 16, borderRadius: 16 }}>
                <h3 style={{ margin: '0 0 12px', fontSize: '1rem', fontWeight: 700 }}>{t('tools.loanParameters')}</h3>
                <p className="tool-help">{t('tools.exampleNote')}</p>
                <div className="form-stack">
                  <label className="field-label">
                    {t('tools.loanAmount')} ({currency})
                    <input className="text-input" inputMode="decimal" value={loanPrincipal} onChange={(e) => setLoanPrincipal(e.target.value)} />
                  </label>
                  <label className="field-label">
                    {t('tools.interestRatePerYear')}
                    <input className="text-input" inputMode="decimal" value={loanInterestRate} onChange={(e) => setLoanInterestRate(e.target.value)} />
                  </label>
                  <label className="field-label">
                    {t('tools.tenureYears')}
                    <input className="text-input" inputMode="numeric" value={loanTenureYears} onChange={(e) => setLoanTenureYears(e.target.value)} />
                  </label>
                  <label className="field-label">
                    {t('tools.tenureMonths')}
                    <input className="text-input" inputMode="numeric" value={loanTenureMonths} onChange={(e) => setLoanTenureMonths(e.target.value)} />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* ==================== 3. FDR & DPS CALCULATOR ==================== */}
          {activeTab === 'fdr_dps' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="kind-tabs" style={{ marginBottom: 0 }}>
                <button
                  type="button"
                  className={`choice ${investmentCalcMode === 'fdr' ? 'selected' : ''}`}
                  onClick={() => setInvestmentCalcMode('fdr')}
                >
                  {t('tools.fdrCalculator')}
                </button>
                <button
                  type="button"
                  className={`choice ${investmentCalcMode === 'dps' ? 'selected' : ''}`}
                  onClick={() => setInvestmentCalcMode('dps')}
                >
                  {t('tools.dpsCalculator')}
                </button>
              </div>

              {investmentCalcMode === 'fdr' ? (
                <>
                  <div
                    className="surface-card"
                    style={{
                      background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
                      color: '#fff',
                      borderRadius: 20,
                      padding: 20,
                      boxShadow: '0 8px 24px rgba(14, 165, 233, 0.25)',
                    }}
                  >
                    <span style={{ fontSize: '0.85rem', opacity: 0.9 }}>{t('tools.fdrNetMaturity')}</span>
                    <h1 style={{ margin: '4px 0 0', fontSize: '2.2rem', fontWeight: 800 }}>
                      {formatMinor(fdrNetPayout, currency, i18n.language)}
                    </h1>
                    <div className="tool-result-meta">
                      <div>
                        <span style={{ opacity: 0.8 }}>{t('tools.grossProfit')}</span>
                        <strong style={{ display: 'block' }}>{formatMinor(fdrGrossProfit, currency, i18n.language)}</strong>
                      </div>
                      <div>
                        <span style={{ opacity: 0.8 }}>{t('tools.taxDeduction')} ({fdrTaxRate}%)</span>
                        <strong style={{ display: 'block' }}>{formatMinor(fdrTax, currency, i18n.language)}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="surface-card" style={{ padding: 16, borderRadius: 16 }}>
                    <p className="tool-help">{t('tools.exampleNote')}</p>
                    <div className="form-stack">
                      <label className="field-label">
                        {t('tools.depositAmount')} ({currency})
                        <input className="text-input" inputMode="decimal" value={fdrPrincipal} onChange={(e) => setFdrPrincipal(e.target.value)} />
                      </label>
                      <label className="field-label">
                        {t('tools.profitRate')}
                        <input className="text-input" inputMode="decimal" value={fdrRate} onChange={(e) => setFdrRate(e.target.value)} />
                      </label>
                      <label className="field-label">
                        {t('tools.tenureMonths')}
                        <input className="text-input" inputMode="numeric" value={fdrTenureMonths} onChange={(e) => setFdrTenureMonths(e.target.value)} />
                      </label>
                      <label className="field-label">
                        {t('tools.taxRate')}
                        <select className="text-input" value={fdrTaxRate} onChange={(e) => setFdrTaxRate(e.target.value)}>
                          <option value="10">{t('tools.taxWithTin')}</option>
                          <option value="15">{t('tools.taxWithoutTin')}</option>
                          <option value="0">{t('tools.taxExempt')}</option>
                        </select>
                      </label>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div
                    className="surface-card"
                    style={{
                      background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                      color: '#fff',
                      borderRadius: 20,
                      padding: 20,
                      boxShadow: '0 8px 24px rgba(245, 158, 11, 0.25)',
                    }}
                  >
                    <span style={{ fontSize: '0.85rem', opacity: 0.9 }}>{t('tools.dpsNetMaturity')}</span>
                    <h1 style={{ margin: '4px 0 0', fontSize: '2.2rem', fontWeight: 800 }}>
                      {formatMinor(dpsNetPayout, currency, i18n.language)}
                    </h1>
                    <div className="tool-result-meta">
                      <div>
                        <span style={{ opacity: 0.8 }}>{t('tools.totalDeposit')}</span>
                        <strong style={{ display: 'block' }}>{formatMinor(dpsTotalDeposit, currency, i18n.language)}</strong>
                      </div>
                      <div>
                        <span style={{ opacity: 0.8 }}>{t('tools.interestEarned')}</span>
                        <strong style={{ display: 'block' }}>{formatMinor(dpsInterest, currency, i18n.language)}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="surface-card" style={{ padding: 16, borderRadius: 16 }}>
                    <p className="tool-help">{t('tools.exampleNote')}</p>
                    <div className="form-stack">
                      <label className="field-label">
                        {t('tools.monthlyDeposit')} ({currency})
                        <input className="text-input" inputMode="decimal" value={dpsMonthly} onChange={(e) => setDpsMonthly(e.target.value)} />
                      </label>
                      <label className="field-label">
                        {t('tools.profitRate')}
                        <input className="text-input" inputMode="decimal" value={dpsRate} onChange={(e) => setDpsRate(e.target.value)} />
                      </label>
                      <label className="field-label">
                        {t('tools.tenureYears')}
                        <input className="text-input" inputMode="numeric" value={dpsTenureYears} onChange={(e) => setDpsTenureYears(e.target.value)} />
                      </label>
                      <label className="field-label">
                        {t('tools.taxRate')}
                        <select className="text-input" value={dpsTaxRate} onChange={(e) => setDpsTaxRate(e.target.value)}>
                          <option value="10">{t('tools.taxWithTin')}</option>
                          <option value="15">{t('tools.taxWithoutTin')}</option>
                          <option value="0">{t('tools.taxExempt')}</option>
                        </select>
                      </label>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ==================== 4. CURRENCY CONVERTER ==================== */}
          {activeTab === 'converter' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div
                className="surface-card"
                style={{
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
                  color: '#fff',
                  borderRadius: 20,
                  padding: 20,
                  boxShadow: '0 8px 24px rgba(139, 92, 246, 0.25)',
                }}
              >
                <span style={{ fontSize: '0.85rem', opacity: 0.9 }}>{convAmount || '0'} {convBase} =</span>
                <h1 style={{ margin: '4px 0 0', fontSize: '2.2rem', fontWeight: 800 }}>
                  {convertedResult === null ? '—' : formatMinor(convertedResult, convQuote, i18n.language)}
                </h1>
                <span style={{ marginTop: 8, display: 'inline-block', fontSize: '0.85rem', opacity: 0.8 }}>
                  1 {convBase} = {convCustomRate} {convQuote}
                </span>
              </div>

              {/* Conversion Controls */}
              <div className="surface-card" style={{ padding: 16, borderRadius: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <label className="field-label">
                    {t('tools.amount')}
                    <input className="text-input" inputMode="decimal" value={convAmount} onChange={(e) => setConvAmount(e.target.value)} />
                  </label>

                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <label className="field-label">
                        {t('tools.fromCurrency')}
                        <input
                          className="text-input"
                          type="text"
                          maxLength={3}
                          value={convBase}
                          onChange={(e) => setConvBase(e.target.value.toUpperCase())}
                        />
                      </label>
                    </div>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={handleSwapCurrencies}
                      aria-label={t('tools.swap')}
                    >
                      <span className="material-symbols-rounded">swap_horiz</span>
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <label className="field-label">
                        {t('tools.toCurrency')}
                        <input
                          className="text-input"
                          type="text"
                          maxLength={3}
                          value={convQuote}
                          onChange={(e) => setConvQuote(e.target.value.toUpperCase())}
                        />
                      </label>
                    </div>
                  </div>

                  <label className="field-label">
                    {t('wealth.exchangeRate')} (1 {convBase} = ? {convQuote})
                    <input
                      className="text-input"
                      inputMode="decimal"
                      value={convCustomRate}
                      onChange={(e) => setConvCustomRate(e.target.value)}
                    />
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
}
