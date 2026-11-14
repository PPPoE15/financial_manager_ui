<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { LOGIN_ROUTE } from '@/router/names'
import { usePlans } from '@/plans/usePlans'
import { draftFromPlan, formatPlanDate, type PlanDraft } from '@/plans/model'
import type { PlanAction } from '@/plans/usePlanAction'
import type { PlannedOperation } from '@/types/plannedOperation'
import type { Category } from '@/types/category'
import type { TransactionType } from '@/types/budget'
import { listCategories } from '@/api/categories'
import BaseButton from '@/components/ui/BaseButton.vue'
import ErrorMessage from '@/components/ui/ErrorMessage.vue'
import PlanFields from '@/components/plans/PlanFields.vue'
import PlanningHeader from '@/components/plans/PlanningHeader.vue'
import PlanDialog from '@/components/plans/PlanDialog.vue'
import TransactionListDialog from '@/components/transactions/TransactionListDialog.vue'
const {
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
} = usePlans()
const categories = ref<Category[]>([])
const categoryError = ref('')
const activeFields = ref<Record<string, keyof PlanDraft>>({})
const menuUid = ref<string | null>(null)
const dialog = ref<{ mode: PlanAction; plan?: PlannedOperation; key: number } | null>(null)
const fact = ref<PlannedOperation | null>(null)
const leaveMessage = ref('')
let sequence = 0
let timer: ReturnType<typeof setInterval>
const filterOptions: { label: string; value?: TransactionType }[] = [
  { label: 'Все' },
  { label: 'Доходы', value: 'income' },
  { label: 'Расходы', value: 'outcome' },
]
const fields: { key: keyof PlanDraft; label: string }[] = [
  { key: 'date', label: 'Дата' },
  { key: 'category', label: 'Категория' },
  { key: 'description', label: 'Комментарий' },
  { key: 'amount', label: 'Сумма' },
]
const displayRows = computed(
  /** Сохраняет видимость черновика даже после внешнего удаления строки. */ () => {
    const result = new Map(rows.value.map(/** Индексирует актуальные строки. */ (p) => [p.uid, p]))
    for (const [uid, entry] of Object.entries(drafts.value))
      if (!result.has(uid)) result.set(uid, entry.base)
    return [...result.values()]
  },
)
/** Загружает категории обоих типов для создания и встроенного редактирования. */
async function loadCategories() {
  try {
    categories.value = (
      await Promise.all([listCategories('income'), listCategories('outcome')])
    ).flat()
    categoryError.value = ''
  } catch {
    categoryError.value = 'Не удалось загрузить категории.'
  }
}
/** Возвращает категории неизменяемого типа строки. */
function rowCategories(plan: PlannedOperation) {
  return categories.value.filter(
    /** Сохраняет тип существующего плана. */ (c) => c.category_type === plan.transaction_type,
  )
}
/** Показывает изменённые значения до сохранения, иначе исходные данные. */
function value(plan: PlannedOperation, key: keyof PlanDraft) {
  const draft = drafts.value[plan.uid]?.draft ?? draftFromPlan(plan)
  if (key === 'date') return formatPlanDate(draft.date)
  if (key === 'amount')
    return `${plan.transaction_type === 'income' ? '+' : '−'}${Number(draft.amount).toLocaleString('ru-RU')} ₽`
  if (key === 'category' && plan.status === 'completed') return plan.category.name
  if (key === 'category')
    return (
      categories.value.find(
        /** Ищет актуальное имя выбранной категории. */ (c) => c.uid === draft.category,
      )?.name ?? plan.category.name
    )
  return draft.description || '—'
}
/** Открывает только выбранное поле в самой строке и фокусирует его. */
async function startEdit(plan: PlannedOperation, key: keyof PlanDraft) {
  edit(plan, key, (drafts.value[plan.uid]?.draft ?? draftFromPlan(plan))[key])
  activeFields.value[plan.uid] = key
  await nextTick()
  document
    .querySelector<HTMLElement>(
      `[data-plan-uid="${plan.uid}"] input, [data-plan-uid="${plan.uid}"] select, [data-plan-uid="${plan.uid}"] textarea`,
    )
    ?.focus()
}
/** Передаёт изменение единственного открытого поля редактору. */
function updateDraft(plan: PlannedOperation, draft: PlanDraft) {
  const key = activeFields.value[plan.uid]
  if (key) edit(plan, key, draft[key])
}
/** Отменяет все локальные изменения. */
function discard() {
  cancel()
  activeFields.value = {}
  leaveMessage.value = ''
}
/** Сохраняет строки и закрывает успешно сохранённые поля. */
async function saveRows() {
  await save()
  for (const uid of Object.keys(activeFields.value))
    if (!drafts.value[uid]) delete activeFields.value[uid]
  await loadCategories()
}
/** Меняет фильтр только при отсутствии несохранённых правок. */
async function filter(type?: TransactionType) {
  if (dirty.value || saving.value) return
  filters.value.transaction_type = type
  await load()
}
/** Переключает видимость выполненных записей. */
async function toggleCompleted(event: Event) {
  filters.value.include_completed = (event.target as HTMLInputElement).checked
  await load()
}
/** Открывает действие после закрытия предыдущего окна, сохраняя фокус Teleport. */
async function open(mode: PlanAction, plan?: PlannedOperation) {
  menuUid.value = null
  dialog.value = null
  await nextTick()
  dialog.value = { mode, plan, key: ++sequence }
}
/** Открывает связанный факт в существующем редакторе фактических операций. */
async function openFact(plan: PlannedOperation) {
  dialog.value = null
  await nextTick()
  fact.value = plan
}
/** Закрывает редактор факта и перечитывает состояние связи с планом. */
function closeFact() {
  fact.value = null
  void load()
}
/** Обновляет данные после возвращения во вкладку и при смене серверного дня. */
function refresh() {
  if (!saving.value && !document.hidden) {
    void load()
    void loadCategories()
  }
}
/** Защищает черновик при закрытии вкладки. */
function beforeUnload(event: BeforeUnloadEvent) {
  if (dirty.value || saving.value || dialog.value) event.preventDefault()
}
onBeforeRouteLeave(
  /** Не блокирует окончание сессии; защищает черновик при обычной навигации. */ (to) => {
    if (to.name === LOGIN_ROUTE) return true
    if (dirty.value || saving.value || dialog.value) {
      leaveMessage.value = 'Сохраните или отмените изменения и закройте окно перед переходом.'
      return false
    }
    return true
  },
)
onMounted(
  /** Загружает экран и подписывается на возврат во вкладку. */ () => {
    refresh()
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('beforeunload', beforeUnload)
    timer = setInterval(refresh, 60000)
  },
)
onBeforeUnmount(
  /** Отменяет запросы и освобождает подписки экрана. */ () => {
    dispose()
    clearInterval(timer)
    window.removeEventListener('focus', refresh)
    document.removeEventListener('visibilitychange', refresh)
    window.removeEventListener('beforeunload', beforeUnload)
  },
)
</script>
<template>
  <div class="min-w-0 px-4 pb-8 pt-6 sm:px-6 lg:px-[38px] lg:pt-8">
    <PlanningHeader />
    <section
      aria-label="Список планов"
      class="mt-7 min-w-0 rounded-md bg-surface-card/80 p-4 sm:p-7"
    >
      <div class="flex flex-wrap items-center gap-4">
        <div
          class="order-2 flex w-full rounded bg-field/60 p-1 sm:order-1 sm:w-auto"
          aria-label="Тип операции"
        >
          <button
            v-for="option in filterOptions"
            :key="option.label"
            type="button"
            :disabled="!!dirty || saving"
            :aria-pressed="filters.transaction_type === option.value"
            class="min-h-11 flex-1 rounded px-5 text-sm focus-visible:outline disabled:opacity-50"
            :class="
              filters.transaction_type === option.value &&
              'bg-action font-bold text-action-foreground'
            "
            @click="filter(option.value)"
          >
            {{ option.label }}
          </button>
        </div>
        <label class="order-3 flex min-h-11 items-center gap-2 text-sm sm:ml-auto"
          ><input
            type="checkbox"
            :checked="filters.include_completed"
            :disabled="!!dirty || saving"
            class="size-4"
            @change="toggleCompleted"
          />Показать выполненные</label
        >
        <BaseButton
          class="order-1 w-full gap-3 sm:order-4 sm:w-auto"
          :disabled="!today || saving || !!dirty"
          @click="open('create')"
          ><span aria-hidden="true" class="inline-flex items-center">+</span>Запланировать
          операцию</BaseButton
        >
      </div>
      <div class="my-4 flex flex-wrap items-center gap-3 text-sm text-ink-muted">
        <span>{{ total }} запланировано</span
        ><span v-if="dueCount" class="rounded bg-warning/10 px-3 py-2 text-warning"
          >Требуют внимания: {{ dueCount }}</span
        ><span class="min-w-0 break-words"
          >Нажмите на дату, сумму, категорию или комментарий, чтобы изменить поле.</span
        >
      </div>
      <ErrorMessage :message="leaveMessage" /><ErrorMessage :message="categoryError" /><BaseButton
        v-if="categoryError"
        variant="secondary"
        @click="loadCategories"
        >Обновить категории</BaseButton
      >
      <p v-if="loading" role="status" class="py-4 text-center text-sm">Загрузка…</p>
      <div v-if="error" class="py-8 text-center">
        <ErrorMessage :message="error" /><BaseButton class="mt-4" @click="load"
          >Повторить</BaseButton
        >
      </div>
      <div v-else-if="!loading && !displayRows.length" class="py-20 text-center">
        <h2 class="text-xl font-bold">
          {{ filters.transaction_type ? 'Нет подходящих планов' : 'Пока нет планов' }}
        </h2>
        <p class="mt-4 text-sm text-ink-muted">
          {{
            filters.transaction_type
              ? 'Попробуйте другой фильтр.'
              : 'Добавьте будущий доход или расход.'
          }}
        </p>
        <BaseButton class="mt-6" @click="open('create')">Запланировать</BaseButton>
      </div>
      <div
        v-if="displayRows.length"
        role="table"
        aria-label="Запланированные операции"
        class="min-w-0"
      >
        <div
          role="row"
          class="hidden grid-cols-[minmax(110px,1fr)_80px_minmax(130px,1.3fr)_minmax(130px,1.3fr)_minmax(110px,1fr)_250px] gap-3 bg-field/60 p-3 text-caption font-bold xl:grid"
        >
          <span role="columnheader">Дата ↑</span><span role="columnheader">Тип</span
          ><span role="columnheader">Категория</span><span role="columnheader">Комментарий</span
          ><span role="columnheader">Сумма</span><span role="columnheader">Действия</span>
        </div>
        <div
          v-for="plan in displayRows"
          :key="plan.uid"
          :data-plan-uid="plan.uid"
          role="row"
          class="relative mb-3 grid min-w-0 grid-cols-2 gap-3 border-l-2 border-b border-b-field-border/20 p-3 xl:mb-0 xl:grid-cols-[minmax(110px,1fr)_80px_minmax(130px,1.3fr)_minmax(130px,1.3fr)_minmax(110px,1fr)_250px] xl:items-center"
          :class="
            plan.status === 'completed'
              ? 'border-l-transparent opacity-80'
              : plan.planned_date < today
                ? 'border-l-warning bg-warning/10'
                : plan.planned_date === today
                  ? 'border-l-action bg-action/10'
                  : 'border-l-transparent bg-field/20'
          "
        >
          <div
            v-for="field in fields"
            :key="field.key"
            role="cell"
            class="min-w-0 break-words"
            :class="
              field.key === 'date'
                ? 'order-1 col-span-2 xl:col-span-1'
                : field.key === 'category'
                  ? 'order-3 col-span-2 xl:col-span-1'
                  : field.key === 'description'
                    ? 'order-4 col-span-2 xl:col-span-1'
                    : 'order-5'
            "
          >
            <PlanFields
              v-if="activeFields[plan.uid] === field.key && drafts[plan.uid]"
              :model-value="drafts[plan.uid]!.draft"
              :categories="rowCategories(plan)"
              :today="today"
              :errors="drafts[plan.uid]!.errors"
              :busy="saving"
              :only="field.key"
              @update:model-value="updateDraft(plan, $event)"
            />
            <button
              v-else-if="plan.status === 'pending'"
              type="button"
              :data-edit="field.key"
              :aria-label="`Изменить: ${field.label}, ${plan.category.name}`"
              :disabled="saving"
              class="min-h-8 max-w-full rounded text-left text-sm focus-visible:outline disabled:opacity-50"
              :class="field.key === 'amount' && 'font-bold'"
              @click="startEdit(plan, field.key)"
            >
              {{ value(plan, field.key) }}
            </button>
            <span v-else class="text-sm" :class="field.key === 'amount' && 'font-bold'">{{
              value(plan, field.key)
            }}</span>
            <p
              v-if="field.key === 'date'"
              class="mt-1 text-caption"
              :class="plan.status === 'completed' ? 'text-success' : 'text-warning'"
            >
              {{
                plan.status === 'completed'
                  ? 'Выполнен'
                  : plan.planned_date < today
                    ? 'Просрочено'
                    : plan.planned_date === today
                      ? 'Сегодня'
                      : ''
              }}
            </p>
            <ErrorMessage
              v-if="activeFields[plan.uid] !== field.key"
              :message="drafts[plan.uid]?.errors[field.key]"
            />
          </div>
          <span
            role="cell"
            class="order-2 text-sm"
            :class="plan.transaction_type === 'income' ? 'text-success' : 'text-danger'"
            >{{ plan.transaction_type === 'income' ? 'Доход' : 'Расход' }}</span
          >
          <div
            role="cell"
            class="order-6 col-span-2 flex min-w-0 flex-wrap items-center gap-2 xl:col-span-1"
          >
            <template v-if="plan.status === 'pending' && !drafts[plan.uid]"
              ><BaseButton
                class="!px-3 !text-caption !font-normal"
                :disabled="saving || !!dirty"
                @click="open('confirm', plan)"
                >Подтвердить</BaseButton
              ><BaseButton
                class="!px-3 !text-caption !font-normal"
                variant="secondary"
                :disabled="saving || !!dirty"
                @click="open('reschedule', plan)"
                >Перенести</BaseButton
              ></template
            >
            <span v-else-if="drafts[plan.uid]" class="text-caption">Есть изменения</span>
            <BaseButton
              v-else
              variant="secondary"
              :disabled="saving || !!dirty"
              @click="open('details', plan)"
              >Подробнее</BaseButton
            >
            <div class="relative ml-auto">
              <button
                type="button"
                data-plan-menu
                :aria-label="`Действия: ${plan.category.name}`"
                :aria-expanded="menuUid === plan.uid"
                class="min-h-11 min-w-8 rounded focus-visible:outline"
                @click="menuUid = menuUid === plan.uid ? null : plan.uid"
                @keydown.esc="menuUid = null"
              >
                …
              </button>
              <div
                v-if="menuUid === plan.uid"
                data-plan-menu-items
                class="absolute right-0 top-full z-10 min-w-36 rounded bg-field p-2 shadow-panel"
              >
                <button
                  type="button"
                  :disabled="saving || !!dirty"
                  class="min-h-11 w-full rounded px-2 text-left text-sm text-danger focus-visible:outline disabled:opacity-50"
                  @click="open('delete', plan)"
                >
                  Удалить план
                </button>
              </div>
            </div>
          </div>
          <div v-if="drafts[plan.uid]?.message" class="order-7 col-span-2 xl:col-span-6">
            <ErrorMessage :message="drafts[plan.uid]!.message" /><BaseButton
              v-if="drafts[plan.uid]!.blocked && !drafts[plan.uid]!.current"
              variant="secondary"
              @click="retryReconcile(plan.uid)"
              >Проверить план</BaseButton
            >
            <div v-if="drafts[plan.uid]?.current" class="mt-2 text-sm">
              <p>
                Актуально: {{ formatPlanDate(drafts[plan.uid]!.current!.planned_date) }} ·
                {{ drafts[plan.uid]!.current!.money_sum }} ₽ ·
                {{ drafts[plan.uid]!.current!.category.name }} ·
                {{ drafts[plan.uid]!.current!.description || '—' }}
              </p>
              <BaseButton
                v-if="drafts[plan.uid]!.current!.status === 'pending'"
                variant="secondary"
                class="mt-2"
                @click="acceptCurrent(plan.uid)"
                >Сохранить черновик с актуальной версией</BaseButton
              >
              <p v-else>План уже выполнен. Отмените черновик.</p>
            </div>
          </div>
        </div>
      </div>
      <footer
        v-if="dirty"
        class="sticky bottom-3 mt-4 flex flex-wrap items-center justify-between gap-3 rounded bg-surface-muted p-4 shadow-panel"
      >
        <span class="text-sm">Изменено записей: {{ dirty }}</span>
        <div class="flex gap-3">
          <BaseButton variant="secondary" :disabled="saving" @click="discard">Отмена</BaseButton
          ><BaseButton :loading="saving" @click="saveRows">Сохранить</BaseButton>
        </div>
      </footer>
      <p v-else class="mt-6 text-right text-caption text-ink-muted">
        Планы не меняют баланс до подтверждения
      </p>
    </section>
    <PlanDialog
      v-if="dialog"
      :key="dialog.key"
      :mode="dialog.mode"
      :plan="dialog.plan"
      :today="today"
      @close="dialog = null"
      @changed="load"
      @clone="open('create', $event)"
      @remove="open('delete', $event)"
      @open-transaction="openFact"
    />
    <TransactionListDialog
      v-if="fact"
      :type="fact.transaction_type"
      :initial-uid="fact.transaction_uid ?? undefined"
      @close="closeFact"
      @changed="load"
    />
  </div>
</template>
