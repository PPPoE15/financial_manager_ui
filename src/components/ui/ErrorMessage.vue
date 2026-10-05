<script setup lang="ts">
defineProps<{
  message?: string | null
  id?: string
}>()
</script>

<template>
  <p v-if="message" :id="id" role="alert" class="text-sm text-danger">{{ message }}</p>
</template>
