<script setup lang="ts">
import { createTransaction } from "@/api/create_transactions";
import Table from "@/components/Table.vue"
import { reactive, ref } from 'vue';

interface TransactionForm {
  transaction_date: string;
  category: string;
  money_sum: number;
  transaction_type: string;
  description: string;
}

const props = defineProps({
  columns: {
    type: Array,
    required: true
  },
  data: {
    type: Array,
    required: true
  },
  transaction_type: {
    type: String,
    required: true
  },
});

const data = ref<any[]>(props.data);
const newRow = reactive<TransactionForm>({
  transaction_date: '',
  category: '',
  money_sum: 0,
  transaction_type: props.transaction_type,
  description: ''
});

async function addNewRow() {
  try {
    const response = await createTransaction({
      ...newRow,
    });

    if (!response.ok) throw new Error('Ошибка сети');

    const savedItem = await response.json() as TransactionForm;
    data.value.push(savedItem);

    // Сброс формы
    Object.assign(newRow.value, {
      transaction_date: '',
      category: '',
      money_sum: null,
      transaction_type: '',
      description: ''
    });
  } catch (error) {
    console.error('Ошибка:', error);
    alert('Не удалось сохранить');
  }
}
</script>

<template>
  <div>
    <!-- Базовая таблица -->
    <Table :columns="columns" :data="data" />

    <!-- Форма добавления -->
    <div class="add-row">
      <table>
        <tbody>
          <tr>
            <td v-for="column in columns" :key="column.prop">
              <input
                v-model="newRow[column.prop]"
                :type="column.type || 'text'"
                class="w-full px-2 py-1 border rounded"
              />
            </td>
            <td>
              <button @click="addNewRow" class="px-3 py-1 bg-blue-500 text-white rounded">
                Сохранить
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
th, td {
  border: 1px solid #ddd;
  padding: 8px;
  text-align: left;
}

th {
  background-color: #f2f2f2;
}
</style>