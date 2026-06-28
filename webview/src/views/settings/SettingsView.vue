<!-- 设置页面组件：语言设置、快捷键说明、关于信息 -->
<script setup lang="ts">
/**
 * 设置页面
 * 包含语言设置、快捷键说明、关于页面
 * 语言设置支持自动检测（跟随 VS Code 语言）和手动选择
 */
import { Icon } from '@iconify/vue'
import { postToExt, onExtMessage } from '../../composables/useMessage'
import { useConfirm } from '../../composables/useConfirm'
import { useNotification } from '../../composables/useNotification'
import { SUPPORTED_LOCALES } from '../../i18n'

const { t } = useI18n()
const { confirmState, showConfirm, handleConfirmOk, handleConfirmCancel } = useConfirm()
const { notification, showSuccess, showWarning, showError, clearNotification } = useNotification()

// 从后端注入的全局变量读取版本号和存储路径
const appVersion = window.__APP_VERSION || '0.0.0'
const storagePath = window.__STORAGE_PATH || ''

// 插件信息常量
const APP_NAME = 'Custom Snippet Manager'
const GITHUB_URL = 'https://github.com/horyce/vscode-custom-snippet-manager'
const LICENSE = 'MIT'

// 语言设置相关 props
const props = defineProps<{
  /** 当前语言来源 */
  localeSource: 'auto' | 'manual'
  /** 当前生效的语言 */
  currentLocale: string
}>()

// 语言设置相关 emits
const emit = defineEmits<{
  back: []
  changeLocale: [locale: string]
  resetLocaleToAuto: []
}>()

// 语言下拉选项，适配 BaseSelect 组件格式
const localeSelectOptions = computed(() =>
  SUPPORTED_LOCALES.map((l) => ({
    label: l.label,
    value: l.value,
    icon: `circle-flags:${l.flag}`,
  }))
)

// 当前语言的显示名称
const currentLocaleLabel = computed(() => {
  const found = SUPPORTED_LOCALES.find(l => l.value === props.currentLocale)
  return found ? found.label : props.currentLocale
})

/** 在外部浏览器中打开链接 */
function openExternal(url: string) {
  postToExt('openExternal', url)
}

/** 打开代码片段存储目录 */
function openSnippetsDirectory() {
  postToExt('openSnippetsDirectory')
}

/** 点击清空数据按钮，弹出二次确认 */
function handleClearAll() {
  showConfirm({
    title: t('clearAll.title'),
    content: t('clearAll.content'),
    confirmLabel: t('clearAll.confirm'),
    cancelLabel: t('clearAll.cancel'),
    danger: true,
    onConfirm: () => {
      postToExt('clearAllSnippets')
    },
  })
}

/** 备份导出中状态 */
const backupLoading = ref(false)

/** 是否为 macOS（用于显示不同的快捷键） */
const isMac = ref(false)

/** 快捷键列表 */
const shortcuts = computed(() => [
  { key: 'insertSnippet', keys: isMac.value ? '⌘⌥I' : 'Ctrl+Alt+I', when: t('settings.whenEditorFocus') },
  { key: 'triggerCompletion', keys: isMac.value ? '⌘⌥Space' : 'Ctrl+Alt+Space', when: t('settings.whenEditorFocus') },
  { key: 'saveSelectionToSnippet', keys: t('settings.contextMenu'), when: t('settings.whenTextSelected') },
])

/** 检测平台 */
onMounted(() => {
  isMac.value = navigator.platform.toUpperCase().includes('MAC')
})

/** 点击备份全部数据按钮 */
function handleBackupAll() {
  backupLoading.value = true
  postToExt('exportAllBackup')
}

// 监听备份导出结果
onExtMessage('exportBackupResult', (payload) => {
  const result = payload as { success: boolean; folderCount?: number; count?: number }
  backupLoading.value = false
  if (result.success) {
    showSuccess(t('backup.success', { folderCount: result.folderCount, count: result.count }))
  } else {
    showError(t('backup.failed'))
  }
})

// 监听后端发送的通知消息（清空数据成功等）
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
</script>

<template>
  <div class="settings-view">
    <!-- 顶部导航栏 -->
    <div class="settings-header">
      <button class="back-btn" @click="emit('back')">
        <Icon icon="carbon:chevron-left" width="16" height="16" />
        {{ t('settings.back') }}
      </button>
      <h2 class="settings-title">{{ t('settings.title') }}</h2>
    </div>

    <!-- 关于页面 -->
    <div class="about-section">
      <!-- 插件 Logo 和名称 -->
      <div class="about-brand">
        <div class="about-logo">
          <img src="../../assets/logo.png" alt="logo" class="about-logo-img" />
        </div>
        <h3 class="about-name">{{ APP_NAME }}</h3>
        <span class="about-version">v{{ appVersion }}</span>
      </div>

      <!-- 语言设置区域 -->
      <div class="locale-section">
        <h4 class="section-title">{{ t('settings.language') }}</h4>
        <div class="locale-setting">
          <!-- 语言来源指示 -->
          <div class="locale-source-row">
            <span class="locale-source-label">{{ currentLocaleLabel }}</span>
            <span class="locale-source-badge" :class="localeSource">
              {{ localeSource === 'auto' ? t('settings.localeAuto') : t('settings.localeManual') }}
            </span>
          </div>
          <!-- 语言选择下拉 -->
          <BaseSelect
            :model-value="currentLocale"
            :options="localeSelectOptions"
            class="locale-select-full"
            @update:model-value="emit('changeLocale', $event)"
          />
          <!-- 重置为自动检测按钮 -->
          <button
            v-if="localeSource === 'manual'"
            class="reset-locale-btn"
            @click="emit('resetLocaleToAuto')"
          >
            <Icon icon="carbon:reset" width="14" height="14" />
            {{ t('settings.resetToAuto') }}
          </button>
        </div>
      </div>

      <!-- 信息列表 -->
      <div class="about-info">
        <div class="info-item">
          <span class="info-label">{{ t('settings.version') }}</span>
          <span class="info-value">v{{ appVersion }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">{{ t('settings.license') }}</span>
          <span class="info-value">{{ LICENSE }}</span>
        </div>
        <div class="info-item clickable" @click="openExternal(GITHUB_URL)">
          <span class="info-label">{{ t('settings.repository') }}</span>
          <span class="info-value info-link">
            <Icon icon="mdi:github" class="info-icon" />
            GitHub
            <Icon icon="carbon:launch" width="10" height="10" />
          </span>
        </div>
        <div class="info-item clickable" @click="openExternal(GITHUB_URL + '/issues')">
          <span class="info-label">{{ t('settings.feedback') }}</span>
          <span class="info-value info-link">
            <Icon icon="mdi:message-text-outline" class="info-icon" />
            GitHub Issues
            <Icon icon="carbon:launch" width="10" height="10" />
          </span>
        </div>
      </div>

      <!-- 快捷键说明 -->
      <div class="shortcuts-section">
        <h4 class="section-title">{{ t('settings.shortcuts') }}</h4>
        <div class="shortcuts-list">
          <div v-for="item in shortcuts" :key="item.key" class="shortcut-item">
            <span class="shortcut-desc">{{ t('settings.shortcut_' + item.key) }}</span>
            <div class="shortcut-right">
              <kbd class="shortcut-key">{{ item.keys }}</kbd>
              <span v-if="item.when" class="shortcut-when">{{ item.when }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 存储路径 -->
      <div v-if="storagePath" class="storage-path-section">
        <span class="storage-path-label">{{ t('settings.storagePath') }}</span>
        <span class="storage-path-value" :title="storagePath">{{ storagePath }}</span>
      </div>

      <!-- 打开代码片段目录按钮 -->
      <BaseButton variant="secondary" icon="carbon:folder" block class="open-dir-btn" @click="openSnippetsDirectory">
        {{ t('settings.openDirectory') }}
      </BaseButton>

      <!-- 数据管理区域 -->
      <div class="data-management-section">
        <BaseButton variant="primary" icon="carbon:download" block :loading="backupLoading" @click="handleBackupAll">
          {{ t('settings.backupAllData') }}
        </BaseButton>
        <BaseButton variant="danger" icon="carbon:trash-can" block @click="handleClearAll">
          {{ t('settings.clearAllData') }}
        </BaseButton>
      </div>

      <!-- 底部说明 -->
      <div class="about-footer">
        <p class="about-desc">{{ t('settings.description') }}</p>
      </div>
    </div>

    <!-- 清空数据二次确认弹窗 -->
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

    <!-- 通知条 -->
    <NotificationBar
      :visible="notification.visible"
      :type="notification.type"
      :message="notification.message"
      :auto-hide="notification.autoHide"
      @close="clearNotification"
    />
  </div>
</template>

<style scoped lang="scss">
.settings-view {
  @include flex-column;
  height: 100vh;
  overflow-y: auto;
}

.settings-header {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  padding: 14px;
  border-bottom: 1px solid $border-panel;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: $spacing-xs;
  padding: $spacing-xs $spacing-sm;
  border: none;
  border-radius: $radius-sm;
  background: transparent;
  color: $color-description;
  font-size: $font-size-sm;
  font-family: inherit;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;

  &:hover {
    background: $bg-hover;
    color: $color-foreground;
  }
}

.settings-title {
  margin: 0;
  font-size: $font-size-lg;
  font-weight: 700;
  color: $color-foreground;
}

.about-section {
  @include flex-column;
  align-items: center;
  padding: $spacing-xl $spacing-lg;
}

.about-brand {
  @include flex-column;
  align-items: center;
  gap: $spacing-sm;
  margin-bottom: $spacing-xl;
}

.about-logo {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  background: $gradient-primary;
  overflow: hidden;
  box-shadow: $shadow-logo;
}

.about-logo-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.about-name {
  margin: 0;
  font-size: $font-size-lg;
  font-weight: 700;
  color: $color-foreground;
}

.about-version {
  font-size: $font-size-sm;
  color: $color-description;
  background: $bg-input;
  padding: 2px 10px;
  border-radius: 10px;
  border: 1px solid $border-input;
}

.about-info {
  width: 100%;
  @include flex-column;
  gap: 2px;
  margin-bottom: $spacing-xl;
}

// ===== 语言设置 =====
.locale-section {
  width: 100%;
  margin-bottom: $spacing-xl;
}

.locale-setting {
  @include flex-column;
  gap: $spacing-sm;
  padding: 0 14px;
}

.locale-source-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.locale-source-label {
  font-size: $font-size-base;
  color: $color-foreground;
  font-weight: 500;
}

.locale-source-badge {
  font-size: $font-size-xs;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 500;

  &.auto {
    color: var(--vscode-notificationsInfoIcon-foreground, #3794ff);
    background: rgba(55, 148, 255, 0.12);
  }

  &.manual {
    color: var(--vscode-notificationsWarningIcon-foreground, #cca700);
    background: rgba(204, 167, 0, 0.12);
  }
}

.locale-select-full {
  width: 100%;
}

.reset-locale-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: $spacing-xs;
  padding: $spacing-xs $spacing-sm;
  border: 1px solid $border-input;
  border-radius: $radius-sm;
  background: transparent;
  color: $color-description;
  font-size: $font-size-sm;
  font-family: inherit;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s, border-color 0.15s;

  &:hover {
    background: $bg-hover;
    color: $color-foreground;
    border-color: $color-foreground;
  }
}

.info-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-radius: $radius-md;

  &.clickable {
    cursor: pointer;
    transition: background-color 0.15s;

    &:hover {
      background: $bg-list-hover;

      .info-link {
        color: $color-link-active;
      }
    }
  }
}

.info-label {
  font-size: $font-size-base;
  color: $color-foreground;
}

.info-value {
  font-size: $font-size-base;
  color: $color-description;
}

.info-link {
  display: flex;
  align-items: center;
  gap: 5px;
  color: $color-link;
}

.info-icon {
  font-size: $font-size-lg;
}

.storage-path-section {
  @include info-panel;
}

// ===== 快捷键说明 =====
.shortcuts-section {
  width: 100%;
  margin-bottom: $spacing-xl;
}

.section-title {
  margin: 0 0 $spacing-sm;
  padding: 0 14px;
  font-size: $font-size-sm;
  font-weight: 600;
  color: $color-description;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.shortcuts-list {
  @include flex-column;
  gap: 2px;
}

.shortcut-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  border-radius: $radius-md;
  gap: $spacing-sm;
}

.shortcut-desc {
  font-size: $font-size-base;
  color: $color-foreground;
  flex: 1;
  min-width: 0;
}

.shortcut-right {
  display: flex;
  align-items: center;
  gap: $spacing-xs;
  flex-shrink: 0;
}

.shortcut-key {
  @include code-text;
  font-size: $font-size-xs;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid $border-input;
  background: $bg-code-block;
  white-space: nowrap;
}

.shortcut-when {
  font-size: $font-size-xs;
  color: $color-description;
  opacity: 0.7;
  white-space: nowrap;
}

.storage-path-label {
  font-size: $font-size-xs;
  color: $color-description;
}

.storage-path-value {
  font-size: $font-size-sm;
  @include code-text;
  word-break: break-all;
  line-height: 1.5;
}

.open-dir-btn {
  margin-bottom: $spacing-md;
}

.data-management-section {
  @include flex-column;
  gap: $spacing-sm;
  width: 100%;
  margin-bottom: $spacing-xl;
}

.about-footer {
  width: 100%;
  text-align: center;
}

.about-desc {
  margin: 0;
  font-size: $font-size-xs;
  color: $color-description;
  opacity: 0.7;
  line-height: 1.6;
}
</style>
