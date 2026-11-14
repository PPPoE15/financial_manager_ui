<script setup lang="ts">
import { REGULAR_OPERATION_ROUTE } from '@/router/names'
import type { PlannedOperation } from '@/types/plannedOperation'

defineProps<{ recurrence: NonNullable<PlannedOperation['recurrence']> }>()
</script>

<template>
  <div class="mt-1 text-caption">
    <template v-if="recurrence.operation_status === 'deleted'">
      <span>Регулярный</span>
      <p class="text-ink-muted">Регулярная операция удалена</p>
    </template>
    <RouterLink
      v-else
      :to="{ name: REGULAR_OPERATION_ROUTE, params: { operationUid: recurrence.operation_uid } }"
      class="rounded text-success hover:underline focus-visible:outline"
    >
      Регулярный <span aria-hidden="true">↗</span>
    </RouterLink>
  </div>
</template>
