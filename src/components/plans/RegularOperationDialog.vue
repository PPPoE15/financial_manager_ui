<script setup lang="ts">
import { isAxiosError } from 'axios'
import { computed, onMounted, ref, useId, watch } from 'vue'
import { listCategories } from '@/api/categories'
import { loadPlans, readPlan } from '@/api/plannedOperations'
import {
  convertPlan,
  createRegularOperation,
  deleteRegularOperation,
  loadRegularOperations,
  readRegularOperation,
  updateRegularOperation,
} from '@/api/regularOperations'
import BaseButton from '@/components/ui/BaseButton.vue'
import ErrorMessage from '@/components/ui/ErrorMessage.vue'
import { acceptAmount, formatPlanDate } from '@/plans/model'
import {
  frequencies,
  regularChanges,
  regularDraft,
  regularPayload,
  validateRegularDraft,
  type RegularEntry,
  type RegularErrors,
} from '@/regularOperations/model'
import type { Category } from '@/types/category'
import type { RegularOperation } from '@/types/regularOperation'

const props = defineProps<{
  mode: 'create' | 'edit' | 'delete'
  today: string
  operation?: RegularOperation
  detailError: boolean
  entry?: RegularEntry
}>()
const emit = defineEmits<{ close: []; changed: []; retryDetail: []; busy: [value: boolean] }>()
const id = useId()
const panel = ref<HTMLDialogElement>()
const source = props.entry && 'source' in props.entry ? props.entry.source : undefined
const current = ref(props.operation)
const draft = ref(regularDraft(props.today || source?.today || '', props.entry, current.value))
const categories = ref<Category[]>([])
const loadingCategories = ref(props.mode !== 'delete')
const categoryError = ref(false)
const busy = ref(false)
const message = ref('')
const errors = ref<RegularErrors>({})
const needsCheck = ref(false)
const reconciled = ref(false)
const latest = ref<RegularOperation>()
const unavailable = ref(false)
const calendar = computed(
  /** Использует дату сервера, включая прямой переход. */ () =>
    [props.today, current.value?.today ?? '', source?.today ?? ''].sort().pop() ?? '',
)
const title = {
  create: 'Создать регулярную операцию',
  edit: 'Редактировать регулярную операцию',
  delete: 'Удалить регулярную операцию?',
}[props.mode]
const availableCategories = computed(
  /** Сохраняет тип исходного плана или операции. */ () => {
    const type = current.value?.transaction_type ?? source?.transaction_type
    return type
      ? categories.value.filter(
          /** Выбирает категории того же типа. */ (category) => category.category_type === type,
        )
      : categories.value
  },
)

watch(
  busy,
  /** Передаёт состояние запроса для защиты навигации. */ (value) => emit('busy', value),
  { flush: 'sync' },
)

watch(
  /** Обновляет операцию после загрузки адресного перехода. */ () => props.operation,
  /** Заполняет форму актуальными полями. */ (operation) => {
    current.value = operation
    if (operation) draft.value = regularDraft(calendar.value, undefined, operation)
  },
)
watch(
  calendar,
  /** Заполняет серверную дату до первого редактирования. */ (today, previous) => {
    if (!previous && !props.entry && props.mode === 'create' && !draft.value.date)
      draft.value.date = today
    if (
      source?.status === 'pending' &&
      draft.value.date === source.planned_date &&
      draft.value.date < today
    )
      draft.value.date = ''
  },
)

/** Загружает варианты выбора категории. */
async function loadCategories() {
  if (props.mode === 'delete') return
  loadingCategories.value = true
  categoryError.value = false
  try {
    categories.value = (
      await Promise.all([listCategories('income'), listCategories('outcome')])
    ).flat()
  } catch {
    categoryError.value = true
  } finally {
    loadingCategories.value = false
  }
}

/** Открывает нативное модальное окно над списком и загружает категории. */
onMounted(function openDialog() {
  panel.value?.showModal()
  void loadCategories()
})

/** Закрывает окно по явному действию или Escape после запроса. */
function close(event?: Event) {
  event?.preventDefault()
  if (!busy.value) emit('close')
}

/** Оставляет в поле только допустимый ввод суммы. */
function inputAmount(event: Event) {
  const input = event.target as HTMLInputElement
  draft.value.amount = acceptAmount(draft.value.amount, input.value)
  input.value = draft.value.amount
}

/** Сверяет снимок операции, планы и источник без повторной отправки мутации. */
async function reconcile() {
  const operation = current.value
  const [seriesResult, plansResult, sourceResult, operationResult] = await Promise.allSettled([
    loadRegularOperations(source?.uid),
    operation || source ? loadPlans({ include_completed: false }) : undefined,
    source ? readPlan(source.uid) : undefined,
    operation ? readRegularOperation(operation.uid) : undefined,
  ] as const)
  latest.value = operationResult.status === 'fulfilled' ? operationResult.value : undefined
  const refreshedSource = sourceResult.status === 'fulfilled' ? sourceResult.value : undefined
  unavailable.value =
    (operationResult.status === 'rejected' &&
      isAxiosError(operationResult.reason) &&
      operationResult.reason.response?.status === 404) ||
    (sourceResult.status === 'rejected' &&
      isAxiosError(sourceResult.reason) &&
      sourceResult.reason.response?.status === 404) ||
    !!(
      source &&
      refreshedSource &&
      (refreshedSource.version !== source.version || refreshedSource.status !== source.status)
    ) ||
    !!(source && seriesResult.status === 'fulfilled' && seriesResult.value.content.length)
  reconciled.value =
    seriesResult.status === 'fulfilled' &&
    plansResult.status === 'fulfilled' &&
    sourceResult.status === 'fulfilled' &&
    operationResult.status === 'fulfilled'
  emit('changed')
}

/** Повторяет чтение после сбоя сверки. */
async function retryCheck() {
  if (busy.value) return
  busy.value = true
  try {
    await reconcile()
  } finally {
    busy.value = false
  }
}

/** Явно принимает актуальный снимок перед новым вводом или удалением. */
function acceptLatest() {
  if (latest.value && current.value) {
    const previous = regularDraft(calendar.value, undefined, current.value)
    const actual = regularDraft(calendar.value, undefined, latest.value)
    for (const field of Object.keys(previous) as (keyof typeof previous)[]) {
      if (draft.value[field] !== previous[field]) {
        Object.assign(actual, { [field]: draft.value[field] })
      }
    }
    current.value = latest.value
    draft.value = actual
  }
  needsCheck.value = false
  latest.value = undefined
  message.value = ''
}

/** Проверяет поля и отправляет одну мутацию. */
async function submit() {
  if (
    (props.mode === 'create' && !calendar.value) ||
    busy.value ||
    needsCheck.value ||
    unavailable.value ||
    loadingCategories.value ||
    categoryError.value
  )
    return
  if (props.mode !== 'create' && !current.value) return
  if (props.mode !== 'delete') {
    errors.value = validateRegularDraft(draft.value, calendar.value, current.value?.first_date)
    if (Object.values(errors.value).some(Boolean)) return
  }
  busy.value = true
  message.value = ''
  try {
    const operation = current.value
    if (props.mode === 'delete' && operation)
      await deleteRegularOperation(operation.uid, operation.version)
    else if (operation) {
      const changes = regularChanges(draft.value, operation)
      if (Object.keys(changes).length)
        await updateRegularOperation(operation.uid, {
          ...changes,
          expected_version: operation.version,
        })
    } else if (source) await convertPlan(source, regularPayload(draft.value))
    else await createRegularOperation(regularPayload(draft.value))
    emit('changed')
    emit('close')
  } catch (error) {
    const status = isAxiosError(error) ? error.response?.status : undefined
    message.value = {
      create: 'Не удалось создать регулярную операцию. Проверьте список перед повторным созданием.',
      edit: 'Не удалось сохранить регулярную операцию.',
      delete: 'Не удалось удалить регулярную операцию.',
    }[props.mode]
    if (status === 400 || status === 422) {
      const validation: { field: string }[] | undefined = isAxiosError(error)
        ? error.response?.data?.validation
        : undefined
      const fields = Array.isArray(validation)
        ? new Set(validation.map(/** Извлекает имена полей API. */ (item) => item.field))
        : new Set()
      if (fields.has('category_uid')) errors.value.category = 'Выберите доступную категорию'
      if (fields.has('first_date')) errors.value.date = 'Выберите сегодня или будущую дату'
      if (fields.has('end_date')) errors.value.end = 'Укажите корректную дату окончания'
    }
    const code = isAxiosError(error) ? error.response?.data?.code : undefined
    if (code === 'FM-409404') {
      message.value = 'Достигнут лимит запланированных операций.'
      return
    }
    if (status === 409 || status === 404 || status === undefined || status >= 500) {
      needsCheck.value = true
      reconciled.value = false
      if (status === 409)
        message.value = 'Возник конфликт. Сверьте актуальные данные перед повтором.'
      await reconcile()
    }
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <dialog
      ref="panel"
      :aria-labelledby="id"
      class="fixed inset-0 m-auto max-h-[calc(100%-1.5rem)] w-[calc(100%-1.5rem)] max-w-[800px] overflow-auto rounded-md bg-surface-card p-5 font-sans text-ink shadow-panel backdrop:bg-dialog-backdrop/70 backdrop:backdrop-blur-sm sm:p-7"
      :class="mode === 'delete' && 'max-w-[700px]'"
      @cancel="close"
    >
      <h2 :id="id" class="text-xl font-bold">{{ title }}</h2>
      <div v-if="mode === 'edit' && !current" class="mt-6 space-y-4">
        <p v-if="!detailError" role="status">Загрузка...</p>
        <template v-else>
          <p role="alert">Не удалось загрузить регулярную операцию</p>
          <BaseButton @click="emit('retryDetail')">Повторить</BaseButton>
        </template>
        <BaseButton variant="secondary" @click="close()">Отмена</BaseButton>
      </div>
      <form v-else class="mt-6" novalidate @submit.prevent="submit">
        <template v-if="mode === 'delete'">
          <p class="text-ink-muted">
            Все невыполненные платежи этой серии, включая просроченные и изменённые вручную, будут
            удалены. Новые платежи больше не появятся.
          </p>
          <p class="mt-8 text-ink-muted">Выполненные планы и фактические операции сохранятся.</p>
        </template>
        <template v-else>
          <p v-if="current?.status === 'ended'" class="mb-5 text-sm text-ink-muted">
            Операция завершена. Продлите срок или уберите дату окончания.
          </p>
          <p v-else-if="current" class="mb-5 text-sm text-ink-muted">
            Изменятся невыполненные платежи на сегодня и будущие даты. Просроченные, выполненные и
            ручные исключения сохранятся.
          </p>
          <p v-else-if="source?.status === 'completed'" class="mb-5 text-sm text-ink-muted">
            Выполненный план и фактическая операция сохранятся. Выберите новую дату первого платежа.
          </p>
          <p
            v-else-if="source && source.planned_date < calendar"
            class="mb-5 text-sm text-ink-muted"
          >
            План просрочен. Выберите новую дату первого платежа.
          </p>
          <p v-if="loadingCategories" role="status">Загрузка...</p>
          <div v-else-if="categoryError" class="mb-4">
            <ErrorMessage message="Не удалось загрузить категории" />
            <BaseButton @click="loadCategories">Повторить</BaseButton>
          </div>
          <fieldset :disabled="busy" class="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
            <label class="grid content-start gap-2 text-sm text-ink-muted">
              Сумма, ₽
              <input
                :value="draft.amount"
                inputmode="numeric"
                placeholder="Введите сумму"
                :aria-invalid="!!errors.amount"
                class="min-h-11 w-full rounded bg-field px-3 text-ink"
                @input="inputAmount"
              />
              <ErrorMessage :message="errors.amount" />
            </label>
            <label class="grid content-start gap-2 text-sm text-ink-muted">
              Категория
              <select
                v-model="draft.category"
                :aria-invalid="!!errors.category"
                class="min-h-11 w-full min-w-0 rounded bg-field px-3 text-ink"
              >
                <option value="" disabled>Выберите категорию</option>
                <option
                  v-for="category in availableCategories"
                  :key="category.uid"
                  :value="category.uid"
                >
                  {{ category.name }}
                </option>
              </select>
              <ErrorMessage :message="errors.category" />
            </label>
            <fieldset class="min-w-0 sm:col-span-2">
              <legend class="mb-2 text-sm text-ink-muted">Периодичность</legend>
              <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <label
                  v-for="(label, frequency) in frequencies"
                  :key="frequency"
                  class="cursor-pointer"
                >
                  <input
                    v-model="draft.frequency"
                    class="peer sr-only"
                    type="radio"
                    :name="id + '-frequency'"
                    :value="frequency"
                  />
                  <span
                    class="grid min-h-10 place-items-center rounded bg-field px-1 py-2 text-center text-sm font-bold peer-checked:bg-action peer-checked:text-action-foreground peer-focus-visible:outline"
                    >{{ label }}</span
                  >
                </label>
              </div>
            </fieldset>
            <label class="grid min-w-0 content-start gap-2 text-sm text-ink-muted">
              Дата первого платежа
              <input
                v-model="draft.date"
                type="date"
                :min="
                  draft.date === current?.first_date && draft.date < calendar
                    ? draft.date
                    : calendar
                "
                max="2099-12-31"
                :aria-invalid="!!errors.date"
                class="min-h-11 w-full min-w-0 rounded bg-field px-3 text-ink"
              />
              <ErrorMessage :message="errors.date" />
            </label>
            <label class="grid min-w-0 content-start gap-2 text-sm text-ink-muted">
              Дата окончания · необязательно
              <input
                v-model="draft.end"
                type="date"
                :min="draft.date"
                max="2099-12-31"
                :aria-invalid="!!errors.end"
                class="min-h-11 w-full min-w-0 rounded bg-field px-3 text-ink"
              />
              <span v-if="!draft.end">Без окончания</span>
              <button
                v-else
                type="button"
                class="justify-self-start underline"
                @click="draft.end = ''"
              >
                Убрать дату окончания
              </button>
              <ErrorMessage :message="errors.end" />
            </label>
            <label class="grid gap-2 text-sm text-ink-muted sm:col-span-2">
              Комментарий · необязательно
              <textarea
                v-model="draft.description"
                rows="2"
                placeholder="Добавьте комментарий"
                :aria-invalid="!!errors.description"
                class="w-full rounded bg-field p-3 text-ink"
              />
              <ErrorMessage :message="errors.description" />
            </label>
          </fieldset>
        </template>
        <ErrorMessage class="mt-4" :message="message" />
        <div v-if="needsCheck" class="mt-4 space-y-3 text-sm">
          <p v-if="unavailable">
            Операция или исходный план изменились. Закройте окно и проверьте список.
          </p>
          <template v-else-if="reconciled">
            <p v-if="latest">
              Актуальные данные: {{ latest.category.name }} · {{ latest.money_sum }} ₽ ·
              {{ frequencies[latest.frequency] }} · {{ formatPlanDate(latest.first_date) }} —
              {{ latest.end_date ? formatPlanDate(latest.end_date) : 'Без окончания' }} ·
              {{ latest.description || '—' }}
            </p>
            <BaseButton variant="secondary" :disabled="busy" @click="acceptLatest">{{
              latest ? 'Использовать актуальные данные' : 'Подтвердить сверку'
            }}</BaseButton>
          </template>
          <BaseButton v-else variant="secondary" :disabled="busy" @click="retryCheck"
            >Повторить проверку</BaseButton
          >
        </div>
        <footer class="mt-8 grid grid-cols-[auto_1fr] gap-3">
          <BaseButton variant="secondary" :disabled="busy" @click="close()">Отмена</BaseButton>
          <BaseButton
            type="submit"
            :loading="busy"
            :disabled="
              needsCheck ||
              unavailable ||
              loadingCategories ||
              categoryError ||
              (mode === 'create' && !calendar)
            "
            :class="mode === 'delete' && 'bg-destructive text-white'"
            >{{
              mode === 'delete' ? 'Удалить' : mode === 'edit' ? 'Сохранить' : 'Создать'
            }}</BaseButton
          >
        </footer>
      </form>
    </dialog>
  </Teleport>
</template>
