<template>
  Добро пожаловать
  <div>
    <button 
      @click="$router.push('/login')"
      class="bg-blue-500 text-white px-4 py-2 rounded"
    >
      Вход
    </button>
    <button 
      @click="$router.push('/registration')"
      class="bg-blue-500 text-white px-4 py-2 rounded"
    >
      Регистрация
    </button>
  </div>
</template>
