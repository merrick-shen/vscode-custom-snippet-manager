/**
 * 确认弹窗 composable
 * 封装确认弹窗的状态管理和操作逻辑，供多个视图复用
 * 配合 ConfirmDialog 组件使用
 */
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

/** 确认弹窗配置 */
interface ConfirmOptions {
  title: string
  content: string
  confirmLabel: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
}

/** 确认弹窗状态 */
interface ConfirmState {
  visible: boolean
  title: string
  content: string
  confirmLabel: string
  cancelLabel: string
  danger: boolean
  onConfirm: () => void
}

export function useConfirm() {
  const { t } = useI18n()

  const confirmState = ref<ConfirmState>({
    visible: false,
    title: '',
    content: '',
    confirmLabel: '',
    cancelLabel: '',
    danger: false,
    onConfirm: () => {},
  })

  /** 显示确认弹窗 */
  function showConfirm(options: ConfirmOptions) {
    confirmState.value = {
      visible: true,
      title: options.title,
      content: options.content,
      confirmLabel: options.confirmLabel,
      cancelLabel: options.cancelLabel || t('form.cancel'),
      danger: options.danger ?? false,
      onConfirm: options.onConfirm,
    }
  }

  /** 确认操作 */
  function handleConfirmOk() {
    confirmState.value.onConfirm()
    confirmState.value.visible = false
  }

  /** 取消操作 */
  function handleConfirmCancel() {
    confirmState.value.visible = false
  }

  return {
    confirmState,
    showConfirm,
    handleConfirmOk,
    handleConfirmCancel,
  }
}
