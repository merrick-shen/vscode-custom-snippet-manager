<!-- 侧边栏视图组件：展示代码片段列表，支持搜索、筛选、新建/编辑/删除 -->
<script setup lang="ts">
/**
 * 侧边栏视图组件
 * 点击新建或编辑时通过 postMessage 通知后端打开编辑器面板
 * 操作按钮使用原生 HTML 确保在 webview 中点击可靠
 * 删除确认弹窗使用自定义浮层替代 n-modal，避免 teleport 兼容问题
 */
import { Icon } from '@iconify/vue'
import Fuse from 'fuse.js'
import type { Snippet, SortOrder, Folder } from '@/types'
import { DEFAULT_FOLDER_ID } from '@/types'
import { SUPPORTED_LANGUAGES } from '@/utils/languages'
import { postToExt, onExtMessage } from '@/composables/useMessage'
import { useNotification } from '@/composables/useNotification'
import { useConfirm } from '@/composables/useConfirm'
import { useImportExportDialogs } from '@/composables/useImportExportDialogs'
import { useFolderDialogs } from '@/composables/useFolderDialogs'
import { ensureLocale } from '@/i18n'
import SettingsView from '@/views/settings/SettingsView.vue'
import SnippetPreviewCard from '@/views/sidebar/components/SnippetPreviewCard.vue'
import FolderGroup from '@/views/sidebar/components/FolderGroup.vue'
import SearchInput from '@/views/sidebar/components/SearchInput.vue'
import StrategyOption from '@/views/sidebar/components/StrategyOption.vue'

const { t, locale } = useI18n()
const { notification, showError, showSuccess, showWarning, clearNotification } = useNotification()
const { confirmState, showConfirm, handleConfirmOk, handleConfirmCancel } = useConfirm()

// 当前视图：'list' 为片段列表，'settings' 为设置页面
const currentView = ref<'list' | 'settings'>('list')

// 切换视图时隐藏预览卡片
watch(currentView, () => {
  previewCard.value?.hide()
})

// 片段列表数据
const snippets = ref<Snippet[]>([])
// 文件夹清单，从后端注入的初始数据初始化
const folders = ref<Folder[]>(Array.isArray(window.__FOLDERS) ? window.__FOLDERS : [])
// 已折叠的文件夹 id 集合，默认全部折叠（打开插件时所有文件夹为关闭状态）
const collapsedFolders = ref<Set<string>>(
  new Set(folders.value.map((f) => f.id))
)

/** 获取文件夹显示名称，默认文件夹用 i18n，其余用自身名称 */
function folderDisplayName(folder: Folder): string {
  return folder.id === DEFAULT_FOLDER_ID ? t('folder.defaultName') : folder.name
}

/** 切换文件夹折叠/展开状态 */
function toggleFolder(folderId: string) {
  const next = new Set(collapsedFolders.value)
  if (next.has(folderId)) {
    next.delete(folderId)
  } else {
    next.add(folderId)
  }
  collapsedFolders.value = next
}
// 搜索关键词
const searchQuery = ref('')
// 语言筛选值，'*' 表示全部，多选时逗号分隔
const languageFilter = ref('*')
// 排序方向，从后端注入的偏好初始化，默认倒序（由新至旧）
const sortOrder = ref<SortOrder>(window.__SORT_ORDER === 'asc' ? 'asc' : 'desc')

// 当前排序方向的显示文本
const currentSortLabel = computed(() => {
  return sortOrder.value === 'desc' ? t('sort.newestFirst') : t('sort.oldestFirst')
})

// 语言来源：'auto' 跟随 VS Code 语言，'manual' 手动设置
const localeSource = ref<'auto' | 'manual'>(window.__LOCALE_SOURCE || 'auto')


/** 切换语言，先确保目标语言翻译已加载，再标记为手动模式并通知后端持久化 */
async function changeLocale(val: string) {
  await ensureLocale(val)
  locale.value = val
  localeSource.value = 'manual'
  postToExt('changeLocale', val)
}

/** 重置语言为自动检测模式 */
function resetLocaleToAuto() {
  postToExt('resetLocaleToAuto', null)
}

/** 切换排序方向（正序/倒序），并通知后端持久化保存 */
function toggleSortOrder() {
  sortOrder.value = sortOrder.value === 'desc' ? 'asc' : 'desc'
  postToExt('changeSortOrder', sortOrder.value)
}

onMounted(() => {
  postToExt('getSnippets')
})

// 语言下拉选项，动态生成以支持 i18n，包含图标信息
const languageOptions = computed(() => [
  { label: t('filter.all'), value: '*', icon: 'carbon:code' },
  ...SUPPORTED_LANGUAGES.filter((l) => l.value !== '*').map((l) => ({
    label: l.label,
    value: l.value,
    icon: l.icon,
  })),
])

// 先按语言筛选，结果作为后续搜索和排序的基础
// 单独缓存可避免在搜索关键词变化时重复执行语言筛选
const languageFilteredSnippets = computed(() => {
  if (!languageFilter.value || languageFilter.value === '*') {
    return snippets.value
  }

  const filterLangs = languageFilter.value.split(',').map((l: string) => l.trim())
  return snippets.value.filter((s) => {
    const langs = s.language.split(',').map((l: string) => l.trim())
    // 片段含通配符 '*' 或与任一筛选语言匹配时显示
    return langs.includes('*') || filterLangs.some((fl: string) => langs.includes(fl))
  })
})

// 缓存 Fuse 实例，仅在语言筛选结果（即 snippets 或 languageFilter）变化时重建
// 搜索关键词变化时复用同一实例，避免大量片段时频繁重建导致卡顿
const fuseInstance = computed(() => {
  return new Fuse(languageFilteredSnippets.value, {
    keys: ['name', 'prefix', 'description'],
    threshold: 0.4,
  })
})

// 根据 Fuse.js 模糊搜索 + 语言筛选 + 排序过滤片段列表
const filteredSnippets = computed(() => {
  let result = languageFilteredSnippets.value

  // 按关键词模糊搜索
  if (searchQuery.value.trim()) {
    result = fuseInstance.value.search(searchQuery.value).map((r) => r.item)
  }

  // 排序：按添加日期，支持正序（由旧至新）和倒序（由新至旧）
  const sorted = [...result]
  sorted.sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0
    return sortOrder.value === 'desc' ? timeB - timeA : timeA - timeB
  })

  return sorted
})

// 是否处于搜索或语言筛选状态（模板空状态判断与分组过滤共用）
const isFiltering = computed(
  () => !!searchQuery.value.trim() || (languageFilter.value !== '*' && !!languageFilter.value)
)

/**
 * 将筛选后的片段按文件夹分组，用于折叠树渲染
 * 顺序遵循文件夹清单顺序；搜索/筛选时仅显示有匹配片段的文件夹
 * 非搜索筛选状态下，空文件夹也显示（方便用户看到结构并向其添加片段）
 */
const groupedFolders = computed(() => {
  // 建立 folderId -> 片段列表 的映射
  const map = new Map<string, Snippet[]>()
  for (const s of filteredSnippets.value) {
    const fid = s.folderId ?? DEFAULT_FOLDER_ID
    const list = map.get(fid)
    if (list) {
      list.push(s)
    } else {
      map.set(fid, [s])
    }
  }

  return folders.value.map((folder) => ({
    folder,
    snippets: map.get(folder.id) ?? [],
  })).filter((group) => {
    // 筛选状态下隐藏无匹配片段的文件夹，非筛选状态下全部显示
    return isFiltering.value ? group.snippets.length > 0 : true
  })
})

/** 点击新建按钮，通知后端打开空白编辑器 */
function handleCreate() {
  postToExt('openEditor', null)
}

/** 点击编辑按钮，通知后端打开编辑器并传入片段数据 */
/** 使用展开运算符将 Vue 响应式 Proxy 转为纯对象，确保 postMessage 能正确序列化 */
function handleEdit(snippet: Snippet) {
  postToExt('openEditor', { ...snippet })
}

/** 点击删除按钮，弹出确认弹窗 */
function handleDelete(snippet: Snippet) {
  showConfirm({
    title: t('delete.title'),
    content: t('delete.content', { name: snippet.name }),
    confirmLabel: t('delete.confirm'),
    cancelLabel: t('delete.cancel'),
    danger: true,
    onConfirm: () => {
      postToExt('deleteSnippet', { id: snippet.id })
    },
  })
}

// 监听后端返回的片段列表数据（包括删除后自动刷新）
onExtMessage('snippetsList', (payload) => {
  snippets.value = payload as Snippet[]
})

// 监听后端返回的文件夹清单（创建/重命名/删除后自动刷新）
onExtMessage('foldersList', (payload) => {
  const list = payload as Folder[]
  // 保留已存在文件夹的折叠状态，新出现的文件夹默认折叠
  const next = new Set<string>()
  for (const f of list) {
    // 旧文件夹沿用原状态，未记录过的新文件夹默认折叠
    if (!folders.value.some((old) => old.id === f.id) || collapsedFolders.value.has(f.id)) {
      next.add(f.id)
    }
  }
  folders.value = list
  collapsedFolders.value = next
})

// 监听后端返回的错误消息（使用 i18n 渲染）
onExtMessage('error', (payload) => {
  const data = payload as { errorKey: string; errorParams?: Record<string, string> }
  showError(t(data.errorKey, data.errorParams ?? {}))
})

// 监听后端语言变更通知（重置为自动模式时触发），先确保语言已加载再切换
onExtMessage('localeChanged', async (payload) => {
  if (typeof payload === 'object' && payload !== null && 'locale' in payload) {
    const data = payload as { locale: string; source: 'auto' | 'manual' }
    await ensureLocale(data.locale)
    locale.value = data.locale
    localeSource.value = data.source
  }
})

// 监听后端发送的通知消息（创建/更新片段成功等）
onExtMessage('showNotification', (payload) => {
  const data = payload as { type: 'success' | 'warning' | 'error'; messageKey: string; params?: Record<string, string> }
  const message = t(`${data.messageKey}`, data.params ?? {})
  if (data.type === 'success') {
    showSuccess(message)
  } else if (data.type === 'warning') {
    showWarning(message)
  } else {
    showError(message)
  }
})

// 预览卡片组件引用
const previewCard = ref<InstanceType<typeof SnippetPreviewCard> | null>(null)

/** 鼠标进入列表项，委托预览卡片显示 */
function handleItemMouseEnter(event: MouseEvent, snippet: Snippet) {
  previewCard.value?.show(event, snippet)
}

/** 鼠标离开列表项，委托预览卡片隐藏 */
function handleItemMouseLeave() {
  previewCard.value?.hide()
}

/** 列表滚动时隐藏预览卡片 */
function handleListScroll() {
  previewCard.value?.hide()
}

// ===== 文件夹多选模式 =====

// 是否处于多选模式
const multiSelectMode = ref(false)

// 多选模式下已选中的文件夹 id 集合
const selectedFolderIds = ref<Set<string>>(new Set())

// 拖拽状态
const dragState = ref<{
  draggingId: string | null
  overId: string | null
  position: 'before' | 'after' | null
}>({
  draggingId: null,
  overId: null,
  position: null,
})

/** 非默认文件夹列表（用于全选/取消全选计算） */
const nonDefaultFolders = computed(() => folders.value.filter((f) => f.id !== DEFAULT_FOLDER_ID))

/** 是否全选（仅计算非默认文件夹） */
const allFoldersSelected = computed(
  () => nonDefaultFolders.value.length > 0 && selectedFolderIds.value.size === nonDefaultFolders.value.length
)

/** 切换多选模式 */
function toggleMultiSelectMode() {
  multiSelectMode.value = !multiSelectMode.value
  if (!multiSelectMode.value) {
    exitMultiSelect()
  }
}

/** 切换单个文件夹选中状态 */
function toggleFolderSelect(folderId: string) {
  const next = new Set(selectedFolderIds.value)
  if (next.has(folderId)) {
    next.delete(folderId)
  } else {
    next.add(folderId)
  }
  selectedFolderIds.value = next
}

/** 全选/取消全选（仅操作非默认文件夹） */
function toggleSelectAllFolders() {
  if (allFoldersSelected.value) {
    selectedFolderIds.value = new Set()
  } else {
    selectedFolderIds.value = new Set(nonDefaultFolders.value.map((f) => f.id))
  }
}

/** 退出多选模式，清空选中状态和拖拽状态 */
function exitMultiSelect() {
  multiSelectMode.value = false
  selectedFolderIds.value = new Set()
  dragState.value = { draggingId: null, overId: null, position: null }
}

// ===== 导入导出对话框（状态和逻辑由 composable 管理） =====
const {
  exportDialog,
  exportAllSelected,
  handleExport,
  toggleExportFolder,
  toggleExportAll,
  confirmExport,
  cancelExport,
  handleImport,
  duplicateDialog,
  handleDuplicateStrategy,
  handleDuplicateCancel,
  placementDialog,
  placementFolderOptions,
  confirmPlacement,
  cancelPlacement,
} = useImportExportDialogs({
  folders,
  snippets,
  t,
  showConfirm,
  showError,
  showSuccess,
  showWarning,
})

// ===== 文件夹管理对话框（状态和逻辑由 composable 管理） =====
const {
  folderDialog,
  openCreateFolder,
  openRenameFolder,
  submitFolderDialog,
  cancelFolderDialog,
  deleteFolderDialog,
  openDeleteFolder,
  confirmDeleteFolder,
  cancelDeleteFolder,
  batchDeleteDialog,
  confirmBatchDeleteFolder,
  cancelBatchDeleteFolder,
  handleBatchDeleteFolders,
} = useFolderDialogs({
  snippets,
  selectedFolderIds,
  t,
  showConfirm,
  showWarning,
  onExitMultiSelect: exitMultiSelect,
})

/** 拖拽开始 */
function handleFolderDragStart(_event: DragEvent, folderId: string) {
  dragState.value.draggingId = folderId
}

/** 拖拽结束 */
function handleFolderDragEnd() {
  dragState.value = { draggingId: null, overId: null, position: null }
}

/** 拖拽经过，计算放置位置 */
function handleFolderDragOver(event: DragEvent, folderId: string) {
  if (folderId === DEFAULT_FOLDER_ID || folderId === dragState.value.draggingId) return
  event.preventDefault()
  dragState.value.overId = folderId
  // 根据鼠标位置判断放置在目标前还是后
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const midY = rect.top + rect.height / 2
  dragState.value.position = event.clientY < midY ? 'before' : 'after'
}

/** 拖拽离开 */
function handleFolderDragLeave() {
  dragState.value.overId = null
  dragState.value.position = null
}

/** 放置，执行排序 */
function handleFolderDrop(_event: DragEvent, targetFolderId: string) {
  const dragId = dragState.value.draggingId
  if (!dragId || dragId === targetFolderId || targetFolderId === DEFAULT_FOLDER_ID) {
    handleFolderDragEnd()
    return
  }

  // 获取非默认文件夹的当前顺序
  const currentOrder = nonDefaultFolders.value.map((f) => f.id)
  // 移除拖拽项
  const withoutDrag = currentOrder.filter((id) => id !== dragId)
  // 在目标位置插入
  const targetIdx = withoutDrag.indexOf(targetFolderId)
  if (targetIdx === -1) {
    handleFolderDragEnd()
    return
  }
  const insertIdx = dragState.value.position === 'after' ? targetIdx + 1 : targetIdx
  withoutDrag.splice(insertIdx, 0, dragId)

  // 通知后端更新排序
  postToExt('reorderFolders', withoutDrag)
  handleFolderDragEnd()
}
</script>

<template>
  <div class="sidebar-view">
    <!-- 设置页面视图 -->
    <SettingsView v-if="currentView === 'settings'" :locale-source="localeSource" :current-locale="locale" @back="currentView = 'list'" @change-locale="changeLocale" @reset-locale-to-auto="resetLocaleToAuto" />
    <!-- 片段列表视图 -->
    <template v-else>
    <!-- 顶部标题栏：图标 + 标题 + 设置按钮 -->
    <div class="sidebar-header">
      <div class="header-content">
        <h2 class="header-title">{{ t('app.title') }}</h2>
        <!-- 设置按钮 -->
        <button class="settings-btn" :title="t('settings.title')" @click="currentView = 'settings'">
          <Icon icon="carbon:settings" width="15" height="15" />
        </button>
      </div>
      <!-- 新建片段按钮，与编辑页 btn-primary 风格统一 -->
      <BaseButton variant="primary" icon="carbon:add" class="create-btn" @click="handleCreate">{{ t('actions.create') }}</BaseButton>
      <!-- 导入导出按钮行 -->
      <div class="import-export-row">
        <BaseButton variant="secondary" size="sm" icon="carbon:upload" class="ie-btn" @click="handleExport">{{ t('importExport.exportConfig') }}</BaseButton>
        <BaseButton variant="secondary" size="sm" icon="carbon:download" class="ie-btn" @click="handleImport">{{ t('importExport.importConfig') }}</BaseButton>
      </div>
      <!-- 新建文件夹按钮 -->
      <BaseButton variant="secondary" size="sm" icon="carbon:folder-add" class="new-folder-btn" @click="openCreateFolder">{{ t('folder.create') }}</BaseButton>
      <!-- 文件夹多选模式按钮 -->
      <div class="folder-manage-row">
        <BaseButton
          :variant="multiSelectMode ? 'primary' : 'secondary'"
          size="sm"
          :icon="multiSelectMode ? 'carbon:checkbox-checked' : 'carbon:checkbox'"
          class="manage-btn"
          @click="toggleMultiSelectMode"
        >
          {{ multiSelectMode ? t('folder.exitManage') : t('folder.manage') }}
        </BaseButton>
        <template v-if="multiSelectMode">
          <BaseButton variant="secondary" size="sm" :icon="allFoldersSelected ? 'carbon:checkbox-checked' : 'carbon:checkbox'" class="manage-btn" @click="toggleSelectAllFolders">
            {{ allFoldersSelected ? t('folder.deselectAll') : t('folder.selectAll') }}
          </BaseButton>
          <BaseButton variant="danger" size="sm" icon="carbon:trash-can" class="manage-btn manage-btn-delete" :disabled="selectedFolderIds.size === 0" @click="handleBatchDeleteFolders">
            {{ t('folder.batchDelete') }}<span v-if="selectedFolderIds.size > 0" class="delete-count">{{ selectedFolderIds.size }}</span>
          </BaseButton>
        </template>
      </div>
    </div>

    <!-- 搜索框 -->
    <div class="sidebar-search">
      <SearchInput v-model="searchQuery" :placeholder="t('list.searchPlaceholder')" />
    </div>

    <!-- 语言筛选下拉：使用自定义组件显示图标 -->
    <div class="sidebar-filter">
      <BaseSelect
        v-model="languageFilter"
        :options="languageOptions"
        :placeholder="t('form.languagePlaceholder')"
        multiple
      />
    </div>

    <!-- 排序切换按钮 -->
    <div class="sidebar-sort">
      <button class="sort-toggle-btn" @click="toggleSortOrder" :title="currentSortLabel">
        <Icon v-if="sortOrder === 'desc'" icon="carbon:arrow-down" width="12" height="12" />
        <Icon v-else icon="carbon:arrow-up" width="12" height="12" />
        {{ currentSortLabel }}
      </button>
    </div>

    <!-- 片段列表区域 -->
    <div class="sidebar-list" @scroll="handleListScroll">
      <!-- 筛选无匹配结果时的空状态 -->
      <div v-if="groupedFolders.length === 0" class="empty-state">
        <p class="empty-desc">{{ t('list.empty') }}</p>
      </div>

      <!-- 片段分组列表：按文件夹折叠 -->
      <div v-else class="folder-groups">
        <FolderGroup
          v-for="group in groupedFolders"
          :key="group.folder.id"
          :folder="group.folder"
          :snippets="group.snippets"
          :is-collapsed="collapsedFolders.has(group.folder.id)"
          :default-folder-id="DEFAULT_FOLDER_ID"
          :folder-display-name="folderDisplayName(group.folder)"
          :multi-select-mode="multiSelectMode"
          :selected="selectedFolderIds.has(group.folder.id)"
          :dragging="dragState.draggingId === group.folder.id"
          :drag-over="dragState.overId === group.folder.id"
          :drag-position="dragState.overId === group.folder.id ? dragState.position ?? undefined : undefined"
          @toggle="toggleFolder"
          @rename="openRenameFolder"
          @delete-folder="openDeleteFolder"
          @edit-snippet="handleEdit"
          @delete-snippet="handleDelete"
          @snippet-mouseenter="handleItemMouseEnter"
          @snippet-mouseleave="handleItemMouseLeave"
          @select="toggleFolderSelect"
          @dragstart="handleFolderDragStart"
          @dragend="handleFolderDragEnd"
          @dragover="handleFolderDragOver"
          @dragleave="handleFolderDragLeave"
          @drop="handleFolderDrop"
        />
      </div>
    </div>

    <!-- 悬浮预览卡片 -->
    <SnippetPreviewCard ref="previewCard" />

    <!-- 通用确认弹窗（删除/导入/导出等操作） -->
    <ConfirmDialog
      :visible="confirmState.visible"
      :title="confirmState.title"
      :content="confirmState.content"
      :confirm-label="confirmState.confirmLabel"
      :cancel-label="confirmState.cancelLabel"
      :danger="confirmState.danger"
      @confirm="handleConfirmOk"
      @cancel="handleConfirmCancel"
    />

    <!-- 重复片段策略选择对话框 -->
    <ConfirmDialog
      :visible="duplicateDialog.visible"
      :title="t('importExport.duplicateTitle')"
      large
      @cancel="handleDuplicateCancel"
    >
      <template #body>
        <p>{{ t('importExport.duplicateContent', { count: duplicateDialog.count }) }}</p>
        <div class="strategy-options">
          <StrategyOption icon="carbon:edit" :name="t('importExport.overwrite')" :desc="t('importExport.overwriteDesc')" @click="handleDuplicateStrategy('overwrite')" />
          <StrategyOption icon="carbon:error-outline" :name="t('importExport.skip')" :desc="t('importExport.skipDesc')" @click="handleDuplicateStrategy('skip')" />
          <StrategyOption icon="carbon:link" :name="t('importExport.merge')" :desc="t('importExport.mergeDesc')" @click="handleDuplicateStrategy('merge')" />
        </div>
      </template>
      <template #footer>
        <BaseButton variant="secondary" size="sm" @click="handleDuplicateCancel">{{ t('form.cancel') }}</BaseButton>
      </template>
    </ConfirmDialog>

    <!-- 文件夹编辑对话框（新建/重命名） -->
    <ConfirmDialog
      :visible="folderDialog.visible"
      :title="folderDialog.mode === 'create' ? t('folder.createTitle') : t('folder.renameTitle')"
      @confirm="submitFolderDialog"
      @cancel="cancelFolderDialog"
    >
      <template #body>
        <input
          v-model="folderDialog.name"
          class="form-input"
          :placeholder="t('folder.namePlaceholder')"
          maxlength="50"
          @keyup.enter="submitFolderDialog"
        />
      </template>
    </ConfirmDialog>

    <!-- 删除文件夹对话框：选择片段处理方式 -->
    <ConfirmDialog
      :visible="deleteFolderDialog.visible"
      :title="t('folder.deleteTitle')"
      large
      @cancel="cancelDeleteFolder"
    >
      <template #body>
        <p>{{ t('folder.deleteContent', { name: deleteFolderDialog.name, count: deleteFolderDialog.count }) }}</p>
        <div v-if="deleteFolderDialog.count > 0" class="strategy-options">
          <StrategyOption icon="carbon:folder" :name="t('folder.deleteMove')" :desc="t('folder.deleteMoveDesc')" @click="confirmDeleteFolder('move')" />
          <StrategyOption icon="carbon:trash-can" :name="t('folder.deleteWithSnippets')" :desc="t('folder.deleteWithSnippetsDesc')" danger @click="confirmDeleteFolder('delete')" />
        </div>
      </template>
      <template #footer>
        <template v-if="deleteFolderDialog.count === 0">
          <BaseButton variant="secondary" size="sm" @click="cancelDeleteFolder">{{ t('form.cancel') }}</BaseButton>
          <BaseButton variant="danger" size="sm" @click="confirmDeleteFolder('delete')">{{ t('folder.delete') }}</BaseButton>
        </template>
        <BaseButton v-else variant="secondary" size="sm" @click="cancelDeleteFolder">{{ t('form.cancel') }}</BaseButton>
      </template>
    </ConfirmDialog>

    <!-- 批量删除文件夹对话框：选择片段处理方式 -->
    <ConfirmDialog
      :visible="batchDeleteDialog.visible"
      :title="t('folder.batchDeleteTitle')"
      large
      @cancel="cancelBatchDeleteFolder"
    >
      <template #body>
        <p>{{ t('folder.batchDeleteStrategyHint') }}</p>
        <div class="strategy-options">
          <StrategyOption icon="carbon:folder" :name="t('folder.deleteMove')" :desc="t('folder.batchDeleteMoveDesc')" @click="confirmBatchDeleteFolder('move')" />
          <StrategyOption icon="carbon:trash-can" :name="t('folder.deleteWithSnippets')" :desc="t('folder.batchDeleteWithSnippetsDesc')" danger @click="confirmBatchDeleteFolder('delete')" />
        </div>
      </template>
      <template #footer>
        <BaseButton variant="secondary" size="sm" @click="cancelBatchDeleteFolder">{{ t('form.cancel') }}</BaseButton>
      </template>
    </ConfirmDialog>

    <!-- 导出范围选择对话框（多选文件夹，每个文件夹各导出一个 JSON） -->
    <ConfirmDialog
      :visible="exportDialog.visible"
      :title="t('importExport.exportConfirmTitle')"
      large
      @cancel="cancelExport"
    >
      <template #body>
        <p>{{ t('folder.exportSelectHint') }}</p>
        <div class="export-options">
          <label class="export-check-item export-check-all">
            <BaseCheckbox :model-value="exportAllSelected" @click="toggleExportAll" />
            <span class="export-option-label">{{ t('folder.exportAll') }}</span>
          </label>
          <label
            v-for="f in folders"
            :key="f.id"
            class="export-check-item"
          >
            <BaseCheckbox
              :model-value="exportDialog.selectedIds.has(f.id)"
              @click="toggleExportFolder(f.id)"
            />
            <Icon icon="carbon:folder" width="14" height="14" />
            <span class="export-option-label">{{ folderDisplayName(f) }}</span>
          </label>
        </div>
      </template>
      <template #footer>
        <BaseButton variant="secondary" size="sm" @click="cancelExport">{{ t('form.cancel') }}</BaseButton>
        <BaseButton variant="primary" size="sm" :disabled="exportDialog.selectedIds.size === 0" @click="confirmExport">{{ t('importExport.exportConfig') }}</BaseButton>
      </template>
    </ConfirmDialog>

    <!-- 导入存放方式选择对话框 -->
    <ConfirmDialog
      :visible="placementDialog.visible"
      :title="t('importExport.placementTitle')"
      large
      @cancel="cancelPlacement"
    >
      <template #body>
        <p>{{ t('importExport.placementHint', { count: placementDialog.count }) }}</p>
        <div class="placement-modes">
          <label class="placement-mode">
            <BaseRadio v-model="placementDialog.mode" value="new" />
            <span>{{ t('importExport.placementNew') }}</span>
          </label>
          <label class="placement-mode">
            <BaseRadio v-model="placementDialog.mode" value="existing" />
            <span>{{ t('importExport.placementExisting') }}</span>
          </label>
        </div>
        <div v-if="placementDialog.mode === 'new'" class="placement-field">
          <input
            v-model="placementDialog.newName"
            class="form-input"
            :placeholder="t('folder.namePlaceholder')"
            maxlength="50"
            @input="placementDialog.nameError = ''"
            @keyup.enter="confirmPlacement"
          />
          <span v-if="placementDialog.nameError" class="placement-error">
            {{ t(placementDialog.nameError) }}
          </span>
        </div>
        <div v-else class="placement-field">
          <BaseSelect
            v-model="placementDialog.targetFolderId"
            :options="placementFolderOptions"
            :placeholder="t('folder.namePlaceholder')"
          />
          <span class="placement-note">{{ t('importExport.placementExistingNote') }}</span>
        </div>
      </template>
      <template #footer>
        <BaseButton variant="secondary" size="sm" @click="cancelPlacement">{{ t('form.cancel') }}</BaseButton>
        <BaseButton variant="primary" size="sm" @click="confirmPlacement">{{ t('importExport.importConfig') }}</BaseButton>
      </template>
    </ConfirmDialog>

    <!-- 通用通知条 -->
    <NotificationBar
      :visible="notification.visible"
      :type="notification.type"
      :message="notification.message"
      :auto-hide="notification.autoHide"
      @close="clearNotification"
    />
    </template>
  </div>
</template>

<style scoped lang="scss">
.sidebar-view {
  @include flex-column;
  height: 100vh;
  overflow: hidden;
  position: relative;
}

// ===== 顶部标题栏 =====
.sidebar-header {
  padding: $spacing-xl 14px $spacing-md;
  border-bottom: 1px solid $border-panel;
}

.header-content {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  margin-bottom: 10px;
}

.header-title {
  margin: 0;
  font-size: $font-size-lg;
  font-weight: 700;
  color: $color-foreground;
  letter-spacing: -0.2px;
  flex: 1;
}

.settings-btn {
  @include icon-btn(28px);
  flex-shrink: 0;
}

.create-btn {
  width: 100%;
  justify-content: center;
}

.import-export-row {
  display: flex;
  gap: 6px;
  margin-top: 6px;
}

.ie-btn {
  flex: 1;
  justify-content: center;
  font-size: $font-size-xs;
}

// ===== 搜索框 =====
.sidebar-search {
  padding: 10px 14px $spacing-xs;
}

// ===== 语言筛选 =====
.sidebar-filter {
  padding: $spacing-xs 14px $spacing-sm;
}

// ===== 排序切换 =====
.sidebar-sort {
  padding: 0 14px $spacing-sm;
}

.sort-toggle-btn {
  display: flex;
  align-items: center;
  gap: $spacing-xs;
  width: 100%;
  padding: $spacing-xs $spacing-sm;
  border: 1px solid var(--vscode-dropdown-border, #3c3c3c);
  border-radius: $radius-sm;
  background: var(--vscode-dropdown-background, #3c3c3c);
  color: var(--vscode-dropdown-foreground, #cccccc);
  font-size: $font-size-xs;
  cursor: pointer;
  font-family: inherit;
  line-height: 1.4;
  transition: background 0.15s;

  &:hover {
    background: var(--vscode-list-hoverBackground, #2a2d2e);
  }
}

// ===== 片段列表 =====
.sidebar-list {
  flex: 1;
  overflow-y: auto;
  padding: $spacing-xs $spacing-sm $spacing-sm;
}

.empty-state {
  @include flex-column;
  align-items: center;
  justify-content: center;
  padding: 40px $spacing-lg;
  text-align: center;
}

.empty-desc {
  margin: 0;
  font-size: $font-size-sm;
  color: $color-description;
  line-height: 1.6;
}

// ===== 文件夹分组 =====
.folder-groups {
  @include flex-column;
  gap: 2px;
}

.new-folder-btn {
  width: 100%;
  justify-content: center;
  margin-top: 6px;
}

// ===== 文件夹管理行 =====
.folder-manage-row {
  display: flex;
  gap: 6px;
  margin-top: 6px;
  flex-wrap: wrap;
  align-items: stretch;
}

.manage-btn {
  flex: 1;
  justify-content: center;
  font-size: $font-size-xs;
  min-width: 0;
  white-space: nowrap;
}

// 批量删除按钮计数徽章
.manage-btn-delete {
  position: relative;
}

.delete-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  margin-left: 4px;
  padding: 0 4px;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.25);
}

// ===== 导出选择 =====
.export-options {
  @include flex-column;
  gap: $spacing-xs;
  margin-top: $spacing-md;
  max-height: 280px;
  overflow-y: auto;
}

.export-check-item {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  padding: 8px 12px;
  border: 1px solid $border-input;
  border-radius: $radius-md;
  background: $bg-input;
  color: $color-foreground;
  cursor: pointer;
  text-align: left;
  transition: background-color 0.15s, border-color 0.15s;

  &:hover {
    background: $bg-list-hover;
    border-color: $color-focus;
  }
}

.export-check-all {
  // 全选项与文件夹列表之间用分隔线区分
  border-style: dashed;
  margin-bottom: 2px;
}

.export-option-label {
  flex: 1;
  font-size: $font-size-base;
  @include text-ellipsis;
}

// ===== 导入存放方式对话框 =====
.placement-modes {
  display: flex;
  gap: $spacing-md;
  margin: $spacing-md 0;
}

.placement-mode {
  display: flex;
  align-items: center;
  gap: $spacing-xs;
  font-size: $font-size-base;
  color: $color-foreground;
  cursor: pointer;
}

.placement-field {
  @include flex-column;
  gap: $spacing-xs;

  select.form-input {
    cursor: pointer;
  }
}

.placement-error {
  font-size: $font-size-xs;
  color: $color-error;
}

.placement-note {
  font-size: $font-size-xs;
  color: $color-description;
}

// ===== 弹窗内容样式 =====
.strategy-options {
  @include flex-column;
  gap: $spacing-sm;
  margin-top: $spacing-md;
}

// ===== 共享样式 =====
.form-input {
  @include input-base;
}
</style>
