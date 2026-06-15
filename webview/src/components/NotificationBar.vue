<!-- 通知条组件：固定在页面底部，支持成功/警告/错误三种类型 -->
<script setup lang="ts">
/**
 * NotificationBar 通知条组件
 *
 * 现代化通知设计：
 * - 左侧彩色竖条 + 类型图标，快速区分通知类型
 * - 自动隐藏进度条，直观显示剩余显示时间
 * - 滑入/滑出动画，视觉流畅
 * - 错误类型不自动隐藏，需手动关闭
 */
import { Icon } from '@iconify/vue'
import type { NotificationType } from '../composables/useNotification'

const props = defineProps<{
  /** 是否显示 */
  visible: boolean
  /** 通知类型 */
  type: NotificationType
  /** 通知内容 */
  message: string
  /** 是否显示自动隐藏进度条 */
  autoHide?: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

/** 各类型对应的图标和颜色标识 */
const typeConfig: Record<NotificationType, { icon: string; colorVar: string }> = {
  success: { icon: 'carbon:checkmark-filled', colorVar: '--notif-success' },
  warning: { icon: 'carbon:warning-filled', colorVar: '--notif-warning' },
  error: { icon: 'carbon:error-filled', colorVar: '--notif-error' },
}

/** 当前通知配置 */
const config = computed(() => typeConfig[props.type] ?? typeConfig.success)
</script>

<template>
  <transition name="notif-slide">
    <div
      v-if="visible"
      class="notification-bar"
      :class="[`notification-${type}`]"
      role="alert"
    >
      <!-- 左侧彩色竖条 -->
      <div class="notification-accent" :style="{ background: `var(${config.colorVar})` }" />

      <!-- 类型图标 -->
      <Icon :icon="config.icon" class="notification-icon" width="16" height="16" />

      <!-- 消息内容 -->
      <span class="notification-text">{{ message }}</span>

      <!-- 关闭按钮 -->
      <button class="notification-close" @click="emit('close')" :title="$t('form.cancel')">
        <Icon icon="carbon:close" width="14" height="14" />
      </button>

      <!-- 自动隐藏进度条 -->
      <div v-if="autoHide" class="notification-progress">
        <div class="notification-progress-bar" :style="{ background: `var(${config.colorVar})` }" />
      </div>
    </div>
  </transition>
</template>

<style scoped lang="scss">
// 通知类型颜色
.notification-bar {
  --notif-success: #5fbd7e;
  --notif-warning: #eab308;
  --notif-error: #f48771;

  position: fixed;
  bottom: $spacing-md;
  left: $spacing-md;
  right: $spacing-md;
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  padding: 10px $spacing-md;
  padding-left: 0;
  border-radius: $radius-md;
  background: $bg-widget;
  border: 1px solid $border-panel;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  z-index: 1000;
  overflow: hidden;
}

// 左侧彩色竖条
.notification-accent {
  width: 3px;
  align-self: stretch;
  flex-shrink: 0;
  border-radius: 3px 0 0 3px;
}

// 类型图标
.notification-icon {
  flex-shrink: 0;
  opacity: 0.9;
}

.notification-success .notification-icon {
  color: var(--notif-success);
}

.notification-warning .notification-icon {
  color: var(--notif-warning);
}

.notification-error .notification-icon {
  color: var(--notif-error);
}

// 消息文本
.notification-text {
  flex: 1;
  min-width: 0;
  font-size: $font-size-sm;
  color: $color-foreground;
  overflow-wrap: break-word;
  word-break: break-word;
  line-height: 1.5;
}

// 关闭按钮
.notification-close {
  @include flex-center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: $radius-sm;
  background: transparent;
  color: $color-description;
  cursor: pointer;
  flex-shrink: 0;
  opacity: 0.6;
  transition: opacity 0.15s, background-color 0.15s, color 0.15s;

  &:hover {
    opacity: 1;
    background: $bg-hover;
    color: $color-foreground;
  }
}

// 进度条容器
.notification-progress {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: rgba(255, 255, 255, 0.06);
}

// 进度条动画
.notification-progress-bar {
  height: 100%;
  border-radius: 0 0 $radius-md $radius-md;
  animation: progress-shrink 3s linear forwards;
}

@keyframes progress-shrink {
  from { width: 100%; }
  to { width: 0%; }
}

// 滑入/滑出动画
.notif-slide-enter-active {
  transition: all 0.3s cubic-bezier(0.21, 1.02, 0.73, 1);
}

.notif-slide-leave-active {
  transition: all 0.2s ease-in;
}

.notif-slide-enter-from {
  transform: translateY(12px);
  opacity: 0;
}

.notif-slide-leave-to {
  transform: translateY(6px);
  opacity: 0;
}
</style>
