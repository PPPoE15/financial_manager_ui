import { createRouter, createWebHistory } from 'vue-router'
import AddTransactionView from '../views/AddTransactionView.vue'
import HomePage from '@/components/HomePage.vue'
import Registration from '@/components/Registration.vue'

const routes = [
  {
    path: '/',
    name: 'home',
    component: HomePage
  },
  {
    path: '/registration',
    name: 'registration',
    component: Registration
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
