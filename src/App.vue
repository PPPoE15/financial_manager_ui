<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <div class="main-background">
    <div class="content">
      <h1 class="header">Финансовый менеджер</h1>
      <RouterView />
    </div>
  </div>
</template>

<style scoped>
.main-background {
  position: relative;
  background-color: #35354f;
  min-height: 100vh;
}

/* Используем псевдоэлемент для фона */
.main-background::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-image: url('/logo_FM.png');
  background-repeat: no-repeat;
  background-position: center;
  background-size: 40%;
  opacity: 0.07;
  z-index: 1;
}

.header {
  text-align: center;
  font-size: 30px;
  padding: 10px;
  font-weight: bold;
  color: #d4d1fe;
}

.content {
  position: relative; /* Создаем новый контекст стека */
  z-index: 2; /* Контент выше фона */
  min-height: calc(100vh - 60px);
}
</style>