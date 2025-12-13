<script lang="ts">
import { createUser } from '@/api/registration';
import { loginUser } from '@/api/login';
import type { LoginData } from '@/types/loginData'

export default {
  name: 'UserRegistration',
  data() {
    return {
      form: {
        login: '',
        password: '',
        password_confirmation: '',
        email: '',
      }
    }
  },
  methods: {
    async handleSubmit() {
      try {
        await createUser({
          ...this.form,
        });
        const loginData: LoginData = {
          login: this.form.login,
          password: this.form.password
        };

        await loginUser({
          ...loginData
        });
      } catch (error) {
        console.error('Registration error:', error);
        alert('Failed to register');
      }
    }
  }
}
</script>

<template>
  <form @submit.prevent="handleSubmit">
    <div class="mb-4">
      <input
        v-model="form.login"
        type="text"
        id="login"
        placeholder="   Имя пользователя"
        class="field"
        required
      />
    </div>
    <div class="mb-4">
      <input
        v-model="form.password"
        type="password"
        id="password"
        placeholder="   Пароль"
        class="field"
        required
      />
    </div>
    <div class="mb-4">
      <input
        v-model="form.password_confirmation"
        type="password"
        id="password_confirmation"
        placeholder="   Повторите пароль"
        class="field"
        required
      />
    </div>
    <div class="mb-4">
      <input
        v-model="form.email"
        type="email"
        id="email"
        placeholder="   E-mail"
        class="field"
      />
    </div>
    <button
      type="submit"
      class="button"
    >
      Зарегистрироваться
    </button>
  </form>
</template>

<style scoped>
.field {
  margin: 10px auto;
  width: 100%;
  background-color: #d4d1fe;
  border-radius: 15px;
  min-height: 45px;
}
.button {
  margin: 10px auto;
  background-color: #d4d1fe;
  border-radius: 15px;
  color: #583f9b;
  min-height: 45px;
  min-width: 35%;
  display: flex;
  justify-content: center;
  align-items: center;
}

</style>