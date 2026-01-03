<script setup lang="ts" async>
import { getTransactions } from '@/api/get_transactions';
import Table from '@/components/Table.vue';
import { ref } from 'vue';

const tableColumns = [
  { label: 'Дата', prop: 'transaction_date' },
  { label: 'Категория', prop: 'category' },
  { label: 'Сумма', prop: 'money_sum' },
  { label: 'Описание', prop: 'description' },
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
    <Table :columns="tableColumns" :data="tableData" />
  </div>
</template>
