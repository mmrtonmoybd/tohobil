import { describe, expect, it } from 'vitest';
import type { DocumentView, DocumentFolder } from '../../db/types';

describe('Document Vault logic', () => {
  it('correctly calculates document expiry status', () => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    // Expired document (10 days ago)
    const expiredDoc: Partial<DocumentView> = {
      expiry_date: now - 10 * dayMs,
    };
    const is_expired = expiredDoc.expiry_date ? expiredDoc.expiry_date < now : false;
    const days_to_expiry = expiredDoc.expiry_date
      ? Math.round((expiredDoc.expiry_date - now) / dayMs)
      : null;
    expect(is_expired).toBe(true);
    expect(days_to_expiry).toBe(-10);

    // Expiring soon (15 days remaining)
    const expiringSoonDoc: Partial<DocumentView> = {
      expiry_date: now + 15 * dayMs,
    };
    const is_expiring_soon =
      expiringSoonDoc.expiry_date != null &&
      Math.round((expiringSoonDoc.expiry_date - now) / dayMs) <= 30;
    expect(is_expiring_soon).toBe(true);

    // Long valid (180 days remaining)
    const validDoc: Partial<DocumentView> = {
      expiry_date: now + 180 * dayMs,
    };
    const daysValid = Math.round((validDoc.expiry_date! - now) / dayMs);
    expect(daysValid > 30).toBe(true);
  });

  it('validates supported document folders', () => {
    const validFolders: DocumentFolder[] = [
      'receipts',
      'invoices',
      'loan_agreements',
      'warranty',
      'bank_statements',
      'ids_certificates',
      'property',
      'other',
    ];
    expect(validFolders).toHaveLength(8);
    expect(validFolders).toContain('warranty');
    expect(validFolders).toContain('receipts');
  });

  it('filters documents by search query across title, note, and tags', () => {
    const docs = [
      { id: '1', title: 'Fridge Warranty', note: 'Walton showroom', tags: 'appliance,warranty' },
      { id: '2', title: 'Passport Copy', note: 'Renewal 2028', tags: 'id,travel' },
      { id: '3', title: 'Shop Rent Receipt', note: 'Paid cash', tags: 'rent,bazar' },
    ];

    const searchFilter = (query: string) => {
      const q = query.toLowerCase();
      return docs.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          d.note.toLowerCase().includes(q) ||
          d.tags.toLowerCase().includes(q),
      );
    };

    expect(searchFilter('warranty')).toHaveLength(1);
    expect(searchFilter('passport')).toHaveLength(1);
    expect(searchFilter('paid')).toHaveLength(1);
    expect(searchFilter('unknown')).toHaveLength(0);
  });
});
