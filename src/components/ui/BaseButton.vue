<script setup lang="ts">
withDefaults(
  defineProps<{
    type?: 'button' | 'submit' | 'reset'
    variant?: 'primary' | 'secondary'
    disabled?: boolean
    loading?: boolean
  }>(),
  { type: 'button', variant: 'primary', disabled: false, loading: false },
)

defineEmits<{ click: [event: MouseEvent] }>()
</script>

<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    :aria-busy="loading ? 'true' : undefined"
    class="inline-flex items-center justify-center px-10 font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
    :class="
      variant === 'primary'
        ? 'h-control rounded bg-primary text-base tracking-normal text-ink-inverse'
        : 'h-[42px] rounded-sm bg-primary-soft text-sm text-primary'
    "
    @click="$emit('click', $event)"
  >
    <slot />
  </button>
</template>
