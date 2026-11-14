import { http } from '@/api/client'
import type { PlannedOperation } from '@/types/plannedOperation'
import type {
  RegularOperation,
  RegularOperationCreate,
  RegularOperationItem,
  RegularOperationList,
  RegularOperationUpdate,
} from '@/types/regularOperation'

/** Загружает все страницы списка, сохраняя только одну строку на операцию. */
export async function loadRegularOperations(sourcePlanUid?: string, signal?: AbortSignal) {
  const content = new Map<string, RegularOperationItem>()
  let skip = 0
  while (true) {
    const { data } = await http.get<RegularOperationList>('/regular-operations', {
      params: { skip, limit: 500, source_plan_uid: sourcePlanUid },
      signal,
    })
    for (const operation of data.content) content.set(operation.uid, operation)
    if (data.next_skip === null) return { ...data, content: [...content.values()] }
    if (!Number.isSafeInteger(data.next_skip) || data.next_skip <= skip)
      throw new Error('Некорректная пагинация регулярных операций')
    skip = data.next_skip
  }
}

/** Формирует адрес одной операции. */
function operationPath(uid: string) {
  return `/regular-operations/${encodeURIComponent(uid)}`
}

/** Получает актуальную операцию для просмотра или сверки версии. */
export async function readRegularOperation(uid: string) {
  return (await http.get<RegularOperation>(operationPath(uid))).data
}

/** Создаёт операцию одним запросом. */
export async function createRegularOperation(body: RegularOperationCreate) {
  return (await http.post<RegularOperation>('/regular-operations', body)).data
}

/** Преобразует план с проверкой версии источника. */
export async function convertPlan(plan: PlannedOperation, body: RegularOperationCreate) {
  return (
    await http.post<{ operation: RegularOperation }>(
      `/planned-operations/${encodeURIComponent(plan.uid)}/recurrence`,
      { ...body, expected_version: plan.version },
    )
  ).data.operation
}

/** Сохраняет изменённые поля с исходной версией. */
export async function updateRegularOperation(uid: string, body: RegularOperationUpdate) {
  return (await http.patch<RegularOperation>(operationPath(uid), body)).data
}

/** Удаляет операцию и её невыполненные платежи. */
export async function deleteRegularOperation(uid: string, version: number) {
  await http.delete(operationPath(uid), { params: { expected_version: version } })
}
