<script>
import { loginUser } from '@/api/login';

export default {
  name: 'UserLogin',
  data() {
    return {
      form: {
        login: '',
        password: '',
      }
    }
  },
  methods: {
    async handleSubmit() {
      try {
        const data = await loginUser({
          ...this.form,
        });
      } catch (error) {
        console.error('Login error:', error);
        alert('Failed to login');
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
        placeholder="   Имя пользователя или e-mail"
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
    <button
      type="submit"
      class="button"
    >
      Войти
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