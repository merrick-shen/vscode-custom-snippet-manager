<!-- 统一按钮组件：支持 variant/size/icon/loading/disabled/block 等 -->
<script setup lang="ts">
import { Icon } from '@iconify/vue'

defineOptions({ name: 'BaseButton' })

defineProps<{
  /** 按钮变体：primary / secondary / danger */
  variant?: 'primary' | 'secondary' | 'danger'
  /** 按钮尺寸：sm / md（默认） */
  size?: 'sm' | 'md'
  /** 图标名称，如 carbon:add */
  icon?: string
  /** 图标位置：left（默认）/ right */
  iconPosition?: 'left' | 'right'
  /** 是否加载中 */
  loading?: boolean
  /** 是否禁用 */
  disabled?: boolean
  /** 是否占满宽度 */
  block?: boolean
  /** 原生 button type */
  type?: 'button' | 'submit' | 'reset'
}>()

const emit = defineEmits<{
  click: [e: MouseEvent]
}>()

function handleClick(e: MouseEvent) {
  emit('click', e)
}
</script>

<template>
  <button
    :type="type || 'button'"
    class="base-btn"
    :class="[
      `base-btn--${variant || 'secondary'}`,
      `base-btn--${size || 'md'}`,
      {
        'base-btn--block': block,
        'base-btn--loading': loading,
      }
    ]"
    :disabled="disabled || loading"
    @click="handleClick"
  >
    <!-- 加载指示器 -->
    <span v-if="loading" class="base-btn__spinner" />
    <!-- 左侧图标 -->
    <Icon
      v-if="icon && iconPosition !== 'right' && !loading"
      :icon="icon"
      :width="size === 'sm' ? 12 : 14"
      :height="size === 'sm' ? 12 : 14"
      class="base-btn__icon"
    />
    <!-- 按钮文字 -->
    <span class="base-btn__text"><slot /></span>
    <!-- 右侧图标 -->
    <Icon
      v-if="icon && iconPosition === 'right' && !loading"
      :icon="icon"
      :width="size === 'sm' ? 12 : 14"
      :height="size === 'sm' ? 12 : 14"
      class="base-btn__icon"
    />
  </button>
</template>

<style scoped lang="scss">
.base-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: none;
  border-radius: $radius-md;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: background-color 0.2s, opacity 0.2s, transform 0.1s;
  outline: none;

  &:active:not(:disabled) {
    transform: scale(0.97);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
}

// 尺寸
.base-btn--md {
  padding: 8px 20px;
  font-size: $font-size-base;
}

.base-btn--sm {
  padding: 5px 14px;
  font-size: $font-size-sm;
}

// 变体
.base-btn--primary {
  background: $btn-primary-bg;
  color: $btn-primary-fg;
  box-shadow: $shadow-primary-btn;

  &:hover:not(:disabled) {
    background: $btn-primary-hover;
  }
}

.base-btn--secondary {
  background: $btn-secondary-bg;
  color: $btn-secondary-fg;

  &:hover:not(:disabled) {
    background: $btn-secondary-hover;
  }
}

.base-btn--danger {
  background: rgba(244, 135, 113, 0.15);
  color: $color-error;

  &:hover:not(:disabled) {
    background: rgba(244, 135, 113, 0.25);
  }
}

// 占满宽度
.base-btn--block {
  width: 100%;
}

// 加载状态
.base-btn--loading {
  pointer-events: none;
}

.base-btn__spinner {
  width: 14px;
  height: 14px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: base-btn-spin 0.6s linear infinite;
}

@keyframes base-btn-spin {
  to { transform: rotate(360deg); }
}

.base-btn__icon {
  flex-shrink: 0;
}

.base-btn__text {
  // 文字容器，确保 slot 内容对齐
}
</style>
