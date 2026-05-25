<!-- 语言选择下拉组件：支持多选模式和图标显示的自定义下拉菜单 -->
<script setup lang="ts">
/**
 * 语言选择下拉组件
 * 支持多选模式：选中 "所有语言" 时自动清除其他选项
 * 选中其他语言时自动取消 "所有语言"
 * 逗号分隔存储，如 "javascript,typescript"
 */
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { Icon } from '@iconify/vue'

/** 组件属性定义 */
const props = withDefaults(defineProps<{
  /** 当前选中值（逗号分隔），支持 v-model 双向绑定 */
  modelValue: string
  /** 下拉选项列表 */
  options: { label: string; value: string; icon: string }[]
  /** 占位文本 */
  placeholder?: string
  /** 下拉展开方向：bottom 向下展开，top 向上展开 */
  placement?: 'bottom' | 'top'
  /** 是否启用多选模式 */
  multiple?: boolean
}>(), {
  placement: 'bottom',
  multiple: false,
})

/** 组件事件定义 */
const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

// 下拉菜单展开状态
const isOpen = ref(false)
// 组件根元素引用，用于检测外部点击
const selectRef = ref<HTMLElement | null>(null)
// 当前高亮的选项索引，用于键盘导航
const highlightIndex = ref(-1)

// 解析当前选中值为数组
const selectedValues = computed(() => {
  if (!props.modelValue) return []
  return props.modelValue.split(',').filter(Boolean)
})

// 单选模式下的选中选项对象
const selectedOption = computed(() => {
  if (props.multiple) return null
  return props.options.find((opt) => opt.value === props.modelValue)
})

// 多选模式下的选中选项列表（排除 "所有语言"）
const selectedOptions = computed(() => {
  if (!props.multiple) return []
  const vals = selectedValues.value
  return props.options.filter((opt) => vals.includes(opt.value) && opt.value !== '*')
})

// 是否选中了 "所有语言"
const isAllLanguages = computed(() => selectedValues.value.includes('*'))

/** 切换下拉菜单展开/收起 */
function toggle() {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    highlightIndex.value = -1
  }
}

/** 判断选项是否被选中 */
function isOptionSelected(opt: { value: string }): boolean {
  return selectedValues.value.includes(opt.value)
}

/** 选择某个选项 */
function selectOption(opt: { label: string; value: string; icon: string }) {
  if (props.multiple) {
    // 多选模式
    const vals = [...selectedValues.value]
    const idx = vals.indexOf(opt.value)

    if (opt.value === '*') {
      // 点击 "所有语言"：选中它并清除其他选项
      if (idx >= 0) {
        // 已选中则取消（不允许全部取消，至少保留一个）
        return
      }
      emit('update:modelValue', '*')
    } else {
      // 点击具体语言
      // 先移除 "所有语言"（如果有的话）
      const allIdx = vals.indexOf('*')
      if (allIdx >= 0) {
        vals.splice(allIdx, 1)
      }
      if (idx >= 0 || (allIdx >= 0 && vals.indexOf(opt.value) >= 0)) {
        // 已选中则取消
        const removeIdx = vals.indexOf(opt.value)
        if (removeIdx >= 0) {
          vals.splice(removeIdx, 1)
        }
        // 如果取消后没有选中任何语言，回退到 "所有语言"
        if (vals.length === 0) {
          emit('update:modelValue', '*')
          return
        }
      } else {
        // 未选中则添加
        vals.push(opt.value)
      }
      emit('update:modelValue', vals.join(','))
    }
  } else {
    // 单选模式
    emit('update:modelValue', opt.value)
    isOpen.value = false
  }
}

/** 点击外部时关闭下拉菜单 */
function handleClickOutside(e: MouseEvent) {
  if (selectRef.value && !selectRef.value.contains(e.target as Node)) {
    isOpen.value = false
  }
}

/** 键盘导航支持 */
function handleKeydown(e: KeyboardEvent) {
  if (!isOpen.value) {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault()
      isOpen.value = true
    }
    return
  }

  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault()
      highlightIndex.value = Math.min(highlightIndex.value + 1, props.options.length - 1)
      break
    case 'ArrowUp':
      e.preventDefault()
      highlightIndex.value = Math.max(highlightIndex.value - 1, 0)
      break
    case 'Enter':
      e.preventDefault()
      if (highlightIndex.value >= 0) {
        selectOption(props.options[highlightIndex.value])
      }
      break
    case 'Escape':
      isOpen.value = false
      break
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div
    ref="selectRef"
    class="lang-select"
    :class="{
      'is-open': isOpen,
      'placement-top': placement === 'top',
      'is-multi': multiple,
    }"
    @keydown="handleKeydown"
    tabindex="0"
  >
    <!-- 触发器：显示当前选中项 -->
    <div class="lang-select-trigger" @click="toggle">
      <div class="lang-select-value">
        <!-- 多选模式 -->
        <template v-if="multiple">
          <!-- 选中 "所有语言" 时显示其图标 -->
          <Icon
            v-if="isAllLanguages"
            :icon="options.find(o => o.value === '*')?.icon || 'carbon:code'"
            class="lang-icon"
          />
          <!-- 多选标签列表 -->
          <template v-else-if="selectedOptions.length > 0">
            <div class="multi-tags">
              <span
                v-for="opt in selectedOptions"
                :key="opt.value"
                class="multi-tag"
              >
                <Icon :icon="opt.icon" class="lang-icon tag-icon" />
                <span class="tag-label">{{ opt.label }}</span>
              </span>
            </div>
          </template>
          <span v-else class="lang-placeholder">{{ placeholder || '' }}</span>
        </template>
        <!-- 单选模式 -->
        <template v-else>
          <Icon
            v-if="selectedOption"
            :icon="selectedOption.icon"
            class="lang-icon"
          />
          <span v-if="selectedOption" class="lang-label">{{ selectedOption.label }}</span>
          <span v-else class="lang-placeholder">{{ placeholder || '' }}</span>
        </template>
      </div>
      <!-- 下拉箭头 -->
      <svg class="lang-select-arrow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>

    <!-- 下拉菜单列表 -->
    <transition name="dropdown">
      <div v-if="isOpen" class="lang-select-dropdown">
        <div
          v-for="(opt, idx) in options"
          :key="opt.value"
          class="lang-select-option"
          :class="{
            'is-selected': isOptionSelected(opt),
            'is-highlighted': idx === highlightIndex,
          }"
          @click="selectOption(opt)"
          @mouseenter="highlightIndex = idx"
        >
          <!-- 多选模式下显示复选框 -->
          <span v-if="multiple" class="checkbox" :class="{ 'is-checked': isOptionSelected(opt) }">
            <svg v-if="isOptionSelected(opt)" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          </span>
          <!-- 选项图标 -->
          <Icon :icon="opt.icon" class="lang-icon" />
          <!-- 选项文本 -->
          <span class="lang-label">{{ opt.label }}</span>
          <!-- 单选模式下的选中勾号 -->
          <svg
            v-if="!multiple && isOptionSelected(opt)"
            class="lang-check"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped lang="scss">
.lang-select {
  position: relative;
  width: 100%;
  outline: none;
}

.lang-select-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 7px 10px;
  border: 1px solid $border-input;
  border-radius: $radius-md;
  background: $bg-input;
  color: var(--vscode-input-foreground, #{$color-foreground});
  font-size: $font-size-base;
  font-family: inherit;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s;

  .lang-select.is-open &,
  &:focus {
    border-color: $color-focus;
    box-shadow: 0 0 0 1px $color-focus;
  }
}

.lang-select-value {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  min-width: 0;
  flex: 1;
  overflow: hidden;
}

.lang-icon {
  flex-shrink: 0;
  font-size: 16px;
}

.lang-label {
  @include text-ellipsis;
}

.lang-placeholder {
  color: $placeholder-color;
}

.multi-tags {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-xs;
  overflow: hidden;
}

.multi-tag {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1px 6px;
  border-radius: $radius-sm;
  background: $btn-primary-bg;
  color: $btn-primary-fg;
  font-size: $font-size-xs;
  line-height: 1.4;
  white-space: nowrap;
}

.tag-icon {
  font-size: $font-size-sm;
}

.tag-label {
  max-width: 80px;
  @include text-ellipsis;
}

.checkbox {
  @include flex-center;
  width: 14px;
  height: 14px;
  border: 1.5px solid var(--vscode-checkbox-border, rgba(255, 255, 255, 0.3));
  border-radius: $radius-sm;
  flex-shrink: 0;
  transition: all 0.15s;

  &.is-checked {
    background: var(--vscode-checkbox-background, #0e639c);
    border-color: var(--vscode-checkbox-border, #0e639c);
    color: var(--vscode-checkbox-foreground, #fff);
  }
}

.lang-select-arrow {
  flex-shrink: 0;
  color: rgba(255, 255, 255, 0.5);
  transition: transform 0.2s;
  margin-left: $spacing-xs;

  .lang-select.is-open & {
    transform: rotate(180deg);
  }

  .lang-select.placement-top & {
    transform: rotate(180deg);
  }

  .lang-select.placement-top.is-open & {
    transform: rotate(0deg);
  }
}

.lang-select-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 1000;
  max-height: 240px;
  overflow-y: auto;
  border: 1px solid $border-dropdown;
  border-radius: $radius-md;
  background: $bg-widget;
  box-shadow: $shadow-dropdown;
  padding: $spacing-xs;

  .lang-select.placement-top & {
    top: auto;
    bottom: calc(100% + 4px);
  }
}

.lang-select-option {
  @include dropdown-option;
  padding: 6px 10px;
  font-size: $font-size-base;

  &.is-highlighted {
    background: var(--vscode-list-hoverBackground, rgba(255, 255, 255, 0.08));
  }
}

.lang-check {
  margin-left: auto;
  flex-shrink: 0;
  color: $btn-primary-bg;
}

.dropdown-enter-active {
  transition: all 0.15s ease-out;
}

.dropdown-leave-active {
  transition: all 0.1s ease-in;
}

.dropdown-enter-from {
  opacity: 0;
  transform: translateY(-4px);
}

.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-2px);
}

.lang-select.placement-top .dropdown-enter-from {
  transform: translateY(4px);
}

.lang-select.placement-top .dropdown-leave-to {
  transform: translateY(2px);
}
</style>
