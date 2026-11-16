import { computed, ref } from 'vue'
import {
  confirmPlan,
  createPlan,
  deletePlan,
  readPlan,
  readPlanTransaction,
  updatePlan,
} from '@/api/plannedOperations'
import { listCategories } from '@/api/categories'
import { listTransactions } from '@/api/transactions'
import { getBalanceHistory } from '@/api/balanceHistory'
import type { PlannedOperation } from '@/types/plannedOperation'
import type { Category } from '@/types/category'
import type { Transaction } from '@/types/transaction'
import { draftFromPlan, validateDraft, type PlanDraft, type PlanErrors } from './model'
import { planError } from './errors'
export type PlanAction = 'create' | 'confirm' | 'reschedule' | 'delete' | 'details'
/** Общая логика форм списка и будущего виджета главной; никакие мутации не повторяются автоматически. */
export function usePlanAction(
  mode: PlanAction,
  source: PlannedOperation | undefined,
  initialToday: string,
) {
  const current = ref(source)
  const today = ref(initialToday)
  const draft = ref<PlanDraft>(
    source
      ? draftFromPlan(source)
      : { date: initialToday, amount: '', category: '', description: '' },
  )
  const categories = ref<Category[]>([])
  const transaction = ref<Transaction | null>(null)
  const errors = ref<PlanErrors>({})
  const message = ref('')
  const loading = ref(false)
  const busy = ref(false)
  const loadFailed = ref(false)
  const factError = ref('')
  const success = ref(false)
  const unknown = ref(false)
  const needsDecision = ref(false)
  const currentVerified = ref(false)
  const unavailable = ref(false)
  let expectedVersion = source?.version
  const completed = computed(
    /** Показывает исходный план после подтверждения, включая восстановление. */ () =>
      mode !== 'create' && current.value?.status === 'completed',
  )
  /** Загружает доступные категории без изменения пользовательского ввода. */
  async function loadCategories() {
    categories.value =
      mode === 'create'
        ? (await Promise.all([listCategories('income'), listCategories('outcome')])).flat()
        : current.value
          ? await listCategories(current.value.transaction_type)
          : []
  }
  /** Читает связанный факт и скрывает ссылку при его внешнем удалении. */
  async function loadFact() {
    transaction.value = null
    factError.value = ''
    const plan = current.value
    if (!plan || plan.transaction_state !== 'available' || !plan.transaction_uid) return
    try {
      transaction.value = await readPlanTransaction(plan.transaction_uid)
    } catch (failure) {
      if (planError(failure).status === 404) {
        try {
          current.value = await readPlan(plan.uid)
        } catch {
          unavailable.value = true
        }
        factError.value = 'Фактическая операция удалена.'
      } else factError.value = 'Не удалось загрузить фактическую операцию.'
    }
  }
  /** Загружает актуальную версию при открытии окна до начала редактирования. */
  async function load() {
    loading.value = true
    loadFailed.value = false
    try {
      if (source && mode !== 'create') {
        current.value = await readPlan(source.uid)
        expectedVersion = current.value.version
        today.value = current.value.today
        draft.value = draftFromPlan(current.value)
      }
      if (mode !== 'details' && mode !== 'delete') await loadCategories()
      if (completed.value) await loadFact()
    } catch {
      loadFailed.value = true
      message.value = 'Не удалось загрузить данные. Повторите загрузку.'
    } finally {
      loading.value = false
    }
  }
  /** Перечитывает план после сбоя, но оставляет черновик и согласованную версию прежними. */
  async function reconcile() {
    if (!current.value) return
    needsDecision.value = true
    currentVerified.value = false
    try {
      current.value = await readPlan(current.value.uid)
      today.value = current.value.today
      currentVerified.value = true
      if (completed.value) await loadFact()
    } catch (failure) {
      if (planError(failure).status === 404) {
        unavailable.value = true
        if (mode === 'delete') success.value = true
      } else message.value += ' Не удалось проверить актуальное состояние.'
    }
  }
  /** Согласует новую версию явным нажатием после отображения актуальных полей. */
  function acceptCurrent() {
    if (!currentVerified.value || !current.value || unavailable.value || (completed.value && mode !== 'delete')) return
    expectedVersion = current.value.version
    needsDecision.value = false
    unknown.value = false
  }
  /** Обновляет фактический список и баланс чтением, без локального прибавления суммы. */
  async function refreshActual() {
    if (!current.value) return
    const date = draft.value.date
    const results = await Promise.allSettled([
      listTransactions(current.value.transaction_type),
      getBalanceHistory(`${date.slice(0, 7)}-01`, date),
    ])
    if (
      results.some(
        /** Выявляет неполную сверку отчётов. */ (result) => result.status === 'rejected',
      )
    )
      message.value += ' Не удалось обновить все фактические данные.'
  }
  /** Выполняет одно явно выбранное действие и сохраняет ввод при любой ошибке. */
  async function submit() {
    if (
      busy.value ||
      loading.value ||
      loadFailed.value ||
      unavailable.value ||
      needsDecision.value ||
      mode === 'details' ||
      (completed.value && mode !== 'delete')
    )
      return
    errors.value =
      mode === 'delete' ? {} : validateDraft(draft.value, today.value, mode === 'confirm')
    if (mode === 'reschedule') {
      delete errors.value.amount
      delete errors.value.category
      delete errors.value.description
    }
    if (Object.keys(errors.value).length) return
    busy.value = true
    message.value = ''
    try {
      const values = {
        money_sum: Number(draft.value.amount),
        category_uid: draft.value.category,
        description: draft.value.description || null,
      }
      if (mode === 'create') await createPlan({ ...values, planned_date: draft.value.date })
      else if (current.value && expectedVersion !== undefined) {
        if (mode === 'confirm') {
          const result = await confirmPlan(current.value.uid, {
            ...values,
            expected_version: expectedVersion,
            transaction_date: `${draft.value.date}T00:00:00`,
          })
          current.value = result.plan
          transaction.value = result.transaction
          await refreshActual()
        } else if (mode === 'reschedule')
          current.value = await updatePlan(current.value.uid, {
            expected_version: expectedVersion,
            planned_date: draft.value.date,
          })
        else await deletePlan(current.value.uid, expectedVersion)
      }
      success.value = true
    } catch (failure) {
      const parsed = planError(failure)
      errors.value = parsed.fields
      unknown.value = parsed.unknown
      message.value =
        mode === 'create' && parsed.unknown
          ? 'Не удалось подтвердить создание операции. Проверьте список перед повторным созданием'
          : parsed.message
      if (parsed.status === 400) {
        try {
          await loadCategories()
        } catch {
          message.value += ' Не удалось обновить категории.'
        }
      }
      if (
        mode !== 'create' &&
        (parsed.unknown || parsed.status === 409 || parsed.status === 404 || parsed.status === 422)
      )
        await reconcile()
      if (mode === 'confirm' && parsed.unknown) await refreshActual()
    } finally {
      busy.value = false
    }
  }
  return {
    current,
    today,
    draft,
    categories,
    transaction,
    errors,
    message,
    loading,
    busy,
    loadFailed,
    factError,
    success,
    unknown,
    needsDecision,
    currentVerified,
    unavailable,
    completed,
    load,
    loadFact,
    submit,
    reconcile,
    acceptCurrent,
  }
}
