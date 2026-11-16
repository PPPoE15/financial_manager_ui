<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router'
import { loadRegularOperations, readRegularOperation } from '@/api/regularOperations'
import BaseButton from '@/components/ui/BaseButton.vue'
import PlanningHeader from '@/components/plans/PlanningHeader.vue'
import RegularOperationDialog from '@/components/plans/RegularOperationDialog.vue'
import { LOGIN_ROUTE, REGULAR_OPERATION_ROUTE, REGULAR_OPERATIONS_ROUTE } from '@/router/names'
import { frequencies, type RegularEntry } from '@/regularOperations/model'
import { takeRegularEntry } from '@/regularOperations/navigation'
import { formatPlanDate } from '@/plans/model'
import { formatMoney } from '@/utils/money'
import type { RegularOperation, RegularOperationItem } from '@/types/regularOperation'

const route = useRoute()
const router = useRouter()
const rows = ref<RegularOperationItem[]>([])
const today = ref('')
const loading = ref(true)
const failed = ref(false)
const detail = ref<RegularOperation>()
const detailError = ref(false)
const mode = ref<'create' | 'edit' | 'delete'>()
const entry = ref<RegularEntry>()
const mutating = ref(false)
let request: AbortController | undefined
let detailSequence = 0

/** Перечитывает список, отменяя устаревшую загрузку. */
async function load() {
  request?.abort()
  const controller = new AbortController()
  request = controller
  loading.value = true
  failed.value = false
  try {
    const data = await loadRegularOperations(undefined, controller.signal)
    if (controller.signal.aborted) return
    rows.value = data.content
    today.value = data.today
  } catch {
    if (!controller.signal.aborted) failed.value = true
  } finally {
    if (!controller.signal.aborted) loading.value = false
  }
}

/** Открывает операцию из строки или прямой ссылки. */
async function openDetail(uid: string) {
  const sequence = ++detailSequence
  detail.value = undefined
  detailError.value = false
  mode.value = 'edit'
  try {
    const operation = await readRegularOperation(uid)
    if (sequence === detailSequence) detail.value = operation
  } catch {
    if (sequence === detailSequence) detailError.value = true
  }
}

/** Возвращает пользователя к списку после закрытия окна. */
function close() {
  mutating.value = false
  mode.value = undefined
  entry.value = undefined
  if (route.name === REGULAR_OPERATION_ROUTE)
    void router.replace({ name: REGULAR_OPERATIONS_ROUTE })
}

/** Показывает окно удаления с версией выбранной строки. */
function openDelete(operation: RegularOperationItem) {
  detail.value = { ...operation, today: today.value, timezone: 'Europe/Moscow' }
  mode.value = 'delete'
}

/** Открывает форму создания непосредственно из текущего списка. */
function openCreate() {
  detail.value = undefined
  mode.value = 'create'
}

onBeforeRouteLeave(
  /** Блокирует уход во время записи, сохраняя выход при окончании сессии. */ (to) => {
    return !mutating.value || to.name === LOGIN_ROUTE
  },
)
onBeforeRouteUpdate(/** Защищает открытое окно при смене адреса операции. */ () => !mutating.value)

watch(
  /** Следит за адресом открытой операции. */
  () => route.params.operationUid,
  /** Переключает окно при навигации по истории браузера. */
  (uid) => {
    if (typeof uid === 'string') void openDetail(uid)
    else if (mode.value === 'edit') {
      ++detailSequence
      mode.value = undefined
    }
  },
  { immediate: true },
)
onMounted(
  /** Загружает список и открывает форму с переданным черновиком. */ () => {
    entry.value = takeRegularEntry(router)
    if (entry.value && route.name === REGULAR_OPERATIONS_ROUTE) openCreate()
    void load()
  },
)
onBeforeUnmount(
  /** Отменяет список и игнорирует устаревший ответ деталей. */ () => {
    request?.abort()
    ++detailSequence
  },
)
</script>

<template>
  <div class="min-w-0 px-4 pb-8 pt-6 sm:px-6 lg:px-[38px] lg:pt-8">
    <PlanningHeader regular />
    <section
      aria-label="Список регулярных операций"
      class="mt-7 min-h-[60vh] rounded-md bg-surface-card/80 p-4 sm:p-7"
    >
      <div
        v-if="!rows.length"
        class="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center"
      >
        <p v-if="loading" role="status" class="text-lg font-bold">Загрузка...</p>
        <template v-else-if="failed">
          <p role="alert" class="text-lg font-bold">Не удалось загрузить регулярные операции</p>
          <BaseButton @click="load">Повторить</BaseButton>
        </template>
        <template v-else>
          <p class="text-lg font-bold">Регулярных операций пока нет</p>
          <BaseButton @click="openCreate">Создать регулярную операцию</BaseButton>
        </template>
      </div>
      <template v-else>
        <p v-if="failed" role="alert" class="mb-4">
          Не удалось загрузить регулярные операции <BaseButton @click="load">Повторить</BaseButton>
        </p>
        <BaseButton class="w-full sm:w-auto" @click="openCreate"
          >+ Создать регулярную операцию</BaseButton
        >
        <ul class="mt-6 grid gap-3">
          <li
            v-for="operation in rows"
            :key="operation.uid"
            class="min-w-0 rounded bg-field/70 p-4"
          >
            <div class="flex items-start justify-between gap-3 text-lg font-bold">
              <span class="min-w-0 break-words">{{ operation.category.name }}</span>
              <span
                class="shrink-0"
                :class="operation.transaction_type === 'income' && 'text-success'"
              >
                {{
                  operation.transaction_type === 'income'
                    ? '+' + formatMoney(operation.money_sum)
                    : formatMoney(-operation.money_sum)
                }}
              </span>
            </div>
            <p
              v-if="operation.description"
              class="mt-1 whitespace-pre-wrap break-words text-sm text-ink-muted"
            >
              {{ operation.description }}
            </p>
            <div class="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center">
              <span>{{ frequencies[operation.frequency] }}</span>
              <span class="text-sm text-ink-muted xl:ml-8">
                {{ formatPlanDate(operation.first_date) }} —
                {{ operation.end_date ? formatPlanDate(operation.end_date) : 'Без окончания' }}
              </span>
              <span v-if="operation.status === 'ended'" class="text-sm text-warning xl:ml-auto"
                >Завершено</span
              >
              <div class="flex flex-wrap gap-2 xl:ml-auto">
                <RouterLink
                  :to="{ name: REGULAR_OPERATION_ROUTE, params: { operationUid: operation.uid } }"
                  class="inline-flex min-h-10 items-center justify-center rounded bg-surface-card px-3 text-sm font-bold hover:bg-field-hover focus-visible:outline"
                  >Редактировать</RouterLink
                >
                <BaseButton
                  variant="secondary"
                  class="!min-h-10 !px-3"
                  @click="openDelete(operation)"
                  >Удалить</BaseButton
                >
              </div>
            </div>
          </li>
        </ul>
      </template>
    </section>
    <RegularOperationDialog
      v-if="mode"
      :key="mode + ':' + String(route.params.operationUid ?? '')"
      :mode="mode"
      :today="today"
      :operation="detail"
      :detail-error="detailError"
      :calendar-error="failed && !today"
      :entry="entry"
      @close="close"
      @changed="load"
      @retry-calendar="load"
      @busy="mutating = $event"
      @retry-detail="openDetail(String(route.params.operationUid))"
    />
  </div>
</template>
