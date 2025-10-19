import { createRouter, createWebHistory } from 'vue-router'
import AddTransactionView from '../views/AddTransactionView.vue'

const routes = [
  {
    path: '/add-transaction',
    name: 'AddTransaction',
    component: AddTransactionView,
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
