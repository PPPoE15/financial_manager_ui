<script setup lang="ts">
import { ref } from 'vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import ErrorMessage from '@/components/ui/ErrorMessage.vue'
import logo from '@/assets/new-design/logo.svg'
import mark from '@/assets/new-design/brand-mark.svg'

const value = ref('')
const clicks = ref(0)
</script>

<template>
  <main class="mx-auto max-w-6xl p-6 sm:p-10">
    <header class="mb-8 flex flex-wrap items-center gap-6">
      <img :src="logo" alt="Финансовый менеджер" class="w-64 max-w-full" />
      <h1 class="text-xl">FM-55 · Базовые компоненты</h1>
    </header>
    <div class="grid gap-8 md:grid-cols-2">
      <section class="min-w-0 space-y-5" aria-label="Поля и кнопки">
        <BaseInput
          id="preview-email"
          v-model="value"
          label="Электронная почта"
          placeholder="Введите почту"
          aria-describedby="email-hint"
        />
        <p id="email-hint" class="text-caption text-ink-secondary">Пример подсказки к полю</p>
        <BaseInput
          label="Пароль"
          type="password"
          model-value="example-password"
          error="Пароль должен содержать не менее 8 символов"
        />
        <BaseInput label="Недоступное поле" model-value="Загрузка данных" disabled />
        <div class="flex flex-wrap gap-3">
          <BaseButton @click="clicks++">Войти</BaseButton>
          <BaseButton variant="secondary">Отмена</BaseButton>
          <BaseButton disabled>Недоступно</BaseButton>
          <BaseButton loading @click="clicks++">Загрузка</BaseButton>
        </div>
        <p class="text-caption text-ink-secondary" aria-live="polite">Нажатий: {{ clicks }}</p>
        <ErrorMessage message="Не удалось сохранить изменения. Попробуйте ещё раз." />
      </section>
      <section class="min-w-0 space-y-5" aria-label="Ресурсы и типографика">
        <div
          class="h-48 rounded-md bg-landscape bg-cover bg-center"
          role="img"
          aria-label="Горный пейзаж из макета"
        />
        <div class="rounded-md bg-surface-card p-6">
          <img :src="mark" alt="Знак финансового менеджера" class="mb-4 h-16" />
          <p class="font-brand text-lg font-medium">Involve Medium · Ваш бюджет</p>
          <p class="mt-2 text-sm text-ink-secondary">Inter · Доходы и расходы</p>
          <ErrorMessage class="mt-4" message="Пример ошибки на тёмной поверхности" />
        </div>
      </section>
    </div>
  </main>
</template>
