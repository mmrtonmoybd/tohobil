/**
 * Export and Import utilities for Tohobil.
 * Supports CSV export with UTF-8 BOM, Excel spreadsheet XML export, branded PDF report HTML rendering,
 * and intelligent CSV parsing with column detection.
 */

import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import type { TransactionRow, ReportData } from '../db/types';
import { formatMinor } from './money';
import bengaliFontUrl from '@fontsource/hind-siliguri/files/hind-siliguri-bengali-400-normal.woff2?url';

function spreadsheetCell(value: string): string {
  return /^[\t\r\n]*[=+\-@]/.test(value) ? `'${value}` : value;
}

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        char
      ]!,
  );

async function fontDataUrl(): Promise<string> {
  try {
    const blob = await (await fetch(bengaliFontUrl)).blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => resolve('');
      reader.readAsDataURL(blob);
    });
  } catch {
    return '';
  }
}

export function exportTransactionsToCsv(
  transactions: TransactionRow[],
  currency: string,
  language: string,
): string {
  const isBn = language === 'bn';
  const headers = isBn
    ? ['তারিখ', 'ধরন', 'অ্যাকাউন্ট', 'খাত (ক্যাটাগরি)', 'পরিমাণ', 'মুদ্রা', 'নোট', 'ট্যাগ']
    : ['Date', 'Type', 'Account', 'Category', 'Amount', 'Currency', 'Note', 'Tags'];

  const rows: string[] = [headers.join(',')];

  for (const t of transactions) {
    const d = new Date(t.occurred_at).toISOString().slice(0, 10);
    const typeStr = spreadsheetCell(t.type);
    const acc = `"${spreadsheetCell(t.account_name || '').replace(/"/g, '""')}"`;
    const cat = `"${spreadsheetCell(t.category_name || '').replace(/"/g, '""')}"`;
    const amountVal = (t.amount / 100).toFixed(2);
    const noteStr = `"${spreadsheetCell(t.note || '').replace(/"/g, '""')}"`;
    const tagsStr = `"${spreadsheetCell(t.tags || '').replace(/"/g, '""')}"`;

    rows.push([d, typeStr, acc, cat, amountVal, currency, noteStr, tagsStr].join(','));
  }

  // Prepend UTF-8 BOM so Microsoft Excel correctly reads non-ASCII / Bengali characters
  return '\uFEFF' + rows.join('\r\n');
}

export function exportTransactionsToExcelXml(
  transactions: TransactionRow[],
  currency: string,
  bookName: string,
): string {
  const rowsXml = transactions
    .map((t) => {
      const d = new Date(t.occurred_at).toISOString().slice(0, 10);
      const amountVal = (t.amount / 100).toFixed(2);
      return `<Row>
        <Cell><Data ss:Type="String">${escapeHtml(d)}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeHtml(spreadsheetCell(t.type))}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeHtml(spreadsheetCell(t.account_name || ''))}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeHtml(spreadsheetCell(t.category_name || ''))}</Data></Cell>
        <Cell><Data ss:Type="Number">${amountVal}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeHtml(currency)}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeHtml(spreadsheetCell(t.note || ''))}</Data></Cell>
      </Row>`;
    })
    .join('\n');

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Bottom"/>
  </Style>
  <Style ss:ID="Header">
   <Font ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#0EA5E9" ss:Pattern="Solid"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="${escapeHtml(bookName || 'Tohobil')}">
  <Table>
   <Row ss:StyleID="Header">
    <Cell><Data ss:Type="String">Date</Data></Cell>
    <Cell><Data ss:Type="String">Type</Data></Cell>
    <Cell><Data ss:Type="String">Account</Data></Cell>
    <Cell><Data ss:Type="String">Category</Data></Cell>
    <Cell><Data ss:Type="String">Amount</Data></Cell>
    <Cell><Data ss:Type="String">Currency</Data></Cell>
    <Cell><Data ss:Type="String">Note</Data></Cell>
   </Row>
   ${rowsXml}
  </Table>
 </Worksheet>
</Workbook>`;
}

export function parseCsvRows(csvText: string): Array<Record<string, string>> {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  // Parse header
  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' && (i === 0 || line[i - 1] !== '\\')) {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]).map((h) => h.replace(/^["\uFEFF]+|["\s]+$/g, '').toLowerCase());
  const data: Array<Record<string, string>> = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      const key = headers[j];
      const val = (values[j] ?? '').replace(/^"|"$/g, '').trim();
      row[key] = val;
    }
    data.push(row);
  }

  return data;
}

export function renderReportHtml(
  report: ReportData,
  currency: string,
  language: string,
  fontDataUrlStr: string,
): string {
  const isBn = language === 'bn';
  const money = (minor: number) => formatMinor(minor, currency, language);
  const fromStr = new Date(report.from).toLocaleDateString(isBn ? 'bn-BD' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const toStr = new Date(report.to).toLocaleDateString(isBn ? 'bn-BD' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  const catRows = report.categories
    .map(
      (c) =>
        `<tr>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${escapeHtml(c.name)}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">${c.percentage}%</td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600;">${escapeHtml(money(c.amount))}</td>
        </tr>`,
    )
    .join('');

  const topExpRows = report.topExpenses
    .map(
      (t) =>
        `<tr>
          <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0;">${new Date(t.occurred_at).toISOString().slice(0, 10)}</td>
          <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0;">${escapeHtml(t.category_name || t.note || '')}</td>
          <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600; color: #f43f5e;">${escapeHtml(money(t.amount))}</td>
        </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
@font-face {
  font-family: 'Hind Siliguri';
  src: url('${fontDataUrlStr}') format('woff2');
  font-weight: 400 700;
}
body {
  font-family: 'Hind Siliguri', system-ui, -apple-system, sans-serif;
  color: #1e293b;
  margin: 0;
  padding: 32px;
  background: #ffffff;
}
.header {
  border-bottom: 2px solid #0ea5e9;
  padding-bottom: 16px;
  margin-bottom: 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.title { font-size: 24px; font-weight: bold; color: #0ea5e9; margin: 0; }
.period { font-size: 14px; color: #64748b; margin-top: 4px; }
.hero-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 28px;
}
.card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 14px;
}
.card-label { font-size: 12px; color: #64748b; margin-bottom: 4px; }
.card-value { font-size: 18px; font-weight: bold; }
.section-title { font-size: 16px; font-weight: bold; margin: 24px 0 12px; color: #334155; }
table { width: 100%; border-collapse: collapse; font-size: 14px; }
th { background: #f1f5f9; padding: 10px; text-align: left; font-weight: 600; color: #475569; }
</style>
</head>
<body>
<div class="header">
  <div>
    <h1 class="title">Tohobil — Financial Statement</h1>
    <div class="period">${escapeHtml(fromStr)} – ${escapeHtml(toStr)}</div>
  </div>
</div>

<div class="hero-grid">
  <div class="card">
    <div class="card-label">Total Income</div>
    <div class="card-value" style="color: #22c55e;">${escapeHtml(money(report.totalIncome))}</div>
  </div>
  <div class="card">
    <div class="card-label">Total Expenses</div>
    <div class="card-value" style="color: #f43f5e;">${escapeHtml(money(report.totalExpense))}</div>
  </div>
  <div class="card">
    <div class="card-label">Net Savings</div>
    <div class="card-value" style="color: #0ea5e9;">${escapeHtml(money(report.netSavings))}</div>
  </div>
  <div class="card">
    <div class="card-label">Savings Rate</div>
    <div class="card-value">${report.savingsRate}%</div>
  </div>
</div>

<div class="section-title">Spending by Category</div>
<table>
  <thead>
    <tr>
      <th>Category</th>
      <th style="text-align: center;">Share</th>
      <th style="text-align: right;">Amount</th>
    </tr>
  </thead>
  <tbody>
    ${catRows || '<tr><td colspan="3" style="padding: 16px; text-align: center; color: #94a3b8;">No expenses recorded</td></tr>'}
  </tbody>
</table>

<div class="section-title" style="margin-top: 28px;">Top Expenses</div>
<table>
  <thead>
    <tr>
      <th>Date</th>
      <th>Description</th>
      <th style="text-align: right;">Amount</th>
    </tr>
  </thead>
  <tbody>
    ${topExpRows || '<tr><td colspan="3" style="padding: 16px; text-align: center; color: #94a3b8;">No expenses recorded</td></tr>'}
  </tbody>
</table>
</body>
</html>`;
}

export async function shareOrPrintReportPdf(
  report: ReportData,
  currency: string,
  language: string,
): Promise<void> {
  const fontUrl = await fontDataUrl();
  const html = renderReportHtml(report, currency, language, fontUrl);

  if (Capacitor.isNativePlatform()) {
    const { PdfGenerator, PageSize } = await import('@capawesome/capacitor-pdf-generator');
    const { path } = await PdfGenerator.generateFromHtml({
      html,
      fileName: `tohobil-report-${new Date().toISOString().slice(0, 10)}.pdf`,
      pageSize: PageSize.A4,
    });
    if (path) {
      await Share.share({
        title: 'Tohobil Report',
        url: path,
      });
    }
  } else {
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => {
        win.print();
      }, 300);
    }
  }
}
