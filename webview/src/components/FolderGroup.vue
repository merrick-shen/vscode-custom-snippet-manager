<!-- 文件夹分组组件：折叠头部 + 片段列表 -->
<script setup lang="ts">
/**
 * FolderGroup 组件
 *
 * 渲染一个文件夹分组，包含可折叠的文件夹头部和内部片段列表。
 * 内部使用 SnippetItem 组件渲染每个片段。
 *
 * @example
 * <FolderGroup
 *   :folder="folder"
 *   :snippets="snippets"
 *   :is-collapsed="collapsedFolders.has(folder.id)"
 *   :default-folder-id="DEFAULT_FOLDER_ID"
 *   :folder-display-name="folderDisplayName(folder)"
 *   @toggle="toggleFolder(folder.id)"
 *   @rename="openRenameFolder(folder)"
 *   @delete-folder="openDeleteFolder(folder)"
 *   @edit-snippet="handleEdit(snippet)"
 *   @delete-snippet="handleDelete(snippet)"
 *   @snippet-mouseenter="handleItemMouseEnter($event, snippet)"
 *   @snippet-mouseleave="handleItemMouseLeave"
 * />
 */
import { Icon } from '@iconify/vue'
import type { Snippet, Folder } from '../types'

defineProps<{
  /** 文件夹数据 */
  folder: Folder
  /** 该文件夹下的片段列表 */
  snippets: Snippet[]
  /** 是否折叠 */
  isCollapsed: boolean
  /** 默认文件夹 ID，用于判断是否显示操作按钮 */
  defaultFolderId: string
  /** 文件夹显示名称（已处理 i18n） */
  folderDisplayName: string
}>()

const emit = defineEmits<{
  (e: 'toggle', folderId: string): void
  (e: 'rename', folder: Folder): void
  (e: 'deleteFolder', folder: Folder): void
  (e: 'editSnippet', snippet: Snippet): void
  (e: 'deleteSnippet', snippet: Snippet): void
  (e: 'snippetMouseenter', event: MouseEvent, snippet: Snippet): void
  (e: 'snippetMouseleave'): void
}>()
</script>

<template>
  <div class="folder-group">
    <div class="folder-header" @click="emit('toggle', folder.id)">
      <Icon
        icon="carbon:chevron-down"
        class="folder-arrow"
        :class="{ 'is-collapsed': isCollapsed }"
        width="12"
        height="12"
      />
      <Icon icon="carbon:folder" class="folder-icon" width="14" height="14" />
      <span class="folder-name">{{ folderDisplayName }}</span>
      <div v-if="folder.id !== defaultFolderId" class="folder-actions">
        <button class="folder-action-btn" @click.stop="emit('rename', folder)">
          <Icon icon="carbon:edit" width="12" height="12" />
        </button>
        <button class="folder-action-btn folder-action-danger" @click.stop="emit('deleteFolder', folder)">
          <Icon icon="carbon:trash-can" width="12" height="12" />
        </button>
      </div>
      <span class="folder-count">{{ snippets.length }}</span>
    </div>

    <div v-show="!isCollapsed" class="snippet-items">
      <div v-if="snippets.length === 0" class="folder-empty">
        {{ $t('folder.emptyHint') }}
      </div>
      <SnippetItem
        v-for="snippet in snippets"
        :key="snippet.id"
        :snippet="snippet"
        @edit="emit('editSnippet', snippet)"
        @delete="emit('deleteSnippet', snippet)"
        @mouseenter="emit('snippetMouseenter', $event, snippet)"
        @mouseleave="emit('snippetMouseleave')"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.folder-group {
  @include flex-column;
}

.folder-header {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 6px;
  border-radius: $radius-sm;
  cursor: pointer;
  user-select: none;
  transition: background-color 0.15s ease;

  &:hover {
    background-color: $bg-list-hover;

    .folder-actions {
      opacity: 1;
    }
  }
}

.folder-arrow {
  flex-shrink: 0;
  opacity: 0.7;
  transition: transform 0.15s ease;

  &.is-collapsed {
    transform: rotate(-90deg);
  }
}

.folder-icon {
  flex-shrink: 0;
  opacity: 0.7;
}

.folder-name {
  flex: 1;
  font-size: $font-size-sm;
  font-weight: 600;
  color: $color-foreground;
  @include text-ellipsis;
}

.folder-count {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 600;
  color: $color-description;
  background: $bg-code-block;
  padding: 0 6px;
  border-radius: 8px;
  line-height: 16px;
}

.folder-actions {
  flex-shrink: 0;
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.folder-action-btn {
  @include flex-center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: 4px;
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

.folder-action-danger:hover {
  color: $color-error;
  background: rgba-color(#f48771, 0.1);
}

.snippet-items {
  @include flex-column;
  gap: 2px;
  // 片段缩进，体现层级关系
  padding-left: 14px;
}

.folder-empty {
  padding: 6px 10px;
  font-size: $font-size-xs;
  color: $color-description;
  opacity: 0.7;
  font-style: italic;
}
</style>
