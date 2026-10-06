import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from '@/App.vue'
import { setSessionExpiredHandler } from '@/api/client'
import router, { redirectToLogin } from '@/router'
import '@/assets/main.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)
setSessionExpiredHandler(() => redirectToLogin(router))
app.mount('#app')
