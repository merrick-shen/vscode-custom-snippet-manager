/**
 * 核心类型定义
 * 定义片段数据结构、消息类型、通信接口和视图模式等公共类型
 * 前后端共享同一套类型约定以确保消息通信的类型安全
 */

/** 代码片段数据结构 */
export interface Snippet {
  id: string
  name: string
  prefix: string
  body: string
  description: string
  language: string
  /** 使用次数，用于按频率排序 */
  usageCount?: number
  /** 创建时间，ISO 8601 格式，用于按日期排序 */
  createdAt?: string
}

/** 排序方向类型：desc 为由新至旧，asc 为由旧至新 */
export type SortOrder = 'desc' | 'asc'

/**
 * 消息类型枚举
 * - getSnippets / snippetsList: 请求和返回片段列表
 * - createSnippet / snippetCreated: 创建片段及创建成功通知
 * - updateSnippet / snippetUpdated: 更新片段及更新成功通知
 * - deleteSnippet: 删除片段
 * - openEditor: 请求打开编辑器面板
 * - closeEditor: 请求关闭编辑器面板
 * - editorReady: 编辑器 webview 加载完成通知
 * - setSnippet: 后端向编辑器发送片段数据用于回填
 * - changeLocale: 前端切换语言，通知后端持久化保存
 * - error: 错误消息
 */
export type MessageType =
  | 'getSnippets'
  | 'snippetsList'
  | 'createSnippet'
  | 'updateSnippet'
  | 'deleteSnippet'
  | 'snippetCreated'
  | 'snippetUpdated'
  | 'openEditor'
  | 'closeEditor'
  | 'editorReady'
  | 'setSnippet'
  | 'changeLocale'
  | 'exportSnippets'
  | 'exportResult'
  | 'importSnippets'
  | 'importResult'
  | 'importError'
  | 'showDuplicateDialog'
  | 'duplicateStrategyChoice'
  | 'showNotification'
  | 'localeChanged'
  | 'changeSortOrder'
  | 'clearAllSnippets'
  | 'error'

/** Webview 发送给扩展的消息格式 */
export interface WebviewMessage {
  type: MessageType
  payload?: unknown
}

/** 扩展发送给 Webview 的消息格式 */
export interface ExtMessage {
  type: MessageType
  payload?: unknown
}
