<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import ErrorMessage from '@/components/ui/ErrorMessage.vue'
import PlanFields from './PlanFields.vue'
import { usePlanAction, type PlanAction } from '@/plans/usePlanAction'
import { formatPlanDate } from '@/plans/model'
import type { PlannedOperation } from '@/types/plannedOperation'
const props = defineProps<{ mode: PlanAction; plan?: PlannedOperation; today: string }>()
const emit = defineEmits<{
  close: []
  changed: []
  clone: [plan: PlannedOperation]
  remove: [plan: PlannedOperation]
  openTransaction: [plan: PlannedOperation]
}>()
const {
  current,
  draft,
  categories,
  errors,
  message,
  loading,
  busy,
  loadFailed,
  factError,
  transaction,
  success,
  unknown,
  needsDecision,
  currentVerified,
  unavailable,
  completed,
  today,
  load,
  loadFact,
  submit,
  reconcile,
  acceptCurrent,
} = usePlanAction(props.mode, props.plan, props.today)
const id = useId()
const panel = ref<HTMLElement>()
const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
const app = document.getElementById('app')
const wasInert = app?.hasAttribute('inert') ?? false
let active = true
const showDetails = computed(
  /** Не превращает окно удаления выполненного плана в карточку просмотра. */ () =>
    completed.value && props.mode !== 'delete',
)
const title = computed(
  /** Подбирает нейтральный заголовок текущего действия. */ () =>
    showDetails.value
      ? 'Выполненный план'
      : {
          create: 'Запланировать операцию',
          confirm: 'Подтвердить',
          reschedule: 'Перенести операцию',
          delete: 'Удалить план?',
          details: 'Выполненный план',
        }[props.mode],
)
const actionLabel = computed(
  /** Подбирает подпись явной мутации. */ () =>
    ({
      create: unknown.value ? 'Создать ещё раз' : 'Запланировать',
      confirm: 'Подтвердить',
      reschedule: 'Перенести',
      delete: 'Удалить план',
      details: 'Закрыть',
    })[props.mode],
)
/** Находит доступные элементы управления окна. */
function focusables() {
  return [
    ...(panel.value?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]',
    ) ?? []),
  ]
}
/** Удерживает фокус внутри окна после асинхронной перерисовки. */
function keepFocus() {
  if (active && !panel.value?.contains(document.activeElement))
    (focusables()[0] ?? panel.value)?.focus()
}
/** Закрывает окно только после завершения запроса. */
function close() {
  if (!busy.value) emit('close')
}
/** Обрабатывает Escape и циклический Tab. */
function keydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    close()
    return
  }
  if (event.key !== 'Tab') return
  const items = focusables(),
    first = items[0],
    last = items[items.length - 1]
  if (!first) {
    event.preventDefault()
    panel.value?.focus()
  } else if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last?.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}
/** Проверяет наличие факта непосредственно перед переходом из деталей. */
async function openTransaction() {
  if (busy.value) return
  busy.value = true
  try {
    await loadFact()
    if (active && transaction.value && current.value && !factError.value) emit('openTransaction', current.value)
  } finally { busy.value = false }
}
/** Отправляет действие, обновляет список и переводит фокус к ошибочному полю. */
async function save() {
  await submit()
  if (!active) return
  emit('changed')
  if (success.value && !showDetails.value) {
    close()
    return
  }
  await nextTick()
  panel.value?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  keepFocus()
}
watch(
  [loading, busy, showDetails],
  /** Восстанавливает фокус после изменения доступных кнопок. */ async () => {
    await nextTick()
    keepFocus()
  },
)
watch(
  /** Получает обновлённый серверный календарь списка. */ () => props.today,
  /** Обновляет ограничения открытой формы после смены дня. */ (value) => {
    if (value) today.value = value
  },
)
onMounted(
  /** Изолирует фон и загружает актуальные данные окна. */ async () => {
    app?.setAttribute('inert', '')
    document.addEventListener('focusin', keepFocus)
    await nextTick()
    keepFocus()
    await load()
  },
)
onBeforeUnmount(
  /** Возвращает доступность фона и фокус исходной кнопке. */ () => {
    active = false
    document.removeEventListener('focusin', keepFocus)
    app?.toggleAttribute('inert', wasInert)
    if (opener?.isConnected) opener.focus()
  },
)
</script>
<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-dialog-backdrop/70 p-3 font-sans text-ink sm:p-8"
    >
      <section
        ref="panel"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="`${id}-title`"
        tabindex="-1"
        class="relative my-auto w-full min-w-0 max-w-[600px] rounded-md bg-gradient-to-r from-dialog-start to-dialog-end p-5 shadow-panel sm:p-8"
        @keydown="keydown"
      >
        <button
          type="button"
          aria-label="Закрыть"
          :disabled="busy"
          class="absolute right-2 top-2 size-10 rounded focus-visible:outline"
          @click="close"
        >
          ×
        </button>
        <h2 :id="`${id}-title`" class="pr-8 text-xl font-bold">{{ title }}</h2>
        <p v-if="mode === 'create' && plan" class="mt-3 text-sm text-ink-muted">
          На основе выполненного плана · {{ plan.category.name }}
        </p>
        <p v-if="loading" role="status" class="py-10">Загрузка…</p>
        <div v-else-if="loadFailed" class="mt-6">
          <ErrorMessage :message="message" /><BaseButton class="mt-4" @click="load"
            >Повторить</BaseButton
          >
        </div>
        <template v-else>
          <div v-if="showDetails && current" class="mt-6">
            <p class="text-sm text-success">✓ Выполнен</p>
            <div class="mt-5 grid gap-8 sm:grid-cols-2">
              <div class="min-w-0">
                <h3 class="font-bold">Исходный план</h3>
                <dl class="mt-5 space-y-4 break-words text-sm">
                  <div>
                    <dt class="text-ink-muted">Дата</dt>
                    <dd>{{ formatPlanDate(current.planned_date) }}</dd>
                  </div>
                  <div>
                    <dt class="text-ink-muted">Сумма</dt>
                    <dd>{{ current.money_sum.toLocaleString('ru-RU') }} ₽</dd>
                  </div>
                  <div>
                    <dt class="text-ink-muted">Категория</dt>
                    <dd>{{ current.category.name }}</dd>
                  </div>
                  <div>
                    <dt class="text-ink-muted">Комментарий</dt>
                    <dd>{{ current.description || '—' }}</dd>
                  </div>
                </dl>
              </div>
              <div class="min-w-0">
                <h3 class="font-bold">Фактическая операция</h3>
                <dl v-if="transaction" class="mt-5 space-y-4 break-words text-sm">
                  <div>
                    <dt class="text-ink-muted">Дата</dt>
                    <dd>{{ formatPlanDate(transaction.transaction_date) }}</dd>
                  </div>
                  <div>
                    <dt class="text-ink-muted">Сумма</dt>
                    <dd>{{ transaction.money_sum.toLocaleString('ru-RU') }} ₽</dd>
                  </div>
                  <div>
                    <dt class="text-ink-muted">Категория</dt>
                    <dd>{{ transaction.category.name }}</dd>
                  </div>
                  <div>
                    <dt class="text-ink-muted">Комментарий</dt>
                    <dd>{{ transaction.description || '—' }}</dd>
                  </div>
                </dl>
                <p v-if="current.transaction_state === 'deleted'" class="mt-5 text-sm">
                  Фактическая операция удалена. План остаётся выполненным.
                </p>
                <ErrorMessage :message="factError" />
                <BaseButton
                  v-if="factError && current.transaction_state === 'available'"
                  variant="secondary"
                  class="mt-4"
                  @click="loadFact"
                  >Обновить факт</BaseButton
                >
                <button
                  v-if="transaction && !factError"
                  type="button"
                  class="mt-5 text-left text-sm text-ink-secondary underline focus-visible:outline"
                  :disabled="busy" @click="openTransaction"
                >
                  Открыть фактическую операцию ↗
                </button>
              </div>
            </div>
            <p class="mt-6 text-sm text-ink-muted">
              Плановые значения не меняются при изменении факта.
            </p>
            <footer class="mt-6 flex flex-wrap gap-3">
              <BaseButton variant="secondary" :disabled="busy" @click="emit('remove', current)"
                >Удалить план</BaseButton
              ><BaseButton :disabled="busy" @click="emit('clone', current)">Запланировать еще</BaseButton
              ><BaseButton variant="secondary" @click="close">Закрыть</BaseButton>
            </footer>
          </div>
          <form v-else class="mt-6" novalidate @submit.prevent="save">
            <p v-if="mode === 'confirm'" class="mb-5 text-sm text-ink-muted">
              Проверьте, когда и на какую сумму произошла операция.
            </p>
            <div v-if="current && mode !== 'create'" class="mb-6 rounded bg-field/70 p-4 text-sm">
              <p>{{ current.category.name }} · {{ current.money_sum.toLocaleString('ru-RU') }} ₽</p>
              <p class="mt-2">
                {{ mode === 'reschedule' ? 'Текущая дата:' : 'Исходный план:' }}
                {{ formatPlanDate(current.planned_date) }}
              </p>
            </div>
            <PlanFields
              v-if="mode !== 'delete'"
              v-model="draft"
              :categories="categories"
              :today="today"
              :errors="errors"
              :busy="busy || unavailable"
              :actual="mode === 'confirm'"
              :only="mode === 'reschedule' ? 'date' : undefined"
            />
            <p v-if="mode === 'delete'" class="my-8 text-sm">
              {{ current?.status === 'completed' ? 'Фактическая операция сохранится. ' : '' }}Баланс
              не изменится.
            </p>
            <p v-else class="mt-6 text-sm text-ink-muted">
              {{
                mode === 'confirm'
                  ? 'Исходный план сохранится.'
                  : mode === 'reschedule'
                    ? 'Сумма и остальные данные плана сохранятся.'
                    : 'План не меняет баланс до подтверждения.'
              }}
            </p>
            <ErrorMessage class="mt-4" :message="message" />
            <p v-if="unavailable" class="mt-3 text-sm">План больше недоступен.</p>
            <div
              v-if="needsDecision && currentVerified && current && !unavailable"
              class="mt-4 rounded border border-warning/50 p-4 text-sm"
            >
              <p>
                Актуальные данные: {{ formatPlanDate(current.planned_date) }} ·
                {{ current.money_sum.toLocaleString('ru-RU') }} ₽ · {{ current.category.name }} ·
                {{ current.description || '—' }}
              </p>
              <p class="mt-2">Черновик сохранён. Проверьте данные перед повтором.</p>
              <BaseButton class="mt-3" variant="secondary" @click="acceptCurrent"
                >Использовать актуальную версию</BaseButton
              >
            </div>
            <BaseButton v-if="needsDecision && !currentVerified && !unavailable" variant="secondary" class="mt-4" @click="reconcile">Повторить проверку плана</BaseButton>
            <div v-if="unknown" class="mt-4 text-sm">
              <p>
                {{
                  mode === 'create'
                    ? 'Запрос мог выполниться. Повторное создание может создать дубликат.'
                    : 'Запрос мог выполниться. Проверьте актуальное состояние перед повтором.'
                }}
              </p>
              <BaseButton class="mt-3" variant="secondary" @click="emit('changed')"
                >Обновить список</BaseButton
              ><BaseButton
                v-if="mode !== 'create'"
                class="ml-2 mt-3"
                variant="secondary"
                @click="reconcile"
                >Проверить план</BaseButton
              >
            </div>
            <footer class="mt-8 flex flex-wrap justify-end gap-3">
              <BaseButton variant="secondary" :disabled="busy" @click="close">Отмена</BaseButton
              ><BaseButton
                type="submit"
                :loading="busy"
                :disabled="needsDecision || unavailable"
                :class="mode === 'delete' && 'bg-destructive text-white'"
                >{{ actionLabel }}</BaseButton
              >
            </footer>
          </form>
        </template>
      </section>
    </div>
  </Teleport>
</template>
