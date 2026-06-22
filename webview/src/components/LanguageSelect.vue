<!-- 语言选择下拉组件：支持多选模式和图标显示的自定义下拉菜单 -->
<script setup lang="ts">
/**
 * 语言选择下拉组件
 * 支持多选模式：选中 "所有语言" 时自动清除其他选项
 * 选中其他语言时自动取消 "所有语言"
 * 逗号分隔存储，如 "javascript,typescript"
 */
import { Icon } from '@iconify/vue'

/** 组件属性定义 */
const props = withDefaults(defineProps<{
  /** 当前选中值（逗号分隔），支持 v-model 双向绑定 */
  modelValue: string
  /** 下拉选项列表，icon 可选，缺省时不渲染图标占位 */
  options: { label: string; value: string; icon?: string }[]
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
function selectOption(opt: { label: string; value: string; icon?: string }) {
  if (!props.multiple) {
    // 单选模式：直接更新并关闭下拉
    emit('update:modelValue', opt.value)
    isOpen.value = false
    return
  }

  // 多选模式下 modelValue 是逗号分隔的字符串，解析为基本类型数组进行值比较
  const vals = [...selectedValues.value]

  if (opt.value === '*') {
    // 点击 "所有语言"：直接切换到全选状态
    emit('update:modelValue', '*')
    return
  }

  // 点击具体语言：先移除 "所有语言"（如果存在），避免 mixed 状态
  const allIdx = vals.indexOf('*')
  if (allIdx >= 0) {
    vals.splice(allIdx, 1)
  }

  const idx = vals.indexOf(opt.value)
  if (idx >= 0) {
    // 已选中则取消
    vals.splice(idx, 1)
  } else {
    // 未选中则添加
    vals.push(opt.value)
  }

  // 如果取消后没有选中任何语言，回退到 "所有语言"，避免空选
  if (vals.length === 0) {
    emit('update:modelValue', '*')
  } else {
    emit('update:modelValue', vals.join(','))
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
          <!-- 选中 "所有语言" 时显示其图标和文字 -->
          <template v-if="isAllLanguages">
            <Icon
              :icon="options.find(o => o.value === '*')?.icon || 'carbon:code'"
              class="lang-icon"
            />
            <span class="lang-label">{{ options.find(o => o.value === '*')?.label }}</span>
          </template>
          <!-- 多选标签列表 -->
          <template v-else-if="selectedOptions.length > 0">
            <div class="multi-tags">
              <span
                v-for="opt in selectedOptions"
                :key="opt.value"
                class="multi-tag"
              >
                <Icon v-if="opt.icon" :icon="opt.icon" class="lang-icon tag-icon" />
                <span class="tag-label">{{ opt.label }}</span>
              </span>
            </div>
          </template>
          <span v-else class="lang-placeholder">{{ placeholder || '' }}</span>
        </template>
        <!-- 单选模式 -->
        <template v-else>
          <Icon
            v-if="selectedOption && selectedOption.icon"
            :icon="selectedOption.icon"
            class="lang-icon"
          />
          <span v-if="selectedOption" class="lang-label">{{ selectedOption.label }}</span>
          <span v-else class="lang-placeholder">{{ placeholder || '' }}</span>
        </template>
      </div>
      <!-- 下拉箭头 -->
      <Icon icon="carbon:chevron-down" class="lang-select-arrow" width="14" height="14" />
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
            <Icon v-if="isOptionSelected(opt)" icon="carbon:checkmark" width="12" height="12" />
          </span>
          <!-- 选项图标 -->
          <Icon v-if="opt.icon" :icon="opt.icon" class="lang-icon" />
          <!-- 选项文本 -->
          <span class="lang-label">{{ opt.label }}</span>
          <!-- 单选模式下的选中勾号 -->
          <Icon
            v-if="!multiple && isOptionSelected(opt)"
            icon="carbon:checkmark"
            class="lang-check"
            width="14"
            height="14"
          />
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
  min-height: 32px;
  padding: 5px 10px;
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
