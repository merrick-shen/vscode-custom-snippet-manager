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
import type { Snippet, SortOrder } from '../types'
import { SUPPORTED_LANGUAGES, getLanguageColor, getLanguageIcon } from '../utils/languages'
import { postToExt, onExtMessage } from '../composables/useMessage'
import { useNotification } from '../composables/useNotification'
import { useConfirm } from '../composables/useConfirm'
import { highlightCodeString } from '../utils/codemirror-langs'
import LanguageSelect from '../components/LanguageSelect.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import NotificationBar from '../components/NotificationBar.vue'
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

// 语言切换下拉菜单展开状态
const localeMenuOpen = ref(false)
// 语言切换下拉菜单容器引用
const localeMenuRef = ref<HTMLElement | null>(null)

// 语言切换下拉选项，每种语言用其自身名称和国旗显示
const localeOptions = computed(() =>
  SUPPORTED_LOCALES.map((l) => ({
    label: l.label,
    value: l.value,
    flag: l.flag,
  }))
)

// 当前选中语言的国旗图标名，用于触发器显示
const currentLocaleFlag = computed(() => {
  const found = SUPPORTED_LOCALES.find((l) => l.value === locale.value)
  return found ? `circle-flags:${found.flag}` : 'circle-flags:us'
})

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

/** 切换排序方向（正序/倒序），并通知后端持久化保存 */
function toggleSortOrder() {
  sortOrder.value = sortOrder.value === 'desc' ? 'asc' : 'desc'
  postToExt('changeSortOrder', sortOrder.value)
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

// 监听后端返回的错误消息（使用 i18n 渲染）
onExtMessage('error', (payload) => {
  const data = payload as { errorKey: string; errorParams?: Record<string, string> }
  showError(t(data.errorKey, data.errorParams ?? {}))
})

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
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        </button>
        <!-- 语言切换下拉菜单 -->
        <div ref="localeMenuRef" class="locale-select">
          <button class="locale-btn" @click="toggleLocaleMenu">
            <Icon :icon="currentLocaleFlag" class="locale-flag" />
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
                <Icon :icon="`circle-flags:${opt.flag}`" class="locale-option-flag" />
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
        multiple
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
    <div class="sidebar-list" @scroll="handleListScroll">
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
}

.locale-btn {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 3px $spacing-sm;
  border: 1px solid $border-input;
  border-radius: $radius-sm;
  background: transparent;
  color: $color-description;
  font-size: 10px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: background-color 0.15s, border-color 0.15s;
  letter-spacing: 0.3px;

  &:hover {
    background: $bg-hover;
    border-color: $color-focus;
  }
}

.locale-flag {
  font-size: $font-size-lg;
  line-height: 1;
  flex-shrink: 0;
}

.locale-arrow {
  flex-shrink: 0;
  opacity: 0.6;
  transition: transform 0.2s;
}

.locale-dropdown {
  @include dropdown-panel;
  top: calc(100% + 4px);
  right: 0;
  min-width: 160px;
}

.locale-option {
  @include dropdown-option;
  justify-content: space-between;
}

.locale-option-flag {
  font-size: 16px;
  line-height: 1;
  flex-shrink: 0;
}

.locale-option-label {
  flex: 1;
}

.locale-check {
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

.search-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 10px;
  color: $color-description;
  pointer-events: none;
}

.search-input {
  padding-left: 30px !important;
  padding-right: 28px !important;
}

.search-clear {
  @include flex-center;
  position: absolute;
  right: 6px;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: $radius-sm;
  background: transparent;
  color: $color-description;
  cursor: pointer;
  transition: background-color 0.15s;

  &:hover {
    background: $bg-hover;
    color: $color-foreground;
  }
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

.empty-icon {
  margin-bottom: 14px;
  color: $color-foreground;
}

.empty-title {
  margin: 0 0 $spacing-xs;
  font-size: $font-size-lg;
  font-weight: 600;
  color: $color-foreground;
  opacity: 0.7;
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

// ===== 弹窗样式（重复策略弹窗使用） =====
.modal-overlay {
  @include modal-overlay;
}

.modal-dialog {
  @include modal-dialog;
}

.modal-header {
  @include modal-header;
}

.modal-title {
  @include modal-title;
}

.modal-body {
  @include modal-body;
}

.modal-footer {
  @include modal-footer;
}

.modal-dialog-lg {
  width: 400px;
}

.strategy-options {
  @include flex-column;
  gap: $spacing-sm;
  margin-top: $spacing-md;
}

.strategy-option {
  @include flex-column;
  gap: $spacing-xs;
  padding: 10px 14px;
  border: 1px solid $border-input;
  border-radius: $radius-md;
  background: $bg-input;
  color: $color-foreground;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  transition: background-color 0.15s, border-color 0.15s;

  &:hover {
    background: $bg-list-hover;
    border-color: $color-focus;
  }
}

.strategy-header {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
}

.strategy-name {
  font-size: $font-size-base;
  font-weight: 600;
}

.strategy-desc {
  font-size: $font-size-xs;
  color: $color-description;
  padding-left: 24px;
}

// ===== 共享样式 =====
.form-input {
  @include input-base;
}

.btn {
  @include btn-base;
}

.btn-sm {
  @include btn-sm;
}

.btn-primary {
  @include btn-primary;
}

.btn-secondary {
  @include btn-secondary;
}

.btn-danger {
  @include btn-danger;
}
</style>
