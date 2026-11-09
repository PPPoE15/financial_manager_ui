import { computed, ref } from 'vue'
import { loadPlans, readPlan, updatePlan } from '@/api/plannedOperations'
import type { PlannedOperation, PlanFilters, PlanUpdate } from '@/types/plannedOperation'
import {
  acceptAmount,
  draftFromPlan,
  validateDraft,
  type PlanDraft,
  type PlanErrors,
} from './model'
import { planError } from './errors'
export interface EditedPlan {
  base: PlannedOperation
  draft: PlanDraft
  errors: PlanErrors
  message: string
  current?: PlannedOperation
  blocked: boolean
}
/** Управляет независимыми черновиками строк и не заменяет их версии фоновым чтением. */
export function usePlans() {
  const rows = ref<PlannedOperation[]>([])
  const drafts = ref<Record<string, EditedPlan>>({})
  const filters = ref<PlanFilters>({ include_completed: false })
  const today = ref('')
  const total = ref(0)
  const dueCount = ref(0)
  const loading = ref(false)
  const saving = ref(false)
  const error = ref('')
  let generation = 0
  let controller: AbortController | undefined
  const dirty = computed(
    /** Считает строки с несохранёнными изменениями. */ () => Object.keys(drafts.value).length,
  )
  /** Читает список заново, отменяя устаревший запрос без потери черновиков. */
  async function load() {
    const request = ++generation
    controller?.abort()
    controller = new AbortController()
    loading.value = true
    error.value = ''
    try {
      const result = await loadPlans({ ...filters.value }, controller.signal)
      if (request !== generation) return
      rows.value = result.content
      today.value = result.today
      total.value = result.total
      dueCount.value = result.due_count
    } catch {
      if (request === generation) error.value = 'Не удалось загрузить планы. Проверьте подключение.'
    } finally {
      if (request === generation) loading.value = false
    }
  }
  /** Создаёт отдельную копию строки; обновление списка не меняет базовую версию. */
  function edit(plan: PlannedOperation, field: keyof PlanDraft, value: string) {
    if (saving.value || plan.status !== 'pending') return
    const entry = (drafts.value[plan.uid] ??= {
      base: { ...plan },
      draft: draftFromPlan(plan),
      errors: {},
      message: '',
      blocked: false,
    })
    entry.draft[field] = field === 'amount' ? acceptAmount(entry.draft.amount, value) : value
    delete entry.errors[field]
  }
  /** Очищает черновики до отправки без обращения к API. */
  function cancel() {
    if (!saving.value) drafts.value = {}
  }
  /** Отправляет только изменённые поля и исходную версию строки. */
  function changes(entry: EditedPlan): PlanUpdate {
    const original = draftFromPlan(entry.base)
    const body: PlanUpdate = { expected_version: entry.base.version }
    if (entry.draft.date !== original.date) body.planned_date = entry.draft.date
    if (entry.draft.amount !== original.amount) body.money_sum = Number(entry.draft.amount)
    if (entry.draft.category !== original.category) body.category_uid = entry.draft.category
    if (entry.draft.description !== original.description)
      body.description = entry.draft.description || null
    return body
  }
  /** Перечитывает запись после конфликта, оставляя решение о новой версии пользователю. */
  async function reconcile(uid: string, entry: EditedPlan) {
    entry.blocked = true
    try {
      entry.current = await readPlan(uid)
    } catch {
      entry.message += ' Не удалось прочитать актуальный план.'
    }
  }
  /** Сохраняет строки отдельно: успех удаляет черновик, ошибка оставляет его для исправления. */
  async function save() {
    if (saving.value) return
    saving.value = true
    try {
      for (const [uid, entry] of Object.entries(drafts.value)) {
        if (entry.blocked) continue
        entry.errors = validateDraft(entry.draft, today.value)
        if (Object.keys(entry.errors).length) continue
        const body = changes(entry)
        if (Object.keys(body).length === 1) {
          delete drafts.value[uid]
          continue
        }
        try {
          await updatePlan(uid, body)
          delete drafts.value[uid]
        } catch (failure) {
          const parsed = planError(failure)
          entry.errors = parsed.fields
          entry.message = parsed.message
          if (parsed.status === 409 || parsed.status === 404 || parsed.unknown)
            await reconcile(uid, entry)
        }
      }
      await load()
    } finally {
      saving.value = false
    }
  }
  /** Принимает прочитанную версию только после явного решения пользователя сохранить его черновик. */
  function acceptCurrent(uid: string) {
    const entry = drafts.value[uid]
    if (!entry?.current || entry.current.status !== 'pending') return
    entry.base = entry.current
    entry.current = undefined
    entry.blocked = false
    entry.message = ''
  }
  /** Повторяет только чтение для сверки после временной ошибки сети. */
  async function retryReconcile(uid: string) {
    const entry = drafts.value[uid]
    if (entry && !saving.value) await reconcile(uid, entry)
  }
  /** Отменяет чтение при уходе с экрана. */
  function dispose() {
    generation++
    controller?.abort()
  }
  return {
    rows,
    drafts,
    filters,
    today,
    total,
    dueCount,
    loading,
    saving,
    error,
    dirty,
    load,
    edit,
    cancel,
    save,
    acceptCurrent,
    dispose,
    retryReconcile,
  }
}
