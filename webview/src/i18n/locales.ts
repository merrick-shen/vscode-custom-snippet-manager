/**
 * 前端语言列表配置
 * 独立于后端 locales.json，避免跨目录导入增加运行时包体积
 * 新增语言时需同步更新此文件和根目录 locales.json
 */
export interface LocaleOption {
  /** 语言标识符，如 'zh'、'en' */
  value: string
  /** 显示名称，如 '简体中文'、'English' */
  label: string
  /** 国旗图标标识，如 'cn'、'us' */
  flag: string
}

/** 支持的语言列表，用于语言切换下拉菜单 */
export const SUPPORTED_LOCALES: LocaleOption[] = [
  { value: 'zh', label: '简体中文', flag: 'cn' },
  { value: 'zh-TW', label: '繁體中文', flag: 'hk' },
  { value: 'en', label: 'English', flag: 'us' },
  { value: 'ja', label: '日本語', flag: 'jp' },
  { value: 'ko', label: '한국어', flag: 'kr' },
  { value: 'ru', label: 'Русский', flag: 'ru' },
  { value: 'de', label: 'Deutsch', flag: 'de' },
  { value: 'fr', label: 'Français', flag: 'fr' },
  { value: 'es', label: 'Español', flag: 'es' },
  { value: 'pt', label: 'Português', flag: 'br' },
  { value: 'it', label: 'Italiano', flag: 'it' },
  { value: 'pl', label: 'Polski', flag: 'pl' },
  { value: 'tr', label: 'Türkçe', flag: 'tr' },
  { value: 'sv', label: 'Svenska', flag: 'se' },
  { value: 'da', label: 'Dansk', flag: 'dk' },
  { value: 'fi', label: 'Suomi', flag: 'fi' },
  { value: 'nl', label: 'Nederlands', flag: 'nl' },
  { value: 'cs', label: 'Čeština', flag: 'cz' },
  { value: 'hu', label: 'Magyar', flag: 'hu' },
  { value: 'th', label: 'ไทย', flag: 'th' },
  { value: 'vi', label: 'Tiếng Việt', flag: 'vn' },
  { value: 'uk', label: 'Українська', flag: 'ua' },
  { value: 'ro', label: 'Română', flag: 'ro' },
  { value: 'el', label: 'Ελληνικά', flag: 'gr' },
  { value: 'hi', label: 'हिन्दी', flag: 'in' },
]
