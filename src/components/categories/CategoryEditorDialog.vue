<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'

import CategoryColumn from '@/components/categories/CategoryColumn.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import ErrorMessage from '@/components/ui/ErrorMessage.vue'
import { useCategoryEditor } from '@/categories/useCategoryEditor'

// Окно «Редактирование категорий» по макету «Новый дизайн» (фрейм 234:734, окно 234:954; геометрия —
// из метаданных узла: окно 1535×672, поля 65px, колонки по 670px с зазором 65px, кнопка 671px по центру).
// FM-59: полупрозрачный градиент нового дизайна, кнопка общей темы высотой 37.5px. Окно открывается поверх главной, закрывается крестиком и Escape, фокус удерживается внутри.
// Высота (FM-44): по макету 672px, но не выше экрана за вычетом полей подложки (2 × 2rem) — при многих статьях
// прокручиваются только колонки, заголовок с крестиком и «Сохранить» остаются на месте. На экране ниже 540px
// колонкам так осталось бы меньше строки — там окно растёт целиком и прокручивается с подложкой. Центрирует
// окно не подложка (items-center уводила верх высокого окна за край, куда не прокрутить), а отступы auto:
// когда окно выше экрана, они обнуляются, и окно прокручивается от своего верха.
// TODO(FM-44): у `100dvh` нет запасного значения — браузер без dvh (Chrome/Edge < 108, Safari < 15.4) отбросит
// max-h и min-h, и окно снова вырастет выше экрана. Сначала значение с `vh`, затем `supports-[height:100dvh]:`.
// TODO(FM-44): минимальная высота 672px перешла с формы на панель — «Загрузка…» и ошибка загрузки теперь у
// верхнего края высокой панели; растянуть их блоки (`flex-1 justify-center`).
// TODO(FM-44): порог 540px — по высоте вьюпорта: браузер, который при экранной клавиатуре уменьшает layout
// viewport (`interactive-widget=resizes-content`), будет переключать раскладку при фокусе в поле. Chrome Android
// ≥108 и iOS Safari по умолчанию так не делают; проверить на устройстве.
// TODO(FM-42): подложка и `my-auto` повторяют FirstStepDialog, у которого всё ещё `items-center` — вынести в
// общий BaseDialog.
const emit = defineEmits<{
  /** Создана или изменена хотя бы одна статья — таблицу «Структура бюджета» нужно перезапросить. */
  saved: []
  close: []
}>()

const { columns, loading, loadFailed, message, saving, load, save, updateRow } = useCategoryEditor()

const titleId = useId()
const panel = ref<HTMLElement | null>(null)
// Элемент, с которого открыли окно (ссылка «Редактировать категории»): после закрытия фокус вернётся на него
// TODO(FM-42): в Safari (и Firefox на macOS) клик мышью не фокусирует кнопку — activeElement здесь body, и фокус
// не возвращается. Передавать ref кнопки из BudgetStructureCard.
const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null

const FOCUSABLE = 'input:not([disabled]), button:not([disabled])'
// Строки существующих статей и новых — в порядке на экране
const ROW = '[data-testid="category-row"], [data-testid="new-row"]'

// TODO(FM-42): удержание фокуса и inert на #app повторяют FirstStepDialog — вынести общий BaseDialog.
function focusables(): HTMLElement[] {
  return panel.value ? [...panel.value.querySelectorAll<HTMLElement>(FOCUSABLE)] : []
}

function keepFocusInside(): void {
  if (panel.value && !panel.value.contains(document.activeElement)) focusables()[0]?.focus()
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    // Во время сохранения окно не закрывается: родитель снимет его через v-if, и «saved» после
    // ответа уже не дойдёт — таблица «Структура бюджета» не узнает о созданных статьях
    // TODO(FM-42): у axios-клиента нет таймаута — если сервер принял запрос и не отвечает, окно не закрыть
    // ничем, а #app под ним inert. Лучше не блокировать закрытие, а перезапрашивать таблицу на `close`,
    // если что-то ушло на сервер (или вынести saving/saved в карточку), либо задать таймаут запросам.
    // NOTE(FM-46): ✕ и Escape закрывают окно без вопроса — несохранённые правки статей и новые строки теряются;
    // подтверждения задача не требует.
    if (!saving.value) emit('close')
    return
  }
  if (event.key !== 'Tab') return

  const items = focusables()
  const first = items[0]
  const last = items[items.length - 1]
  if (!first || !last) return
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

// Приложение под окном недоступно ни мыши, ни клавиатуре, ни скринридеру; окно вынесено в body,
// поэтому inert на #app его не задевает.
// TODO(FM-42): inert снимается безусловно, как и в FirstStepDialog: если открыты оба окна, закрытие одного
// открывает приложение под другим — решать в общем BaseDialog (счётчик открытых окон).
function setAppInert(value: boolean): void {
  document.getElementById('app')?.toggleAttribute('inert', value)
}

// Disabled-кнопки не удерживают фокус: Tab продолжает работать через readonly-поля.
watch(saving, async (pending) => {
  if (pending) {
    await nextTick()
    focusables()[0]?.focus()
  }
})

async function onLoad(): Promise<void> {
  await load()
  await nextTick()
  keepFocusInside()
}

async function onSubmit(): Promise<void> {
  const result = await save()
  if (result?.saved) emit('saved')
  if (result?.complete) {
    emit('close')
    return
  }
  // Окно остаётся открытым: строка с фокусом могла сохраниться и уйти из DOM, а кнопка на время запроса
  // становилась disabled — без фокуса внутри панели не работают Escape и удержание Tab.
  await nextTick()
  // Повторное нажатие во время сохранения: save() сразу вернул null, фокус не трогаем
  if (!saving.value) focusError()
}

// Фокус после неудачного «Сохранить» (FM-44): при многих статьях строка с ошибкой может быть вне видимой части
// колонок, а на низком экране фокус на крестике уводит прокрутку к верху, прочь от сообщения у «Сохранить».
// Ошибка у строки — фокус в её поле с ошибкой (или в первое, если ошибка строки целиком, как лимит), и строка
// с текстом ошибки докручивается в видимую часть: focus() не прокручивает уже видимое поле. Общая ошибка (сеть,
// 5xx) — фокус на «Сохранить», рядом с её сообщением.
// NOTE(FM-44): при ошибке строки и общей ошибке в одном сохранении фокус — в строку; ниже 540px сообщение у
// «Сохранить» тогда может оказаться за нижним краем (скринридер объявит его через role="alert").
// TODO(FM-44): строка ищется по DOM дочерних компонентов (`data-testid` строк, `aria-invalid`, `role="alert"`
// из ErrorMessage) — при смене их разметки фокус тихо уйдёт на «Сохранить». Искать по состоянию
// (`rows[].errors`/`.message`) и звать `focusError()` строки через `defineExpose`.
function focusError(): void {
  const rows = panel.value ? [...panel.value.querySelectorAll<HTMLElement>(ROW)] : []
  const row = rows.find((item) => item.querySelector('[aria-invalid="true"], [role="alert"]'))
  if (row) {
    const field =
      row.querySelector<HTMLElement>('[aria-invalid="true"]') ??
      row.querySelector<HTMLElement>('input')
    field?.focus()
    row.scrollIntoView({ block: 'nearest' })
    return
  }
  const submit = panel.value?.querySelector<HTMLElement>('button[type="submit"]')
  if (submit) submit.focus()
  else keepFocusInside()
}

onMounted(async () => {
  setAppInert(true)
  await nextTick()
  keepFocusInside()
  await onLoad()
})

onBeforeUnmount(() => {
  setAppInert(false)
  opener?.focus()
})
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-dialog-backdrop/40 px-4 py-8 font-sans text-ink backdrop-blur-md"
    >
      <div
        ref="panel"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        class="relative flex w-full max-w-[1535px] flex-col rounded-[15px] bg-gradient-to-r from-dialog-start/70 to-dialog-end/70 px-4 pb-6 pt-8 shadow-xl sm:px-[65px] sm:pb-[27px] sm:pt-[46px] sm:my-auto lg:min-h-[min(672px,calc(100dvh-4rem))] [@media(min-height:540px)]:max-h-[calc(100dvh-4rem)]"
        @keydown="onKeydown"
      >
        <button
          type="button"
          aria-label="Закрыть"
          :disabled="saving"
          class="absolute right-3 top-3 flex size-10 items-center justify-center rounded-sm text-ink-muted hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50 sm:right-[14px] sm:top-[14px]"
          @click="emit('close')"
        >
          <!-- Крестик 12×12 из макета (узел 235:1004) -->
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.5" />
          </svg>
        </button>

        <h2 :id="titleId" class="pr-10 text-xl font-bold text-ink sm:text-2xl">
          Редактирование категорий
        </h2>

        <p v-if="loading" role="status" class="py-16 text-center text-sm text-ink-muted">
          Загрузка…
        </p>
        <div v-else-if="loadFailed" class="flex flex-col items-center gap-4 py-16 text-center">
          <ErrorMessage message="Не удалось загрузить статьи" />
          <BaseButton variant="secondary" @click="onLoad">Повторить</BaseButton>
        </div>
        <!-- novalidate: проверку делаем сами и показываем свои сообщения -->
        <form
          v-else
          class="mt-8 flex min-h-0 flex-1 flex-col gap-8 sm:mt-[31px]"
          novalidate
          @submit.prevent="onSubmit"
        >
          <!-- Отступ 4px внутри прокрутки (и такой же отрицательный снаружи): иначе overflow обрезает рамку
               фокуса у полей по краям. relative: иначе absolute-элементы колонок (sr-only подписи, знак ₽ в поле
               плана держит свой relative) позиционируются от панели, выходят из прокрутки и растягивают подложку. -->
          <div
            data-testid="category-editor-scroll"
            class="relative -m-1 grid min-h-0 flex-1 content-start gap-8 overflow-y-auto p-1 lg:grid-cols-2 lg:gap-[65px]"
          >
            <CategoryColumn
              :column="columns.outcome"
              title="Расходы"
              empty-text="Статей расходов пока нет"
              tone="danger"
              :readonly="saving"
              @update="updateRow"
            />
            <CategoryColumn
              :column="columns.income"
              title="Доходы"
              empty-text="Статей доходов пока нет"
              tone="success"
              :readonly="saving"
              @update="updateRow"
            />
          </div>
          <div class="mx-auto flex w-full max-w-[671px] shrink-0 flex-col gap-3">
            <ErrorMessage data-testid="form-error" :message="message" />
            <BaseButton type="submit" class="w-full" :loading="saving">Сохранить</BaseButton>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>
