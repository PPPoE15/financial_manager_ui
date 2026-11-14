import { draftFromPlan, validateDraft, type PlanDraft, type PlanErrors } from '@/plans/model'
import type { PlannedOperation } from '@/types/plannedOperation'
import type {
  RegularFrequency,
  RegularOperationCreate,
  RegularOperationItem,
} from '@/types/regularOperation'

export const frequencies: Record<RegularFrequency, string> = {
  daily: 'Ежедневно',
  weekly: 'Еженедельно',
  monthly: 'Ежемесячно',
  yearly: 'Ежегодно',
}

export interface RegularDraft extends PlanDraft {
  frequency: RegularFrequency
  end: string
}

export type RegularErrors = PlanErrors & { end?: string }

export type RegularEntry = { draft: PlanDraft } | { source: PlannedOperation }

/** Предзаполняет поля, оставляя выбор даты для выполненного или просроченного плана. */
export function regularDraft(
  today: string,
  entry?: RegularEntry,
  operation?: RegularOperationItem,
): RegularDraft {
  if (operation)
    return {
      ...draftFromPlan({ ...operation, planned_date: operation.first_date }),
      frequency: operation.frequency,
      end: operation.end_date ?? '',
    }
  let draft: PlanDraft = { date: today, amount: '', category: '', description: '' }
  if (entry && 'draft' in entry) draft = { ...entry.draft }
  if (entry && 'source' in entry) {
    draft = draftFromPlan(entry.source)
    if (entry.source.status === 'completed' || draft.date < today) draft.date = ''
  }
  return { ...draft, frequency: 'monthly', end: '' }
}

/** Проверяет срок действия и сохраняет прежнюю прошедшую дату при редактировании. */
export function validateRegularDraft(
  draft: RegularDraft,
  today: string,
  originalDate?: string,
): RegularErrors {
  const errors: RegularErrors = validateDraft(draft, today, draft.date === originalDate)
  if (draft.end) {
    errors.end = validateDraft({ ...draft, date: draft.end }, today, true).date
    if (!errors.end && draft.end < draft.date)
      errors.end = 'Дата окончания должна быть не раньше даты первого платежа'
  }
  return errors
}

/** Преобразует проверенные поля в тело API. */
export function regularPayload(draft: RegularDraft): RegularOperationCreate {
  return {
    first_date: draft.date,
    end_date: draft.end || null,
    frequency: draft.frequency,
    money_sum: Number(draft.amount),
    category_uid: draft.category,
    description: draft.description || null,
  }
}

/** Отправляет только изменённые поля, включая явное снятие окончания. */
export function regularChanges(draft: RegularDraft, operation: RegularOperationItem) {
  const original = regularPayload(regularDraft('', undefined, operation))
  const body = regularPayload(draft)
  return Object.fromEntries(
    (Object.keys(body) as (keyof RegularOperationCreate)[])
      .filter(/** Оставляет поля, изменённые пользователем. */ (key) => body[key] !== original[key])
      .map(/** Сохраняет значение из черновика. */ (key) => [key, body[key]]),
  ) as Partial<RegularOperationCreate>
}
