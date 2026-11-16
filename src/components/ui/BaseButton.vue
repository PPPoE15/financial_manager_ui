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
    class="inline-flex min-h-control items-center justify-center gap-2 rounded px-6 py-2 text-sm font-bold leading-5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:bg-action-disabled disabled:text-action-disabled-foreground"
    :class="
      variant === 'primary'
        ? 'bg-action text-action-foreground enabled:hover:bg-action-hover enabled:active:bg-action-pressed'
        : 'bg-surface-card text-ink enabled:hover:bg-field-hover enabled:active:bg-surface-muted'
    "
    @click="$emit('click', $event)"
  >
    <span
      v-if="loading"
      aria-hidden="true"
      class="size-3 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none"
    />
    <slot />
  </button>
</template>
