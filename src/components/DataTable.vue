<template>
  <table>
    <thead>
      <tr>
        <th v-for="column in columns" :key="column.prop">
          {{ column.label }}
        </th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="(row, index) in data" :key="index">
        <td v-for="column in columns" :key="column.prop">
          {{ row[column.prop] }}
        </td>
      </tr>
    </tbody>
  </table>
</template>

<script setup lang="ts">
import type { Column } from '@/types/table'

defineProps<{
  columns: Column[]
  data: Record<string, unknown>[]
}>()
</script>

<style scoped>
table {
  width: 100%;
  border-collapse: collapse;
}

th, td {
  border: 1px solid #ddd;
  padding: 8px;
  text-align: left;
}

th {
  background-color: #f2f2f2;
}
</style>