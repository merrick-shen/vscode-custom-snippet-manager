<!-- 设置页面组件：当前仅包含"关于"信息，为后续设置功能预留入口 -->
<script setup lang="ts">
/**
 * 设置页面
 * 包含关于页面，展示插件名称、版本号、GitHub 地址等基础信息
 * 后续可扩展实际设置功能
 */
import { Icon } from '@iconify/vue'
import { postToExt, onExtMessage } from '../composables/useMessage'
import { useConfirm } from '../composables/useConfirm'
import { useNotification } from '../composables/useNotification'

const { t } = useI18n()
const { confirmState, showConfirm, handleConfirmOk, handleConfirmCancel } = useConfirm()
const { notification, showSuccess, showError, clearNotification } = useNotification()

// 从后端注入的全局变量读取版本号和存储路径
const appVersion = window.__APP_VERSION || '0.0.0'
const storagePath = window.__STORAGE_PATH || ''

// 插件信息常量
const APP_NAME = 'Custom Snippet Manager'
const GITHUB_URL = 'https://github.com/horyce/vscode-custom-snippet-manager'
const LICENSE = 'MIT'

/** 在外部浏览器中打开链接 */
function openExternal(url: string) {
  if (window.vscode) {
    window.vscode.postMessage({ type: 'openExternal', payload: url })
  }
}

/** 打开代码片段存储目录 */
function openSnippetsDirectory() {
  if (window.vscode) {
    window.vscode.postMessage({ type: 'openSnippetsDirectory' })
  }
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

// 定义 emit，用于返回上一页
const emit = defineEmits<{
  back: []
}>()
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
          <img src="../assets/logo.png" alt="logo" class="about-logo-img" />
        </div>
        <h3 class="about-name">{{ APP_NAME }}</h3>
        <span class="about-version">v{{ appVersion }}</span>
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

      <!-- 存储路径 -->
      <div v-if="storagePath" class="storage-path-section">
        <span class="storage-path-label">{{ t('settings.storagePath') }}</span>
        <span class="storage-path-value" :title="storagePath">{{ storagePath }}</span>
      </div>

      <!-- 打开代码片段目录按钮 -->
      <button class="open-dir-btn" @click="openSnippetsDirectory">
        <Icon icon="carbon:folder" width="14" height="14" />
        {{ t('settings.openDirectory') }}
      </button>

      <!-- 数据管理区域 -->
      <div class="data-management-section">
        <button class="backup-all-btn" :disabled="backupLoading" @click="handleBackupAll">
          <Icon icon="carbon:download" width="14" height="14" />
          {{ backupLoading ? t('backup.exporting') : t('settings.backupAllData') }}
        </button>
        <button class="clear-all-btn" @click="handleClearAll">
          <Icon icon="carbon:trash-can" width="14" height="14" />
          {{ t('settings.clearAllData') }}
        </button>
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
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: $spacing-sm $spacing-lg;
  margin-bottom: $spacing-md;
  border: 1px solid $border-button;
  border-radius: $radius-md;
  background: $btn-secondary-bg;
  color: $btn-secondary-fg;
  font-size: $font-size-base;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background: $btn-secondary-hover;
  }
}

.data-management-section {
  @include flex-column;
  gap: $spacing-sm;
  width: 100%;
  margin-bottom: $spacing-xl;
}

.backup-all-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: $spacing-sm $spacing-lg;
  border: 1px solid $border-button;
  border-radius: $radius-md;
  background: $btn-primary-bg;
  color: $btn-primary-fg;
  font-size: $font-size-base;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: background-color 0.2s, opacity 0.2s;

  &:hover:not(:disabled) {
    background: $btn-primary-hover;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.clear-all-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: $spacing-sm $spacing-lg;
  border: 1px solid rgba(244, 135, 113, 0.3);
  border-radius: $radius-md;
  background: rgba(244, 135, 113, 0.1);
  color: $color-error;
  font-size: $font-size-base;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: background-color 0.2s, border-color 0.2s;

  &:hover {
    background: rgba(244, 135, 113, 0.2);
    border-color: rgba(244, 135, 113, 0.5);
  }
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
