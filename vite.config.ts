import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), vueDevTools()],
  // Абсолютный base: относительные пути к ассетам ломаются при обновлении страницы на вложенном маршруте
  base: '/',
  // В dev-режиме повторяет маршрутизацию nginx: запрос уходит в контейнер бэкенда (порты из
  // fm_devops/docker-compose.yaml). Префикс снимается только для /transaction/ — сервис авторизации
  // сам монтирует API под /auth. Нужен, когда VITE_API_URL/VITE_AUTH_API_URL не заданы.
  server: {
    proxy: {
      '/transaction/': {
        target: 'http://localhost:8083',
        rewrite: (path) => path.replace(/^\/transaction/, ''),
      },
      '/auth/': {
        target: 'http://localhost:8082',
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
