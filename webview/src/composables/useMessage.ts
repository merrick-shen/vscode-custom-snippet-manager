/**
 * Webview 与扩展之间的消息通信工具
 * 封装 postMessage 发送和监听逻辑，提供类型安全的消息通信接口
 * 所有 webview 与后端的数据交互都通过此模块完成
 */
import type { WebviewMessage, ExtMessage, MessageType } from '../types'

/** 消息处理回调函数类型 */
type MessageHandler = (payload: unknown) => void

/** 按消息类型存储的回调函数映射表 */
const handlers = new Map<MessageType, MessageHandler[]>()

// 全局监听来自扩展后端的消息，根据类型分发给已注册的回调
window.addEventListener('message', (event: MessageEvent<ExtMessage>) => {
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
 * 注册扩展消息监听
 * 同一消息类型可注册多个回调，都会被执行
 * @param type 消息类型
 * @param handler 回调函数
 */
export function onExtMessage(type: MessageType, handler: MessageHandler): void {
  const existing = handlers.get(type) || []
  existing.push(handler)
  handlers.set(type, existing)
}
