<script setup lang="ts">
import { computed, useId } from 'vue'

import ErrorMessage from '@/components/ui/ErrorMessage.vue'

// Блок окна «Первый шаг» по макету «Приветствие»: вопрос (он же подпись поля), пояснение под ним,
// поле и, у суммы, знак ₽ внутри поля справа
const props = withDefaults(
  defineProps<{
    label: string
    hint: string
    placeholder: string
    error?: string | null
    suffix?: string
    autocomplete?: string
  }>(),
  { error: null, suffix: undefined, autocomplete: 'off' },
)

const model = defineModel<string>({ default: '' })

const inputId = useId()
const hintId = `${inputId}-hint`
const suffixId = `${inputId}-suffix`
const errorId = `${inputId}-error`
const describedBy = computed(() =>
  [hintId, props.suffix && suffixId, props.error && errorId].filter(Boolean).join(' '),
)
</script>

<template>
  <div class="flex flex-col">
    <label :for="inputId" class="text-lg font-medium text-ink sm:text-xl">{{ label }}</label>
    <p :id="hintId" class="mt-1 text-sm text-ink-secondary">{{ hint }}</p>
    <div class="relative mt-4 sm:mt-[30px]">
      <input
        :id="inputId"
        v-model="model"
        type="text"
        :placeholder="placeholder"
        :autocomplete="autocomplete"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="describedBy"
        class="h-control w-full rounded border bg-surface px-[18px] text-base tracking-normal text-ink outline-none placeholder:text-ink-placeholder focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary"
        :class="[error ? 'border-danger' : 'border-transparent', suffix && 'pr-12']"
      />
      <span
        v-if="suffix"
        :id="suffixId"
        class="pointer-events-none absolute inset-y-0 right-[18px] flex items-center text-base text-ink"
        >{{ suffix }}</span
      >
    </div>
    <ErrorMessage :id="errorId" :message="error" class="mt-2" />
  </div>
</template>
