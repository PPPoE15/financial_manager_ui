<script setup lang="ts">
import { computed, useId, type InputHTMLAttributes } from 'vue'

import ErrorMessage from '@/components/ui/ErrorMessage.vue'
import type { EditorRow, RowField } from '@/categories/useCategoryEditor'

// Строка статьи по макету (Group 32) — и существующей (FM-46), и новой: поля «Название категории», «План»,
// «Комментарий» с подсказками-плейсхолдерами; у заполненного плана справа знак ₽. Введённые значения — жирные,
// подсказки — обычным начертанием, как в макете. Подписей над полями в макете нет — имя поля для скринридера
// в aria-label. Строка — данные окна: поле не меняется здесь, а сообщается событием `update`.
// readonly — на время сохранения: правка отправляемой строки потерялась бы (сохранённая строка принимает
// значения из ответа) или получила бы ошибку, относящуюся к прежнему значению.
const props = defineProps<{ row: EditorRow; readonly?: boolean }>()

const emit = defineEmits<{ update: [field: RowField, value: string] }>()

function onInput(name: RowField, event: Event): void {
  emit('update', name, (event.target as HTMLInputElement).value)
}

const errorId = useId()
const messages = computed(() =>
  (['name', 'plan', 'description'] as RowField[])
    .map((field) => props.row.errors[field])
    .concat(props.row.message ?? undefined)
    .filter((text): text is string => Boolean(text)),
)

const field =
  'h-[46px] w-full min-w-0 rounded-sm border bg-field px-[15px] text-base sm:text-sm font-medium text-ink outline-none placeholder:font-normal placeholder:text-ink-placeholder focus-visible:outline-2 hover:bg-field-hover focus-visible:outline-offset-2 focus-visible:outline-focus'

// TODO(FM-46): у полей всех строк одинаковые aria-label («Название категории», «План», «Комментарий») — при многих
// статьях скринридер читает «План, 4 990» без указания статьи. Связать поля существующей статьи с её названием
// (например, aria-label «План: Продукты» или группа с подписью).
// TODO(FM-46): у полей нет title с полным текстом, как было у ячеек только для чтения (FM-42): длинное название
// (поле 184px) или комментарий видны только началом. Вернуть :title со значением поля.
// TODO(FM-42): aria-describedby всех полей строки ссылается на общий список ошибок, а текст ошибки не называет
// поле — скринридер зачитывает ошибку плана и на названии, и на комментарии. Связывать каждое поле со своей ошибкой.
function attrs(name: RowField): InputHTMLAttributes {
  const invalid = Boolean(props.row.errors[name])
  return {
    value: props.row[name],
    readonly: props.readonly,
    onInput: (event: Event) => onInput(name, event),
    'aria-invalid': invalid ? 'true' : undefined,
    'aria-describedby': messages.value.length ? errorId : undefined,
    class: [field, invalid ? 'border-danger' : 'border-transparent'],
  }
}
</script>

<template>
  <div>
    <div class="grid grid-cols-2 gap-[5px] sm:grid-cols-[184fr_185fr_292fr]">
      <input
        type="text"
        aria-label="Название категории"
        placeholder="Название категории"
        autocomplete="off"
        class="col-span-2 sm:col-span-1"
        v-bind="attrs('name')"
      />
      <div class="relative min-w-0">
        <input
          type="text"
          inputmode="numeric"
          aria-label="План"
          placeholder="План"
          autocomplete="off"
          :class="row.plan && 'pr-9'"
          v-bind="attrs('plan')"
        />
        <!-- TODO(FM-46): знак ₽ — у любого непустого ввода, в том числе неверного («abc ₽»), как было с FM-42;
             показывать его только у числа (parsePlan без ошибки). -->
        <span
          v-if="row.plan"
          aria-hidden="true"
          class="pointer-events-none absolute inset-y-0 right-[15px] flex items-center text-sm font-medium text-ink"
          >₽</span
        >
      </div>
      <!-- NOTE(FM-46): однострочное поле, как в макете. Контракт допускает переводы строк в комментарии — созданный
           через API многострочный комментарий показывается слитно, и его правка отправит текст без переводов строк.
           Через окно такой не создать. -->
      <input
        type="text"
        aria-label="Комментарий"
        placeholder="Комментарий"
        autocomplete="off"
        v-bind="attrs('description')"
      />
    </div>
    <div v-if="messages.length" :id="errorId" class="mt-1 flex flex-col gap-1">
      <ErrorMessage v-for="text in messages" :key="text" :message="text" />
    </div>
  </div>
</template>
