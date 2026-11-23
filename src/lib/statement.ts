import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import type { TFunction } from 'i18next';
import type { DebtEntry, DebtView, Person } from '../db/types';
import { addMinor, formatMinor } from './money';
import bengaliFontUrl from '@fontsource/hind-siliguri/files/hind-siliguri-bengali-400-normal.woff2?url';

type Timeline = (DebtEntry & {
  direction: DebtView['direction'];
  account_name: string | null;
})[];
const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        char
      ]!,
  );
async function fontDataUrl(): Promise<string> {
  const blob = await (await fetch(bengaliFontUrl)).blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('FONT_LOAD_FAILED'));
    reader.readAsDataURL(blob);
  });
}
export function renderPersonStatementHtml(
  person: Person,
  debts: DebtView[],
  timeline: Timeline,
  currency: string,
  language: string,
  t: TFunction,
  fontUrl: string,
): string {
  const locale = language === 'bn' ? 'bn-BD' : 'en-GB';
  const money = (amount: number) => formatMinor(amount, currency, language);
  const date = (ms: number) =>
    new Date(ms).toLocaleDateString(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  const receivable = addMinor(
    ...debts
      .filter((x) => x.direction === 'receivable')
      .map((x) => x.outstanding),
  );
  const payable = addMinor(
    ...debts.filter((x) => x.direction === 'payable').map((x) => x.outstanding),
  );
  const rows = timeline
    .map(
      (event) =>
        `<tr><td>${escapeHtml(date(event.occurred_at))}</td><td>${escapeHtml(t(`debtFlow.events.${event.kind}`))}</td><td>${escapeHtml(event.account_name === 'cash' ? t('money.cashInHand') : (event.account_name ?? t('debtFlow.recordOnly')))}</td><td>${escapeHtml(event.note)}</td><td class="amount">${escapeHtml(money(event.amount))}</td></tr>`,
    )
    .join('');
  const debtRows = debts
    .map(
      (debt) =>
        `<tr><td>${escapeHtml(t(`debtFlow.${debt.direction}`))}</td><td>${escapeHtml(date(debt.date))}</td><td>${debt.due_date ? escapeHtml(date(debt.due_date)) : escapeHtml(t('debtFlow.noDueDate'))}</td><td class="amount">${escapeHtml(money(debt.outstanding))}</td></tr>`,
    )
    .join('');
  return `<!doctype html><html lang="${language === 'bn' ? 'bn' : 'en'}"><head><meta charset="utf-8"><style>
  @font-face{font-family:Hind;src:url('${fontUrl}') format('woff2');font-weight:400}
  @page{size:A4;margin:16mm}*{box-sizing:border-box}body{font-family:${language === 'bn' ? 'Hind,system-ui' : 'system-ui,Hind'},sans-serif;color:#0f172a;font-size:12px}h1{font-size:24px;color:#0d9488;margin:0 0 4px}h2{font-size:18px;margin:22px 0 8px}.muted{color:#64748b}.brand{border-bottom:3px solid #14b8a6;padding-bottom:14px}.summary{display:flex;gap:20px;margin:20px 0}.summary div{flex:1;padding:14px;border-radius:12px;background:#f3f6fb}.summary small{display:block;color:#64748b}.summary strong{font-size:18px}table{width:100%;border-collapse:collapse}th,td{text-align:left;border-bottom:1px solid #e2e8f0;padding:8px 5px;vertical-align:top;word-break:break-word}th{background:#f3f6fb}.amount{text-align:right;white-space:nowrap}tr{break-inside:avoid}.footer{margin-top:24px;color:#64748b;font-size:10px}</style></head><body>
  <div class="brand"><h1>${escapeHtml(t('appName'))}</h1><span class="muted">${escapeHtml(t('debtFlow.statementTitle'))}</span></div>
  <h2>${escapeHtml(person.name)}</h2><p class="muted">${person.phone ? escapeHtml(person.phone) + ' · ' : ''}${escapeHtml(date(Date.now()))}</p>
  <div class="summary"><div><small>${escapeHtml(t('home.receivable'))}</small><strong>${escapeHtml(money(receivable))}</strong></div><div><small>${escapeHtml(t('home.payable'))}</small><strong>${escapeHtml(money(payable))}</strong></div></div>
  <h2>${escapeHtml(t('debtFlow.activeDebts'))}</h2><table><thead><tr><th>${escapeHtml(t('debtFlow.direction'))}</th><th>${escapeHtml(t('debtFlow.date'))}</th><th>${escapeHtml(t('debtFlow.dueDate'))}</th><th class="amount">${escapeHtml(t('debtFlow.principal'))}</th></tr></thead><tbody>${debtRows}</tbody></table>
  <h2>${escapeHtml(t('debtFlow.timeline'))}</h2><table><thead><tr><th>${escapeHtml(t('debtFlow.date'))}</th><th>${escapeHtml(t('debtFlow.entryType'))}</th><th>${escapeHtml(t('debtFlow.account'))}</th><th>${escapeHtml(t('debtFlow.note'))}</th><th class="amount">${escapeHtml(t('debtFlow.amount'))}</th></tr></thead><tbody>${rows}</tbody></table>
  <p class="footer">${escapeHtml(t('debtFlow.statementFooter'))}</p></body></html>`;
}
export async function sharePersonStatement(
  person: Person,
  debts: DebtView[],
  timeline: Timeline,
  currency: string,
  language: string,
  t: TFunction,
): Promise<void> {
  const printWindow = Capacitor.isNativePlatform()
    ? null
    : window.open('', '_blank');
  try {
    const html = renderPersonStatementHtml(
      person,
      debts,
      timeline,
      currency,
      language,
      t,
      await fontDataUrl(),
    );
    if (!Capacitor.isNativePlatform()) {
      if (!printWindow) throw new Error('POPUP_BLOCKED');
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      void printWindow.document.fonts.ready.then(() => printWindow.print());
      return;
    }
    const { PdfGenerator, PageSize } =
      await import('@capawesome/capacitor-pdf-generator');
    const { path } = await PdfGenerator.generateFromHtml({
      html,
      fileName: `tohobil-statement-${person.id.slice(0, 8)}.pdf`,
      pageSize: PageSize.A4,
    });
    await Share.share({ title: t('debtFlow.statementTitle'), files: [path] });
  } catch (error) {
    printWindow?.close();
    throw error;
  }
}
