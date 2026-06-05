<!-- 片段悬浮预览卡片：鼠标悬停列表项时显示代码预览 -->
<script setup lang="ts">
/**
 * SnippetPreviewCard 组件
 *
 * 鼠标悬停在片段列表项上时，延迟 400ms 显示代码预览卡片。
 * 通过 show/hide 方法控制显隐，父组件通过 ref 调用。
 *
 * @example
 * <SnippetPreviewCard ref="previewCard" />
 * const previewCard = ref()
 * previewCard.value?.show(event, snippet)
 * previewCard.value?.hide()
 */
import type { Snippet } from '../types'
import { highlightCodeString } from '../utils/codemirror-langs'

// 预览卡片最大显示行数
const PREVIEW_MAX_LINES = 8

const previewState = ref<{
  visible: boolean
  snippet: Snippet | null
  top: number
  left: number
  width: number
  placement: 'top' | 'bottom'
  html: string
}>({
  visible: false,
  snippet: null,
  top: 0,
  left: 0,
  width: 0,
  placement: 'top',
  html: '',
})

let previewTimer: ReturnType<typeof setTimeout> | null = null

/** 截取代码前 N 行 */
function getPreviewLines(body: string, maxLines: number): string {
  const lines = body.split('\n')
  if (lines.length <= maxLines) return body
  return lines.slice(0, maxLines).join('\n')
}

/** 鼠标进入列表项，延迟显示预览 */
function show(event: MouseEvent, snippet: Snippet) {
  if (previewTimer) clearTimeout(previewTimer)
  const el = event.currentTarget as HTMLElement
  previewTimer = setTimeout(() => {
    // 延迟回调内重新获取位置，避免滚动导致位置过期
    const itemRect = el.getBoundingClientRect()
    // 元素不在视口内则不显示
    if (itemRect.bottom < 0 || itemRect.top > window.innerHeight) return
    const top = itemRect.top
    const left = itemRect.left
    const width = itemRect.width
    const placement = top < 150 ? 'bottom' : 'top'

    const previewCode = getPreviewLines(snippet.body, PREVIEW_MAX_LINES)
    const lang = snippet.language.split(',')[0].trim()
    const html = highlightCodeString(previewCode, lang)
    const hasMore = snippet.body.split('\n').length > PREVIEW_MAX_LINES

    previewState.value = {
      visible: true,
      snippet,
      top,
      left,
      width,
      placement,
      html: hasMore ? html + '<span class="preview-more">...</span>' : html,
    }
  }, 400)
}

/** 鼠标离开列表项，隐藏预览 */
function hide() {
  if (previewTimer) {
    clearTimeout(previewTimer)
    previewTimer = null
  }
  previewState.value.visible = false
}

// 组件卸载时清理定时器，防止回调更新已卸载组件
onBeforeUnmount(() => {
  if (previewTimer) {
    clearTimeout(previewTimer)
    previewTimer = null
  }
})

defineExpose({ show, hide })
</script>

<template>
  <transition name="preview-fade">
    <div
      v-if="previewState.visible && previewState.snippet"
      class="preview-card"
      :class="`preview-${previewState.placement}`"
      :style="{ top: previewState.top + 'px', left: previewState.left + 'px', width: previewState.width + 'px' }"
    >
      <div class="preview-header">
        <span class="preview-name">{{ previewState.snippet.name }}</span>
        <code class="preview-prefix">{{ previewState.snippet.prefix }}</code>
      </div>
      <pre class="preview-code" v-html="previewState.html"></pre>
      <div v-if="previewState.snippet.description" class="preview-desc">
        {{ previewState.snippet.description }}
      </div>
    </div>
  </transition>
</template>

<style scoped lang="scss">
.preview-card {
  position: fixed;
  z-index: 100;
  border: 1px solid $border-dropdown;
  border-radius: $radius-lg;
  background: $bg-widget;
  box-shadow: $shadow-dropdown;
  overflow: hidden;
  pointer-events: none;

  &.preview-top {
    transform: translateY(-100%);
  }

  &.preview-bottom {
    transform: translateY(4px);
  }
}

.preview-header {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  padding: $spacing-sm $spacing-md;
  border-bottom: 1px solid $border-panel;
}

.preview-name {
  font-size: $font-size-sm;
  font-weight: 600;
  color: $color-foreground;
  @include text-ellipsis;
  flex: 1;
}

.preview-prefix {
  font-size: $font-size-xs;
  @include code-text;
  background-color: $bg-code-block;
  padding: 1px 5px;
  border-radius: $radius-sm;
  flex-shrink: 0;
}

.preview-code {
  margin: 0;
  padding: $spacing-sm $spacing-md;
  max-height: 200px;
  overflow: auto;
  font-family: $font-mono;
  font-size: $font-size-xs;
  line-height: 1.5;
  color: $color-foreground;
  white-space: pre;
  tab-size: 2;

  :deep(.tok-keyword) { color: #c678dd; }
  :deep(.tok-string) { color: #98c379; }
  :deep(.tok-number) { color: #d19a66; }
  :deep(.tok-comment) { color: #5c6370; font-style: italic; }
  :deep(.tok-functionName) { color: #61afef; }
  :deep(.tok-variableName) { color: #e06c75; }
  :deep(.tok-typeName) { color: #e5c07b; }
  :deep(.tok-propertyName) { color: #e06c75; }
  :deep(.tok-operator) { color: #56b6c2; }
  :deep(.tok-punctuation) { color: #abb2bf; }
  :deep(.tok-meta) { color: #abb2bf; }
  :deep(.tok-atom) { color: #d19a66; }

  :deep(.preview-more) {
    display: block;
    padding-top: $spacing-xs;
    color: $color-description;
    font-style: italic;
  }
}

.preview-desc {
  padding: $spacing-xs $spacing-md $spacing-sm;
  font-size: $font-size-xs;
  color: $color-description;
  line-height: 1.4;
  border-top: 1px solid $border-panel;
}

.preview-fade-enter-active {
  transition: opacity 0.15s ease-out;
}

.preview-fade-leave-active {
  transition: opacity 0.1s ease-in;
}

.preview-fade-enter-from,
.preview-fade-leave-to {
  opacity: 0;
}
</style>
