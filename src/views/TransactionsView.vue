<script setup lang="ts" async>
import { getTransactions } from '@/api/get_transactions';
import Table from '@/components/TransactionTable.vue';
import { ref } from 'vue';

const tableColumns = [
  { label: 'Дата', prop: 'transaction_date', type: 'date' },
  { label: 'Категория', prop: 'category', type: 'text' },
  { label: 'Сумма', prop: 'money_sum', type: 'number' },
  { label: 'Описание', prop: 'description', type: 'text' },
];
const props = defineProps({
  transaction_type: {
    type: String,
    required: true
  },
});

const response = await getTransactions(props.transaction_type);
const tableData = ref<any[]>([]);

tableData.value = response.content
</script>

<template>
  <div class="container mx-auto p-4">
    <Table :columns="tableColumns" :data="tableData" :transaction_type="transaction_type" />
  </div>
</template>
