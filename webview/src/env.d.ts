/**
 * 全局类型声明
 * 声明 VS Code Webview API 和视图模式标识的全局类型
 * 这些变量由后端在 HTML 中注入，前端通过 window 对象访问
 */
interface VscodeApi {
  postMessage(msg: unknown): void
}

/** 支持的语言标识符 */
type AppLocale = 'zh' | 'zh-TW' | 'en' | 'ja' | 'ko' | 'ru' | 'de' | 'fr' | 'es' | 'pt' | 'it' | 'pl' | 'tr'

declare global {
  interface Window {
    /** VS Code Webview API，用于向扩展后端发送消息 */
    vscode?: VscodeApi
    /** 视图模式标识，由后端注入，决定渲染侧边栏还是编辑器 */
    __VIEW_MODE?: 'sidebar' | 'editor'
    /** 语言偏好，由后端从 globalState 注入，确保侧边栏和编辑器语言同步 */
    __LOCALE?: AppLocale
    /** 排序偏好，由后端从 globalState 注入，'desc' 为由新至旧，'asc' 为由旧至新 */
    __SORT_ORDER?: 'desc' | 'asc'
    /** 插件版本号，由后端从 package.json 注入 */
    __APP_VERSION?: string
    /** 代码片段存储目录路径，由后端注入 */
    __STORAGE_PATH?: string
  }
}

export {}
