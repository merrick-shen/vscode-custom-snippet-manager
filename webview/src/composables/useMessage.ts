/**
 * Webview 与扩展之间的消息通信工具
 * 封装 postMessage 发送和监听逻辑，提供类型安全的消息通信接口
 * 所有 webview 与后端的数据交互都通过此模块完成
 */
import { useEventListener } from '@vueuse/core'
import type { WebviewMessage, ExtMessage, MessageType } from '../types'

/** 消息处理回调函数类型 */
type MessageHandler = (payload: unknown) => void

/** 按消息类型存储的回调函数映射表 */
const handlers = new Map<MessageType, MessageHandler[]>()

// 使用 useEventListener 管理全局消息监听，自动在组件卸载时清理
// 注意：此模块在 setup 上下文中首次导入时注册监听，组件卸载时自动移除
useEventListener(window, 'message', (event: MessageEvent<ExtMessage>) => {
  const msg = event.data
  if (msg && msg.type) {
    const cbs = handlers.get(msg.type)
    if (cbs) {
      cbs.forEach((cb) => cb(msg.payload))
    }
  }
})

/**
 * 向扩展后端发送消息
 * @param type 消息类型
 * @param payload 消息载荷
 */
export function postToExt(type: MessageType, payload?: unknown): void {
  const msg: WebviewMessage = { type, payload }
  window.vscode?.postMessage(msg)
}

/**
 * 注册扩展消息监听，返回取消函数
 * 同一消息类型可注册多个回调，都会被执行
 * 调用返回的函数可取消该回调，解决 #5
 * @param type 消息类型
 * @param handler 回调函数
 * @returns 取消监听函数
 */
export function onExtMessage(type: MessageType, handler: MessageHandler): () => void {
  const existing = handlers.get(type) || []
  existing.push(handler)
  handlers.set(type, existing)

  // 返回取消函数，从 handlers 中移除该回调
  return () => {
    const cbs = handlers.get(type)
    if (cbs) {
      const index = cbs.indexOf(handler)
      if (index > -1) {
        cbs.splice(index, 1)
      }
      // 若该类型已无回调，清理 Map 条目
      if (cbs.length === 0) {
        handlers.delete(type)
      }
    }
  }
}
