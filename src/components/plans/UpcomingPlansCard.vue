<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, useId } from 'vue'
import { RouterLink } from 'vue-router'
import { loadUpcomingPlans } from '@/api/plannedOperations'
import { formatPlanDate } from '@/plans/model'
import type { PlanAction } from '@/plans/usePlanAction'
import type { PlannedOperation } from '@/types/plannedOperation'
import { PLANNED_OPERATIONS_ROUTE } from '@/router/names'
import { formatMoney } from '@/utils/money'
import BaseButton from '@/components/ui/BaseButton.vue'
import ErrorMessage from '@/components/ui/ErrorMessage.vue'
import RegularPlanBadge from './RegularPlanBadge.vue'
import PlanDialog from './PlanDialog.vue'

const emit = defineEmits<{ changed: []; openTransaction: [plan: PlannedOperation] }>()
const titleId = useId()
const rows = ref<PlannedOperation[]>([])
const today = ref('')
const loading = ref(false)
const failed = ref(false)
const dialog = ref<{ mode: PlanAction; plan: PlannedOperation; key: number } | null>(null)
let sequence = 0
let request = 0
let controller: AbortController | undefined
let timer: ReturnType<typeof setInterval>
let active = true
/** Перечитывает ограниченную страницу; старый ответ не может затереть результат действия. */
async function reload() {
  const current = ++request
  controller?.abort()
  controller = new AbortController()
  loading.value = true
  failed.value = false
  try {
    const result = await loadUpcomingPlans(controller.signal)
    if (current !== request) return
    rows.value = result.content
    today.value = result.today
  } catch {
    if (current === request) failed.value = true
  } finally {
    if (current === request) loading.value = false
  }
}
/** Обновляет календарь сервера при возврате во вкладку и раз в минуту. */
function refresh() {
  if (!document.hidden) void reload()
}
/** Переключает общий диалог после восстановления фокуса предыдущего окна. */
async function open(mode: PlanAction, plan: PlannedOperation, event?: MouseEvent) {
  if (event?.currentTarget instanceof HTMLElement) event.currentTarget.focus()
  dialog.value = null
  await nextTick()
  if (active) dialog.value = { mode, plan, key: ++sequence }
}
/** Обновляет ближайшие планы и сообщает главной о возможном изменении факта. */
function changed() {
  void reload()
  emit('changed')
}
/** Снимает модальность перед открытием существующего редактора фактической операции. */
async function openTransaction(plan: PlannedOperation) {
  dialog.value = null
  await nextTick()
  if (active) emit('openTransaction', plan)
}
onMounted(
  /** Подключает обновление без локального вычисления сегодняшнего дня. */ () => {
    void reload()
    timer = setInterval(refresh, 60000)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
  },
)
onBeforeUnmount(
  /** Освобождает запросы и подписки при уходе с главной. */ () => {
    active = false
    ++request
    controller?.abort()
    clearInterval(timer)
    window.removeEventListener('focus', refresh)
    document.removeEventListener('visibilitychange', refresh)
  },
)
defineExpose({ reload })
</script>

<template>
  <section :aria-labelledby="titleId" class="min-w-0 rounded bg-budget-panel/40 p-4 shadow-panel">
    <h2 :id="titleId" class="text-base font-bold">
      <RouterLink
        :to="{ name: PLANNED_OPERATIONS_ROUTE }"
        class="rounded underline decoration-ink/30 underline-offset-8 hover:text-ink-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
        >Планирование</RouterLink
      >
    </h2>
    <div class="mt-4 min-w-0">
      <p
        v-if="loading && !rows.length"
        role="status"
        class="py-10 text-center text-sm text-ink-muted"
      >
        Загрузка…
      </p>
      <div v-else-if="failed" class="flex flex-col items-center gap-4 py-10 text-center">
        <ErrorMessage message="Не удалось загрузить запланированные операции" />
        <BaseButton variant="secondary" @click="reload">Повторить</BaseButton>
      </div>
      <p v-else-if="!rows.length" class="py-10 text-center text-sm text-ink-muted">
        Запланированных операций пока нет
      </p>
      <ul v-else class="space-y-2 text-caption tracking-normal">
        <li
          v-for="plan in rows"
          :key="plan.uid"
          :data-plan-uid="plan.uid"
          class="grid min-w-0 grid-cols-2 items-center gap-3 rounded border-l-2 p-3 sm:grid-cols-[80px_minmax(0,1fr)_auto_auto]"
          :class="
            plan.planned_date < today
              ? 'border-warning bg-warning/10'
              : plan.planned_date === today
                ? 'border-action bg-action/10'
                : 'border-transparent bg-field/20'
          "
        >
          <div class="col-span-2 flex items-center justify-between gap-2 sm:col-span-1 sm:block">
            <time :datetime="plan.planned_date" class="tabular-nums">{{
              formatPlanDate(plan.planned_date)
            }}</time>
            <p v-if="plan.planned_date <= today" class="text-warning sm:mt-1">
              {{ plan.planned_date < today ? 'Просрочено' : 'Сегодня' }}
            </p>
          </div>
          <div class="min-w-0 break-words">
            <span class="font-semibold" :title="plan.category.name">{{ plan.category.name }}</span>
            <RegularPlanBadge v-if="plan.recurrence" :recurrence="plan.recurrence" />
          </div>
          <span
            class="text-right font-bold tabular-nums"
            :class="plan.transaction_type === 'income' && 'text-success'"
            >{{ plan.transaction_type === 'income' ? '+' : '−'
            }}{{ formatMoney(plan.money_sum) }}</span
          >
          <div class="col-span-2 flex flex-wrap gap-2 sm:col-span-1 sm:justify-end">
            <BaseButton
              class="!px-3 !text-caption !font-normal"
              @click="open('confirm', plan, $event)"
              >Подтвердить</BaseButton
            >
            <BaseButton
              variant="secondary"
              class="!px-3 !text-caption !font-normal"
              @click="open('reschedule', plan, $event)"
              >Перенести</BaseButton
            >
          </div>
        </li>
      </ul>
    </div>
    <PlanDialog
      v-if="dialog"
      :key="dialog.key"
      :mode="dialog.mode"
      :plan="dialog.plan"
      :today="today"
      @close="dialog = null"
      @changed="changed"
      @open-regular="$router.push($event)"
      @clone="open('create', $event)"
      @remove="open('delete', $event)"
      @open-transaction="openTransaction"
    />
  </section>
</template>
