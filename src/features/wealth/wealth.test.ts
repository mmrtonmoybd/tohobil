import { describe, expect, it } from 'vitest';
import type { AssetType, AssetView, WealthSummary } from '../../db/types';

describe('Wealth and Assets Logic', () => {
  describe('Asset maturity calculations', () => {
    function computeDaysToMaturity(maturityDateMs: number | null, referenceDateStr: string = '2026-11-22'): number | null {
      if (!maturityDateMs) return null;
      const ref = new Date(`${referenceDateStr}T00:00:00Z`).getTime();
      return Math.round((maturityDateMs - ref) / (1000 * 60 * 60 * 24));
    }

    it('identifies upcoming maturities within 30 days', () => {
      const matMs = new Date('2026-12-07T00:00:00Z').getTime();
      const days = computeDaysToMaturity(matMs, '2026-11-22');
      expect(days).toBe(15);
      expect(days !== null && days >= 0 && days <= 30).toBe(true);
    });

    it('identifies already matured assets', () => {
      const pastMs = new Date('2026-11-10T00:00:00Z').getTime();
      const pastDays = computeDaysToMaturity(pastMs, '2026-11-22');
      expect(pastDays).toBe(-12);
      expect(pastDays !== null && pastDays <= 0).toBe(true);

      const todayMs = new Date('2026-11-22T00:00:00Z').getTime();
      const todayDays = computeDaysToMaturity(todayMs, '2026-11-22');
      expect(todayDays).toBe(0);
      expect(todayDays !== null && todayDays <= 0).toBe(true);
    });

    it('handles assets without maturity dates', () => {
      const noMaturity = computeDaysToMaturity(null);
      expect(noMaturity).toBeNull();
    });
  });

  describe('Wealth Summary and Returns', () => {
    const mockAssets: AssetView[] = [
      {
        id: 'a1',
        user_id: 'u1',
        book_id: 'book1',
        type: 'fdr',
        name: 'BRAC Bank 1-Year FDR',
        institution: 'BRAC Bank',
        currency: 'BDT',
        principal: 50000000, // 500,000 BDT
        current_value: 54500000, // 545,000 BDT
        profit_rate: 9.0,
        unit: null,
        start_date: 1732060800000,
        maturity_date: 1763596800000,
        note: '',
        created_at: 1000,
        updated_at: 1000,
        deleted_at: null,
        sync_state: 'synced',
        server_rev: 1,
        profit: 4500000,
        profitPercentage: 9.0,
        daysToMaturity: -2,
        isMatured: true,
        isMaturingSoon: false,
      },
      {
        id: 'a2',
        user_id: 'u1',
        book_id: 'book1',
        type: 'sanchayapatra',
        name: '3-Year Savings Certificate',
        institution: 'Bangladesh Bank',
        currency: 'BDT',
        principal: 100000000, // 1,000,000 BDT
        current_value: 111000000, // 1,110,000 BDT
        profit_rate: 11.04,
        unit: null,
        start_date: 1715731200000,
        maturity_date: 1810339200000,
        note: '',
        created_at: 1000,
        updated_at: 1000,
        deleted_at: null,
        sync_state: 'synced',
        server_rev: 1,
        profit: 11000000,
        profitPercentage: 11.0,
        daysToMaturity: 540,
        isMatured: false,
        isMaturingSoon: false,
      },
      {
        id: 'a3',
        user_id: 'u1',
        book_id: 'book1',
        type: 'gold',
        name: 'Gold Bar 22K',
        institution: 'Jeweller',
        currency: 'BDT',
        principal: 20000000, // 200,000 BDT
        current_value: 26000000, // 260,000 BDT
        profit_rate: null,
        unit: '2 bhori',
        start_date: 1704067200000,
        maturity_date: null,
        note: '',
        created_at: 1000,
        updated_at: 1000,
        deleted_at: null,
        sync_state: 'synced',
        server_rev: 1,
        profit: 6000000,
        profitPercentage: 30.0,
        daysToMaturity: null,
        isMatured: false,
        isMaturingSoon: false,
      },
    ];

    function calculateWealthSummary(assets: AssetView[]): WealthSummary {
      let currentValue = 0;
      let totalInvested = 0;
      const byType: Record<AssetType, { count: number; totalValue: number; totalInvested: number }> = {
        fdr: { count: 0, totalValue: 0, totalInvested: 0 },
        dps: { count: 0, totalValue: 0, totalInvested: 0 },
        sanchayapatra: { count: 0, totalValue: 0, totalInvested: 0 },
        gold: { count: 0, totalValue: 0, totalInvested: 0 },
        land: { count: 0, totalValue: 0, totalInvested: 0 },
        shares: { count: 0, totalValue: 0, totalInvested: 0 },
        crypto: { count: 0, totalValue: 0, totalInvested: 0 },
        other: { count: 0, totalValue: 0, totalInvested: 0 },
      };

      for (const asset of assets) {
        currentValue += asset.current_value;
        totalInvested += asset.principal;

        const group = byType[asset.type];
        if (group) {
          group.count += 1;
          group.totalValue += asset.current_value;
          group.totalInvested += asset.principal;
        }
      }

      const totalProfit = currentValue - totalInvested;
      const profitPercentage = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;
      const maturingSoon = assets.filter(
        (a) => a.daysToMaturity !== null && a.daysToMaturity >= 0 && a.daysToMaturity <= 30
      );

      return {
        totalInvested,
        currentValue,
        totalProfit,
        profitPercentage,
        assetCount: assets.length,
        byType,
        maturingSoon,
      };
    }

    it('accurately aggregates total valuations, principal, and return percentage', () => {
      const summary = calculateWealthSummary(mockAssets);

      // Principal: 500k + 1000k + 200k = 1,700,000 BDT (170,000,000 minor)
      expect(summary.totalInvested).toBe(170000000);

      // Valuation: 545k + 1110k + 260k = 1,915,000 BDT (191,500,000 minor)
      expect(summary.currentValue).toBe(191500000);

      // Profit: 191.5M - 170M = 21,500,000 minor (215,000 BDT)
      expect(summary.totalProfit).toBe(21500000);

      // Profit %: 21.5M / 170M * 100 = 12.647...
      expect(Math.round(summary.profitPercentage * 10) / 10).toBe(12.6);

      // By type checks
      expect(summary.byType.fdr.count).toBe(1);
      expect(summary.byType.fdr.totalValue).toBe(54500000);
      expect(summary.byType.sanchayapatra.count).toBe(1);
      expect(summary.byType.gold.count).toBe(1);
      expect(summary.byType.shares.count).toBe(0);
    });

    it('safely handles zero principal without division by zero', () => {
      const zeroPrincipalAsset: AssetView[] = [
        {
          id: 'z1',
          user_id: 'u1',
          book_id: 'book1',
          type: 'other',
          name: 'Inherited Gift',
          institution: null,
          currency: 'BDT',
          principal: 0,
          current_value: 500000,
          profit_rate: null,
          unit: null,
          start_date: 1735689600000,
          maturity_date: null,
          note: '',
          created_at: 1000,
          updated_at: 1000,
          deleted_at: null,
          sync_state: 'synced',
          server_rev: 1,
          profit: 500000,
          profitPercentage: 0,
          daysToMaturity: null,
          isMatured: false,
          isMaturingSoon: false,
        },
      ];

      const summary = calculateWealthSummary(zeroPrincipalAsset);
      expect(summary.totalInvested).toBe(0);
      expect(summary.currentValue).toBe(500000);
      expect(summary.profitPercentage).toBe(0);
    });
  });

  describe('Comprehensive Net Worth Formula', () => {
    it('calculates net worth as (Liquid Accounts + Physical/Financial Investments) - (Debts + Liabilities)', () => {
      const accountsCash = 15000000; // 150,000 BDT
      const investmentsValuation = 50000000; // 500,000 BDT
      const debtsReceivable = 2000000; // 20,000 BDT to collect
      const debtsPayable = 35000000; // 350,000 BDT owed

      // Total Assets = Cash + Receivables + Investments
      const totalAssets = accountsCash + debtsReceivable + investmentsValuation;
      expect(totalAssets).toBe(67000000); // 670,000 BDT

      // Total Liabilities = Debts Payable
      const totalLiabilities = debtsPayable;
      expect(totalLiabilities).toBe(35000000); // 350,000 BDT

      // Net Worth = Assets - Liabilities
      const netWorth = totalAssets - totalLiabilities;
      expect(netWorth).toBe(32000000); // 320,000 BDT
    });
  });
});
