<!-- 文件夹分组组件：折叠头部 + 片段列表，支持拖拽排序 -->
<script setup lang="ts">
/**
 * FolderGroup 组件
 *
 * 渲染一个文件夹分组，包含可折叠的文件夹头部和内部片段列表。
 * 非默认文件夹头部右侧显示拖拽手柄，可拖拽排序；hover 时显示编辑/删除按钮。
 */
import { Icon } from '@iconify/vue'
import type { Snippet, Folder } from '@/types'
import SnippetItem from '@/views/sidebar/components/SnippetItem.vue'

const props = defineProps<{
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
  /** 是否正在拖拽 */
  dragging?: boolean
  /** 拖拽经过时的放置指示 */
  dragOver?: boolean
  /** 拖拽位置：before 或 after */
  dragPosition?: 'before' | 'after'
}>()

const emit = defineEmits<{
  (e: 'toggle', folderId: string): void
  (e: 'rename', folder: Folder): void
  (e: 'deleteFolder', folder: Folder): void
  (e: 'editSnippet', snippet: Snippet): void
  (e: 'deleteSnippet', snippet: Snippet): void
  (e: 'snippetMouseenter', event: MouseEvent, snippet: Snippet): void
  (e: 'snippetMouseleave'): void
  (e: 'dragstart', event: DragEvent, folderId: string): void
  (e: 'dragend'): void
  (e: 'dragover', event: DragEvent, folderId: string): void
  (e: 'dragleave'): void
  (e: 'drop', event: DragEvent, folderId: string): void
}>()

/** 文件夹头部元素引用，用于设置自定义拖拽图像 */
const folderHeaderRef = ref<HTMLElement | null>(null)

/** 拖拽图标元素引用，用于计算拖拽偏移 */
const dragHandleRef = ref<HTMLElement | null>(null)

/** 是否为默认文件夹 */
const isDefault = computed(() => props.folder.id === props.defaultFolderId)

/** 是否可拖拽（默认文件夹不可拖拽） */
const canDrag = computed(() => !isDefault.value)

/** 拖拽开始 */
function handleDragStart(event: DragEvent) {
  if (!canDrag.value) {
    event.preventDefault()
    return
  }
  // 使用整个文件夹头部作为拖拽图像，偏移量基于拖拽图标在 header 中的位置
  if (event.dataTransfer && folderHeaderRef.value && dragHandleRef.value) {
    const headerRect = folderHeaderRef.value.getBoundingClientRect()
    const handleRect = dragHandleRef.value.getBoundingClientRect()
    // 鼠标位置相对于拖拽图标中心的偏移
    const offsetX = handleRect.left - headerRect.left + handleRect.width / 2
    const offsetY = handleRect.top - headerRect.top + handleRect.height / 2
    event.dataTransfer.setDragImage(folderHeaderRef.value, offsetX, offsetY)
  }
  emit('dragstart', event, props.folder.id)
}

/** 拖拽经过 */
function handleDragOver(event: DragEvent) {
  if (!canDrag.value) return
  event.preventDefault()
  emit('dragover', event, props.folder.id)
}

/** 拖拽离开 */
function handleDragLeave() {
  emit('dragleave')
}

/** 放置 */
function handleDrop(event: DragEvent) {
  if (!canDrag.value) return
  event.preventDefault()
  emit('drop', event, props.folder.id)
}
</script>

<template>
  <div
    class="folder-group"
    :class="{
      'is-dragging': dragging,
      'is-drag-over': dragOver,
      'is-default-folder': isDefault,
      'drag-before': dragOver && dragPosition === 'before',
      'drag-after': dragOver && dragPosition === 'after',
    }"
    @dragover="handleDragOver"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
  >
    <div ref="folderHeaderRef" class="folder-header" @click="emit('toggle', folder.id)">
      <Icon
        icon="carbon:chevron-down"
        class="folder-arrow"
        :class="{ 'is-collapsed': isCollapsed }"
        width="12"
        height="12"
      />
      <Icon icon="carbon:folder" class="folder-icon" width="14" height="14" />
      <span class="folder-name">{{ folderDisplayName }}</span>
      <!-- 操作区域：非默认文件夹显示编辑/删除按钮 + 拖拽手柄 -->
      <div v-if="!isDefault" class="folder-actions">
        <button class="folder-action-btn" @click.stop="emit('rename', folder)">
          <Icon icon="carbon:edit" width="12" height="12" />
        </button>
        <button class="folder-action-btn folder-action-danger" @click.stop="emit('deleteFolder', folder)">
          <Icon icon="carbon:trash-can" width="12" height="12" />
        </button>
        <!-- 拖拽手柄：常驻显示，用于排序 -->
        <div
          ref="dragHandleRef"
          class="folder-drag-handle"
          draggable="true"
          @click.stop
          @dragstart="handleDragStart"
          @dragend="emit('dragend')"
        >
          <Icon icon="carbon:draggable" width="14" height="14" />
        </div>
      </div>
      <span class="folder-count">{{ snippets.length }}</span>
    </div>

    <!-- 片段列表 -->
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
  position: relative;
  transition: opacity 0.15s ease;

  &.is-dragging {
    opacity: 0.4;
  }

  &.is-default-folder .folder-header {
    cursor: default;
  }

  // 拖拽放置指示线
  &.drag-before::before {
    content: '';
    position: absolute;
    top: -1px;
    left: 0;
    right: 0;
    height: 2px;
    background: $color-focus;
    border-radius: 1px;
    z-index: 1;
  }

  &.drag-after::after {
    content: '';
    position: absolute;
    bottom: -1px;
    left: 0;
    right: 0;
    height: 2px;
    background: $color-focus;
    border-radius: 1px;
    z-index: 1;
  }
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
  align-items: center;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.folder-drag-handle {
  @include flex-center;
  width: 22px;
  height: 22px;
  padding: 0;
  border-radius: 4px;
  color: $color-description;
  cursor: grab;
  transition: background-color 0.15s, color 0.15s;

  &:hover {
    background: $bg-hover;
    color: $color-foreground;
  }

  &:active {
    cursor: grabbing;
  }
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
