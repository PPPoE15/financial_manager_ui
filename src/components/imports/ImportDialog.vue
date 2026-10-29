<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import ErrorMessage from '@/components/ui/ErrorMessage.vue'
import { downloadImportTemplate, type ImportFormat } from '@/api/imports'
import { useImport } from '@/imports/useImport'

const emit = defineEmits<{ saved: []; close: [] }>()
const {
  type,
  file,
  format,
  message,
  saving,
  result,
  issues,
  truncated,
  selectFiles,
  changeType,
  submit,
} = useImport()
const id = useId()
const panel = ref<HTMLElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const downloading = ref<ImportFormat | null>(null)
const downloadError = ref('')
const busy = computed(
  /** Блокирует форму на время запроса. */ () => saving.value || downloading.value !== null,
)
const noun = computed(
  /** Выбирает подпись шаблона и файла. */ () => (type.value === 'income' ? 'доходов' : 'расходов'),
)
const object = computed(
  /** Выбирает подпись кнопки отправки. */ () => (type.value === 'income' ? 'доходы' : 'расходы'),
)
const columnHelp = computed(
  /** Объясняет правила колонок отдельно для CSV и Excel. */ () =>
    format.value === 'csv'
      ? 'Порядок колонок в CSV не важен. Дополнительные колонки игнорируются.'
      : 'Excel: сохраните названия и порядок четырёх колонок в шаблоне.',
)
const formatHelp = computed(
  /** Объясняет подготовку значений для выбранного формата файла. */ () =>
    format.value === 'csv'
      ? 'CSV: UTF-8; разделитель — запятая или точка с запятой. Дата — дд.мм.гггг или дд.мм.гг: день, месяц, год; например, 1.1.2025. Разделители могут быть любыми нецифровыми символами. Годы 00–99 означают 2000–2099. Пробелы по краям всех значений удаляются, включая заголовки. Сумма — целые рубли: пробелы, точки и запятые между цифрами считаются разделителями разрядов, например 1,25 — это 125 рублей. Если запятая разделяет колонки, заключите сумму с запятой в кавычки.'
      : 'Excel: используйте шаблон выбранного типа операций. Дата — дд.мм.гггг, дд/мм/гггг или дд-мм-гггг. Сумма — целые рубли.',
)
const fields = {
  file: 'Файл',
  date: 'Дата',
  amount: 'Сумма',
  category: 'Категория',
  description: 'Описание',
}
const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
const app = document.getElementById('app')
const wasInert = app?.hasAttribute('inert') ?? false
let active = true

/** Возвращает доступные элементы окна для циклического перехода Tab. */
function focusables() {
  return [
    ...(panel.value?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled])',
    ) ?? []),
  ]
}
/** Удерживает фокус в окне, включая состояние с заблокированными кнопками. */
function keepFocus() {
  if (
    active &&
    (!panel.value?.contains(document.activeElement) ||
      document.activeElement?.hasAttribute('disabled'))
  ) {
    ;(focusables()[0] ?? panel.value)?.focus()
  }
}
/** Закрывает окно только после завершения текущего запроса. */
function close() {
  if (!busy.value) emit('close')
}
/** Поддерживает Escape и циклическую клавиатурную навигацию. */
function keydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    close()
    return
  }
  if (event.key !== 'Tab') return
  const items = focusables()
  const first = items[0],
    last = items[items.length - 1]
  if (!first) {
    event.preventDefault()
    panel.value?.focus()
    return
  }
  if (
    event.shiftKey &&
    (document.activeElement === first || document.activeElement === panel.value)
  ) {
    event.preventDefault()
    last?.focus()
  } else if (
    !event.shiftKey &&
    (document.activeElement === last || document.activeElement === panel.value)
  ) {
    event.preventDefault()
    first.focus()
  }
}
/** Обрабатывает выбор файла и разрешает повторный выбор того же исправленного файла. */
function selected(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files?.length) selectFiles(Array.from(input.files))
  input.value = ''
}
/** Принимает один перетащенный файл, пока форма доступна. */
function dropped(event: DragEvent) {
  if (!busy.value) selectFiles(Array.from(event.dataTransfer?.files ?? []))
}
/** Сохраняет бинарный шаблон под фиксированным именем из контракта. */
async function download(format: ImportFormat) {
  if (busy.value) return
  downloading.value = format
  downloadError.value = ''
  const selectedType = type.value
  try {
    const blob = await downloadImportTemplate(selectedType, format)
    if (!active) return
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${selectedType}-template.${format}`
    document.body.append(link)
    try {
      link.click()
    } finally {
      link.remove()
      URL.revokeObjectURL(url)
    }
  } catch {
    if (active) downloadError.value = 'Не удалось скачать шаблон. Попробуйте ещё раз.'
  } finally {
    downloading.value = null
  }
}
/** Уведомляет экран об успешном импорте и переводит фокус к результату. */
async function save() {
  if (downloading.value) return
  const saved = await submit()
  if (!active) return
  if (saved) emit('saved')
  await nextTick()
  panel.value?.querySelector<HTMLElement>('[data-result]')?.focus()
  keepFocus()
}
/** Восстанавливает доступный фокус после изменения состояния запроса. */
watch(busy, async () => {
  await nextTick()
  keepFocus()
})
/** Делает фон недоступным и устанавливает начальный фокус. */
onMounted(async () => {
  app?.setAttribute('inert', '')
  document.addEventListener('focusin', keepFocus)
  await nextTick()
  keepFocus()
})
/** Возвращает фокус и исходную доступность фона при размонтировании. */
onBeforeUnmount(() => {
  active = false
  document.removeEventListener('focusin', keepFocus)
  app?.toggleAttribute('inert', wasInert)
  opener?.focus()
})
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-dialog-backdrop/40 px-4 py-8 font-sans text-ink backdrop-blur-md"
    >
      <!-- FM-94: Figma 888:798, 800×672 в масштабе темы 0.75.
           Узкая версия и состояния согласованы пользователем. -->
      <section
        ref="panel"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="`${id}-title`"
        tabindex="-1"
        class="relative my-auto w-full max-w-[600px] rounded-[11.25px] bg-gradient-to-r from-dialog-start/90 to-dialog-end/90 px-4 pb-6 pt-12 shadow-xl outline-none sm:p-9 sm:pt-[27px]"
        @keydown="keydown"
      >
        <button
          type="button"
          aria-label="Закрыть"
          :disabled="busy"
          class="absolute right-3 top-3 flex size-8 items-center justify-center rounded text-ink-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-50"
          @click="close"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="m1 1 12 12M13 1 1 13" stroke="currentColor" stroke-width="1.5" />
          </svg>
        </button>
        <form novalidate @submit.prevent="save">
          <h2 :id="`${id}-title`" class="text-xl font-bold">Импорт операций</h2>
          <p class="mt-2 text-caption text-ink-muted">Добавьте операции из файла CSV или Excel</p>
          <div
            role="group"
            aria-label="Тип операций"
            class="mt-4 grid grid-cols-2 rounded-md bg-surface-card p-1"
          >
            <button
              v-for="item in ['outcome', 'income'] as const"
              :key="item"
              type="button"
              :data-type="item"
              :aria-pressed="type === item"
              :disabled="busy"
              class="min-h-control rounded px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-60"
              :class="
                type === item ? 'bg-action font-bold text-action-foreground' : 'text-ink-muted'
              "
              @click="changeType(item)"
            >
              {{ item === 'income' ? 'Доходы' : 'Расходы' }}
            </button>
          </div>
          <p class="mt-2 text-caption text-ink-muted">
            Расходы и доходы загружаются отдельными файлами
          </p>
          <h3 class="mb-3 mt-5 text-base font-bold">1. Подготовьте файл</h3>
          <div
            class="flex flex-wrap items-center justify-between gap-3 rounded-md bg-surface-card/70 p-4"
          >
            <div>
              <h4 class="text-sm font-bold">Шаблон {{ noun }}</h4>
              <p class="mt-2 text-caption text-ink-muted">
                Обязательные колонки: Дата, Сумма, Категория, Описание.
              </p>
              <p class="mt-1 text-caption text-ink-muted">{{ columnHelp }}</p>
            </div>
            <div class="flex flex-wrap gap-2">
              <BaseButton
                v-for="value in ['csv', 'xlsx'] as const"
                :key="value"
                :data-template="value"
                variant="secondary"
                :loading="downloading === value"
                :disabled="busy"
                class="border border-field-border px-4"
                @click="download(value)"
              >
                <span aria-hidden="true">↓</span>{{ value === 'csv' ? 'CSV' : 'Excel' }}
              </BaseButton>
            </div>
          </div>
          <ErrorMessage class="mt-2" :message="downloadError" />
          <h3 class="mb-3 mt-5 text-base font-bold">2. Загрузите файл {{ noun }}</h3>
          <div
            data-testid="dropzone"
            class="rounded-md border border-dashed border-field-border bg-surface-card/40 p-5 text-center"
            @dragover.prevent
            @drop.prevent="dropped"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 32 32"
              class="mx-auto mb-3 size-7 text-ink-muted"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
            >
              <path d="M16 23V2m-8 8 8-8 8 8M3 21v9h26v-9" />
            </svg>
            <p class="text-sm">
              Перетащите файл сюда или
              <button
                type="button"
                :disabled="busy"
                class="rounded text-ink-secondary underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
                @click="fileInput?.click()"
              >
                выберите файл
              </button>
            </p>
            <input
              :id="`${id}-file`"
              ref="fileInput"
              type="file"
              accept=".csv,.xlsx"
              :disabled="busy"
              :aria-label="`Файл ${noun}`"
              class="sr-only"
              @change="selected"
            />
            <p class="mt-2 text-caption text-ink-muted">
              CSV или Excel · один файл с {{ type === 'income' ? 'доходами' : 'расходами' }}
            </p>
            <p v-if="file" class="mt-3 break-all text-sm font-bold">{{ file.name }}</p>
          </div>
          <p class="mt-3 text-caption text-ink-muted">
            {{ formatHelp }}
          </p>
          <p class="mt-1 text-caption text-ink-muted">
            До 5 МиБ и 10 000 операций. Повторная загрузка создаёт новые операции.
          </p>
          <div
            v-if="message || result"
            data-result
            tabindex="-1"
            class="mt-4 rounded outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
          >
            <ErrorMessage :message="message" />
            <ul
              v-if="issues.length"
              class="mt-2 max-h-40 space-y-2 overflow-y-auto break-words text-caption text-danger"
              aria-label="Ошибки файла"
            >
              <li v-for="(issue, index) in issues" :key="index">
                {{
                  issue.row === null
                    ? 'Файл'
                    : `${format === 'csv' ? 'Строка файла' : 'Строка Excel'} ${issue.row} · ${fields[issue.field]}`
                }}: {{ issue.message }}
              </li>
            </ul>
            <p v-if="truncated" class="mt-2 text-caption text-danger">
              Показаны первые 100 ошибок. В файле есть другие ошибки.
            </p>
          </div>
          <p
            role="status"
            aria-live="polite"
            :class="saving || result ? 'mt-3 text-sm' : 'sr-only'"
          >
            {{
              saving
                ? 'Импорт выполняется…'
                : result
                  ? `Импорт завершён. Добавлено операций: ${result.imported_count}.`
                  : ''
            }}
          </p>
          <div class="mt-5 flex flex-col gap-3 sm:flex-row">
            <BaseButton
              variant="secondary"
              :disabled="busy"
              class="border border-field-border sm:w-32"
              @click="close"
              >{{ result ? 'Закрыть' : 'Отмена' }}</BaseButton
            >
            <BaseButton type="submit" :loading="saving" :disabled="busy || !file" class="flex-1"
              >Импортировать {{ object }}</BaseButton
            >
          </div>
        </form>
      </section>
    </div>
  </Teleport>
</template>
