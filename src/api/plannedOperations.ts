import { http } from '@/api/client'
import type {
  PlanConfirmation,
  PlanConfirmed,
  PlanCreate,
  PlanFilters,
  PlannedOperation,
  PlannedOperationList,
  PlanUpdate,
} from '@/types/plannedOperation'
import type { Transaction } from '@/types/transaction'
/** Загружает все страницы, удаляя повторы при конкурентном сдвиге offset. */
export async function loadPlans(
  filters: PlanFilters,
  signal?: AbortSignal,
): Promise<PlannedOperationList> {
  const rows = new Map<string, PlannedOperation>()
  let skip = 0
  let first: PlannedOperationList | undefined
  while (true) {
    const { data } = await http.get<PlannedOperationList>('/planned-operations', {
      params: { ...filters, skip, limit: 500 },
      signal,
    })
    first ??= data
    for (const row of data.content) rows.set(row.uid, row)
    if (data.next_skip === null) break
    if (!Number.isInteger(data.next_skip) || data.next_skip <= skip || data.next_skip > 100000)
      throw new Error('Некорректная пагинация планов')
    skip = data.next_skip
  }
  return {
    ...first,
    next_skip: null,
    content: [...rows.values()].sort(
      /** Восстанавливает фиксированный порядок после удаления повторов. */ (a, b) =>
        a.planned_date.localeCompare(b.planned_date) || a.uid.localeCompare(b.uid),
    ),
  }
}
/** Создаёт план одним запросом, без автоматического повтора после сбоя. */
export async function createPlan(body: PlanCreate): Promise<PlannedOperation> {
  return (await http.post<PlannedOperation>('/planned-operations', body)).data
}
/** Перечитывает актуальное состояние плана для сверки конфликта. */
export async function readPlan(uid: string): Promise<PlannedOperation> {
  return (await http.get<PlannedOperation>(`/planned-operations/${encodeURIComponent(uid)}`)).data
}
/** Обновляет одну строку с исходной согласованной версией. */
export async function updatePlan(uid: string, body: PlanUpdate): Promise<PlannedOperation> {
  return (
    await http.patch<PlannedOperation>(`/planned-operations/${encodeURIComponent(uid)}`, body)
  ).data
}
/** Удаляет план, сохраняя связанную фактическую операцию. */
export async function deletePlan(uid: string, version: number): Promise<void> {
  await http.delete(`/planned-operations/${encodeURIComponent(uid)}`, {
    params: { expected_version: version },
  })
}
/** Подтверждает план одним запросом с полными фактическими значениями. */
export async function confirmPlan(uid: string, body: PlanConfirmation): Promise<PlanConfirmed> {
  return (
    await http.post<PlanConfirmed>(`/planned-operations/${encodeURIComponent(uid)}/confirm`, body)
  ).data
}
/** Получает актуальный факт по UID, не подменяя его исходными значениями плана. */
export async function readPlanTransaction(uid: string): Promise<Transaction> {
  return (await http.get<Transaction>(`/transactions/${encodeURIComponent(uid)}`)).data
}
