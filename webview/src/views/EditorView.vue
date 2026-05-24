<!-- 编辑器视图组件：片段新建/编辑表单，保存后自动关闭并刷新侧边栏 -->
<script setup lang="ts">
/**
 * 编辑器视图组件
 * 支持新建和编辑两种模式，通过后端 setSnippet 消息切换
 * 使用原生 HTML 表单元素替代 Naive UI，确保 webview 中交互可靠
 */
import { ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Snippet } from '../types'
import { SUPPORTED_LANGUAGES } from '../types'
import { postToExt, onExtMessage } from '../composables/useMessage'
import LanguageSelect from '../components/LanguageSelect.vue'
import CodeEditor from '../components/CodeEditor.vue'

const { t, locale } = useI18n()

// 当前编辑的片段数据，为 null 时表示新建模式
const editingSnippet = ref<Snippet | null>(null)
// 表单数据
const form = ref({
  name: '',
  prefix: '',
  body: '',
  description: '',
  language: '*',
})
// 保存中状态，防止重复提交
const saving = ref(false)
// 是否为编辑模式
const isEditing = ref(false)
// 校验错误信息
const errors = ref<Record<string, string>>({})
// 后端返回的错误提示
const serverError = ref('')

// 语言下拉选项，包含图标信息（computed 确保语言切换时标签更新）
const languageOptions = computed(() =>
  SUPPORTED_LANGUAGES.map((l) => ({
    label: l.value === '*' ? t('form.allLanguages') : l.label,
    value: l.value,
    icon: l.icon,
  }))
)

// 监听编辑片段变化，回填或清空表单
watch(
  () => editingSnippet.value,
  (val) => {
    if (val) {
      // 编辑模式：回填片段数据到表单
      isEditing.value = true
      form.value = {
        name: val.name,
        prefix: val.prefix,
        body: val.body,
        description: val.description,
        language: val.language,
      }
    } else {
      // 新建模式：清空表单
      isEditing.value = false
      form.value = { name: '', prefix: '', body: '', description: '', language: '*' }
    }
    // 切换模式时清除校验错误
    errors.value = {}
  },
  { immediate: true }
)

/** 校验表单，返回是否通过 */
function validate(): boolean {
  const e: Record<string, string> = {}
  if (!form.value.name.trim()) e.name = t('form.nameRequired')
  if (!form.value.prefix.trim()) e.prefix = t('form.prefixRequired')
  if (!form.value.body.trim()) e.body = t('form.bodyRequired')
  errors.value = e
  return Object.keys(e).length === 0
}

/** 清除指定字段的校验错误 */
function clearError(field: string) {
  if (errors.value[field]) {
    const next = { ...errors.value }
    delete next[field]
    errors.value = next
  }
}

/** 保存片段：校验通过后发送创建或更新消息 */
function handleSave() {
  if (!validate()) return
  saving.value = true
  serverError.value = ''
  if (editingSnippet.value) {
    // 编辑模式：发送更新消息
    postToExt('updateSnippet', { id: editingSnippet.value.id, ...form.value })
  } else {
    // 新建模式：发送创建消息
    postToExt('createSnippet', { ...form.value })
  }
  // 延迟重置保存状态，等待后端响应
  setTimeout(() => { saving.value = false }, 1000)
}

/** 关闭编辑器面板 */
function handleClose() {
  postToExt('closeEditor', null)
}

// 监听后端发送的片段数据，进入编辑模式
onExtMessage('setSnippet', (payload) => {
  editingSnippet.value = payload as Snippet
})

// 创建成功后关闭面板
onExtMessage('snippetCreated', () => {
  handleClose()
})

// 更新成功后关闭面板
onExtMessage('snippetUpdated', () => {
  handleClose()
})

// 监听后端返回的错误消息
onExtMessage('error', (payload) => {
  serverError.value = payload as string
  saving.value = false
})

// 监听侧边栏语言切换，同步更新编辑器面板的 locale
onExtMessage('localeChanged', (payload) => {
  locale.value = payload as string
})

// 组件挂载时通知后端编辑器已就绪
onMounted(() => {
  postToExt('editorReady', null)
})
</script>

<template>
  <div class="editor-view">
    <!-- 顶部标题栏：渐变背景 + 模式标识 -->
    <div class="editor-header">
      <div class="header-content">
        <!-- 模式图标 -->
        <div class="header-icon" :class="{ 'header-icon--edit': isEditing }">
          <svg v-if="isEditing" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </div>
        <!-- 标题和副标题 -->
        <div class="header-text">
          <h2 class="header-title">{{ isEditing ? t('form.editTitle') : t('form.createTitle') }}</h2>
          <p class="header-subtitle">{{ isEditing ? t('form.editSubtitle') : t('form.createSubtitle') }}</p>
        </div>
      </div>
    </div>

    <!-- 表单主体区域 -->
    <div class="editor-body">
      <!-- 前缀命名规范提示 -->
      <div class="prefix-notice">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <span>{{ t('form.prefixNotice') }}</span>
      </div>

      <!-- 名称和前缀并排 -->
      <div class="form-section">
        <div class="form-row">
          <div class="form-group" :class="{ 'has-error': errors.name }">
            <label class="form-label">
              {{ t('form.name') }}
              <span class="required-dot">*</span>
            </label>
            <input
              v-model="form.name"
              class="form-input"
              :placeholder="t('form.namePlaceholder')"
              @input="clearError('name')"
            />
            <transition name="slide-fade">
              <span v-if="errors.name" class="form-error">{{ errors.name }}</span>
            </transition>
          </div>

          <div class="form-group" :class="{ 'has-error': errors.prefix }">
            <label class="form-label">
              {{ t('form.prefix') }}
              <span class="required-dot">*</span>
            </label>
            <input
              v-model="form.prefix"
              class="form-input"
              :placeholder="t('form.prefixPlaceholder')"
              @input="clearError('prefix')"
            />
            <transition name="slide-fade">
              <span v-if="errors.prefix" class="form-error">{{ errors.prefix }}</span>
            </transition>
          </div>
        </div>
      </div>

      <!-- 代码内容区域 -->
      <div class="form-section">
        <div class="form-group" :class="{ 'has-error': errors.body }">
          <label class="form-label">
            {{ t('form.body') }}
            <span class="required-dot">*</span>
            <span class="form-hint">{{ t('form.bodyHint') }}</span>
          </label>
          <div class="code-editor-wrapper">
            <CodeEditor
              v-model="form.body"
              :language="form.language === '*' ? '' : form.language"
              :placeholder="t('form.bodyPlaceholder')"
              @update:model-value="clearError('body')"
            />
          </div>
          <transition name="slide-fade">
            <span v-if="errors.body" class="form-error">{{ errors.body }}</span>
          </transition>
        </div>
      </div>

      <!-- 描述和语言并排 -->
      <div class="form-section">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">{{ t('form.description') }}</label>
            <input
              v-model="form.description"
              class="form-input"
              :placeholder="t('form.descriptionPlaceholder')"
            />
          </div>

          <div class="form-group">
            <label class="form-label">{{ t('form.language') }}</label>
            <LanguageSelect
              v-model="form.language"
              :options="languageOptions"
              :placeholder="t('form.languagePlaceholder')"
              placement="top"
              multiple
            />
          </div>
        </div>
      </div>
    </div>

    <!-- 底部操作栏 -->
    <div class="editor-footer">
      <!-- 服务器错误提示 -->
      <transition name="slide-fade">
        <span v-if="serverError" class="server-error">{{ serverError }}</span>
      </transition>
      <div class="footer-actions">
        <button class="btn btn-secondary" @click="handleClose">
          {{ t('form.cancel') }}
        </button>
        <button class="btn btn-primary" :disabled="saving" @click="handleSave">
          <svg v-if="!saving" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          <span v-else class="spinner"></span>
          {{ t('form.save') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ===== 整体布局 ===== */
.editor-view {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background: var(--vscode-editor-background);
}

/* ===== 顶部标题栏 ===== */
.editor-header {
  padding: 24px 28px 20px;
  border-bottom: 1px solid var(--vscode-panel-border, rgba(255,255,255,0.06));
  background: linear-gradient(
    180deg,
    var(--vscode-editor-background) 0%,
    var(--vscode-sideBar-background, var(--vscode-editor-background)) 100%
  );
}

.header-content {
  display: flex;
  align-items: center;
  gap: 14px;
}

/* 模式图标：新建为蓝色，编辑为琥珀色 */
.header-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: linear-gradient(135deg, #0e639c, #1177bb);
  color: #fff;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(14, 99, 156, 0.3);
}

.header-icon--edit {
  background: linear-gradient(135deg, #c77832, #e89b4c);
  box-shadow: 0 2px 8px rgba(199, 120, 50, 0.3);
}

.header-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.header-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--vscode-editor-foreground);
  letter-spacing: -0.3px;
}

.header-subtitle {
  margin: 0;
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
  font-weight: 400;
}

/* ===== 表单主体 ===== */
.editor-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 28px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* 前缀命名规范提示横幅 */
.prefix-notice {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 6px;
  background: var(--vscode-inputValidation-warningBackground, #352a05);
  border: 1px solid var(--vscode-inputValidation-warningBorder, #cca700);
  color: var(--vscode-editorWarning-foreground, #cca700);
  font-size: 12px;
  line-height: 1.5;
}

.prefix-notice svg {
  flex-shrink: 0;
  margin-top: 2px;
}

/* 表单分区 */
.form-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* 表单行：两个字段并排 */
.form-row {
  display: flex;
  gap: 16px;
}

.form-row .form-group {
  flex: 1;
  min-width: 0;
}

/* 表单组 */
.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* 表单标签 */
.form-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--vscode-editor-foreground);
  opacity: 0.85;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  display: flex;
  align-items: center;
  gap: 4px;
}

/* 必填标记 */
.required-dot {
  color: var(--vscode-errorForeground, #f48771);
  font-size: 14px;
  line-height: 1;
}

/* 字段提示 */
.form-hint {
  font-weight: 400;
  text-transform: none;
  opacity: 0.5;
  font-size: 11px;
  letter-spacing: 0;
}

/* 输入框 */
.form-input {
  width: 100%;
  padding: 9px 12px;
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

/* 校验错误状态 */
.has-error .form-input,
.has-error .code-editor {
  border-color: var(--vscode-errorForeground, #f48771);
  box-shadow: 0 0 0 1px var(--vscode-errorForeground, #f48771);
}

/* 错误信息 */
.form-error {
  font-size: 11px;
  color: var(--vscode-errorForeground, #f48771);
  padding-left: 2px;
}

/* 错误信息动画 */
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

/* ===== 代码编辑器 ===== */
.code-editor-wrapper {
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--vscode-input-border, rgba(255,255,255,0.12));
  transition: border-color 0.2s, box-shadow 0.2s;
  background: var(--vscode-input-background, rgba(255,255,255,0.04));
}

.code-editor-wrapper:focus-within {
  border-color: var(--vscode-focusBorder, #007fd4);
  box-shadow: 0 0 0 1px var(--vscode-focusBorder, #007fd4);
}

.has-error .code-editor-wrapper {
  border-color: var(--vscode-errorForeground, #f48771);
  box-shadow: 0 0 0 1px var(--vscode-errorForeground, #f48771);
}

/* ===== 底部操作栏 ===== */
.editor-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 28px;
  border-top: 1px solid var(--vscode-panel-border, rgba(255,255,255,0.06));
  background: var(--vscode-editor-background);
}

/* 服务器错误提示 */
.server-error {
  font-size: 12px;
  color: var(--vscode-errorForeground, #f48771);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 操作按钮组 */
.footer-actions {
  display: flex;
  gap: 10px;
  flex-shrink: 0;
}

/* 按钮基础样式 */
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

/* 次要按钮（取消） */
.btn-secondary {
  background: var(--vscode-button-secondaryBackground, #3a3d41);
  color: var(--vscode-button-secondaryForeground, #fff);
}

.btn-secondary:hover {
  background: var(--vscode-button-secondaryHoverBackground, #45494e);
}

/* 主要按钮（保存） */
.btn-primary {
  background: var(--vscode-button-background, #0e639c);
  color: var(--vscode-button-foreground, #fff);
  box-shadow: 0 1px 4px rgba(14, 99, 156, 0.3);
}

.btn-primary:hover {
  background: var(--vscode-button-hoverBackground, #1177bb);
}

/* 加载旋转动画 */
.spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
