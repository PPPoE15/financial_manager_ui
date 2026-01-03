<script lang="ts">
import TransactionsView from './TransactionsView.vue';
export default {
  name: 'TabsComponent',
  components: {
    TransactionsView,
  },
  data() {
    return {
      activeTab: 'outcome' // Активная вкладка по умолчанию
    }
  }
}
</script>



<template>
  <div class="tabs-container">
    <!-- Кнопки вкладок -->
    <div class="tabs-header">
      <button 
        @click="activeTab = 'outcome'"
        :class="{ 'active': activeTab === 'outcome' }"
        class="tab-button"
      >
        Расходы
      </button>
      <button 
        @click="activeTab = 'income'"
        :class="{ 'active': activeTab === 'income' }"
        class="tab-button"
      >
        Доходы
      </button>
    </div>

    <!-- Содержимое вкладок -->
    <div class="tabs-content">
      <div v-if="activeTab === 'income'" class="tab-panel">
        <TransactionsView :transaction_type="'income'" />
      </div>

      <div v-if="activeTab === 'outcome'" class="tab-panel">
        <TransactionsView :transaction_type="'outcome'" />
      </div>
    </div>
  </div>
</template>


<style scoped>
.tabs-container {
  max-width: 800px;
  margin: 30px auto;
  border: 5px solid #d4d1fe;
  background-color: #d4d1fe;
  border-radius: 15px;
  overflow: hidden;
}

.tabs-header {
  display: flex;
  background-color: #d4d1fe;
  border-bottom: 3px solid #d4d1fe;
}

.tab-button {
  flex: 1;
  padding: 15px 20px;
  border: none;
  border-radius: 15px;
  background: #d4d1fe;
  cursor: pointer;
  font-size: 20px;
  transition: all 0.3s ease;
  color: #583f9b
}

.tab-button:hover {
  background-color: #d4d1fe;
}

.tab-button.active {
  background-color: #583f9b;
  color: #d4d1fe;
  font-weight: bold;
}

.tabs-content {
  padding: 20px;
  background-color: #583f9b;
  border-radius: 15px;
}

.tab-panel {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
