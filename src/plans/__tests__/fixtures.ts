import type { PlannedOperation } from '@/types/plannedOperation'
/** Создаёт независимый план для проверки переходов. */
export function plan(uid = 'p', overrides: Partial<PlannedOperation> = {}): PlannedOperation {
  return {
    uid,
    planned_date: '2026-11-09',
    money_sum: 10,
    category: { uid: 'c', name: 'ЖКХ' },
    transaction_type: 'outcome',
    description: 'Исходный',
    version: 1,
    status: 'pending',
    completed_at: null,
    transaction_uid: null,
    transaction_state: 'none',
    today: '2026-11-09',
    timezone: 'Europe/Moscow',
    ...overrides,
  }
}
