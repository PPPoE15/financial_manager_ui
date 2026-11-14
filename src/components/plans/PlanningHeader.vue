<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { PLANNED_OPERATIONS_ROUTE, REGULAR_OPERATIONS_ROUTE } from '@/router/names'

defineProps<{ regular?: boolean }>()
</script>

<template>
  <h1 class="break-words font-brand text-xl font-medium sm:text-2xl lg:pr-[260px]">Планирование</h1>
  <nav aria-label="Планирование" class="mt-6 grid grid-cols-2 gap-2 sm:flex sm:gap-3">
    <RouterLink
      :to="{ name: PLANNED_OPERATIONS_ROUTE }"
      :aria-current="!regular ? 'page' : undefined"
      class="flex min-h-11 items-center justify-center rounded px-2 py-2 text-center text-xs font-bold sm:px-8 sm:text-sm"
      :class="!regular ? 'bg-action text-action-foreground' : 'bg-surface-card text-ink'"
      >Запланированные</RouterLink
    >
    <RouterLink
      :to="{ name: REGULAR_OPERATIONS_ROUTE }"
      :aria-current="regular ? 'page' : undefined"
      class="flex min-h-11 items-center justify-center rounded px-2 py-2 text-center text-xs font-bold sm:px-8 sm:text-sm"
      :class="regular ? 'bg-action text-action-foreground' : 'bg-surface-card text-ink'"
      >Регулярные операции</RouterLink
    >
  </nav>
</template>
