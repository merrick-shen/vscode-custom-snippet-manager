<!-- 通用复选框组件：支持 size/disabled/indeterminate 等 -->
<script setup lang="ts">
import { Icon } from '@iconify/vue'

defineOptions({ name: 'BaseCheckbox' })

const props = defineProps<{
  /** 是否选中 */
  modelValue?: boolean
  /** 是否半选状态（不确定状态） */
  indeterminate?: boolean
  /** 尺寸：sm / md（默认） */
  size?: 'sm' | 'md'
  /** 是否禁用 */
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

function toggle() {
  if (props.disabled) return
  // 半选状态点击后变为选中
  emit('update:modelValue', props.indeterminate ? true : !props.modelValue)
}
</script>

<template>
  <span
    class="base-checkbox"
    :class="[
      `base-checkbox--${size || 'md'}`,
      {
        'base-checkbox--checked': modelValue && !indeterminate,
        'base-checkbox--indeterminate': indeterminate,
        'base-checkbox--disabled': disabled,
      }
    ]"
    role="checkbox"
    :aria-checked="indeterminate ? 'mixed' : modelValue"
    :aria-disabled="disabled"
    tabindex="0"
    @click="toggle"
    @keydown.enter="toggle"
    @keydown.space.prevent="toggle"
  >
    <!-- 选中：勾号 -->
    <Icon
      v-if="modelValue && !indeterminate"
      icon="carbon:checkmark"
      :width="size === 'sm' ? 10 : 12"
      :height="size === 'sm' ? 10 : 12"
      class="base-checkbox__icon"
    />
    <!-- 半选：横线 -->
    <span v-else-if="indeterminate" class="base-checkbox__dash" />
  </span>
</template>

<style scoped lang="scss">
.base-checkbox {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1.5px solid $border-input;
  border-radius: $radius-sm;
  background: $bg-input;
  cursor: pointer;
  transition: background-color 0.15s, border-color 0.15s;
  flex-shrink: 0;

  &:hover:not(.base-checkbox--disabled) {
    border-color: $color-focus;
  }

  &:focus-visible {
    outline: 1px solid $color-focus;
    outline-offset: 1px;
  }
}

// 尺寸
.base-checkbox--md {
  width: 16px;
  height: 16px;
}

.base-checkbox--sm {
  width: 14px;
  height: 14px;
}

// 选中状态
.base-checkbox--checked {
  background: $btn-primary-bg;
  border-color: $btn-primary-bg;

  &:hover:not(.base-checkbox--disabled) {
    background: $btn-primary-hover;
    border-color: $btn-primary-hover;
  }
}

// 半选状态
.base-checkbox--indeterminate {
  background: $btn-primary-bg;
  border-color: $btn-primary-bg;

  &:hover:not(.base-checkbox--disabled) {
    background: $btn-primary-hover;
    border-color: $btn-primary-hover;
  }
}

// 禁用状态
.base-checkbox--disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

// 勾号图标
.base-checkbox__icon {
  color: $btn-primary-fg;
}

// 半选横线
.base-checkbox__dash {
  width: 8px;
  height: 1.5px;
  background: $btn-primary-fg;
  border-radius: 1px;
}
</style>
