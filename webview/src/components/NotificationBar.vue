<!-- 通知条组件：固定在页面底部，支持成功/警告/错误三种类型 -->
<script setup lang="ts">
import { Icon } from '@iconify/vue'
import type { NotificationType } from '../composables/useNotification'

defineProps<{
  /** 是否显示 */
  visible: boolean
  /** 通知类型 */
  type: NotificationType
  /** 通知内容 */
  message: string
}>()

const emit = defineEmits<{
  close: []
}>()
</script>

<template>
  <transition name="slide-up">
    <div v-if="visible" class="notification-bar" :class="`notification-${type}`">
      <span class="notification-text">{{ message }}</span>
      <button class="notification-close" @click="emit('close')">
        <Icon icon="carbon:close" width="12" height="12" />
      </button>
    </div>
  </transition>
</template>

<style scoped lang="scss">
.notification-bar {
  @include notification-bar;

  &.notification-error {
    background: rgba-color(#f48771, 0.15);
    border-top-color: rgba-color(#f48771, 0.3);
    color: $color-error;
  }

  &.notification-warning {
    background: rgba-color(#eab308, 0.15);
    border-top-color: rgba-color(#eab308, 0.3);
    color: $color-warning;
  }

  &.notification-success {
    background: rgba-color(#5fbd7e, 0.15);
    border-top-color: rgba-color(#5fbd7e, 0.3);
    color: $color-info;
  }
}

.notification-text {
  flex: 1;
  min-width: 0;
  overflow-wrap: break-word;
  word-break: break-all;
  line-height: 1.4;
}

.notification-close {
  @include flex-center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  border-radius: $radius-sm;
  background: transparent;
  color: inherit;
  cursor: pointer;
  flex-shrink: 0;
  margin-left: $spacing-sm;
  opacity: 0.7;

  &:hover {
    opacity: 1;
    background: rgba(255, 255, 255, 0.1);
  }
}

.slide-up-enter-active {
  transition: all 0.2s ease-out;
}

.slide-up-leave-active {
  transition: all 0.15s ease-in;
}

.slide-up-enter-from {
  transform: translateY(4px);
  opacity: 0;
}

.slide-up-leave-to {
  transform: translateY(2px);
  opacity: 0;
}
</style>
