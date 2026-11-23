import { create } from 'zustand';
import type {
  Account,
  AssetType,
  AssetView,
  Balance,
  Book,
  Category,
  DebtView,
  ExchangeRate,
  Favorite,
  Person,
  Tag,
  TransactionRow,
  WealthSummary,
} from '../../db/types';
import * as repo from '../../db/repository';
import * as debtRepo from '../../db/debts';
import { addMinor } from '../../lib/money';
import { convertMinor } from '../../lib/currency';
import { refreshDebtReminders } from '../../lib/debtReminders';
import i18n from '../../i18n';
type MoneyState = {
  ready: boolean;
  error: string | null;
  bookId: string | null;
  books: Book[];
  accounts: Account[];
  categories: Category[];
  tags: Tag[];
  favorites: Favorite[];
  transactions: TransactionRow[];
  balances: Balance[];
  income: number;
  expense: number;
  total: number;
  cash: number;
  unconvertedCurrencies: string[];
  people: Person[];
  debts: DebtView[];
  receivable: number;
  payable: number;
  overdue: number;
  assets: AssetView[];
  wealthSummary: WealthSummary | null;
  exchangeRates: ExchangeRate[];
  investments: number;
  netWorth: number;
  initialize: () => Promise<void>;
  refresh: () => Promise<void>;
  setBook: (id: string) => Promise<void>;
  saveTransaction: (
    input: repo.TransactionInput,
    id?: string,
  ) => Promise<string>;
  deleteTransaction: (id: string) => Promise<void>;
  restoreTransaction: (id: string) => Promise<void>;
  saveAccount: (input: repo.AccountInput, id?: string) => Promise<string>;
  archiveAccount: (id: string, archived: boolean) => Promise<void>;
  createBook: (name: string, currency: string) => Promise<string>;
  renameBook: (id: string, name: string) => Promise<void>;
  saveCategory: (
    input: {
      name: string;
      kind: Category['kind'];
      parentId?: string | null;
      icon: string;
      color: string;
    },
    id?: string,
  ) => Promise<string>;
  saveTag: (name: string, color?: string) => Promise<string>;
  saveFavorite: (input: {
    name: string;
    type: Favorite['type'];
    amount: number;
    accountId: string;
    categoryId: string | null;
  }) => Promise<string>;
  savePerson: (
    input: { name: string; phone?: string; note?: string },
    id?: string,
  ) => Promise<string>;
  deletePerson: (id: string) => Promise<void>;
  createDebt: (input: debtRepo.CreateDebtInput) => Promise<string>;
  addDebtEntry: (
    id: string,
    input: debtRepo.DebtEventInput,
    action: 'more' | 'payment',
  ) => Promise<string>;
  settleDebt: (id: string) => Promise<void>;
  updateDebtDetails: (
    id: string,
    input: { dueDate?: number | null; note?: string },
  ) => Promise<void>;
  createAsset: (input: {
    type: AssetType;
    name: string;
    institution?: string | null;
    principal: number;
    currentValue?: number;
    profitRate?: number | null;
    startDate: number;
    maturityDate?: number | null;
    unit?: string | null;
    currency: string;
    note?: string;
    fundingAccountId?: string | null;
  }) => Promise<string>;
  updateAsset: (
    id: string,
    input: {
      type?: AssetType;
      name?: string;
      institution?: string | null;
      principal?: number;
      currentValue?: number;
      profitRate?: number | null;
      startDate?: number;
      maturityDate?: number | null;
      unit?: string | null;
      currency?: string;
      note?: string;
    },
  ) => Promise<void>;
  deleteAsset: (id: string) => Promise<void>;
  recordAssetValuation: (
    assetId: string,
    input: { value: number; date: number },
  ) => Promise<string>;
  saveExchangeRate: (input: {
    base: string;
    quote: string;
    rate: number;
    date?: number;
    source?: 'server' | 'manual';
  }) => Promise<string>;
  fetchServerRates: () => Promise<void>;
};
let booting: Promise<void> | null = null;
export const useMoney = create<MoneyState>((set, get) => ({
  ready: false,
  error: null,
  bookId: null,
  books: [],
  accounts: [],
  categories: [],
  tags: [],
  favorites: [],
  transactions: [],
  balances: [],
  income: 0,
  expense: 0,
  total: 0,
  cash: 0,
  unconvertedCurrencies: [],
  people: [],
  debts: [],
  receivable: 0,
  payable: 0,
  overdue: 0,
  assets: [],
  wealthSummary: null,
  exchangeRates: [],
  investments: 0,
  netWorth: 0,
  initialize: () => {
    if (booting) return booting;
    booting = (async () => {
      try {
        await repo.initializeMoney();
        const books = await repo.listBooks();
        const saved = localStorage.getItem('tohobil.bookId');
        const selected = books.find((x) => x.id === saved)?.id ?? books[0].id;
        set({ books, bookId: selected });
        await get().refresh();
        set({ ready: true, error: null });
        void get().fetchServerRates().catch(() => {});
      } catch (e) {
        console.error('Money database initialization failed', e);
        set({
          ready: true,
          error: e instanceof Error ? e.message : 'DATABASE_ERROR',
        });
        throw e;
      } finally {
        booting = null;
      }
    })();
    return booting;
  },
  refresh: async () => {
    const bookId = get().bookId;
    if (!bookId) return;
    const [
      books,
      accounts,
      categories,
      tags,
      favorites,
      transactions,
      balances,
      people,
      debts,
      assets,
      wealthSummary,
      exchangeRates,
    ] = await Promise.all([
      repo.listBooks(),
      repo.listAccounts(bookId, true),
      repo.listCategories(bookId),
      repo.listTags(bookId),
      repo.listFavorites(bookId),
      repo.listTransactions({ bookId, limit: 100 }),
      repo.getBalances(bookId),
      debtRepo.listPeople(bookId),
      debtRepo.listDebts(bookId),
      repo.listAssets(bookId),
      repo.getWealthSummary(bookId),
      repo.listExchangeRates(bookId),
    ]);
    const now = new Date(),
      from = new Date(now.getFullYear(), now.getMonth(), 1).getTime(),
      to = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
    const monthlyTotals = await repo.getMonthlyTotals(bookId, from, to);
    const active = new Set(
      accounts.filter((x) => x.include_in_total).map((x) => x.id),
    );
    const cashIds = new Set(
      accounts.filter((x) => x.type === 'cash').map((x) => x.id),
    );

    const currentBook = books.find((b) => b.id === bookId);
    const baseCurrency = currentBook?.currency ?? 'BDT';
    const accMap = new Map(accounts.map((a) => [a.id, a]));

    let total = 0;
    let cash = 0;
    const unconvertedCurrencies = new Set<string>();
    const toBase = (amount: number, sourceCurrency: string): number | null => {
      if (amount === 0) return 0;
      if (sourceCurrency === baseCurrency) return amount;
      const direct = exchangeRates.find((r) => r.base === sourceCurrency && r.quote === baseCurrency);
      if (direct && direct.rate > 0) return convertMinor(amount, sourceCurrency, baseCurrency, direct.rate);
      const inverse = exchangeRates.find((r) => r.base === baseCurrency && r.quote === sourceCurrency);
      if (inverse && inverse.rate > 0) return convertMinor(amount, sourceCurrency, baseCurrency, inverse.rate, true);
      unconvertedCurrencies.add(sourceCurrency);
      return null;
    };
    for (const b of balances) {
      const acc = accMap.get(b.account_id);
      if (!acc) continue;
      const converted = toBase(b.balance, acc.currency);
      if (converted === null) continue;
      if (active.has(b.account_id)) total = addMinor(total, converted);
      if (cashIds.has(b.account_id)) cash = addMinor(cash, converted);
    }
    let income = 0;
    let expense = 0;
    for (const row of monthlyTotals) {
      const converted = toBase(row.total, row.currency);
      if (converted === null) continue;
      if (row.type === 'income') income = addMinor(income, converted);
      else expense = addMinor(expense, converted);
    }

    const receivable = addMinor(
      ...debts
        .filter((x) => x.direction === 'receivable')
        .map((x) => x.outstanding),
    );
    const payable = addMinor(
      ...debts
        .filter((x) => x.direction === 'payable')
        .map((x) => x.outstanding),
    );
    const overdue = addMinor(
      ...debts.filter((x) => x.overdue).map((x) => x.outstanding),
    );
    const investments = wealthSummary.currentValue;
    const netWorth = total + receivable + investments - payable;

    set({
      books,
      accounts,
      categories,
      tags,
      favorites,
      transactions,
      balances,
      income,
      expense,
      total,
      cash,
      unconvertedCurrencies: [...unconvertedCurrencies],
      people,
      debts,
      receivable,
      payable,
      overdue,
      assets,
      wealthSummary,
      exchangeRates,
      investments,
      netWorth,
    });
    void refreshDebtReminders(i18n.language).catch(() => {});
  },
  setBook: async (id) => {
    if (!get().books.some((x) => x.id === id))
      throw new Error('BOOK_NOT_FOUND');
    localStorage.setItem('tohobil.bookId', id);
    set({ bookId: id });
    await get().refresh();
  },
  saveTransaction: async (input, id) => {
    const bookId = get().bookId;
    if (!bookId) throw new Error('BOOK_NOT_FOUND');
    const result = await repo.saveTransaction(bookId, input, id);
    await get().refresh();
    return result;
  },
  deleteTransaction: async (id) => {
    await repo.deleteTransaction(id);
    await get().refresh();
  },
  restoreTransaction: async (id) => {
    await repo.restoreTransaction(id);
    await get().refresh();
  },
  saveAccount: async (input, id) => {
    const bookId = get().bookId;
    if (!bookId) throw new Error('BOOK_NOT_FOUND');
    const result = await repo.saveAccount(bookId, input, id);
    await get().refresh();
    return result;
  },
  archiveAccount: async (id, archived) => {
    await repo.archiveAccount(id, archived);
    await get().refresh();
  },
  createBook: async (name, currency) => {
    const id = await repo.createBook(name, currency);
    await get().refresh();
    await get().setBook(id);
    return id;
  },
  renameBook: async (id, name) => {
    await repo.renameBook(id, name);
    await get().refresh();
  },
  saveCategory: async (input, id) => {
    const bookId = get().bookId;
    if (!bookId) throw new Error('BOOK_NOT_FOUND');
    const result = await repo.saveCategory(bookId, input, id);
    await get().refresh();
    return result;
  },
  saveTag: async (name, color) => {
    const bookId = get().bookId;
    if (!bookId) throw new Error('BOOK_NOT_FOUND');
    const result = await repo.saveTag(bookId, name, color);
    await get().refresh();
    return result;
  },
  saveFavorite: async (input) => {
    const bookId = get().bookId;
    if (!bookId) throw new Error('BOOK_NOT_FOUND');
    const result = await repo.saveFavorite(bookId, input);
    await get().refresh();
    return result;
  },
  savePerson: async (input, id) => {
    const bookId = get().bookId;
    if (!bookId) throw new Error('BOOK_NOT_FOUND');
    const result = await debtRepo.savePerson(bookId, input, id);
    await get().refresh();
    return result;
  },
  deletePerson: async (id) => {
    const bookId = get().bookId;
    if (!bookId) throw new Error('BOOK_NOT_FOUND');
    await debtRepo.deletePerson(bookId, id);
    await get().refresh();
  },
  createDebt: async (input) => {
    const bookId = get().bookId;
    if (!bookId) throw new Error('BOOK_NOT_FOUND');
    const result = await debtRepo.createDebt(bookId, input);
    await get().refresh();
    return result;
  },
  addDebtEntry: async (id, input, action) => {
    const bookId = get().bookId;
    if (!bookId) throw new Error('BOOK_NOT_FOUND');
    const result = await debtRepo.addDebtEntry(bookId, id, input, action);
    await get().refresh();
    return result;
  },
  settleDebt: async (id) => {
    const bookId = get().bookId;
    if (!bookId) throw new Error('BOOK_NOT_FOUND');
    await debtRepo.settleDebt(bookId, id);
    await get().refresh();
  },
  updateDebtDetails: async (id, input) => {
    const bookId = get().bookId;
    if (!bookId) throw new Error('BOOK_NOT_FOUND');
    await debtRepo.updateDebtDetails(bookId, id, input);
    await get().refresh();
  },
  createAsset: async (input) => {
    const bookId = get().bookId;
    if (!bookId) throw new Error('BOOK_NOT_FOUND');
    const result = await repo.createAsset(bookId, input);
    await get().refresh();
    return result;
  },
  updateAsset: async (id, input) => {
    await repo.updateAsset(id, input);
    await get().refresh();
  },
  deleteAsset: async (id) => {
    await repo.deleteAsset(id);
    await get().refresh();
  },
  recordAssetValuation: async (assetId, input) => {
    const result = await repo.recordAssetValuation(assetId, input);
    await get().refresh();
    return result;
  },
  saveExchangeRate: async (input) => {
    const bookId = get().bookId;
    if (!bookId) throw new Error('BOOK_NOT_FOUND');
    const result = await repo.saveExchangeRate(bookId, input);
    await get().refresh();
    return result;
  },
  fetchServerRates: async () => {
    const bookId = get().bookId;
    if (!bookId) throw new Error('BOOK_NOT_FOUND');
    const book = get().books.find((b) => b.id === bookId);
    await repo.fetchAndStoreServerRates(bookId, book?.currency ?? 'BDT');
    await get().refresh();
  },
}));
