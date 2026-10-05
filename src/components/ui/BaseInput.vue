<script setup lang="ts">
import { computed, useId } from 'vue'

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

const generatedId = useId()
const inputId = computed(() => props.id ?? generatedId)
const errorId = computed(() => `${inputId.value}-error`)
</script>

<template>
  <div class="flex flex-col gap-[11px]">
    <label :for="inputId" class="text-base font-medium text-ink">{{ label }}</label>
    <input
      :id="inputId"
      v-model="model"
      v-bind="$attrs"
      :type="type"
      :placeholder="placeholder"
      :aria-invalid="error ? 'true' : undefined"
      :aria-describedby="error ? errorId : undefined"
      class="h-control w-full rounded border bg-surface-card px-[18px] text-base tracking-normal text-ink outline-none placeholder:text-ink-placeholder focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
      :class="error ? 'border-danger' : 'border-transparent'"
    />
    <ErrorMessage :id="errorId" :message="error" />
  </div>
</template>
