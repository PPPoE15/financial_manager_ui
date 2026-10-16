import { createApp, watch } from 'vue'
import { createPinia } from 'pinia'

import { useSessionStore } from '@/stores/session'
import App from '@/App.vue'
import { setSessionExpiredHandler } from '@/api/client'
import router, { redirectToLogin } from '@/router'
import '@/assets/main.css'

const app = createApp(App)
app.use(createPinia())
// При смене аккаунта/выходе в соседней вкладке сбрасываем также данные открытых экранов.
watch(
  () => useSessionStore().externalChange,
  () => window.location.reload(),
)
app.use(router)
setSessionExpiredHandler(() => redirectToLogin(router))
app.mount('#app')
