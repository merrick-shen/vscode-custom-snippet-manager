<!-- 通用确认弹窗组件：标题 + 内容 + 取消/确认按钮 -->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

defineProps<{
  /** 是否显示弹窗 */
  visible: boolean
  /** 弹窗标题 */
  title: string
  /** 弹窗内容 */
  content: string
  /** 确认按钮文字，默认取 i18n 的 form.save */
  confirmLabel?: string
  /** 取消按钮文字，默认取 i18n 的 form.cancel */
  cancelLabel?: string
  /** 确认按钮是否为危险样式（红色） */
  danger?: boolean
}>()

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()
</script>

<template>
  <div v-if="visible" class="modal-overlay" @click.self="emit('cancel')">
    <div class="modal-dialog">
      <div class="modal-header">
        <span class="modal-title">{{ title }}</span>
      </div>
      <div class="modal-body">
        <p>{{ content }}</p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary btn-sm" @click="emit('cancel')">{{ cancelLabel || t('form.cancel') }}</button>
        <button class="btn btn-sm" :class="danger ? 'btn-danger' : 'btn-primary'" @click="emit('confirm')">{{ confirmLabel || t('form.save') }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.modal-overlay {
  @include modal-overlay;
}

.modal-dialog {
  @include modal-dialog;
}

.modal-header {
  @include modal-header;
}

.modal-title {
  @include modal-title;
}

.modal-body {
  @include modal-body;
}

.modal-footer {
  @include modal-footer;
}

.btn {
  @include btn-base;
}

.btn-sm {
  @include btn-sm;
}

.btn-primary {
  @include btn-primary;
}

.btn-secondary {
  @include btn-secondary;
}

.btn-danger {
  @include btn-danger;
}
</style>
