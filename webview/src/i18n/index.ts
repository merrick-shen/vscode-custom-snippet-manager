/**
 * 国际化配置
 * 使用 vue-i18n 管理多语言翻译
 * 启动时从 window.__LOCALE 读取后端注入的语言偏好，确保侧边栏和编辑器语言同步
 * legacy: false 启用 Composition API 模式
 *
 * 按需加载策略：
 * - 启动时仅静态导入 zh（默认）与 en（fallback），保证首屏立即可用
 * - 其余 23 种语言通过 import.meta.glob 注册为动态 chunk
 * - 切换语言或启动时若用户偏好非内置语言，调用 ensureLocale 异步加载后再切换
 * 这样可显著减小首屏 JS bundle 体积（减少约 250KB 源码）
 */
import { createI18n } from 'vue-i18n'
import zh from '@/i18n/zh'
import en from '@/i18n/en'
import type { LocaleOption } from '@/i18n/locales'

/** 支持的语言列表，用于语言切换下拉菜单 */
export { SUPPORTED_LOCALES } from '@/i18n/locales'
export type { LocaleOption } from '@/i18n/locales'

/** 语言标识符类型 */
export type LocaleValue = LocaleOption['value']

/**
 * 动态语言包加载器映射表
 * 使用 import.meta.glob 让 Vite 将每个语言文件分割为独立 chunk
 * 通过 negative pattern 排除非语言包文件，以及已静态导入的 zh/en（避免无效动态导入警告）
 */
const localeLoaders = import.meta.glob<{ default: Record<string, unknown> }>([
  './*.ts',
  '!./index.ts',
  '!./locales.ts',
  '!./zh.ts',
  '!./en.ts',
])

/** 已加载的语言集合，避免重复加载 */
const loadedLocales = new Set<string>(['zh', 'en'])

/** 读取后端注入的语言偏好，默认简体中文 */
const savedLocale = window.__LOCALE || 'zh'

/**
 * 从 zh 语言包推导消息 Schema 类型
 * 使用 string 作为 Locales 泛型，使 locale 可接受任意语言标识符
 * （messages 启动时仅包含 zh/en，其余通过 setLocaleMessage 动态注册）
 */
type MessageSchema = typeof zh

const i18n = createI18n<[MessageSchema], string, false>({
  legacy: false,
  // 启动时仅 zh/en 同步可用，其他语言在 ensureLocale 完成后再切换
  locale: loadedLocales.has(savedLocale) ? savedLocale : 'zh',
  fallbackLocale: 'en',
  messages: { zh, en },
})

/**
 * 确保指定语言的翻译已加载
 * - 已加载或为内置语言（zh/en）时立即返回
 * - 否则动态导入对应语言包并注册到 i18n 实例
 * 加载失败时静默回退到 fallbackLocale，不抛出异常
 *
 * @param locale 语言标识符
 */
export async function ensureLocale(locale: string): Promise<void> {
  if (loadedLocales.has(locale)) return
  const loader = localeLoaders[`./${locale}.ts`]
  if (!loader) {
    // 未知语言标识，保持现状（将自动回退到 fallbackLocale）
    console.warn(`[i18n] 未知语言: ${locale}`)
    return
  }
  try {
    const mod = await loader()
    // 动态加载的模块默认类型较宽，断言为 MessageSchema 以匹配 setLocaleMessage 签名
    i18n.global.setLocaleMessage(locale, mod.default as MessageSchema)
    loadedLocales.add(locale)
  } catch (err) {
    console.error(`[i18n] 加载语言 ${locale} 失败:`, err)
  }
}

export default i18n
