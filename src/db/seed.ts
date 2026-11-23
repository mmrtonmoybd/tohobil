import type { SQLiteDBConnection } from '@capacitor-community/sqlite';
async function run(
  db: SQLiteDBConnection,
  sql: string,
  params: unknown[],
): Promise<void> {
  await db.run(sql, params, false);
}
import { uuidv7 } from '../lib/ids';
const expense = [
  ['food', 'restaurant', '#f97316'],
  ['transport', 'directions_car', '#8b5cf6'],
  ['mobile', 'phone_in_talk', '#0ea5e9'],
  ['rent', 'home', '#6366f1'],
  ['electricity', 'bolt', '#f59e0b'],
  ['gas', 'local_fire_department', '#f97316'],
  ['water', 'water_drop', '#0ea5e9'],
  ['education', 'school', '#6366f1'],
  ['medical', 'medical_services', '#ef4444'],
  ['shopping', 'shopping_bag', '#ec4899'],
  ['family', 'family_restroom', '#14b8a6'],
  ['gifts', 'redeem', '#ec4899'],
  ['charity', 'volunteer_activism', '#22c55e'],
  ['entertainment', 'movie', '#8b5cf6'],
  ['personalCare', 'spa', '#ec4899'],
  ['repairs', 'build', '#64748b'],
  ['fees', 'receipt_long', '#f43f5e'],
  ['other', 'more_horiz', '#64748b'],
] as const;
const income = [
  ['salary', 'payments', '#22c55e'],
  ['business', 'storefront', '#14b8a6'],
  ['freelancing', 'laptop_mac', '#6366f1'],
  ['remittance', 'public', '#0ea5e9'],
  ['rentReceived', 'home', '#8b5cf6'],
  ['profit', 'trending_up', '#22c55e'],
  ['bonus', 'stars', '#f59e0b'],
  ['gift', 'redeem', '#ec4899'],
  ['otherIncome', 'more_horiz', '#64748b'],
] as const;
export function deviceCurrency(): string {
  const locale = navigator.language;
  const region =
    new Intl.Locale(locale).region?.toUpperCase() ??
    (locale.toLowerCase().startsWith('bn') ? 'BD' : 'US');
  const map: Record<string, string> = {
    BD: 'BDT',
    US: 'USD',
    GB: 'GBP',
    IN: 'INR',
    PK: 'PKR',
    NP: 'NPR',
    LK: 'LKR',
    AE: 'AED',
    SA: 'SAR',
    QA: 'QAR',
    KW: 'KWD',
    BH: 'BHD',
    OM: 'OMR',
    MY: 'MYR',
    SG: 'SGD',
    AU: 'AUD',
    CA: 'CAD',
    JP: 'JPY',
    CN: 'CNY',
    DE: 'EUR',
    FR: 'EUR',
    IT: 'EUR',
    ES: 'EUR',
    NL: 'EUR',
    BE: 'EUR',
  };
  return map[region] ?? 'USD';
}
export async function seedBook(
  db: SQLiteDBConnection,
  name: string,
  currency: string,
  isDefault: boolean,
  userId = 'local',
): Promise<string> {
  const id = uuidv7(),
    now = Date.now(),
    user = userId || 'local';
  await run(
    db,
    'INSERT INTO books(id,user_id,name,icon,color,currency,is_default,created_at,updated_at,sync_state,server_rev) VALUES(?,?,?,?,?,?,?,?,?,?,0)',
    [
      id,
      user,
      name,
      'menu_book',
      '#14b8a6',
      currency,
      isDefault ? 1 : 0,
      now,
      now,
      'pending',
    ],
  );
  await run(
    db,
    'INSERT INTO accounts(id,user_id,book_id,name,type,currency,opening_balance,color,icon,include_in_total,is_archived,sort_order,created_at,updated_at,sync_state,server_rev) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)',
    [
      uuidv7(),
      user,
      id,
      'cash',
      'cash',
      currency,
      0,
      '#14b8a6',
      'payments',
      1,
      0,
      0,
      now,
      now,
      'pending',
    ],
  );
  for (const [kind, items] of [
    ['expense', expense],
    ['income', income],
  ] as const) {
    let order = 0;
    for (const [key, icon, color] of items) {
      await run(
        db,
        'INSERT INTO categories(id,user_id,book_id,i18n_key,kind,icon,color,sort_order,is_default,created_at,updated_at,sync_state,server_rev) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,0)',
        [
          uuidv7(),
          user,
          id,
          key,
          kind,
          icon,
          color,
          order++,
          1,
          now,
          now,
          'pending',
        ],
      );
    }
  }
  return id;
}
