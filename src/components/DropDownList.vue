<template>
  <div>
    <input
      type="text"
      v-model="searchQuery"
      placeholder="Поиск..."
      class="search-input"
    />
    
    <select v-model="selectedValue" size="5">
      <option
        v-for="item in filteredOptions"
        :key="item.value"
        :value="item.value"
      >
        {{ item.name }}
      </option>
    </select>
    <button class="px-3 py-1 bg-blue-500 text-white rounded">
      Создать
    </button>
  </div>
</template>

<script setup lang="ts">
import { getCategories } from '@/api/get_categories';
import type { categoryData } from '@/types/categories';
import { ref, computed } from 'vue';

const searchQuery = ref('');
const selectedValue = ref('');

const categories = ref<categoryData[]>([]);
const response = await getCategories("outcome");
categories.value = response
console.log(categories.value)

// Фильтрация по поиску
const filteredOptions = computed(() => {
  return categories.value.filter(item =>
    item.name.toLowerCase().includes(searchQuery.value.toLowerCase())
  );
});
</script>

<style>
.search-input {
  width: 100%;
  padding: 8px;
  margin-bottom: 8px;
}
</style>