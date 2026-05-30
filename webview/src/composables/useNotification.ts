/**
 * 通知提示 composable
 * 封装通知状态管理和显示/隐藏逻辑，供多个视图复用
 */
import { useTimeoutFn } from '@vueuse/core'

/** 通知类型 */
export type NotificationType = 'success' | 'warning' | 'error'

/** 通知状态 */
interface NotificationState {
  visible: boolean
  type: NotificationType
  message: string
}

export function useNotification() {
  const notification = ref<NotificationState>({
    visible: false,
    type: 'error',
    message: '',
  })

  // useTimeoutFn 自动在组件卸载时清理定时器，解决 #4
  const { start: startAutoHide, stop: stopAutoHide } = useTimeoutFn(() => {
    notification.value.visible = false
  }, 3000)

  /** 显示通知，成功/警告 3 秒后自动隐藏，错误需手动关闭 */
  function showNotification(type: NotificationType, msg: string) {
    notification.value = { visible: true, type, message: msg }
    // 先停止已有的自动隐藏定时器
    stopAutoHide()
    if (type !== 'error') {
      startAutoHide()
    }
  }

  function showError(msg: string) {
    showNotification('error', msg)
  }

  function showSuccess(msg: string) {
    showNotification('success', msg)
  }

  function showWarning(msg: string) {
    showNotification('warning', msg)
  }

  function clearNotification() {
    notification.value.visible = false
    stopAutoHide()
  }

  return {
    notification,
    showNotification,
    showError,
    showSuccess,
    showWarning,
    clearNotification,
  }
}
