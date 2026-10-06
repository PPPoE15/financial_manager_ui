<script setup lang="ts">
import { reactive, ref } from 'vue'

import { mapAuthError } from '@/auth/errors'
import { useSignIn } from '@/auth/useSignIn'
import { validateLogin, type FieldErrors } from '@/auth/validation'
import AuthFormLayout from '@/components/auth/AuthFormLayout.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import type { LoginRequest } from '@/types/auth'

const form = reactive<LoginRequest>({ email: '', password: '' })
const errors = ref<FieldErrors<LoginRequest>>({})
const message = ref<string | null>(null)
const submitting = ref(false)

const signIn = useSignIn()

async function onSubmit(): Promise<void> {
  // Повторная отправка (двойной клик, Enter во время запроса) не уходит вторым запросом
  if (submitting.value) return

  message.value = null
  errors.value = validateLogin(form)
  if (Object.keys(errors.value).length) return

  submitting.value = true
  try {
    await signIn({ email: form.email.trim(), password: form.password })
  } catch (error) {
    const mapped = mapAuthError(error)
    message.value = mapped.message
    errors.value = mapped.fields
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <AuthFormLayout
    submit-label="Войти"
    :message="message"
    :submitting="submitting"
    @submit="onSubmit"
  >
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
      autocomplete="current-password"
      :error="errors.password"
    />
  </AuthFormLayout>
</template>
