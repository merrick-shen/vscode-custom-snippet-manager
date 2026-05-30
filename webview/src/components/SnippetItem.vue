<!-- 片段列表项组件：名称 + 语言标签 + 前缀 + 描述 + 操作按钮 -->
<script setup lang="ts">
/**
 * SnippetItem 组件
 *
 * 渲染单个片段列表项，包含名称、语言标签、前缀、描述和悬浮操作按钮。
 *
 * @example
 * <SnippetItem
 *   :snippet="snippet"
 *   @edit="handleEdit"
 *   @delete="handleDelete"
 *   @mouseenter="handleMouseEnter"
 *   @mouseleave="handleMouseLeave"
 * />
 */
import { Icon } from '@iconify/vue'
import type { Snippet } from '../types'
import { getLanguageColor, getLanguageIcon } from '../utils/languages'

const { t } = useI18n()

defineProps<{
  /** 片段数据 */
  snippet: Snippet
}>()

const emit = defineEmits<{
  (e: 'edit', snippet: Snippet): void
  (e: 'delete', snippet: Snippet): void
  (e: 'mouseenter', event: MouseEvent, snippet: Snippet): void
  (e: 'mouseleave'): void
}>()
</script>

<template>
  <div
    class="snippet-item"
    @mouseenter="emit('mouseenter', $event, snippet)"
    @mouseleave="emit('mouseleave')"
  >
    <div class="item-main">
      <div class="item-top">
        <span class="item-name">{{ snippet.name }}</span>
        <span
          v-for="lang in snippet.language.split(',').map((l: string) => l.trim())"
          :key="lang"
          class="lang-badge"
          :style="{ backgroundColor: getLanguageColor(lang) + '22', color: getLanguageColor(lang), borderColor: getLanguageColor(lang) + '44' }"
        >
          <Icon v-if="lang !== '*'" :icon="getLanguageIcon(lang)" class="lang-badge-icon" />
          <span class="lang-badge-text">{{ lang === '*' ? t('filter.all') : lang }}</span>
        </span>
      </div>
      <div class="item-meta">
        <code class="item-prefix">{{ snippet.prefix }}</code>
        <span v-if="snippet.description" class="item-desc">{{ snippet.description }}</span>
      </div>
    </div>
    <div class="item-actions">
      <button class="action-btn" @click.stop="emit('edit', snippet)">
        <Icon icon="carbon:edit" width="14" height="14" />
      </button>
      <button class="action-btn action-btn-danger" @click.stop="emit('delete', snippet)">
        <Icon icon="carbon:trash-can" width="14" height="14" />
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.snippet-item {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  padding: $spacing-sm 10px;
  border-radius: $radius-md;
  cursor: default;
  transition: background-color 0.15s ease;

  &:hover {
    background-color: $bg-list-hover;

    .item-actions {
      opacity: 1;
    }
  }
}

.item-main {
  flex: 1;
  min-width: 0;
}

.item-top {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 3px;
}

.item-name {
  font-size: $font-size-base;
  font-weight: 600;
  color: $color-foreground;
  @include text-ellipsis;
}

.lang-badge {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  font-weight: 600;
  padding: 0 5px;
  border-radius: $radius-sm;
  border: 1px solid;
  line-height: 16px;
  letter-spacing: 0.3px;
}

.lang-badge-icon {
  font-size: $font-size-xs;
}

.lang-badge-text {
  font-size: 9px;
  text-transform: uppercase;
}

.item-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.item-prefix {
  flex-shrink: 0;
  font-size: $font-size-xs;
  @include code-text;
  background-color: $bg-code-block;
  padding: 1px 5px;
  border-radius: $radius-sm;
}

.item-desc {
  font-size: $font-size-xs;
  color: $color-description;
  @include text-ellipsis;
}

.item-actions {
  flex-shrink: 0;
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.action-btn {
  @include flex-center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: $color-foreground;
  opacity: 0.6;
  cursor: pointer;
  transition: background-color 0.15s, opacity 0.15s, color 0.15s;

  &:hover {
    background: $bg-hover;
    opacity: 1;
  }
}

.action-btn-danger:hover {
  color: $color-error;
  background: rgba-color(#f48771, 0.1);
}
</style>
