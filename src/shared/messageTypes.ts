/**
 * Webview 与扩展之间的消息类型约定
 * 前后端共享，确保消息通信的类型安全
 */

/** Webview 与扩展之间的消息类型 */
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
  | 'resetLocaleToAuto'
  | 'exportSnippets'
  | 'exportResult'
  | 'importSnippets'
  | 'importResult'
  | 'importError'
  | 'showDuplicateDialog'
  | 'duplicateStrategyChoice'
  | 'showImportPlacementDialog'
  | 'importPlacementChoice'
  | 'showNotification'
  | 'localeChanged'
  | 'changeSortOrder'
  | 'clearAllSnippets'
  | 'exportAllBackup'
  | 'exportBackupResult'
  | 'foldersList'
  | 'createFolder'
  | 'renameFolder'
  | 'deleteFolder'
  | 'reorderFolders'
  | 'openExternal'
  | 'openSnippetsDirectory'
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
