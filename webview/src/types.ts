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
  /** 所属文件夹 ID，由后端附加；缺省视为默认文件夹 */
  folderId?: string
}

/** 文件夹数据结构，与后端 FolderMeta 对应 */
export interface Folder {
  /** 文件夹唯一标识符 */
  id: string
  /** 文件夹名称，默认文件夹为空字符串（前端用 i18n 显示） */
  name: string
  /** 创建时间，ISO 8601 格式 */
  createdAt: string
  /** 排序序号 */
  order: number
}

/** 默认文件夹 ID，需与后端 DEFAULT_FOLDER_ID 保持一致 */
export const DEFAULT_FOLDER_ID = 'default'

/** 排序方向类型：desc 为由新至旧，asc 为由旧至新 */
export type SortOrder = 'desc' | 'asc'

// 消息类型、通信接口与后端共享同一套定义，避免两端不一致
export type { MessageType, WebviewMessage, ExtMessage } from '../../src/shared/messageTypes'
