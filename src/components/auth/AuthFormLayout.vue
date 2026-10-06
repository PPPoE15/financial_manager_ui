<script setup lang="ts">
import BaseButton from '@/components/ui/BaseButton.vue'
import ErrorMessage from '@/components/ui/ErrorMessage.vue'

defineProps<{
  submitLabel: string
  message: string | null
  submitting: boolean
}>()

const emit = defineEmits<{ submit: [] }>()
</script>

<template>
  <!-- novalidate: проверку делаем сами и показываем свои сообщения, а не всплывающие подсказки браузера -->
  <form class="flex flex-col gap-9" novalidate @submit.prevent="emit('submit')">
    <slot />
    <div class="flex flex-col gap-3">
      <ErrorMessage data-testid="form-error" :message="message" />
      <BaseButton type="submit" class="w-full" :loading="submitting">{{ submitLabel }}</BaseButton>
    </div>
  </form>
</template>
