<script setup lang="ts">
import { computed, useId, type InputHTMLAttributes } from 'vue'

import ErrorMessage from '@/components/ui/ErrorMessage.vue'
import type { NewRow, NewRowField } from '@/categories/useCategoryEditor'

// Строка для новой статьи по макету (Group 32): поля «Название категории», «План», «Комментарий»
// с подсказками-плейсхолдерами; у заполненного плана справа знак ₽, как у существующих строк.
// Подписей над полями в макете нет — имя поля для скринридера в aria-label.
// Строка — данные окна: поле не меняется здесь, а сообщается событием `update`.
// readonly — на время сохранения: правка отправляемой строки потерялась бы (строка уходит в список
// со старым значением) или получила бы ошибку, относящуюся к прежнему значению.
const props = defineProps<{ row: NewRow; readonly?: boolean }>()

const emit = defineEmits<{ update: [field: NewRowField, value: string] }>()

function onInput(name: NewRowField, event: Event): void {
  emit('update', name, (event.target as HTMLInputElement).value)
}

const errorId = useId()
const messages = computed(() =>
  (['name', 'plan', 'description'] as NewRowField[])
    .map((field) => props.row.errors[field])
    .concat(props.row.message ?? undefined)
    .filter((text): text is string => Boolean(text)),
)

const field =
  'h-[46px] w-full min-w-0 rounded-sm border bg-surface px-[15px] text-sm text-ink outline-none placeholder:text-ink-placeholder focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary'

// TODO(FM-42): aria-describedby всех полей строки ссылается на общий список ошибок, а текст ошибки не называет
// поле — скринридер зачитывает ошибку плана и на названии, и на комментарии. Связывать каждое поле со своей ошибкой.
function attrs(name: NewRowField): InputHTMLAttributes {
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
  <div data-testid="new-row">
    <div class="grid grid-cols-2 gap-[5px] sm:grid-cols-[184fr_185fr_292fr]">
      <input
        type="text"
        aria-label="Название категории"
        placeholder="Название категории"
        autocomplete="off"
        class="col-span-2 font-medium sm:col-span-1"
        v-bind="attrs('name')"
      />
      <div class="relative min-w-0">
        <input
          type="text"
          inputmode="numeric"
          aria-label="План"
          placeholder="План"
          autocomplete="off"
          class="font-medium"
          :class="row.plan && 'pr-9'"
          v-bind="attrs('plan')"
        />
        <span
          v-if="row.plan"
          aria-hidden="true"
          class="pointer-events-none absolute inset-y-0 right-[15px] flex items-center text-sm font-medium text-ink"
          >₽</span
        >
      </div>
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
