<script setup lang="ts">
import { formatMoney } from '@/utils/money'

// Ячейка суммы: `null` — бледный прочерк, а смысл прочерка (`missingLabel`) — для скринридера
defineProps<{ value: number | null; missingLabel: string }>()
</script>

<template>
  <td :class="value === null && 'text-ink-placeholder'">
    <template v-if="value === null">
      <span aria-hidden="true">{{ formatMoney(null) }}</span>
      <span class="sr-only">{{ missingLabel }}</span>
    </template>
    <template v-else>{{ formatMoney(value) }}</template>
  </td>
</template>
