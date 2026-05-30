<!-- 通用确认弹窗组件：标题 + 内容(slot) + 按钮(slot) -->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import BaseButton from './BaseButton.vue'

const { t } = useI18n()

defineProps<{
  /** 是否显示弹窗 */
  visible: boolean
  /** 弹窗标题 */
  title: string
  /** 弹窗内容（无 body slot 时使用） */
  content?: string
  /** 确认按钮文字，默认取 i18n 的 form.save */
  confirmLabel?: string
  /** 取消按钮文字，默认取 i18n 的 form.cancel */
  cancelLabel?: string
  /** 确认按钮是否为危险样式（红色） */
  danger?: boolean
  /** 是否使用宽版弹窗 */
  large?: boolean
}>()

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()
</script>

<template>
  <div v-if="visible" class="modal-overlay" @click.self="emit('cancel')">
    <div class="modal-dialog" :class="{ 'modal-dialog-lg': large }">
      <div class="modal-header">
        <span class="modal-title">{{ title }}</span>
      </div>
      <div class="modal-body">
        <slot name="body">
          <p>{{ content }}</p>
        </slot>
      </div>
      <div class="modal-footer">
        <slot name="footer">
          <BaseButton variant="secondary" size="sm" @click="emit('cancel')">{{ cancelLabel || t('form.cancel') }}</BaseButton>
          <BaseButton :variant="danger ? 'danger' : 'primary'" size="sm" @click="emit('confirm')">{{ confirmLabel || t('form.save') }}</BaseButton>
        </slot>
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

.modal-dialog-lg {
  width: 400px;
}

.modal-header {
  @include modal-header;
}

.modal-title {
  @include modal-title;
}

.modal-body {
  padding: $spacing-md 18px 18px;
  :deep(p) {
    margin: 0;
    font-size: $font-size-base;
    color: $color-description;
    line-height: 1.6;
  }
}

.modal-footer {
  @include modal-footer;
}
</style>
