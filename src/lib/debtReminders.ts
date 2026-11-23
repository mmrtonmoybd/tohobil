import { Capacitor } from '@capacitor/core';
import type { LocalNotificationSchema } from '@capacitor/local-notifications';
import type { TFunction } from 'i18next';
import type { DebtInstallment, DebtView } from '../db/types';
import { listDebts, listUpcomingInstallments } from '../db/debts';
import { listBooks } from '../db/repository';
import { formatMinor } from './money';
import i18n from '../i18n';

const KEY = 'tohobil.debtReminders';
function notificationId(value: string): number {
  let hash = 2166136261;
  for (const char of value)
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0) & 0x7fffffff;
}
function atNine(due: number): Date {
  const date = new Date(due);
  date.setHours(9, 0, 0, 0);
  return date;
}
let scheduleQueue: Promise<void> = Promise.resolve();
type UpcomingInstallment = DebtInstallment & {
  person_name: string;
  currency: string;
};
export function buildDebtNotifications(
  debts: DebtView[],
  installments: UpcomingInstallment[],
  language: string,
  t: TFunction,
  now: number,
): LocalNotificationSchema[] {
  const notifications: LocalNotificationSchema[] = [];
  for (const debt of debts) {
    if (
      !debt.outstanding ||
      !debt.due_date ||
      atNine(debt.due_date).getTime() <= now
    )
      continue;
    notifications.push({
      id: notificationId(`debt:${debt.id}`),
      title: t('debtFlow.dueNotificationTitle'),
      body: t('debtFlow.dueNotificationBody', {
        name: debt.person_name,
        amount: formatMinor(debt.outstanding, debt.currency, language),
      }),
      schedule: { at: atNine(debt.due_date) },
      isExactNotification: false,
      channelId: 'tohobil-debts',
      extra: { tohobilDebt: true, debtId: debt.id },
    });
  }
  for (const installment of installments) {
    if (atNine(installment.due_date).getTime() <= now) continue;
    notifications.push({
      id: notificationId(`installment:${installment.id}`),
      title: t('debtFlow.installmentNotificationTitle'),
      body: t('debtFlow.installmentNotificationBody', {
        name: installment.person_name,
        amount: formatMinor(
          installment.amount - installment.paid_amount,
          installment.currency,
          language,
        ),
      }),
      schedule: { at: atNine(installment.due_date) },
      isExactNotification: false,
      channelId: 'tohobil-debts',
      extra: { tohobilDebt: true, debtId: installment.debt_id },
    });
  }
  return notifications
    .sort((a, b) => a.schedule!.at!.getTime() - b.schedule!.at!.getTime())
    .slice(0, 60);
}
async function scheduleDebtReminders(
  language: string,
  t: TFunction,
): Promise<void> {
  if (!Capacitor.isNativePlatform() || localStorage.getItem(KEY) !== 'on')
    return;
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  if ((await LocalNotifications.checkPermissions()).display !== 'granted')
    return;
  const books = await listBooks();
  const debts = (
    await Promise.all(books.map((book) => listDebts(book.id)))
  ).flat();
  const installments = (
    await Promise.all(books.map((book) => listUpcomingInstallments(book.id)))
  ).flat();
  const notifications = buildDebtNotifications(
    debts,
    installments,
    language,
    t,
    Date.now(),
  );
  await LocalNotifications.createChannel({
    id: 'tohobil-debts',
    name: t('debtFlow.reminderChannel'),
    description: t('debtFlow.reminderChannelDescription'),
    importance: 3,
  });
  const pending = (await LocalNotifications.getPending()).notifications.filter(
    (x) => x.extra?.tohobilDebt === true,
  );
  if (pending.length)
    await LocalNotifications.cancel({
      notifications: pending.map((x) => ({ id: x.id })),
    });
  if (notifications.length)
    await LocalNotifications.schedule({ notifications });
}
export function refreshDebtReminders(
  language: string,
  t: TFunction = i18n.t,
): Promise<void> {
  scheduleQueue = scheduleQueue
    .catch(() => {})
    .then(() => scheduleDebtReminders(language, t));
  return scheduleQueue;
}
export async function enableDebtReminders(
  language: string,
  t: TFunction,
): Promise<void> {
  if (!Capacitor.isNativePlatform()) throw new Error('NATIVE_ONLY');
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  const permission = await LocalNotifications.requestPermissions();
  if (permission.display !== 'granted') throw new Error('NOTIFICATION_DENIED');
  localStorage.setItem(KEY, 'on');
  await refreshDebtReminders(language, t);
}
