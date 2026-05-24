<!-- 侧边栏视图组件：展示代码片段列表，支持搜索、筛选、新建/编辑/删除 -->
<script setup lang="ts">
/**
 * 侧边栏视图组件
 * 点击新建或编辑时通过 postMessage 通知后端打开编辑器面板
 * 操作按钮使用原生 HTML 确保在 webview 中点击可靠
 * 删除确认弹窗使用自定义浮层替代 n-modal，避免 teleport 兼容问题
 */
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { Icon } from '@iconify/vue'
import Fuse from 'fuse.js'
import type { Snippet, SortOrder } from '../types'
import { SUPPORTED_LANGUAGES } from '../types'
import { postToExt, onExtMessage } from '../composables/useMessage'
import LanguageSelect from '../components/LanguageSelect.vue'
import { SUPPORTED_LOCALES } from '../i18n'

const { t, locale } = useI18n()

// 片段列表数据
const snippets = ref<Snippet[]>([])
// 搜索关键词
const searchQuery = ref('')
// 语言筛选值，'*' 表示全部
const languageFilter = ref('*')
// 排序方向，默认倒序（由新至旧）
const sortOrder = ref<SortOrder>('desc')

// 当前排序方向的显示文本
const currentSortLabel = computed(() => {
  return sortOrder.value === 'desc' ? t('sort.newestFirst') : t('sort.oldestFirst')
})
// 当前待删除的片段，用于弹窗确认
const deletingSnippet = ref<Snippet | null>(null)
// 通用通知状态
const notification = ref<{
  visible: boolean
  type: 'success' | 'warning' | 'error'
  message: string
}>({
  visible: false,
  type: 'error',
  message: '',
})
// 通知自动隐藏定时器
let notificationTimer: ReturnType<typeof setTimeout> | null = null

// 语言切换下拉菜单展开状态
const localeMenuOpen = ref(false)
// 语言切换下拉菜单容器引用
const localeMenuRef = ref<HTMLElement | null>(null)

// 语言切换下拉选项，每种语言用其自身名称显示
const localeOptions = computed(() =>
  SUPPORTED_LOCALES.map((l) => ({
    label: l.label,
    value: l.value,
  }))
)

// 当前选中的语言名称，用于触发器显示
const currentLocaleLabel = computed(() => {
  const found = SUPPORTED_LOCALES.find((l) => l.value === locale.value)
  return found ? found.label : '简体中文'
})

/** 切换语言，同时通知扩展持久化保存 */
function changeLocale(val: string) {
  locale.value = val
  postToExt('changeLocale', val)
  localeMenuOpen.value = false
}

/** 切换语言下拉菜单展开/收起 */
function toggleLocaleMenu() {
  localeMenuOpen.value = !localeMenuOpen.value
}

/** 切换排序方向（正序/倒序） */
function toggleSortOrder() {
  sortOrder.value = sortOrder.value === 'desc' ? 'asc' : 'desc'
}

/** 点击外部关闭语言下拉菜单 */
function handleLocaleClickOutside(e: MouseEvent) {
  if (localeMenuRef.value && !localeMenuRef.value.contains(e.target as Node)) {
    localeMenuOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleLocaleClickOutside)
  // 组件挂载时请求片段列表
  postToExt('getSnippets')
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleLocaleClickOutside)
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

  // 按语言筛选：片段的 language 字段支持逗号分隔的多语言
  if (languageFilter.value && languageFilter.value !== '*') {
    result = result.filter(
      (s) => {
        const langs = s.language.split(',').map((l: string) => l.trim())
        return langs.includes('*') || langs.includes(languageFilter.value)
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

/** 根据 language value 获取对应的 Iconify 图标名，用于列表项的语言标签 */
function getLanguageIconify(lang: string): string {
  const found = SUPPORTED_LANGUAGES.find((l) => l.value === lang)
  return found ? found.icon : 'carbon:code'
}

/** 获取语言对应的品牌色，用于语言标签的背景和边框 */
function getLanguageColor(lang: string): string {
  const colorMap: Record<string, string> = {
    javascript: '#f7df1e', typescript: '#3178c6', python: '#3776ab',
    html: '#e34f26', css: '#1572b6', json: '#292929', java: '#ed8b00',
    csharp: '#239120', cpp: '#00599c', c: '#a8b9cc', go: '#00add8',
    rust: '#dea584', php: '#777bb4', ruby: '#cc342d', swift: '#fa7343',
    kotlin: '#7f52ff', vue: '#4fc08d', javascriptreact: '#61dafb',
    typescriptreact: '#61dafb', scss: '#cc6699', less: '#1d365d',
    shellscript: '#89e051', sql: '#e38c00', yaml: '#cb171e',
    xml: '#e37933', dart: '#0175c2', lua: '#000080', r: '#276dc3',
    dockerfile: '#2496ed', markdown: '#083fa1',
  }
  return colorMap[lang] || 'var(--vscode-textPreformat-foreground)'
}

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
  deletingSnippet.value = snippet
}

/** 确认删除，发送删除消息并关闭弹窗（成功通知由后端确认后发送） */
function handleDeleteConfirm() {
  if (deletingSnippet.value) {
    postToExt('deleteSnippet', { id: deletingSnippet.value.id })
  }
  deletingSnippet.value = null
}

/** 取消删除，关闭弹窗 */
function handleDeleteCancel() {
  deletingSnippet.value = null
}

/** 显示通知提示，成功/警告3秒后自动隐藏，错误类型需手动关闭 */
function showNotification(type: 'success' | 'warning' | 'error', msg: string) {
  notification.value = { visible: true, type, message: msg }
  if (notificationTimer) {
    clearTimeout(notificationTimer)
    notificationTimer = null
  }
  // 错误通知不自动关闭，确保用户能看到完整信息
  if (type !== 'error') {
    notificationTimer = setTimeout(() => {
      notification.value.visible = false
      notificationTimer = null
    }, 3000)
  }
}

/** 显示错误通知 */
function showError(msg: string) {
  showNotification('error', msg)
}

/** 显示成功通知 */
function showSuccess(msg: string) {
  showNotification('success', msg)
}

/** 显示警告通知 */
function showWarning(msg: string) {
  showNotification('warning', msg)
}

/** 清除通知 */
function clearNotification() {
  notification.value.visible = false
  if (notificationTimer) {
    clearTimeout(notificationTimer)
    notificationTimer = null
  }
}

// 监听后端返回的片段列表数据（包括删除后自动刷新）
onExtMessage('snippetsList', (payload) => {
  snippets.value = payload as Snippet[]
})

// 监听后端返回的错误消息（使用 i18n 渲染）
onExtMessage('error', (payload) => {
  const data = payload as { errorKey: string; errorParams?: Record<string, string> }
  showError(t(data.errorKey, data.errorParams ?? {}))
})

// 导入导出确认弹窗状态
const confirmDialog = ref<{
  visible: boolean
  title: string
  content: string
  confirmLabel: string
  danger: boolean
  onConfirm: () => void
}>({
  visible: false,
  title: '',
  content: '',
  confirmLabel: '',
  danger: false,
  onConfirm: () => {},
})

/** 显示确认对话框 */
function showConfirm(options: {
  title: string
  content: string
  confirmLabel: string
  danger?: boolean
  onConfirm: () => void
}) {
  confirmDialog.value = {
    visible: true,
    title: options.title,
    content: options.content,
    confirmLabel: options.confirmLabel,
    danger: options.danger ?? false,
    onConfirm: options.onConfirm,
  }
}

/** 确认对话框 - 确认 */
function handleConfirmOk() {
  confirmDialog.value.onConfirm()
  confirmDialog.value.visible = false
}

/** 确认对话框 - 取消 */
function handleConfirmCancel() {
  confirmDialog.value.visible = false
}

/** 点击导出配置按钮 */
function handleExport() {
  if (snippets.value.length === 0) {
    showError(t('importExport.noDataToExport'))
    return
  }
  showConfirm({
    title: t('importExport.exportConfirmTitle'),
    content: t('importExport.exportConfirmContent'),
    confirmLabel: t('importExport.exportConfig'),
    onConfirm: () => {
      postToExt('exportSnippets')
    },
  })
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
  const result = payload as { success: boolean; count?: number }
  if (result.success) {
    showSuccess(t('importExport.exportSuccessDetail', { count: result.count ?? 0 }))
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
      t('importExport.importSuccessDetail', { count: result.imported })
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
</script>

<template>
  <div class="sidebar-view">
    <!-- 通用通知条 -->
    <transition name="slide-fade">
      <div v-if="notification.visible" class="notification-bar" :class="`notification-${notification.type}`">
        <span class="notification-text">{{ notification.message }}</span>
        <button class="notification-close" @click="clearNotification">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </transition>

    <!-- 顶部标题栏：图标 + 标题 + 语言切换 -->
    <div class="sidebar-header">
      <div class="header-content">
        <!-- 标题图标，使用项目 logo -->
        <div class="header-icon">
          <img src="../assets/logo.png" alt="logo" class="header-logo" />
        </div>
        <h2 class="header-title">{{ t('app.title') }}</h2>
        <!-- 语言切换下拉菜单 -->
        <div ref="localeMenuRef" class="locale-select">
          <button class="locale-btn" @click="toggleLocaleMenu">
            <Icon icon="mdi:translate" class="locale-icon" />
            {{ currentLocaleLabel }}
            <svg class="locale-arrow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <transition name="dropdown">
            <div v-if="localeMenuOpen" class="locale-dropdown">
              <div
                v-for="opt in localeOptions"
                :key="opt.value"
                class="locale-option"
                :class="{ 'is-selected': opt.value === locale }"
                @click="changeLocale(opt.value)"
              >
                <span class="locale-option-label">{{ opt.label }}</span>
                <svg v-if="opt.value === locale" class="locale-check" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
            </div>
          </transition>
        </div>
      </div>
      <!-- 新建片段按钮，与编辑页 btn-primary 风格统一 -->
      <button class="btn btn-primary create-btn" @click="handleCreate">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        {{ t('actions.create') }}
      </button>
      <!-- 导入导出按钮行 -->
      <div class="import-export-row">
        <button class="btn btn-secondary btn-sm ie-btn" @click="handleExport">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          {{ t('importExport.exportConfig') }}
        </button>
        <button class="btn btn-secondary btn-sm ie-btn" @click="handleImport">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          {{ t('importExport.importConfig') }}
        </button>
      </div>
    </div>

    <!-- 搜索框：列表为空时隐藏，与编辑页 form-input 风格统一 -->
    <div v-if="snippets.length > 0" class="sidebar-search">
      <div class="search-wrapper">
        <svg class="search-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input
          v-model="searchQuery"
          class="form-input search-input"
          :placeholder="t('list.searchPlaceholder')"
        />
        <!-- 清除按钮 -->
        <button v-if="searchQuery" class="search-clear" @click="searchQuery = ''">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>

    <!-- 语言筛选下拉：列表为空时隐藏，使用自定义组件显示图标 -->
    <div v-if="snippets.length > 0" class="sidebar-filter">
      <LanguageSelect
        v-model="languageFilter"
        :options="languageOptions"
        :placeholder="t('form.languagePlaceholder')"
      />
    </div>

    <!-- 排序切换按钮：列表为空时隐藏 -->
    <div v-if="snippets.length > 0" class="sidebar-sort">
      <button class="sort-toggle-btn" @click="toggleSortOrder" :title="currentSortLabel">
        <svg v-if="sortOrder === 'desc'" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14"/><path d="M19 12l-7 7-7-7"/></svg>
        <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14"/><path d="M5 12l7-7 7 7"/></svg>
        {{ currentSortLabel }}
      </button>
    </div>

    <!-- 片段列表区域 -->
    <div class="sidebar-list">
      <!-- 空状态：没有任何片段 -->
      <div v-if="snippets.length === 0" class="empty-state">
        <div class="empty-icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" opacity="0.3">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
          </svg>
        </div>
        <p class="empty-title">{{ t('list.empty') }}</p>
        <p class="empty-desc">{{ t('list.emptyDesc') }}</p>
      </div>

      <!-- 筛选无结果 -->
      <div v-else-if="filteredSnippets.length === 0" class="empty-state">
        <p class="empty-desc">{{ t('list.empty') }}</p>
      </div>

      <!-- 片段列表 -->
      <div v-else class="snippet-items">
        <div
          v-for="snippet in filteredSnippets"
          :key="snippet.id"
          class="snippet-item"
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
                <Icon v-if="lang !== '*'" :icon="getLanguageIconify(lang)" class="lang-badge-icon" />
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
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <!-- 删除按钮 -->
            <button class="action-btn action-btn-danger" :title="t('actions.delete')" @click.stop="handleDelete(snippet)">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 删除确认弹窗：自定义浮层，按钮与编辑页 btn 风格统一 -->
    <div v-if="deletingSnippet" class="modal-overlay" @click.self="handleDeleteCancel">
      <div class="modal-dialog">
        <div class="modal-header">
          <span class="modal-title">{{ t('delete.title') }}</span>
        </div>
        <div class="modal-body">
          <p>{{ t('delete.content', { name: deletingSnippet?.name }) }}</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary btn-sm" @click="handleDeleteCancel">{{ t('delete.cancel') }}</button>
          <button class="btn btn-danger btn-sm" @click="handleDeleteConfirm">{{ t('delete.confirm') }}</button>
        </div>
      </div>
    </div>

    <!-- 通用确认对话框（导入/导出等操作） -->
    <div v-if="confirmDialog.visible" class="modal-overlay" @click.self="handleConfirmCancel">
      <div class="modal-dialog">
        <div class="modal-header">
          <span class="modal-title">{{ confirmDialog.title }}</span>
        </div>
        <div class="modal-body">
          <p>{{ confirmDialog.content }}</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary btn-sm" @click="handleConfirmCancel">{{ t('form.cancel') }}</button>
          <button class="btn btn-sm" :class="confirmDialog.danger ? 'btn-danger' : 'btn-primary'" @click="handleConfirmOk">{{ confirmDialog.confirmLabel }}</button>
        </div>
      </div>
    </div>

    <!-- 重复片段策略选择对话框 -->
    <div v-if="duplicateDialog.visible" class="modal-overlay" @click.self="handleDuplicateCancel">
      <div class="modal-dialog modal-dialog-lg">
        <div class="modal-header">
          <span class="modal-title">{{ t('importExport.duplicateTitle') }}</span>
        </div>
        <div class="modal-body">
          <p>{{ t('importExport.duplicateContent', { count: duplicateDialog.count }) }}</p>
          <!-- 三个策略选项卡 -->
          <div class="strategy-options">
            <button class="strategy-option" @click="handleDuplicateStrategy('overwrite')">
              <div class="strategy-header">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                <span class="strategy-name">{{ t('importExport.overwrite') }}</span>
              </div>
              <span class="strategy-desc">{{ t('importExport.overwriteDesc') }}</span>
            </button>
            <button class="strategy-option" @click="handleDuplicateStrategy('skip')">
              <div class="strategy-header">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                <span class="strategy-name">{{ t('importExport.skip') }}</span>
              </div>
              <span class="strategy-desc">{{ t('importExport.skipDesc') }}</span>
            </button>
            <button class="strategy-option" @click="handleDuplicateStrategy('merge')">
              <div class="strategy-header">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><path d="M11 18H8a2 2 0 0 1-2-2V9"/></svg>
                <span class="strategy-name">{{ t('importExport.merge') }}</span>
              </div>
              <span class="strategy-desc">{{ t('importExport.mergeDesc') }}</span>
            </button>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary btn-sm" @click="handleDuplicateCancel">{{ t('form.cancel') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ===== 侧边栏整体布局 ===== */
.sidebar-view {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  position: relative;
}

/* ===== 通用通知条 ===== */
.notification-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  font-size: 12px;
  border-bottom: 1px solid;
}

.notification-bar.notification-error {
  background: rgba(244, 135, 113, 0.15);
  border-bottom-color: rgba(244, 135, 113, 0.3);
  color: var(--vscode-errorForeground, #f48771);
}

.notification-bar.notification-warning {
  background: rgba(234, 179, 8, 0.15);
  border-bottom-color: rgba(234, 179, 8, 0.3);
  color: var(--vscode-notificationsWarningIcon-foreground, #cca700);
}

.notification-bar.notification-success {
  background: rgba(95, 189, 126, 0.15);
  border-bottom-color: rgba(95, 189, 126, 0.3);
  color: var(--vscode-notificationsInfoIcon-foreground, #3794ff);
}

.notification-text {
  flex: 1;
  min-width: 0;
  /* 允许长文本换行显示，避免被截断 */
  overflow-wrap: break-word;
  word-break: break-all;
  line-height: 1.4;
}

.notification-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  border-radius: 3px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  flex-shrink: 0;
  margin-left: 8px;
  opacity: 0.7;
}

.notification-close:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.1);
}

/* 错误提示动画 */
.slide-fade-enter-active {
  transition: all 0.2s ease-out;
}

.slide-fade-leave-active {
  transition: all 0.15s ease-in;
}

.slide-fade-enter-from {
  transform: translateY(-4px);
  opacity: 0;
}

.slide-fade-leave-to {
  transform: translateY(-2px);
  opacity: 0;
}

/* ===== 顶部标题栏 ===== */
.sidebar-header {
  padding: 16px 14px 12px;
  border-bottom: 1px solid var(--vscode-panel-border, rgba(255,255,255,0.06));
}

.header-content {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

/* 标题图标，与编辑页 header-icon 风格统一 */
.header-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 7px;
  background: linear-gradient(135deg, #0e639c, #1177bb);
  color: #fff;
  flex-shrink: 0;
  overflow: hidden;
}

/* logo 图片自适应容器 */
.header-logo {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.header-title {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: var(--vscode-editor-foreground);
  letter-spacing: -0.2px;
  flex: 1;
}

/* 语言切换下拉菜单容器 */
.locale-select {
  position: relative;
  flex-shrink: 0;
}

/* 语言切换触发按钮，保持原有尺寸 */
.locale-btn {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 3px 8px;
  border: 1px solid var(--vscode-input-border, rgba(255,255,255,0.12));
  border-radius: 4px;
  background: transparent;
  color: var(--vscode-descriptionForeground);
  font-size: 10px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: background-color 0.15s, border-color 0.15s;
  letter-spacing: 0.3px;
}

/* 语言切换按钮中的翻译图标 */
.locale-icon {
  font-size: 13px;
  flex-shrink: 0;
}

.locale-btn:hover {
  background: var(--vscode-toolbar-hoverBackground, rgba(255,255,255,0.08));
  border-color: var(--vscode-focusBorder, #007fd4);
}

/* 下拉箭头 */
.locale-arrow {
  flex-shrink: 0;
  opacity: 0.6;
  transition: transform 0.2s;
}

.locale-select .locale-btn:has(~ .locale-dropdown) .locale-arrow,
.locale-select .locale-arrow {
  transform: rotate(0deg);
}

/* 语言下拉菜单面板 */
.locale-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  z-index: 1000;
  min-width: 120px;
  border: 1px solid var(--vscode-dropdown-border, rgba(255,255,255,0.12));
  border-radius: 6px;
  background: var(--vscode-editorWidget-background, #252526);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  padding: 4px;
}

/* 语言选项 */
.locale-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 5px 10px;
  border-radius: 4px;
  cursor: pointer;
  color: var(--vscode-editor-foreground);
  font-size: 12px;
  transition: background-color 0.1s;
}

.locale-option:hover {
  background: var(--vscode-list-hoverBackground, rgba(255,255,255,0.08));
}

/* 已选中状态 */
.locale-option.is-selected {
  color: var(--vscode-list-activeSelectionForeground, #fff);
  font-weight: 600;
}

.locale-option-label {
  flex: 1;
}

/* 选中勾号 */
.locale-check {
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

/* 新建按钮，与编辑页 btn-primary 统一 */
.create-btn {
  width: 100%;
  justify-content: center;
}

/* 导入导出按钮行 */
.import-export-row {
  display: flex;
  gap: 6px;
  margin-top: 6px;
}

/* 导入导出按钮，等分宽度 */
.ie-btn {
  flex: 1;
  justify-content: center;
  font-size: 11px;
}

/* ===== 搜索框 ===== */
.sidebar-search {
  padding: 10px 14px 4px;
}

.search-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 10px;
  color: var(--vscode-descriptionForeground);
  pointer-events: none;
}

.search-input {
  padding-left: 30px !important;
  padding-right: 28px !important;
}

/* 搜索清除按钮 */
.search-clear {
  position: absolute;
  right: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: 3px;
  background: transparent;
  color: var(--vscode-descriptionForeground);
  cursor: pointer;
  transition: background-color 0.15s;
}

.search-clear:hover {
  background: var(--vscode-toolbar-hoverBackground, rgba(255,255,255,0.08));
  color: var(--vscode-editor-foreground);
}

/* ===== 语言筛选下拉 ===== */
.sidebar-filter {
  padding: 4px 14px 8px;
}

/* ===== 排序切换按钮 ===== */
.sidebar-sort {
  padding: 0 14px 8px;
}

.sort-toggle-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  padding: 4px 8px;
  border: 1px solid var(--vscode-dropdown-border, #3c3c3c);
  border-radius: 3px;
  background: var(--vscode-dropdown-background, #3c3c3c);
  color: var(--vscode-dropdown-foreground, #cccccc);
  font-size: 11px;
  cursor: pointer;
  font-family: inherit;
  line-height: 1.4;
  transition: background 0.15s;
}

.sort-toggle-btn:hover {
  background: var(--vscode-list-hoverBackground, #2a2d2e);
}

/* ===== 片段列表 ===== */
.sidebar-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 8px 8px;
}

/* 空状态居中展示 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 16px;
  text-align: center;
}

.empty-icon {
  margin-bottom: 14px;
  color: var(--vscode-editor-foreground);
}

.empty-title {
  margin: 0 0 4px;
  font-size: 14px;
  font-weight: 600;
  color: var(--vscode-editor-foreground);
  opacity: 0.7;
}

.empty-desc {
  margin: 0;
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
  line-height: 1.6;
}

/* 列表项容器 */
.snippet-items {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* 单个片段项 */
.snippet-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: default;
  transition: background-color 0.15s ease;
}

.snippet-item:hover {
  background-color: var(--vscode-list-hoverBackground, rgba(255,255,255,0.04));
}

/* 片段信息区域 */
.item-main {
  flex: 1;
  min-width: 0;
}

/* 名称行 */
.item-top {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 3px;
}

.item-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--vscode-editor-foreground);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 语言标签 */
.lang-badge {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  font-weight: 600;
  padding: 0 5px;
  border-radius: 3px;
  border: 1px solid;
  line-height: 16px;
  letter-spacing: 0.3px;
}

/* 语言标签内的图标 */
.lang-badge-icon {
  font-size: 11px;
}

/* 语言标签内的文本 */
.lang-badge-text {
  font-size: 9px;
  text-transform: uppercase;
}

/* 元信息行 */
.item-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

/* 触发前缀 */
.item-prefix {
  flex-shrink: 0;
  font-size: 11px;
  font-family: var(--vscode-editor-font-family, 'Cascadia Code', Consolas, monospace);
  background-color: var(--vscode-textCodeBlock-background, rgba(255,255,255,0.06));
  color: var(--vscode-textPreformat-foreground);
  padding: 1px 5px;
  border-radius: 3px;
}

/* 描述文本 */
.item-desc {
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ===== 操作按钮区 ===== */
.item-actions {
  flex-shrink: 0;
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.snippet-item:hover .item-actions {
  opacity: 1;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: var(--vscode-editor-foreground);
  opacity: 0.6;
  cursor: pointer;
  transition: background-color 0.15s, opacity 0.15s, color 0.15s;
}

.action-btn:hover {
  background: var(--vscode-toolbar-hoverBackground, rgba(255,255,255,0.08));
  opacity: 1;
}

/* 删除按钮悬浮变红 */
.action-btn-danger:hover {
  color: var(--vscode-errorForeground, #f48771);
  background: rgba(244, 135, 113, 0.1);
}

/* ===== 删除确认弹窗 ===== */
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
}

.modal-dialog {
  width: 320px;
  max-width: 90%;
  background: var(--vscode-editorWidget-background, #252526);
  border: 1px solid var(--vscode-panel-border, rgba(255,255,255,0.1));
  border-radius: 8px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
  overflow: hidden;
}

.modal-header {
  padding: 16px 18px 0;
}

.modal-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--vscode-editor-foreground);
}

.modal-body {
  padding: 12px 18px 18px;
}

.modal-body p {
  margin: 0;
  font-size: 13px;
  color: var(--vscode-descriptionForeground);
  line-height: 1.6;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 14px 18px;
  border-top: 1px solid var(--vscode-panel-border, rgba(255,255,255,0.06));
}

/* 重复策略对话框加宽 */
.modal-dialog-lg {
  width: 400px;
}

/* 策略选项列表 */
.strategy-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
}

/* 单个策略选项按钮 */
.strategy-option {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 14px;
  border: 1px solid var(--vscode-input-border, rgba(255,255,255,0.12));
  border-radius: 6px;
  background: var(--vscode-input-background, rgba(255,255,255,0.04));
  color: var(--vscode-editor-foreground);
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  transition: background-color 0.15s, border-color 0.15s;
}

.strategy-option:hover {
  background: var(--vscode-list-hoverBackground, rgba(255,255,255,0.08));
  border-color: var(--vscode-focusBorder, #007fd4);
}

/* 策略选项标题行：图标 + 名称 */
.strategy-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.strategy-name {
  font-size: 13px;
  font-weight: 600;
}

/* 策略选项描述文字 */
.strategy-desc {
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
  padding-left: 24px;
}

/* ===== 共享样式：与编辑页统一 ===== */

/* 输入框，与编辑页 form-input 统一 */
.form-input {
  width: 100%;
  padding: 7px 10px;
  border: 1px solid var(--vscode-input-border, rgba(255,255,255,0.12));
  border-radius: 6px;
  background: var(--vscode-input-background, rgba(255,255,255,0.04));
  color: var(--vscode-input-foreground, var(--vscode-editor-foreground));
  font-size: 13px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.form-input::placeholder {
  color: var(--vscode-input-placeholderForeground, rgba(255,255,255,0.3));
}

.form-input:focus {
  border-color: var(--vscode-focusBorder, #007fd4);
  box-shadow: 0 0 0 1px var(--vscode-focusBorder, #007fd4);
}

/* 按钮基础样式，与编辑页 btn 统一 */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 20px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: background-color 0.2s, opacity 0.2s, transform 0.1s;
  outline: none;
}

.btn:active {
  transform: scale(0.97);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* 小号按钮，用于弹窗 */
.btn-sm {
  padding: 5px 14px;
  font-size: 12px;
}

/* 主要按钮 */
.btn-primary {
  background: var(--vscode-button-background, #0e639c);
  color: var(--vscode-button-foreground, #fff);
  box-shadow: 0 1px 4px rgba(14, 99, 156, 0.3);
}

.btn-primary:hover {
  background: var(--vscode-button-hoverBackground, #1177bb);
}

/* 次要按钮 */
.btn-secondary {
  background: var(--vscode-button-secondaryBackground, #3a3d41);
  color: var(--vscode-button-secondaryForeground, #fff);
}

.btn-secondary:hover {
  background: var(--vscode-button-secondaryHoverBackground, #45494e);
}

/* 危险按钮 */
.btn-danger {
  background: rgba(244, 135, 113, 0.15);
  color: var(--vscode-errorForeground, #f48771);
}

.btn-danger:hover {
  background: rgba(244, 135, 113, 0.25);
}
</style>
