<script setup lang="ts">
defineProps<{
  message?: string | null
  id?: string
}>()
</script>

<template>
  <p
    v-if="message"
    :id="id"
    role="alert"
    class="break-words text-sm font-medium leading-5 text-danger"
  >
    {{ message }}
  </p>
</template>
