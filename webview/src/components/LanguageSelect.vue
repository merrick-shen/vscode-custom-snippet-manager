<!-- 语言选择下拉组件：支持图标显示的自定义下拉菜单 -->
<script setup lang="ts">
/**
 * 语言选择下拉组件
 * 替代原生 <select>，在选项中显示 Iconify 语言图标
 * 支持点击外部关闭、键盘导航、向上/向下展开等交互
 */
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { Icon } from '@iconify/vue'

/** 组件属性定义 */
const props = withDefaults(defineProps<{
  /** 当前选中值，支持 v-model 双向绑定 */
  modelValue: string
  /** 下拉选项列表 */
  options: { label: string; value: string; icon: string }[]
  /** 占位文本 */
  placeholder?: string
  /** 下拉展开方向：bottom 向下展开，top 向上展开 */
  placement?: 'bottom' | 'top'
}>(), {
  placement: 'bottom',
})

/** 组件事件定义 */
const emit = defineEmits<{
  /** 选中值变化时触发 */
  (e: 'update:modelValue', value: string): void
}>()

// 下拉菜单展开状态
const isOpen = ref(false)
// 组件根元素引用，用于检测外部点击
const selectRef = ref<HTMLElement | null>(null)
// 当前高亮的选项索引，用于键盘导航
const highlightIndex = ref(-1)

// 当前选中的选项对象
const selectedOption = computed(() =>
  props.options.find((opt) => opt.value === props.modelValue)
)

/** 切换下拉菜单展开/收起 */
function toggle() {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    highlightIndex.value = -1
  }
}

/** 选择某个选项 */
function selectOption(opt: { label: string; value: string; icon: string }) {
  emit('update:modelValue', opt.value)
  isOpen.value = false
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
    }"
    @keydown="handleKeydown"
    tabindex="0"
  >
    <!-- 触发器：显示当前选中项 -->
    <div class="lang-select-trigger" @click="toggle">
      <div class="lang-select-value">
        <!-- 选中项的图标 -->
        <Icon
          v-if="selectedOption"
          :icon="selectedOption.icon"
          class="lang-icon"
        />
        <!-- 选中项的文本，或占位符 -->
        <span v-if="selectedOption" class="lang-label">{{ selectedOption.label }}</span>
        <span v-else class="lang-placeholder">{{ placeholder || '' }}</span>
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
            'is-selected': opt.value === modelValue,
            'is-highlighted': idx === highlightIndex,
          }"
          @click="selectOption(opt)"
          @mouseenter="highlightIndex = idx"
        >
          <!-- 选项图标 -->
          <Icon :icon="opt.icon" class="lang-icon" />
          <!-- 选项文本 -->
          <span class="lang-label">{{ opt.label }}</span>
          <!-- 选中勾号 -->
          <svg
            v-if="opt.value === modelValue"
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

<style scoped>
/* 选择器容器 */
.lang-select {
  position: relative;
  width: 100%;
  outline: none;
}

/* 触发器按钮 */
.lang-select-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 7px 10px;
  border: 1px solid var(--vscode-input-border, rgba(255,255,255,0.12));
  border-radius: 6px;
  background: var(--vscode-input-background, rgba(255,255,255,0.04));
  color: var(--vscode-input-foreground, var(--vscode-editor-foreground));
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.lang-select.is-open .lang-select-trigger,
.lang-select-trigger:focus {
  border-color: var(--vscode-focusBorder, #007fd4);
  box-shadow: 0 0 0 1px var(--vscode-focusBorder, #007fd4);
}

/* 选中值区域 */
.lang-select-value {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

/* 语言图标通用样式 */
.lang-icon {
  flex-shrink: 0;
  font-size: 16px;
}

/* 选项文本 */
.lang-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 占位符文本 */
.lang-placeholder {
  color: var(--vscode-input-placeholderForeground, rgba(255,255,255,0.3));
}

/* 下拉箭头 */
.lang-select-arrow {
  flex-shrink: 0;
  color: rgba(255,255,255,0.5);
  transition: transform 0.2s;
}

.lang-select.is-open .lang-select-arrow {
  transform: rotate(180deg);
}

/* 向上展开时箭头默认朝上 */
.lang-select.placement-top .lang-select-arrow {
  transform: rotate(180deg);
}

.lang-select.placement-top.is-open .lang-select-arrow {
  transform: rotate(0deg);
}

/* 下拉菜单：默认向下展开 */
.lang-select-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 1000;
  max-height: 240px;
  overflow-y: auto;
  border: 1px solid var(--vscode-dropdown-border, rgba(255,255,255,0.12));
  border-radius: 6px;
  background: var(--vscode-editorWidget-background, #252526);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  padding: 4px;
}

/* 向上展开时下拉菜单定位 */
.lang-select.placement-top .lang-select-dropdown {
  top: auto;
  bottom: calc(100% + 4px);
}

/* 单个选项 */
.lang-select-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 4px;
  cursor: pointer;
  color: var(--vscode-editor-foreground);
  font-size: 13px;
  transition: background-color 0.1s;
}

/* 悬浮和高亮状态 */
.lang-select-option:hover,
.lang-select-option.is-highlighted {
  background: var(--vscode-list-hoverBackground, rgba(255,255,255,0.08));
}

/* 已选中状态 */
.lang-select-option.is-selected {
  color: var(--vscode-list-activeSelectionForeground, #fff);
  font-weight: 600;
}

/* 选中勾号 */
.lang-check {
  margin-left: auto;
  flex-shrink: 0;
  color: var(--vscode-button-background, #0e639c);
}

/* 下拉菜单动画 */
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

/* 向上展开时的动画方向反转 */
.lang-select.placement-top .dropdown-enter-from {
  transform: translateY(4px);
}

.lang-select.placement-top .dropdown-leave-to {
  transform: translateY(2px);
}
</style>
