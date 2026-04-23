/**
 * 国际化配置
 * 使用 vue-i18n 管理中英文翻译
 * 启动时从 window.__LOCALE 读取后端注入的语言偏好，确保侧边栏和编辑器语言同步
 * legacy: false 启用 Composition API 模式
 */
import { createI18n } from 'vue-i18n'
import zh from './zh'
import en from './en'

// 读取后端注入的语言偏好，默认中文
const savedLocale = window.__LOCALE || 'zh'

const i18n = createI18n({
  legacy: false,
  locale: savedLocale,
  fallbackLocale: 'en',
  messages: { zh, en },
})

export default i18n
