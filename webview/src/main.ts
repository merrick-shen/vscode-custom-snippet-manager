/**
 * 应用入口文件
 * 初始化 Vue 应用，注册 vue-i18n 国际化插件
 * 预加载 Iconify 图标数据，确保 webview 离线环境下图标正常显示
 *
 * i18n 按需加载：启动时若用户偏好语言非内置（zh/en），先异步加载该语言再挂载应用，
 * 避免渲染后立即切换语言造成的视觉闪烁
 */
import { createApp } from 'vue'
import i18n, { ensureLocale } from '@/i18n'
import { registerIcons } from '@/utils/icons'
import App from '@/App.vue'

// 在创建应用前注册图标，确保所有 Icon 组件能正确渲染
registerIcons()

// 异步引导：确保启动语言翻译已加载后再挂载应用
async function bootstrap() {
  const startupLocale = window.__LOCALE || 'zh'
  await ensureLocale(startupLocale)
  const app = createApp(App)
  // 注册国际化插件，支持多语言切换
  app.use(i18n)
  // 启动语言已加载完成，确保 locale 指向用户偏好
  i18n.global.locale.value = startupLocale
  app.mount('#app')
}

void bootstrap()
