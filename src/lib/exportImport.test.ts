import { describe, expect, it } from 'vitest';
import {
  exportTransactionsToCsv,
  exportTransactionsToExcelXml,
  parseCsvRows,
  renderReportHtml,
} from './exportImport';
import type { ReportData, TransactionRow } from '../db/types';

describe('Export and Import utilities', () => {
  const mockTransactions: TransactionRow[] = [
    {
      id: 'tx1',
      user_id: 'u1',
      book_id: 'b1',
      type: 'expense',
      amount: 45000, // 450.00 BDT
      currency: 'BDT',
      account_id: 'acc1',
      to_account_id: null,
      category_id: 'cat1',
      parent_id: null,
      occurred_at: 1732272000000,
      note: 'Groceries, fruits & veggies',
      created_at: 1000,
      updated_at: 1000,
      deleted_at: null,
      sync_state: 'synced',
      server_rev: 1,
      account_name: 'Cash',
      person_name: null,
      category_name: 'Food & Dining',
      category_key: 'food',
      tags: 'monthly, household',
      split_count: 0,
      split_category_ids: null,
      attachment_count: 0,
      fee: 0,
      debt_id: null,
    },
    {
      id: 'tx2',
      user_id: 'u1',
      book_id: 'b1',
      type: 'income',
      amount: 5000000, // 50,000.00 BDT
      currency: 'BDT',
      account_id: 'acc2',
      to_account_id: null,
      category_id: 'cat2',
      parent_id: null,
      occurred_at: 1732272000000,
      note: 'Monthly Salary',
      created_at: 1000,
      updated_at: 1000,
      deleted_at: null,
      sync_state: 'synced',
      server_rev: 1,
      account_name: 'City Bank',
      person_name: null,
      category_name: 'Salary',
      category_key: 'salary',
      tags: null,
      split_count: 0,
      split_category_ids: null,
      attachment_count: 0,
      fee: 0,
      debt_id: null,
    },
  ];

  it('exports transactions to CSV with UTF-8 BOM', () => {
    const csv = exportTransactionsToCsv(mockTransactions, 'BDT', 'en');
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('Date,Type,Account,Category,Amount,Currency,Note,Tags');
    expect(csv).toContain('450.00');
    expect(csv).toContain('"Groceries, fruits & veggies"');
  });

  it('neutralizes spreadsheet formulas in exported notes', () => {
    const csv = exportTransactionsToCsv(
      [{ ...mockTransactions[0], note: '=cmd|" /C calc"!A0' }],
      'BDT',
      'en',
    );
    expect(csv).toContain(`"'=cmd|`);
  });

  it('exports transactions to Excel XML format', () => {
    const xml = exportTransactionsToExcelXml(mockTransactions, 'BDT', 'Personal');
    expect(xml).toContain('<?xml version="1.0"?>');
    expect(xml).toContain('urn:schemas-microsoft-com:office:spreadsheet');
    expect(xml).toContain('<Worksheet ss:Name="Personal">');
    expect(xml).toContain('<Data ss:Type="Number">450.00</Data>');
  });

  it('parses CSV rows with quotes, commas, and trims', () => {
    const raw = `Date,Type,Account,Amount,Note
2026-11-22,expense,Cash,500,"Dinner, takeaway"
2026-11-21,income,"City Bank",1500,Bonus`;

    const parsed = parseCsvRows(raw);
    expect(parsed.length).toBe(2);
    expect(parsed[0].date).toBe('2026-11-22');
    expect(parsed[0].type).toBe('expense');
    expect(parsed[0].amount).toBe('500');
    expect(parsed[0].note).toBe('Dinner, takeaway');
    expect(parsed[1].account).toBe('City Bank');
  });

  it('renders report HTML statement', () => {
    const mockReport: ReportData = {
      from: 1730419200000,
      to: 1733011200000,
      totalIncome: 10000000,
      totalExpense: 6000000,
      netSavings: 4000000,
      savingsRate: 40,
      dailyAverageExpense: 200000,
      monthEndForecast: 6000000,
      categories: [
        { categoryId: 'c1', name: 'Food', icon: 'restaurant', color: '#f59e0b', amount: 3000000, percentage: 50, count: 12 },
      ],
      tags: [],
      accounts: [],
      dailyTrend: [],
      topExpenses: mockTransactions,
      comparison: { prevIncome: 9000000, prevExpense: 5000000, incomeDeltaPct: 11, expenseDeltaPct: 20 },
    };

    const html = renderReportHtml(mockReport, 'BDT', 'en', 'data:font/woff2;base64,...');
    expect(html).toContain('Tohobil — Financial Statement');
    expect(html).toContain('Savings Rate');
    expect(html).toContain('40%');
    expect(html).toContain('Food');
  });
});
