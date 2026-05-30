<!-- 搜索输入框组件：搜索图标 + 输入框 + 清除按钮 -->
<script setup lang="ts">
import { Icon } from '@iconify/vue'

/**
 * SearchInput 组件
 *
 * 带搜索图标和清除按钮的输入框，支持 v-model 双向绑定。
 *
 * @example
 * <SearchInput v-model="keyword" placeholder="搜索..." />
 * <SearchInput v-model="keyword" />  <!-- placeholder 默认为空 -->
 */
defineProps<{
  /** 搜索关键词，支持 v-model 双向绑定 */
  modelValue: string
  /** 占位文本 */
  placeholder?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

function onInput(event: Event) {
  emit('update:modelValue', (event.target as HTMLInputElement).value)
}

function clear() {
  emit('update:modelValue', '')
}
</script>

<template>
  <div class="search-input-wrapper">
    <Icon icon="carbon:search" class="search-input-icon" width="14" height="14" />
    <input
      :value="modelValue"
      class="search-input-field"
      :placeholder="placeholder"
      @input="onInput"
    />
    <button v-if="modelValue" class="search-input-clear" @click="clear">
      <Icon icon="carbon:close" width="12" height="12" />
    </button>
  </div>
</template>

<style scoped lang="scss">
.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.search-input-icon {
  position: absolute;
  left: 10px;
  color: $color-description;
  pointer-events: none;
}

.search-input-field {
  @include input-base;
  padding-left: 30px !important;
  padding-right: 28px !important;
}

.search-input-clear {
  @include flex-center;
  position: absolute;
  right: 6px;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: $radius-sm;
  background: transparent;
  color: $color-description;
  cursor: pointer;
  transition: background-color 0.15s;

  &:hover {
    background: $bg-hover;
    color: $color-foreground;
  }
}
</style>
