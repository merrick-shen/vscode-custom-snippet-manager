<!-- 侧边栏视图组件：展示代码片段列表，支持搜索、筛选、新建/编辑/删除 -->
<script setup lang="ts">
/**
 * 侧边栏视图组件
 * 点击新建或编辑时通过 postMessage 通知后端打开编辑器面板
 * 操作按钮使用原生 HTML 确保在 webview 中点击可靠
 * 删除确认弹窗使用自定义浮层替代 n-modal，避免 teleport 兼容问题
 */
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { Icon } from '@iconify/vue'
import Fuse from 'fuse.js'
import type { Snippet, SortOrder, Folder } from '../types'
import { DEFAULT_FOLDER_ID } from '../types'
import { SUPPORTED_LANGUAGES, getLanguageColor, getLanguageIcon } from '../utils/languages'
import { postToExt, onExtMessage } from '../composables/useMessage'
import { useNotification } from '../composables/useNotification'
import { useConfirm } from '../composables/useConfirm'
import { highlightCodeString } from '../utils/codemirror-langs'
import LanguageSelect from '../components/LanguageSelect.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import NotificationBar from '../components/NotificationBar.vue'
import StrategyOption from '../components/StrategyOption.vue'
import BaseButton from '../components/BaseButton.vue'
import SearchInput from '../components/SearchInput.vue'
import SettingsView from './SettingsView.vue'
import { SUPPORTED_LOCALES } from '../i18n'

const { t, locale } = useI18n()
const { notification, showError, showSuccess, showWarning, clearNotification } = useNotification()
const { confirmState, showConfirm, handleConfirmOk, handleConfirmCancel } = useConfirm()

// 当前视图：'list' 为片段列表，'settings' 为设置页面
const currentView = ref<'list' | 'settings'>('list')

// 切换视图时清除预览状态
watch(currentView, () => {
  previewState.value.visible = false
  if (previewTimer) {
    clearTimeout(previewTimer)
    previewTimer = null
  }
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

/** 导入存放方式对话框的文件夹下拉选项，默认文件夹用 i18n 名称 */
const placementFolderOptions = computed(() =>
  placementDialog.value.folders.map((f) => ({
    value: f.id,
    label: f.id === DEFAULT_FOLDER_ID ? t('folder.defaultName') : f.name,
  }))
)

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

// 语言切换下拉选项，适配 LanguageSelect 组件格式
const localeSelectOptions = computed(() =>
  SUPPORTED_LOCALES.map((l) => ({
    label: l.label,
    value: l.value,
    icon: `circle-flags:${l.flag}`,
  }))
)

/** 切换语言，同时通知扩展持久化保存 */
function changeLocale(val: string) {
  locale.value = val
  postToExt('changeLocale', val)
}

/** 切换排序方向（正序/倒序），并通知后端持久化保存 */
function toggleSortOrder() {
  sortOrder.value = sortOrder.value === 'desc' ? 'asc' : 'desc'
  postToExt('changeSortOrder', sortOrder.value)
}

onMounted(() => {
  postToExt('getSnippets')
})

onBeforeUnmount(() => {
  if (previewTimer) {
    clearTimeout(previewTimer)
    previewTimer = null
  }
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

// 根据 Fuse.js 模糊搜索 + 语言筛选 + 排序过滤片段列表
const filteredSnippets = computed(() => {
  let result = snippets.value

  // 按语言筛选：支持多选，片段的 language 字段支持逗号分隔的多语言
  if (languageFilter.value && languageFilter.value !== '*') {
    const filterLangs = languageFilter.value.split(',').map((l: string) => l.trim())
    result = result.filter(
      (s) => {
        const langs = s.language.split(',').map((l: string) => l.trim())
        // 片段含通配符 '*' 或与任一筛选语言匹配时显示
        return langs.includes('*') || filterLangs.some((fl: string) => langs.includes(fl))
      }
    )
  }

  // 按关键词模糊搜索
  if (searchQuery.value.trim()) {
    const fuse = new Fuse(result, {
      keys: ['name', 'prefix', 'description'],
      threshold: 0.4,
    })
    result = fuse.search(searchQuery.value).map((r) => r.item)
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

// ===== 文件夹管理 =====

// 文件夹编辑对话框状态：mode 区分新建和重命名
const folderDialog = ref<{
  visible: boolean
  mode: 'create' | 'rename'
  id: string
  name: string
}>({
  visible: false,
  mode: 'create',
  id: '',
  name: '',
})

// 删除文件夹对话框状态，展示该文件夹下的片段数量供用户决策
const deleteFolderDialog = ref<{
  visible: boolean
  id: string
  name: string
  count: number
}>({
  visible: false,
  id: '',
  name: '',
  count: 0,
})

/** 打开新建文件夹对话框 */
function openCreateFolder() {
  folderDialog.value = { visible: true, mode: 'create', id: '', name: '' }
}

/** 打开重命名文件夹对话框（默认文件夹不可重命名） */
function openRenameFolder(folder: Folder) {
  if (folder.id === DEFAULT_FOLDER_ID) return
  folderDialog.value = { visible: true, mode: 'rename', id: folder.id, name: folder.name }
}

/** 提交文件夹对话框：新建或重命名 */
function submitFolderDialog() {
  const name = folderDialog.value.name.trim()
  if (!name) {
    showWarning(t('folder.nameRequired'))
    return
  }
  if (folderDialog.value.mode === 'create') {
    postToExt('createFolder', { name })
  } else {
    postToExt('renameFolder', { id: folderDialog.value.id, name })
  }
  folderDialog.value.visible = false
}

/** 取消文件夹对话框 */
function cancelFolderDialog() {
  folderDialog.value.visible = false
}

/** 打开删除文件夹对话框（默认文件夹不可删除） */
function openDeleteFolder(folder: Folder) {
  if (folder.id === DEFAULT_FOLDER_ID) return
  // 统计该文件夹下的片段数量
  const count = snippets.value.filter((s) => (s.folderId ?? DEFAULT_FOLDER_ID) === folder.id).length
  deleteFolderDialog.value = { visible: true, id: folder.id, name: folder.name, count }
}

/** 确认删除文件夹，action 决定片段处理方式 */
function confirmDeleteFolder(action: 'move' | 'delete') {
  postToExt('deleteFolder', { id: deleteFolderDialog.value.id, action })
  deleteFolderDialog.value.visible = false
}

/** 取消删除文件夹 */
function cancelDeleteFolder() {
  deleteFolderDialog.value.visible = false
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

// 导出文件夹选择对话框状态，selectedIds 为已勾选的文件夹 id 集合
const exportDialog = ref<{ visible: boolean; selectedIds: Set<string> }>({
  visible: false,
  selectedIds: new Set(),
})

/** 点击导出配置按钮，打开文件夹多选对话框（默认全选） */
function handleExport() {
  if (snippets.value.length === 0) {
    showError(t('importExport.noDataToExport'))
    return
  }
  // 默认勾选全部文件夹
  exportDialog.value = {
    visible: true,
    selectedIds: new Set(folders.value.map((f) => f.id)),
  }
}

/** 是否已全选 */
const exportAllSelected = computed(
  () => folders.value.length > 0 && exportDialog.value.selectedIds.size === folders.value.length
)

/** 切换单个文件夹勾选状态 */
function toggleExportFolder(folderId: string) {
  const next = new Set(exportDialog.value.selectedIds)
  if (next.has(folderId)) {
    next.delete(folderId)
  } else {
    next.add(folderId)
  }
  exportDialog.value.selectedIds = next
}

/** 切换全选/全不选 */
function toggleExportAll() {
  if (exportAllSelected.value) {
    exportDialog.value.selectedIds = new Set()
  } else {
    exportDialog.value.selectedIds = new Set(folders.value.map((f) => f.id))
  }
}

/** 确认导出：将勾选的文件夹 id 列表发送给后端，每个文件夹各导出一个 JSON */
function confirmExport() {
  const ids = Array.from(exportDialog.value.selectedIds)
  if (ids.length === 0) {
    return
  }
  exportDialog.value.visible = false
  postToExt('exportSnippets', { folderIds: ids })
}

/** 取消导出 */
function cancelExport() {
  exportDialog.value.visible = false
}

/** 点击导入配置按钮 */
function handleImport() {
  showConfirm({
    title: t('importExport.importConfirmTitle'),
    content: t('importExport.importConfirmContent'),
    confirmLabel: t('importExport.importConfig'),
    danger: true,
    onConfirm: () => {
      postToExt('importSnippets')
    },
  })
}

// 监听后端返回的导出结果
onExtMessage('exportResult', (payload) => {
  const result = payload as { success: boolean; folderCount?: number; count?: number }
  if (result.success) {
    showSuccess(
      t('importExport.exportSuccessDetail', {
        folderCount: result.folderCount ?? 0,
        count: result.count ?? 0,
      })
    )
  } else {
    showError(t('importExport.exportFailed'))
  }
})

// 监听后端返回的导入结果
onExtMessage('importResult', (payload) => {
  const result = payload as {
    imported: number
    skipped: number
    overwritten: number
    merged: number
    total: number
    folderName: string
    errors: string[]
  }
  if (result.errors.length > 0) {
    showWarning(
      t('importExport.importPartialDetail', {
        imported: result.imported,
        errors: result.errors.length,
      })
    )
  } else {
    showSuccess(
      t('importExport.importSuccessDetail', {
        count: result.imported,
        folder: result.folderName || t('folder.defaultName'),
      })
    )
  }
})

// 监听后端返回的导入错误（文件读取失败、JSON 无效、验证失败等）
onExtMessage('importError', (payload) => {
  const data = payload as { errorKey: string; errorParams?: Record<string, string | number> }
  showError(t(`importExport.${data.errorKey}`, data.errorParams ?? {}))
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

// 重复片段策略对话框状态
const duplicateDialog = ref<{
  visible: boolean
  count: number
}>({
  visible: false,
  count: 0,
})

// 监听后端请求显示重复策略对话框
onExtMessage('showDuplicateDialog', (payload) => {
  const data = payload as { count: number }
  duplicateDialog.value = {
    visible: true,
    count: data.count,
  }
})

/** 用户选择重复处理策略，通知后端 */
function handleDuplicateStrategy(strategy: string) {
  duplicateDialog.value.visible = false
  postToExt('duplicateStrategyChoice', strategy)
}

/** 用户取消重复策略对话框 */
function handleDuplicateCancel() {
  duplicateDialog.value.visible = false
  postToExt('duplicateStrategyChoice', null)
}

// 导入存放方式对话框状态
const placementDialog = ref<{
  visible: boolean
  // 来源文件夹推荐名（来自导入 JSON 的 folder.name）
  suggestedName: string
  // 待导入片段数量
  count: number
  // 可选的已有文件夹清单
  folders: Folder[]
  // 当前选择的存放模式
  mode: 'new' | 'existing'
  // 新建文件夹名称输入
  newName: string
  // 导入到已有文件夹时选中的文件夹 id
  targetFolderId: string
  // 名称校验错误的 i18n key，空表示无错误
  nameError: string
}>({
  visible: false,
  suggestedName: '',
  count: 0,
  folders: [],
  mode: 'new',
  newName: '',
  targetFolderId: DEFAULT_FOLDER_ID,
  nameError: '',
})

// 监听后端请求显示导入存放方式对话框
onExtMessage('showImportPlacementDialog', (payload) => {
  const data = payload as { suggestedName: string; count: number; folders: Folder[] }
  const list = Array.isArray(data.folders) ? data.folders : []
  placementDialog.value = {
    visible: true,
    suggestedName: data.suggestedName ?? '',
    count: data.count ?? 0,
    folders: list,
    mode: 'new',
    // 推荐名为空（来源为默认文件夹）时留空让用户填写
    newName: data.suggestedName ?? '',
    targetFolderId: list[0]?.id ?? DEFAULT_FOLDER_ID,
    nameError: '',
  }
})

/** 校验新建文件夹名称：非空且不与现有文件夹重名（忽略大小写、去空格） */
function validatePlacementName(): boolean {
  const trimmed = placementDialog.value.newName.trim()
  if (!trimmed) {
    placementDialog.value.nameError = 'folder.nameRequired'
    return false
  }
  const lower = trimmed.toLowerCase()
  const conflict = placementDialog.value.folders.some(
    (f) => folderDisplayName(f).trim().toLowerCase() === lower
  )
  if (conflict) {
    placementDialog.value.nameError = 'importExport.placementNameConflict'
    return false
  }
  placementDialog.value.nameError = ''
  return true
}

/** 确认存放方式，回传后端 */
function confirmPlacement() {
  if (placementDialog.value.mode === 'new') {
    if (!validatePlacementName()) {
      return
    }
    const name = placementDialog.value.newName.trim()
    placementDialog.value.visible = false
    postToExt('importPlacementChoice', { mode: 'new', name })
  } else {
    placementDialog.value.visible = false
    postToExt('importPlacementChoice', { mode: 'existing', folderId: placementDialog.value.targetFolderId })
  }
}

/** 取消存放方式选择，终止导入 */
function cancelPlacement() {
  placementDialog.value.visible = false
  postToExt('importPlacementChoice', null)
}

// ===== 悬浮预览卡片 =====
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
// 预览卡片最大显示行数
const PREVIEW_MAX_LINES = 8

/** 截取代码前 N 行 */
function getPreviewLines(body: string, maxLines: number): string {
  const lines = body.split('\n')
  if (lines.length <= maxLines) return body
  return lines.slice(0, maxLines).join('\n')
}

/** 鼠标进入列表项，延迟显示预览 */
function handleItemMouseEnter(event: MouseEvent, snippet: Snippet) {
  if (previewTimer) clearTimeout(previewTimer)
  // 必须在 setTimeout 外捕获元素引用，因为 currentTarget 在异步回调中为 null
  const el = event.currentTarget as HTMLElement
  previewTimer = setTimeout(() => {
    const itemRect = el.getBoundingClientRect()
    // 使用视口坐标定位，避免被滚动容器裁剪
    const top = itemRect.top
    const left = itemRect.left
    const width = itemRect.width
    // 上方空间不足 150px 时改为下方显示
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
function handleItemMouseLeave() {
  if (previewTimer) {
    clearTimeout(previewTimer)
    previewTimer = null
  }
  previewState.value.visible = false
}

/** 列表滚动时隐藏预览卡片 */
function handleListScroll() {
  previewState.value.visible = false
}
</script>

<template>
  <div class="sidebar-view">
    <!-- 设置页面视图 -->
    <SettingsView v-if="currentView === 'settings'" @back="currentView = 'list'" />
    <!-- 片段列表视图 -->
    <template v-else>
    <!-- 顶部标题栏：图标 + 标题 + 语言切换 -->
    <div class="sidebar-header">
      <div class="header-content">
        <h2 class="header-title">{{ t('app.title') }}</h2>
        <!-- 设置按钮 -->
        <button class="settings-btn" :title="t('settings.title')" @click="currentView = 'settings'">
          <Icon icon="carbon:settings" width="15" height="15" />
        </button>
        <!-- 语言切换下拉菜单 -->
        <LanguageSelect
          :model-value="locale"
          :options="localeSelectOptions"
          class="locale-select"
          @update:model-value="changeLocale"
        />
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
    </div>

    <!-- 搜索框 -->
    <div class="sidebar-search">
      <SearchInput v-model="searchQuery" :placeholder="t('list.searchPlaceholder')" />
    </div>

    <!-- 语言筛选下拉：使用自定义组件显示图标 -->
    <div class="sidebar-filter">
      <LanguageSelect
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
        <div
          v-for="group in groupedFolders"
          :key="group.folder.id"
          class="folder-group"
        >
          <!-- 文件夹头部：折叠箭头 + 名称 + 数量 + 操作按钮 -->
          <div class="folder-header" @click="toggleFolder(group.folder.id)">
            <Icon
              icon="carbon:chevron-down"
              class="folder-arrow"
              :class="{ 'is-collapsed': collapsedFolders.has(group.folder.id) }"
              width="12"
              height="12"
            />
            <Icon icon="carbon:folder" class="folder-icon" width="14" height="14" />
            <span class="folder-name">{{ folderDisplayName(group.folder) }}</span>
            <!-- 文件夹操作：放在数量左侧，使数量始终贴右，与默认文件夹对齐 -->
            <div v-if="group.folder.id !== DEFAULT_FOLDER_ID" class="folder-actions">
              <button class="folder-action-btn" :title="t('folder.rename')" @click.stop="openRenameFolder(group.folder)">
                <Icon icon="carbon:edit" width="12" height="12" />
              </button>
              <button class="folder-action-btn folder-action-danger" :title="t('folder.delete')" @click.stop="openDeleteFolder(group.folder)">
                <Icon icon="carbon:trash-can" width="12" height="12" />
              </button>
            </div>
            <span class="folder-count">{{ group.snippets.length }}</span>
          </div>

          <!-- 文件夹内片段：折叠时隐藏 -->
          <div v-show="!collapsedFolders.has(group.folder.id)" class="snippet-items">
            <!-- 文件夹内无片段提示 -->
            <div v-if="group.snippets.length === 0" class="folder-empty">
              {{ t('folder.emptyHint') }}
            </div>
            <div
              v-for="snippet in group.snippets"
              :key="snippet.id"
              class="snippet-item"
              @mouseenter="handleItemMouseEnter($event, snippet)"
              @mouseleave="handleItemMouseLeave"
            >
              <!-- 片段信息：名称、语言标签、前缀、描述 -->
              <div class="item-main">
                <div class="item-top">
                  <span class="item-name">{{ snippet.name }}</span>
                  <!-- 语言标签，使用 Iconify 图标 + 品牌色 -->
                  <span
                    v-for="lang in snippet.language.split(',').map((l: string) => l.trim())"
                    :key="lang"
                    class="lang-badge"
                    :style="{ backgroundColor: getLanguageColor(lang) + '22', color: getLanguageColor(lang), borderColor: getLanguageColor(lang) + '44' }"
                  >
                    <Icon v-if="lang !== '*'" :icon="getLanguageIcon(lang)" class="lang-badge-icon" />
                    <span class="lang-badge-text">{{ lang === '*' ? t('form.allLanguages') : lang }}</span>
                  </span>
                </div>
                <div class="item-meta">
                  <code class="item-prefix">{{ snippet.prefix }}</code>
                  <span v-if="snippet.description" class="item-desc">{{ snippet.description }}</span>
                </div>
              </div>
              <!-- 操作按钮区：悬浮时显示 -->
              <div class="item-actions">
                <!-- 编辑按钮 -->
                <button class="action-btn" :title="t('actions.edit')" @click.stop="handleEdit(snippet)">
                  <Icon icon="carbon:edit" width="14" height="14" />
                </button>
                <!-- 删除按钮 -->
                <button class="action-btn action-btn-danger" :title="t('actions.delete')" @click.stop="handleDelete(snippet)">
                  <Icon icon="carbon:trash-can" width="14" height="14" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 悬浮预览卡片 -->
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
            <input type="checkbox" :checked="exportAllSelected" @change="toggleExportAll" />
            <span class="export-option-label">{{ t('folder.exportAll') }}</span>
          </label>
          <label
            v-for="f in folders"
            :key="f.id"
            class="export-check-item"
          >
            <input
              type="checkbox"
              :checked="exportDialog.selectedIds.has(f.id)"
              @change="toggleExportFolder(f.id)"
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
            <input type="radio" value="new" v-model="placementDialog.mode" />
            <span>{{ t('importExport.placementNew') }}</span>
          </label>
          <label class="placement-mode">
            <input type="radio" value="existing" v-model="placementDialog.mode" />
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
          <LanguageSelect
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

// ===== 语言切换 =====
.locale-select {
  position: relative;
  flex-shrink: 0;
  width: auto;

  :deep(.lang-select) {
    width: auto;
  }

  :deep(.lang-select-trigger) {
    width: auto;
    padding: 3px 6px;
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.3px;
    gap: 3px;
  }

  :deep(.lang-icon) {
    font-size: 16px;
  }

  :deep(.lang-label) {
    font-size: 10px;
  }

  :deep(.lang-select-arrow) {
    width: 10px;
    height: 10px;
  }

  :deep(.lang-select-dropdown) {
    right: 0;
    left: auto;
    min-width: 160px;
  }
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

.snippet-items {
  @include flex-column;
  gap: 2px;
}

// ===== 文件夹分组 =====
.folder-groups {
  @include flex-column;
  gap: 2px;
}

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

  // 折叠时箭头指向右侧
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

// 文件夹内片段缩进，体现层级关系
.folder-group .snippet-items {
  padding-left: 14px;
}

.folder-empty {
  padding: 6px 10px;
  font-size: $font-size-xs;
  color: $color-description;
  opacity: 0.7;
  font-style: italic;
}

.new-folder-btn {
  width: 100%;
  justify-content: center;
  margin-top: 6px;
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

  input[type='checkbox'] {
    cursor: pointer;
    flex-shrink: 0;
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

  input[type='radio'] {
    cursor: pointer;
  }
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

// ===== 悬浮预览卡片 =====

.preview-card {
  position: fixed;
  z-index: 100;
  border: 1px solid $border-dropdown;
  border-radius: $radius-lg;
  background: $bg-widget;
  box-shadow: $shadow-dropdown;
  overflow: hidden;
  pointer-events: none;

  // 默认在列表项上方显示
  &.preview-top {
    transform: translateY(-100%);
  }

  // 上方空间不足时在列表项下方显示
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

// ===== 操作按钮 =====
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
