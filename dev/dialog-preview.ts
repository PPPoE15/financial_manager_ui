import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { AxiosError, AxiosHeaders } from 'axios'
import { http } from '../src/api/client'
import { useSessionStore } from '../src/stores/session'
import DialogPreview from './DialogPreview.vue'
import '../src/assets/main.css'

// Только локальный стенд: запросы не отправляются на сервер.
http.defaults.adapter = async (config) => {
  const response = { config, headers: new AxiosHeaders(), status: 200, statusText: 'OK', data: {} as object }
  if (config.url === '/starting-balance') {
    response.status = 404
    response.data = { code: 'FM-404201' }
    throw new AxiosError('Остаток не задан', '404', config, null, response)
  }
  if (config.method !== 'get') throw new AxiosError('Network Error', 'ERR_NETWORK', config, {})
  if (config.url === '/categories') {
    const type = config.params.category_type
    const count = new URLSearchParams(location.search).has('long') ? 40 : type === 'income' ? 1 : 2
    response.data = { content: Array.from({ length: count }, (_, i) => ({
      uid: `${type}-${i}`, name: type === 'income' ? `Зарплата ${i + 1}` : i === 0 ? 'Продукты' : `ЖКХ ${i}`,
      category_type: type, money_plan: type === 'income' ? 200000 : 4990, description: i === 0 ? 'Покупки в магазинах' : null,
    })) }
  }
  return response
}
const app = createApp(DialogPreview)
app.use(createPinia())
useSessionStore().setUser({ uid: 'preview', email: 'preview@example.test', name: null })
app.mount('#app')
