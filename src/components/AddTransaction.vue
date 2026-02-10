<template>
  <form @submit.prevent="handleSubmit" class="transaction-form">
    <div class="form-group">
      <label for="transaction_date">Дата транзакции</label>
      <input
        id="transaction_date"
        v-model="form.transaction_date"
        type="date"
        required
      />
    </div>

    <div class="form-group">
      <label for="category">Категория</label>
      <select
        id="category"
        v-model="form.category"
        @change="onCategoryChange"
        required
      >
        <option value="">Выберите категорию</option>
        <option
          v-for="cat in categories"
          :key="cat.uuid"
          :value="cat.uuid"
        >
          {{ cat.name }}
        </option>
      </select>
    </div>

    <div class="form-group">
      <label for="money_sum">Сумма</label>
      <input
        id="money_sum"
        v-model.number="form.money_sum"
        type="number"
        step="0.01"
        required
      />
    </div>

    <div class="form-group">
      <label for="transaction_type">Тип транзакции</label>
      <select id="transaction_type" v-model="form.transaction_type" required>
        <option value="income">Доход</option>
        <option value="expense">Расход</option>
      </select>
    </div>

    <div class="form-group">
      <label for="description">Описание</label>
      <textarea
        id="description"
        v-model="form.description"
        rows="3"
      ></textarea>
    </div>

    <button type="submit" :disabled="isSubmitting">
      {{ isSubmitting ? 'Отправляется...' : 'Сохранить' }}
    </button>
  </form>
</template>

<script lang="ts">
import { getCategories } from '@/api/get_categories';

export default {
  data() {
    return {
      categories: [], // Список категорий из API
      form: {
        transaction_date: '',
        category: '',       // UUID выбранной категории
        money_sum: null,
        transaction_type: '',
        description: ''
      },
      isSubmitting: false
    };
  },

  mounted() {
    this.fetchCategories();
  },

  methods: {
    // Загрузка категорий из API
    async fetchCategories() {
      try {
        const response = await getCategories("outcome");
        if (!response) {
          throw new Error('Ошибка загрузки категорий');
        }
        this.categories = response;
      } catch (error) {
        console.error('Не удалось загрузить категории:', error);
        alert('Не удалось загрузить категории. Проверьте подключение к сети.');
      }
    },

    // Обработчик изменения категории (можно расширить при необходимости)
    onCategoryChange() {
      // Здесь можно добавить логику при смене категории
    },

    // Отправка формы
    async handleSubmit() {
      this.isSubmitting = true;

      try {
        const payload = {
          transaction_date: this.form.transaction_date,
          category: this.form.category,      // UUID категории
          money_sum: this.form.money_sum,
          transaction_type: this.form.transaction_type,
          description: this.form.description
        };

        const response = await fetch('https://your-api-url/transactions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          throw new Error('Ошибка отправки данных');
        }

        alert('Транзакция сохранена!');
        this.$emit('success', payload); // Опциональное событие при успехе
        this.resetForm();
      } catch (error) {
        console.error('Ошибка при отправке формы:', error);
        alert('Не удалось сохранить транзакцию. Попробуйте ещё раз.');
      } finally {
        this.isSubmitting = false;
      }
    },

    // Очистка формы после отправки
    resetForm() {
      this.form = {
        transaction_date: '',
        category: '',
        money_sum: null,
        transaction_type: '',
        description: ''
      };
    }
  }
};
</script>

<style scoped>
.transaction-form {
  max-width: 500px;
  margin: 0 auto;
  padding: 20px;
  border: 1px solid #ddd;
  border-radius: 8px;
}

.form-group {
  margin-bottom: 15px;
}

label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
}

input, select, textarea {
  width: 100%;
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-sizing: border-box;
}

button {
  background-color: #007bff;
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

button:disabled {
  background-color: #6c757d;
  cursor: not-allowed;
}
</style>
