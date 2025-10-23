import { createRouter, createWebHistory } from 'vue-router'
import AddTransactionView from '../views/AddTransactionView.vue'
import HomePage from '@/components/HomePage.vue'

const routes = [
  {
    path: '/',
    name: 'home',
    component: HomePage
  },
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
