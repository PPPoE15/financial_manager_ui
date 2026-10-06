<script setup lang="ts">
import { reactive, ref } from 'vue'

import { register } from '@/api/auth'
import { mapAuthError } from '@/auth/errors'
import { useSignIn } from '@/auth/useSignIn'
import { validateRegistration, type FieldErrors } from '@/auth/validation'
import AuthFormLayout from '@/components/auth/AuthFormLayout.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import type { RegistrationRequest } from '@/types/auth'

const form = reactive<RegistrationRequest>({
  name: '',
  email: '',
  password: '',
  password_confirmation: '',
})
const errors = ref<FieldErrors<RegistrationRequest>>({})
const message = ref<string | null>(null)
const submitting = ref(false)

const signIn = useSignIn()

// TODO(FM-12): логика отправки (защита от повтора, валидация, mapAuthError) дублируется в LoginForm и
// RegistrationForm — вынести в общий composable.
async function onSubmit(): Promise<void> {
  // Повторная отправка (двойной клик, Enter во время запроса) не уходит вторым запросом
  if (submitting.value) return

  message.value = null
  errors.value = validateRegistration(form)
  if (Object.keys(errors.value).length) return

  const payload: RegistrationRequest = { ...form, name: form.name.trim(), email: form.email.trim() }
  submitting.value = true
  try {
    try {
      await register(payload)
    } catch (error) {
      const mapped = mapAuthError(error)
      message.value = mapped.message
      errors.value = mapped.fields
      return
    }

    // Регистрация токенов не выдаёт — входим с теми же данными
    try {
      await signIn({ email: payload.email, password: payload.password })
    } catch {
      // TODO(FM-12): форма остаётся активной — повторная отправка даст 409 «уже зарегистрирован».
      // Лучше сразу переключать на вкладку «Вход» с подставленной почтой. То же при 502/504 от /registration
      // по таймауту прокси, когда пользователь на бэкенде уже создан: повтор даст 409 без подсказки войти.
      message.value = 'Аккаунт создан, но войти автоматически не удалось. Войдите на вкладке «Вход»'
    }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <AuthFormLayout
    submit-label="Зарегистрироваться"
    :message="message"
    :submitting="submitting"
    @submit="onSubmit"
  >
    <BaseInput
      v-model="form.name"
      label="Как к вам обращаться"
      placeholder="Имя"
      autocomplete="name"
      :error="errors.name"
    />
    <BaseInput
      v-model="form.email"
      label="Электронная почта"
      type="email"
      placeholder="name@example.com"
      autocomplete="email"
      :error="errors.email"
    />
    <BaseInput
      v-model="form.password"
      label="Пароль"
      type="password"
      placeholder="Введите пароль"
      autocomplete="new-password"
      :error="errors.password"
    />
    <BaseInput
      v-model="form.password_confirmation"
      label="Подтвердите пароль"
      type="password"
      placeholder="Введите пароль еще раз"
      autocomplete="new-password"
      :error="errors.password_confirmation"
    />
  </AuthFormLayout>
</template>
