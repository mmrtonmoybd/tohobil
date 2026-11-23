import { parseMinor } from './money';

/**
 * SMS Paste Parser for Bangladeshi MFS (bKash, Nagad, Rocket) and Bank SMS notifications.
 * Extracts transaction kind, amount in integer minor units (poisha), fees, TrxID, counterparty, and suggested account.
 */

export type ParsedSms = {
  kind: 'expense' | 'income' | 'transfer';
  amount: number; // minor units (e.g. 150000 for 1500.00 BDT)
  fee?: number; // minor units
  trxId?: string;
  counterparty?: string;
  suggestedAccount?: 'bkash' | 'nagad' | 'rocket' | 'bank';
  raw: string;
};

// Helper to convert decimal amount string (e.g. "1,500.00" or "500") to minor units
function parseAmountToMinor(valStr: string): number {
  try {
    const minor = parseMinor(valStr, 'BDT');
    return minor > 0 ? minor : 0;
  } catch {
    return 0;
  }
}

export function parseFinancialSms(text: string): ParsedSms | null {
  if (!text || text.trim().length === 0) return null;
  const raw = text.trim();
  const lower = raw.toLowerCase();

  // 1. bKash SMS patterns
  // "You have received Tk 1,500.00 from 017xxxxxxxx. Fee Tk 0.00. Balance Tk 5,230.50. TrxID 8N7X6Y5Z at 22/11/2026 14:30"
  if (lower.includes('bkash') || lower.includes('trxid')) {
    // Received / Cash In (Income)
    const receivedMatch = raw.match(/(?:received|cash in)\s+(?:tk\.?|bdt)\s*([\d,]+(?:\.\d{1,2})?)\s+from\s+([^.\n]+)/i);
    if (receivedMatch) {
      const amount = parseAmountToMinor(receivedMatch[1]);
      const counterparty = receivedMatch[2].trim();
      const feeMatch = raw.match(/fee\s+(?:tk\.?|bdt)\s*([\d,]+(?:\.\d{1,2})?)/i);
      const trxMatch = raw.match(/trxid\s+([a-z0-9]+)/i);
      return {
        kind: 'income',
        amount,
        fee: feeMatch ? parseAmountToMinor(feeMatch[1]) : 0,
        counterparty,
        trxId: trxMatch ? trxMatch[1] : undefined,
        suggestedAccount: 'bkash',
        raw,
      };
    }

    // Payment (Expense)
    const paymentMatch = raw.match(/payment\s+(?:tk\.?|bdt)\s*([\d,]+(?:\.\d{1,2})?)\s+to\s+([^.\n]+?)(?:\s+successful|\.|$)/i);
    if (paymentMatch) {
      const amount = parseAmountToMinor(paymentMatch[1]);
      const counterparty = paymentMatch[2].trim();
      const feeMatch = raw.match(/fee\s+(?:tk\.?|bdt)\s*([\d,]+(?:\.\d{1,2})?)/i);
      const trxMatch = raw.match(/trxid\s+([a-z0-9]+)/i);
      return {
        kind: 'expense',
        amount,
        fee: feeMatch ? parseAmountToMinor(feeMatch[1]) : 0,
        counterparty,
        trxId: trxMatch ? trxMatch[1] : undefined,
        suggestedAccount: 'bkash',
        raw,
      };
    }

    // Cash Out (Expense)
    const cashOutMatch = raw.match(/cash out\s+(?:tk\.?|bdt)\s*([\d,]+(?:\.\d{1,2})?)\s+(?:to|from)\s+([^.\n]+)/i);
    if (cashOutMatch) {
      const amount = parseAmountToMinor(cashOutMatch[1]);
      const counterparty = cashOutMatch[2].trim();
      const feeMatch = raw.match(/fee\s+(?:tk\.?|bdt)\s*([\d,]+(?:\.\d{1,2})?)/i);
      const trxMatch = raw.match(/trxid\s+([a-z0-9]+)/i);
      return {
        kind: 'expense',
        amount,
        fee: feeMatch ? parseAmountToMinor(feeMatch[1]) : 0,
        counterparty: `Agent: ${counterparty}`,
        trxId: trxMatch ? trxMatch[1] : undefined,
        suggestedAccount: 'bkash',
        raw,
      };
    }

    // Send Money (Transfer/Expense)
    const sendMoneyMatch = raw.match(/send money\s+(?:tk\.?|bdt)?\s*([\d,]+(?:\.\d{1,2})?)\s+to\s+([^.\n]+)/i);
    if (sendMoneyMatch) {
      const amount = parseAmountToMinor(sendMoneyMatch[1]);
      const counterparty = sendMoneyMatch[2].trim();
      const feeMatch = raw.match(/fee\s+(?:tk\.?|bdt)\s*([\d,]+(?:\.\d{1,2})?)/i);
      const trxMatch = raw.match(/trxid\s+([a-z0-9]+)/i);
      return {
        kind: 'transfer',
        amount,
        fee: feeMatch ? parseAmountToMinor(feeMatch[1]) : 0,
        counterparty,
        trxId: trxMatch ? trxMatch[1] : undefined,
        suggestedAccount: 'bkash',
        raw,
      };
    }

    // Mobile Recharge (Expense)
    const rechargeMatch = raw.match(/mobile recharge\s+(?:tk\.?|bdt)\s*([\d,]+(?:\.\d{1,2})?)\s+to\s+([^.\n]+)/i);
    if (rechargeMatch) {
      const amount = parseAmountToMinor(rechargeMatch[1]);
      const counterparty = rechargeMatch[2].trim();
      const trxMatch = raw.match(/trxid\s+([a-z0-9]+)/i);
      return {
        kind: 'expense',
        amount,
        counterparty: `Mobile Recharge: ${counterparty}`,
        trxId: trxMatch ? trxMatch[1] : undefined,
        suggestedAccount: 'bkash',
        raw,
      };
    }
  }

  // 2. Nagad SMS patterns
  // "Payment Tk 1200.00 to Meena Bazar successful. Fee Tk 0.00. TxnID: 76XJ89KL. Balance Tk 4500.00"
  // "Money Transfer Successful! Amount: Tk 1,000.00, Receiver: 017..., Fee: Tk 0.00, TxnID: 76XJ89KL"
  if (lower.includes('nagad') || lower.includes('txnid')) {
    const feeMatch = raw.match(/fee:?\s*(?:tk\.?|bdt)?\s*([\d,]+(?:\.\d{1,2})?)/i);
    const trxMatch = raw.match(/txnid:?\s*([a-z0-9]+)/i);

    // Cash In
    const cashInMatch = raw.match(/cash in\s+from\s+(.+?)\s+of\s+(?:tk\.?|bdt)\s*([\d,]+(?:\.\d{1,2})?)/i);
    if (cashInMatch) {
      return {
        kind: 'income',
        amount: parseAmountToMinor(cashInMatch[2]),
        counterparty: cashInMatch[1].trim(),
        fee: feeMatch ? parseAmountToMinor(feeMatch[1]) : 0,
        trxId: trxMatch ? trxMatch[1] : undefined,
        suggestedAccount: 'nagad',
        raw,
      };
    }

    // Cash Out
    const cashOutMatch = raw.match(/cash out\s+from\s+(.+?)\s*(?:tk\.?|bdt)?\s*([\d,]+(?:\.\d{1,2})?)/i);
    if (cashOutMatch) {
      return {
        kind: 'expense',
        amount: parseAmountToMinor(cashOutMatch[2]),
        counterparty: cashOutMatch[1].trim(),
        fee: feeMatch ? parseAmountToMinor(feeMatch[1]) : 0,
        trxId: trxMatch ? trxMatch[1] : undefined,
        suggestedAccount: 'nagad',
        raw,
      };
    }

    // Payment
    const paymentMatch = raw.match(/payment\s+(?:tk\.?|bdt)\s*([\d,]+(?:\.\d{1,2})?)\s+to\s+([^.\n]+?)(?:\s+successful|\.|$)/i);
    if (paymentMatch) {
      return {
        kind: 'expense',
        amount: parseAmountToMinor(paymentMatch[1]),
        counterparty: paymentMatch[2].trim(),
        fee: feeMatch ? parseAmountToMinor(feeMatch[1]) : 0,
        trxId: trxMatch ? trxMatch[1] : undefined,
        suggestedAccount: 'nagad',
        raw,
      };
    }

    // Money Transfer
    const transferMatch = raw.match(/(?:money transfer|transfer).*?amount:?\s*(?:tk\.?|bdt)?\s*([\d,]+(?:\.\d{1,2})?)/i);
    if (transferMatch) {
      const receiverMatch = raw.match(/receiver:?\s*([^,.\n]+)/i);
      return {
        kind: 'transfer',
        amount: parseAmountToMinor(transferMatch[1]),
        counterparty: receiverMatch ? receiverMatch[1].trim() : undefined,
        fee: feeMatch ? parseAmountToMinor(feeMatch[1]) : 0,
        trxId: trxMatch ? trxMatch[1] : undefined,
        suggestedAccount: 'nagad',
        raw,
      };
    }
  }

  // 3. Rocket (DBBL) patterns
  // "Txn: Cash In Tk 2000.00 from 019... TxnId: 123456789. Bal: Tk 5000.00"
  // "Txn: Cash Out Tk 1000.00 to ... Fee Tk 18.00. TxnId: ..."
  if (lower.includes('rocket') || lower.includes('txn:')) {
    const feeMatch = raw.match(/fee\s+(?:tk\.?|bdt)\s*([\d,]+(?:\.\d{1,2})?)/i);
    const trxMatch = raw.match(/txnid:?\s*([a-z0-9]+)/i);

    const isCashIn = lower.includes('cash in');
    const amountMatch = raw.match(/(?:tk\.?|bdt)\s*([\d,]+(?:\.\d{1,2})?)/i);
    if (amountMatch) {
      return {
        kind: isCashIn ? 'income' : 'expense',
        amount: parseAmountToMinor(amountMatch[1]),
        fee: feeMatch ? parseAmountToMinor(feeMatch[1]) : 0,
        trxId: trxMatch ? trxMatch[1] : undefined,
        suggestedAccount: 'rocket',
        raw,
      };
    }
  }

  // 4. Standard Bank SMS patterns
  // "A/C *1234 debited for BDT 3,500.00 on 22-NOV-26 by POS at UNIMART. Avail Bal BDT 45,800.00"
  // "Your A/C *5678 is credited with BDT 50,000.00 on 01-NOV-26 by Salary. Avail Bal BDT 92,150.00"
  const debitMatch = raw.match(/(?:debited for|spent|withdrawn|paid)\s+(?:bdt|tk\.?)\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (debitMatch) {
    const amount = parseAmountToMinor(debitMatch[1]);
    const merchantMatch = raw.match(/(?:at|to|by POS at|by)\s+([^.\n]+?)(?:\s+on|\.|$)/i);
    return {
      kind: 'expense',
      amount,
      counterparty: merchantMatch ? merchantMatch[1].trim() : undefined,
      suggestedAccount: 'bank',
      raw,
    };
  }

  const creditMatch = raw.match(/(?:credited with|deposited|received)\s+(?:bdt|tk\.?)\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (creditMatch) {
    const amount = parseAmountToMinor(creditMatch[1]);
    const sourceMatch = raw.match(/(?:by|from)\s+([^.\n]+?)(?:\s+on|\.|$)/i);
    return {
      kind: 'income',
      amount,
      counterparty: sourceMatch ? sourceMatch[1].trim() : undefined,
      suggestedAccount: 'bank',
      raw,
    };
  }

  // 5. Fallback generic amount detection
  const genericMatch = raw.match(/(?:tk\.?|bdt)\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (genericMatch) {
    const amount = parseAmountToMinor(genericMatch[1]);
    if (amount > 0) {
      const isIncome = lower.includes('credit') || lower.includes('received') || lower.includes('inward');
      return {
        kind: isIncome ? 'income' : 'expense',
        amount,
        raw,
      };
    }
  }

  return null;
}
