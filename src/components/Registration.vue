<script setup lang="ts">
import { reactive } from 'vue';
import { createUser } from '@/api/registration';
import type { Registration } from '@/types/registration';

const form = reactive<Registration>({
  login: '',
  password: '',
  password_confirmation: '',
  email: '',
});

const handleSubmit = async () => {
  try {
    await createUser({
      ...form,
    });
  } catch (error) {
    console.error('Registration error:', error);
    alert('Failed to register');
  }
};
</script>

<template>
  <div class="bg-white p-6 rounded-lg shadow-lg w-full max-w-md mx-auto">
    <h1 class="text-2xl font-bold mb-6 text-center">Регистрация</h1>
    <form @submit.prevent="handleSubmit">
      <div class="mb-4">
        <label for="login" class="block text-sm font-medium text-gray-700">login</label>
        <input
          v-model="form.login"
          type="text"
          id="login"
          placeholder="e.g., Food, Salary"
          class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
          required
        />
      </div>
      <div class="mb-4">
        <label for="password" class="block text-sm font-medium text-gray-700">password</label>
        <input
          v-model="form.password"
          type="text"
          id="password"
          placeholder="e.g., Food, Salary"
          class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
          required
        />
      </div>
      <div class="mb-4">
        <label for="password_confirmation" class="block text-sm font-medium text-gray-700">password_confirmation</label>
        <input
          v-model="form.password_confirmation"
          type="text"
          id="password_confirmation"
          placeholder="e.g., Food, Salary"
          class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
          required
        />
      </div>
      <div class="mb-4">
        <label for="email" class="block text-sm font-medium text-gray-700">email</label>
        <input
          v-model="form.email"
          type="text"
          id="email"
          placeholder="e.g., Food, Salary"
          class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
          required
        />
      </div>
      <button
        type="submit"
        class="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50"
      >
        Зарегистрироваться
      </button>
    </form>
  </div>
</template>
