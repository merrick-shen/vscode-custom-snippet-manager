<!-- 编辑器视图组件：片段新建/编辑表单，保存后自动关闭并刷新侧边栏 -->
<script setup lang="ts">
/**
 * 编辑器视图组件
 * 支持新建和编辑两种模式，通过后端 setSnippet 消息切换
 * 使用原生 HTML 表单元素替代 Naive UI，确保 webview 中交互可靠
 */
import { ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Icon } from '@iconify/vue'
import type { Snippet, Folder } from '../types'
import { DEFAULT_FOLDER_ID } from '../types'
import { SUPPORTED_LANGUAGES } from '../utils/languages'
import { postToExt, onExtMessage } from '../composables/useMessage'
import LanguageSelect from '../components/LanguageSelect.vue'
import CodeEditor from '../components/CodeEditor.vue'

const { t, locale } = useI18n()

// 当前编辑的片段数据，为 null 时表示新建模式
const editingSnippet = ref<Snippet | null>(null)
// 文件夹清单，从后端注入的初始数据初始化，供所属文件夹下拉选择
const folders = ref<Folder[]>(Array.isArray(window.__FOLDERS) ? window.__FOLDERS : [])
// 表单数据
const form = ref({
  name: '',
  prefix: '',
  body: '',
  description: '',
  language: '*',
  folderId: DEFAULT_FOLDER_ID,
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

/** 文件夹下拉选项，默认文件夹用 i18n 名称（无图标，复用 LanguageSelect） */
const folderOptions = computed(() =>
  folders.value.map((f) => ({
    value: f.id,
    label: f.id === DEFAULT_FOLDER_ID ? t('folder.defaultName') : f.name,
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
        // 片段缺失 folderId 时归为默认文件夹
        folderId: val.folderId ?? DEFAULT_FOLDER_ID,
      }
    } else {
      // 新建模式：清空表单，默认归入默认文件夹
      isEditing.value = false
      form.value = { name: '', prefix: '', body: '', description: '', language: '*', folderId: DEFAULT_FOLDER_ID }
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
  // 切换片段时清除残留的后端错误提示
  serverError.value = ''
})

// 创建成功后关闭面板
onExtMessage('snippetCreated', () => {
  handleClose()
})

// 更新成功后关闭面板
onExtMessage('snippetUpdated', () => {
  handleClose()
})

// 监听后端返回的错误消息（使用 i18n 渲染）
onExtMessage('error', (payload) => {
  const data = payload as { errorKey: string; errorParams?: Record<string, string> }
  serverError.value = t(data.errorKey, data.errorParams ?? {})
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
          <Icon v-if="isEditing" icon="carbon:edit" width="18" height="18" />
          <Icon v-else icon="carbon:add" width="18" height="18" />
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
        <Icon icon="carbon:information" width="14" height="14" />
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
              class="scope-select"
              multiple
            />
          </div>
        </div>
      </div>

      <!-- 所属文件夹选择 -->
      <div class="form-section">
        <div class="form-group">
          <label class="form-label">{{ t('folder.belongTo') }}</label>
          <LanguageSelect
            v-model="form.folderId"
            :options="folderOptions"
            placement="top"
          />
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
          <Icon v-if="!saving" icon="carbon:checkmark" width="16" height="16" />
          <span v-else class="spinner"></span>
          {{ t('form.save') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.editor-view {
  @include flex-column;
  height: 100vh;
  overflow: hidden;
  background: var(--vscode-editor-background);
}

// ===== 顶部标题栏 =====
.editor-header {
  padding: $spacing-xl 28px 20px;
  border-bottom: 1px solid $border-panel;
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

.header-icon {
  @include flex-center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: $gradient-primary;
  color: #fff;
  flex-shrink: 0;
  box-shadow: $shadow-primary-btn;
}

.header-icon--edit {
  background: $gradient-edit;
  box-shadow: $shadow-edit-btn;
}

.header-text {
  @include flex-column;
  gap: 2px;
}

.header-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: $color-foreground;
  letter-spacing: -0.3px;
}

.header-subtitle {
  margin: 0;
  font-size: $font-size-sm;
  color: $color-description;
  font-weight: 400;
}

// ===== 表单主体 =====
.editor-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 28px;
  @include flex-column;
  gap: 20px;
}

.prefix-notice {
  display: flex;
  align-items: flex-start;
  gap: $spacing-sm;
  padding: 10px $spacing-md;
  border-radius: $radius-md;
  background: var(--vscode-inputValidation-warningBackground, #352a05);
  border: 1px solid var(--vscode-inputValidation-warningBorder, #cca700);
  color: var(--vscode-editorWarning-foreground, #cca700);
  font-size: $font-size-sm;
  line-height: 1.5;

  svg {
    flex-shrink: 0;
    margin-top: 2px;
  }
}

.form-section {
  @include flex-column;
  gap: 6px;
}

.form-row {
  display: flex;
  gap: $spacing-lg;

  .form-group {
    flex: 1;
    min-width: 0;
  }
}

.form-group {
  @include flex-column;
  gap: 6px;
}

.form-label {
  font-size: $font-size-sm;
  font-weight: 600;
  color: $color-foreground;
  opacity: 0.85;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  display: flex;
  align-items: center;
  gap: $spacing-xs;
}

.required-dot {
  color: $color-error;
  font-size: $font-size-lg;
  line-height: 1;
}

.form-hint {
  font-weight: 400;
  text-transform: none;
  opacity: 0.5;
  font-size: $font-size-xs;
  letter-spacing: 0;
}

.form-input {
  @include input-base;
  padding: 9px $spacing-md;
}

// 使用范围下拉触发器高度对齐到描述输入框（上下内边距 9px）
.scope-select :deep(.lang-select-trigger) {
  padding-top: 9px;
  padding-bottom: 9px;
}

.has-error .form-input,
.has-error .code-editor {
  border-color: $color-error;
  box-shadow: 0 0 0 1px $color-error;
}

.form-error {
  font-size: $font-size-xs;
  color: $color-error;
  padding-left: 2px;
}

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

// ===== 代码编辑器 =====
.code-editor-wrapper {
  border-radius: $radius-lg;
  overflow: hidden;
  border: 1px solid $border-input;
  transition: border-color 0.2s, box-shadow 0.2s;
  background: $bg-input;

  &:focus-within {
    border-color: $color-focus;
    box-shadow: 0 0 0 1px $color-focus;
  }
}

.has-error .code-editor-wrapper {
  border-color: $color-error;
  box-shadow: 0 0 0 1px $color-error;
}

// ===== 底部操作栏 =====
.editor-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 28px;
  border-top: 1px solid $border-panel;
  background: var(--vscode-editor-background);
}

.server-error {
  font-size: $font-size-sm;
  color: $color-error;
  flex: 1;
  min-width: 0;
  @include text-ellipsis;
}

.footer-actions {
  display: flex;
  gap: 10px;
  flex-shrink: 0;
}

.btn {
  @include btn-base;
}

.btn-secondary {
  @include btn-secondary;
}

.btn-primary {
  @include btn-primary;
}

.spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
