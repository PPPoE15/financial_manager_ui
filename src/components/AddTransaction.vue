<script setup lang="ts">
import { reactive } from 'vue';
import { createTransaction } from '@/api/transactions';

interface TransactionForm {
  transactionDate: string;
  category: string;
  moneySum: number | null;
  transactionType: 'income' | 'outcome' | '';
  description: string;
}

const form = reactive<TransactionForm>({
  transactionDate: new Date().toISOString().slice(0, 16),
  category: '',
  moneySum: null,
  transactionType: '',
  description: '',
});

const handleSubmit = async () => {
  try {
    if (!form.transactionType) {
      alert('Please select a transaction type');
      return;
    }
    await createTransaction({
      ...form,
      transactionType: form.transactionType as 'income' | 'outcome',
      moneySum: form.moneySum ?? 0,
    });
    alert('Transaction added successfully!');
    // Сброс формы
    form.category = '';
    form.moneySum = null;
    form.transactionType = '';
    form.description = '';
  } catch (error) {
    console.error('Error adding transaction:', error);
    alert('Failed to add transaction');
  }
};
</script>

<template>
  <div class="bg-white p-6 rounded-lg shadow-lg w-full max-w-md mx-auto">
    <h1 class="text-2xl font-bold mb-6 text-center">Add Transaction</h1>
    <form @submit.prevent="handleSubmit">
      <div class="mb-4">
        <label for="transactionDate" class="block text-sm font-medium text-gray-700">Transaction Date</label>
        <input
          v-model="form.transactionDate"
          type="datetime-local"
          id="transactionDate"
          class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
          required
        />
      </div>
      <div class="mb-4">
        <label for="category" class="block text-sm font-medium text-gray-700">Category</label>
        <input
          v-model="form.category"
          type="text"
          id="category"
          placeholder="e.g., Food, Salary"
          class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
          required
        />
      </div>
      <div class="mb-4">
        <label for="moneySum" class="block text-sm font-medium text-gray-700">Amount</label>
        <input
          v-model.number="form.moneySum"
          type="number"
          id="moneySum"
          placeholder="e.g., 120"
          min="0"
          step="0.01"
          class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
          required
        />
      </div>
      <div class="mb-4">
        <label for="transactionType" class="block text-sm font-medium text-gray-700">Transaction Type</label>
        <select
          v-model="form.transactionType"
          id="transactionType"
          class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
          required
        >
          <option value="" disabled>Select type</option>
          <option value="income">Income</option>
          <option value="outcome">Outcome</option>
        </select>
      </div>
      <div class="mb-4">
        <label for="description" class="block text-sm font-medium text-gray-700">Description</label>
        <textarea
          v-model="form.description"
          id="description"
          placeholder="e.g., Cat food"
          class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
          rows="4"
        ></textarea>
      </div>
      <button
        type="submit"
        class="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50"
      >
        Add Transaction
      </button>
    </form>
  </div>
</template>
