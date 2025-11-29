<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <div class="main-background">
    <h1 class="header">Финансовый менеджер</h1>
    <RouterView />
  </div>
</template>


<style scoped>
.main-background{
  background-color: #583f9b;
  min-height: 100vh;
}

.header{
text-align: center;
font-size: 30px;
padding: 10px;
font-weight: bold;
color: #d4d1fe;
}
</style>