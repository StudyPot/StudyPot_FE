import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './app/App.vue'
import router from './app/router'
import './app/styles/index.css'
import { enableMocking } from './shared/api/msw/enableMocking'

async function bootstrap(): Promise<void> {
  await enableMocking()

  const app = createApp(App)

  app.use(createPinia())
  app.use(router)

  app.mount('#app')
}

void bootstrap()
