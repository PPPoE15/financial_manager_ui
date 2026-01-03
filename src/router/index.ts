import { createRouter, createWebHistory } from 'vue-router'
import AddTransactionView from '@/views/AddTransactionView.vue'
import HomePage from '@/components/HomePage.vue'
import RegistrationView from '@/views/RegistrationView.vue'
import TransactionsTabsView from '@/views/TransactionsTabsView.vue'

const routes = [
  {
    path: '/',
    name: 'home',
    component: HomePage,
  },
  {
    path: '/registration',
    name: 'registration',
    component: RegistrationView,
  },
  {
    path: '/transaction-list',
    name: 'transactions',
    component: TransactionsTabsView,
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
