<!-- 设置页面组件：当前仅包含"关于"信息，为后续设置功能预留入口 -->
<script setup lang="ts">
/**
 * 设置页面
 * 包含关于页面，展示插件名称、版本号、GitHub 地址等基础信息
 * 后续可扩展实际设置功能
 */
import { useI18n } from 'vue-i18n'
import { Icon } from '@iconify/vue'

const { t } = useI18n()

// 从后端注入的全局变量读取版本号和存储路径
const appVersion = window.__APP_VERSION || '0.0.0'
const storagePath = window.__STORAGE_PATH || ''

// 插件信息常量
const APP_NAME = 'Custom Snippet Manager'
const GITHUB_URL = 'https://github.com/horyce/vscode-custom-snippet-manager'
const LICENSE = 'MIT'

/** 在外部浏览器中打开链接 */
function openExternal(url: string) {
  // Webview 中无法直接使用 window.open，需要通过 VS Code 命令打开
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
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
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
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </span>
        </div>
        <div class="info-item clickable" @click="openExternal(GITHUB_URL + '/issues')">
          <span class="info-label">{{ t('settings.feedback') }}</span>
          <span class="info-value info-link">
            <Icon icon="mdi:message-text-outline" class="info-icon" />
            GitHub Issues
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
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
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        {{ t('settings.openDirectory') }}
      </button>

      <!-- 底部说明 -->
      <div class="about-footer">
        <p class="about-desc">{{ t('settings.description') }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 设置页面整体布局 */
.settings-view {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow-y: auto;
}

/* 顶部导航栏 */
.settings-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px;
  border-bottom: 1px solid var(--vscode-panel-border, rgba(255,255,255,0.06));
}

/* 返回按钮 */
.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
}

.back-btn:hover {
  background: var(--vscode-toolbar-hoverBackground, rgba(255,255,255,0.08));
  color: var(--vscode-editor-foreground);
}

/* 页面标题 */
.settings-title {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: var(--vscode-editor-foreground);
}

/* 关于区域 */
.about-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 16px;
}

/* 品牌：Logo + 名称 + 版本 */
.about-brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  margin-bottom: 24px;
}

/* Logo 容器 */
.about-logo {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  background: linear-gradient(135deg, #0e639c, #1177bb);
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(14, 99, 156, 0.3);
}

.about-logo-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

/* 插件名称 */
.about-name {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--vscode-editor-foreground);
}

/* 版本号标签 */
.about-version {
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
  background: var(--vscode-input-background, rgba(255,255,255,0.04));
  padding: 2px 10px;
  border-radius: 10px;
  border: 1px solid var(--vscode-input-border, rgba(255,255,255,0.12));
}

/* 信息列表 */
.about-info {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 24px;
}

/* 单条信息 */
.info-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-radius: 6px;
}

/* 可点击的信息行 */
.info-item.clickable {
  cursor: pointer;
  transition: background-color 0.15s;
}

.info-item.clickable:hover {
  background: var(--vscode-list-hoverBackground, rgba(255,255,255,0.04));
}

/* 信息标签 */
.info-label {
  font-size: 13px;
  color: var(--vscode-editor-foreground);
}

/* 信息值 */
.info-value {
  font-size: 13px;
  color: var(--vscode-descriptionForeground);
}

/* 链接样式 */
.info-link {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--vscode-textLink-foreground, #3794ff);
}

.info-item.clickable:hover .info-link {
  color: var(--vscode-textLink-activeForeground, #4bb0ff);
}

/* 链接图标 */
.info-icon {
  font-size: 14px;
}

/* 底部说明 */
.about-footer {
  width: 100%;
  text-align: center;
}

/* 存储路径区域 */
.storage-path-section {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
  padding: 8px 12px;
  border-radius: 6px;
  background: var(--vscode-input-background, rgba(255,255,255,0.04));
  border: 1px solid var(--vscode-input-border, rgba(255,255,255,0.12));
}

.storage-path-label {
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
}

.storage-path-value {
  font-size: 12px;
  font-family: var(--vscode-editor-font-family, 'Cascadia Code', Consolas, monospace);
  color: var(--vscode-textPreformat-foreground);
  word-break: break-all;
  line-height: 1.5;
}

/* 打开目录按钮 */
.open-dir-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 8px 16px;
  margin-bottom: 24px;
  border: 1px solid var(--vscode-button-border, rgba(255,255,255,0.12));
  border-radius: 6px;
  background: var(--vscode-button-secondaryBackground, #3a3d41);
  color: var(--vscode-button-secondaryForeground, #fff);
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: background-color 0.2s;
}

.open-dir-btn:hover {
  background: var(--vscode-button-secondaryHoverBackground, #45494e);
}

.about-desc {
  margin: 0;
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
  opacity: 0.7;
  line-height: 1.6;
}
</style>
