/**
 * 应用入口文件
 * 初始化 Vue 应用，注册 vue-i18n 国际化插件
 * 预加载 Iconify 图标数据，确保 webview 离线环境下图标正常显示
 */
import { createApp } from 'vue'
import i18n from './i18n'
import { registerIcons } from './utils/icons'
import App from './App.vue'

// 在创建应用前注册图标，确保所有 Icon 组件能正确渲染
registerIcons()

const app = createApp(App)
// 注册国际化插件，支持中英文切换
app.use(i18n)
app.mount('#app')
