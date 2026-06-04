<!-- 通用单选框组件：支持 size/disabled 等 -->
<script setup lang="ts">
defineOptions({ name: 'BaseRadio' })

const props = defineProps<{
  /** 当前选中值 */
  modelValue?: string | number | boolean
  /** 该选项的值 */
  value: string | number | boolean
  /** 尺寸：sm / md（默认） */
  size?: 'sm' | 'md'
  /** 是否禁用 */
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | number | boolean]
}>()

/** 是否为选中状态 */
const isChecked = () => props.modelValue === props.value

function toggle() {
  if (props.disabled) return
  emit('update:modelValue', props.value)
}
</script>

<template>
  <span
    class="base-radio"
    :class="[
      `base-radio--${size || 'md'}`,
      {
        'base-radio--checked': isChecked(),
        'base-radio--disabled': disabled,
      }
    ]"
    role="radio"
    :aria-checked="isChecked()"
    :aria-disabled="disabled"
    tabindex="0"
    @click="toggle"
    @keydown.enter="toggle"
    @keydown.space.prevent="toggle"
  >
    <!-- 选中时内部圆点 -->
    <span v-if="isChecked()" class="base-radio__dot" />
  </span>
</template>

<style scoped lang="scss">
.base-radio {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1.5px solid $border-input;
  border-radius: 50%;
  background: $bg-input;
  cursor: pointer;
  transition: border-color 0.15s;
  flex-shrink: 0;

  &:hover:not(.base-radio--disabled) {
    border-color: $color-focus;
  }

  &:focus-visible {
    outline: 1px solid $color-focus;
    outline-offset: 1px;
  }
}

// 尺寸
.base-radio--md {
  width: 16px;
  height: 16px;
}

.base-radio--sm {
  width: 14px;
  height: 14px;
}

// 选中状态
.base-radio--checked {
  border-color: $btn-primary-bg;

  &:hover:not(.base-radio--disabled) {
    border-color: $btn-primary-hover;
  }
}

// 禁用状态
.base-radio--disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

// 内部圆点
.base-radio__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: $btn-primary-bg;
  transition: background-color 0.15s;
}

.base-radio--sm .base-radio__dot {
  width: 6px;
  height: 6px;
}
</style>
