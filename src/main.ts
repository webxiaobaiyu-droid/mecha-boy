import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from '@/App.vue'
import '@/styles/main.scss'

createApp(App).use(createPinia()).mount('#app')
