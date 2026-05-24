/**
 * 国际化配置
 * 使用 vue-i18n 管理多语言翻译
 * 启动时从 window.__LOCALE 读取后端注入的语言偏好，确保侧边栏和编辑器语言同步
 * legacy: false 启用 Composition API 模式
 */
import { createI18n } from 'vue-i18n'
import zh from './zh'
import zhTW from './zh-TW'
import en from './en'
import ja from './ja'
import ko from './ko'
import ru from './ru'
import de from './de'
import fr from './fr'
import es from './es'
import pt from './pt'
import it from './it'
import pl from './pl'
import tr from './tr'
import localesData from '../../../locales.json'

/** 支持的语言列表，用于语言切换下拉菜单（数据来源：locales.json） */
export const SUPPORTED_LOCALES = localesData.locales

/** 语言标识符类型 */
export type LocaleValue = (typeof SUPPORTED_LOCALES)[number]['value']

// 读取后端注入的语言偏好，默认简体中文
const savedLocale = window.__LOCALE || 'zh'

const i18n = createI18n({
  legacy: false,
  locale: savedLocale,
  fallbackLocale: 'en',
  messages: { zh, 'zh-TW': zhTW, en, ja, ko, ru, de, fr, es, pt, it, pl, tr },
})

export default i18n
