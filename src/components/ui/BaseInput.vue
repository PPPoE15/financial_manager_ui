<script setup lang="ts">
import { computed, useAttrs, useId, type HTMLAttributes } from 'vue'

import ErrorMessage from '@/components/ui/ErrorMessage.vue'

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    label: string
    type?: string
    placeholder?: string
    error?: string | null
    id?: string
  }>(),
  { type: 'text', placeholder: undefined, error: null, id: undefined },
)

const model = defineModel<string>({ default: '' })

// class/style родителя относятся к блоку поля целиком, остальные атрибуты — к самому <input>
const attrs = useAttrs()
const rootAttrs = computed(
  () => ({ class: attrs.class, style: attrs.style }) as Pick<HTMLAttributes, 'class' | 'style'>,
)
const inputAttrs = computed(() =>
  Object.fromEntries(Object.entries(attrs).filter(([key]) => key !== 'class' && key !== 'style')),
)

const generatedId = useId()
const inputId = computed(() => props.id ?? generatedId)
const errorId = computed(() => `${inputId.value}-error`)
// useAttrs не реактивен: читаем актуальные атрибуты при каждом рендере.
function describedBy(): string | undefined {
  return (
    [attrs['aria-describedby'], props.error ? errorId.value : undefined]
      .filter(Boolean)
      .join(' ') || undefined
  )
}
</script>

<template>
  <div class="flex flex-col gap-2" v-bind="rootAttrs">
    <label :for="inputId" class="text-caption font-medium leading-5 text-ink">{{ label }}</label>
    <input
      :id="inputId"
      v-model="model"
      v-bind="inputAttrs"
      :type="type"
      :placeholder="placeholder"
      :aria-invalid="error ? 'true' : undefined"
      :aria-describedby="describedBy()"
      class="h-control min-w-0 w-full rounded border bg-field px-3 text-base tracking-normal text-ink outline-none transition-colors placeholder:text-ink-placeholder enabled:hover:bg-field-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-ink-muted sm:text-sm"
      :class="error ? 'border-danger' : 'border-field-border'"
    />
    <ErrorMessage :id="errorId" :message="error" />
  </div>
</template>
