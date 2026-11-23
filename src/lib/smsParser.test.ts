import { describe, expect, it } from 'vitest';
import { parseFinancialSms } from './smsParser';

describe('Financial SMS Parser', () => {
  describe('bKash SMS notifications', () => {
    it('parses received money (income)', () => {
      const sms = 'You have received Tk 1,500.00 from 01712345678. Fee Tk 0.00. Balance Tk 5,230.50. TrxID 8N7X6Y5Z at 22/11/2026 14:30';
      const parsed = parseFinancialSms(sms);
      expect(parsed).not.toBeNull();
      expect(parsed?.kind).toBe('income');
      expect(parsed?.amount).toBe(150000); // 1,500.00 BDT
      expect(parsed?.counterparty).toBe('01712345678');
      expect(parsed?.fee).toBe(0);
      expect(parsed?.trxId).toBe('8N7X6Y5Z');
      expect(parsed?.suggestedAccount).toBe('bkash');
    });

    it('parses merchant payment (expense)', () => {
      const sms = 'Payment Tk 850.50 to Agora Superstore successful. Fee Tk 0.00. Balance Tk 2,350.70. TrxID 7C6D5E4F at 22/11/2026';
      const parsed = parseFinancialSms(sms);
      expect(parsed).not.toBeNull();
      expect(parsed?.kind).toBe('expense');
      expect(parsed?.amount).toBe(85050); // 850.50 BDT
      expect(parsed?.counterparty).toBe('Agora Superstore');
      expect(parsed?.trxId).toBe('7C6D5E4F');
      expect(parsed?.suggestedAccount).toBe('bkash');
    });

    it('parses cash out with fee (expense)', () => {
      const sms = 'Cash Out Tk 2,000.00 to 01899887766. Fee Tk 29.80. Balance Tk 3,200.70. TrxID 9A8B7C6D';
      const parsed = parseFinancialSms(sms);
      expect(parsed).not.toBeNull();
      expect(parsed?.kind).toBe('expense');
      expect(parsed?.amount).toBe(200000); // 2000 BDT
      expect(parsed?.fee).toBe(2980); // 29.80 BDT
      expect(parsed?.trxId).toBe('9A8B7C6D');
      expect(parsed?.counterparty).toBe('Agent: 01899887766');
    });

    it('parses send money (transfer/expense)', () => {
      const sms = 'Send Money Tk 500.00 to 01911223344. Fee Tk 5.00. Balance Tk 1,500.00. TrxID 6B5A4D3C';
      const parsed = parseFinancialSms(sms);
      expect(parsed).not.toBeNull();
      expect(parsed?.kind).toBe('transfer');
      expect(parsed?.amount).toBe(50000);
      expect(parsed?.fee).toBe(500);
      expect(parsed?.counterparty).toBe('01911223344');
      expect(parsed?.trxId).toBe('6B5A4D3C');
    });
  });

  describe('Nagad SMS notifications', () => {
    it('parses cash in (income)', () => {
      const sms = 'Cash In from Agent: 01811223344 of Tk 3,000.00 successful. TxnID: 89AB12CD, Balance: Tk 7,500.00';
      const parsed = parseFinancialSms(sms);
      expect(parsed).not.toBeNull();
      expect(parsed?.kind).toBe('income');
      expect(parsed?.amount).toBe(300000);
      expect(parsed?.counterparty).toBe('Agent: 01811223344');
      expect(parsed?.trxId).toBe('89AB12CD');
      expect(parsed?.suggestedAccount).toBe('nagad');
    });

    it('parses merchant payment (expense)', () => {
      const sms = 'Payment Tk 1200.00 to Meena Bazar successful. Fee Tk 0.00. TxnID: 76XJ89KL. Balance Tk 4500.00';
      const parsed = parseFinancialSms(sms);
      expect(parsed).not.toBeNull();
      expect(parsed?.kind).toBe('expense');
      expect(parsed?.amount).toBe(120000);
      expect(parsed?.counterparty).toBe('Meena Bazar');
      expect(parsed?.trxId).toBe('76XJ89KL');
    });
  });

  describe('Bank SMS notifications', () => {
    it('parses bank POS debit (expense)', () => {
      const sms = 'A/C *1234 debited for BDT 3,500.00 on 22-NOV-26 by POS at UNIMART. Avail Bal BDT 45,800.00';
      const parsed = parseFinancialSms(sms);
      expect(parsed).not.toBeNull();
      expect(parsed?.kind).toBe('expense');
      expect(parsed?.amount).toBe(350000);
      expect(parsed?.counterparty).toBe('UNIMART');
      expect(parsed?.suggestedAccount).toBe('bank');
    });

    it('parses salary credit (income)', () => {
      const sms = 'Your A/C *5678 is credited with BDT 50,000.00 on 01-NOV-26 by Salary. Avail Bal BDT 92,150.00';
      const parsed = parseFinancialSms(sms);
      expect(parsed).not.toBeNull();
      expect(parsed?.kind).toBe('income');
      expect(parsed?.amount).toBe(5000000);
      expect(parsed?.counterparty).toBe('Salary');
      expect(parsed?.suggestedAccount).toBe('bank');
    });
  });

  describe('Edge cases and empty inputs', () => {
    it('returns null for empty strings or irrelevant messages', () => {
      expect(parseFinancialSms('')).toBeNull();
      expect(parseFinancialSms('   ')).toBeNull();
      expect(parseFinancialSms('Hello how are you? Meeting at 5pm')).toBeNull();
    });
  });
});
