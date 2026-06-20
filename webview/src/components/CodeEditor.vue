<!-- 代码编辑器组件：基于 CodeMirror 6，支持语法高亮和 v-model 双向绑定 -->
<script setup lang="ts">
/**
 * CodeEditor 组件
 * 封装 CodeMirror 6 编辑器，提供：
 * - 根据语言自动切换语法高亮
 * - v-model 双向绑定
 * - 与 VS Code 主题融合的样式
 * - Tab 键输入制表符而非切换焦点
 */
import { EditorView, keymap, placeholder as cmPlaceholder } from '@codemirror/view'
import { EditorState, type Extension } from '@codemirror/state'
import { defaultKeymap, indentWithTab, history, historyKeymap } from '@codemirror/commands'
import { syntaxHighlighting, defaultHighlightStyle, foldGutter, foldKeymap } from '@codemirror/language'
import { oneDark } from '@codemirror/theme-one-dark'
import { autocompletion, completionKeymap } from '@codemirror/autocomplete'
import { getLanguageExtension } from '../utils/codemirror-langs'

const props = withDefaults(defineProps<{
  /** 编辑器内容，支持 v-model */
  modelValue: string
  /** 语言 ID，用于语法高亮 */
  language?: string
  /** 占位符文本 */
  placeholder?: string
}>(), {
  language: '*',
  placeholder: '',
})

const emit = defineEmits<{
  /** 内容变更事件，用于 v-model */
  (e: 'update:modelValue', value: string): void
}>()

// 编辑器容器 DOM 引用
const editorRef = ref<HTMLDivElement>()
// CodeMirror 编辑器实例
let editorView: EditorView | null = null
// 防止内部更新触发外部 watch 的标志
let isInternalUpdate = false

/**
 * 构建 CodeMirror 扩展列表
 * 包含基础功能、主题、语言高亮和事件监听
 */
function createExtensions(language: string, placeholderText: string): Extension[] {
  const extensions: Extension[] = [
    // 历史记录，支持撤销/重做
    history(),
    // 代码折叠
    foldGutter(),
    // 默认语法高亮样式
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    // 自动补全
    autocompletion(),
    // 键盘映射：默认快捷键 + Tab 缩进 + 折叠 + 补全
    keymap.of([
      ...defaultKeymap,
      ...historyKeymap,
      ...foldKeymap,
      ...completionKeymap,
      indentWithTab,
    ]),
    // 内容变更监听
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        isInternalUpdate = true
        emit('update:modelValue', update.state.doc.toString())
        isInternalUpdate = false
      }
    }),
    // 自定义主题：与 VS Code 风格融合
    EditorView.theme({
      '&': {
        fontSize: 'var(--vscode-editor-font-size, 13px)',
        backgroundColor: 'transparent',
      },
      '.cm-content': {
        fontFamily: "var(--vscode-editor-font-family, 'Cascadia Code', Consolas, monospace)",
        caretColor: 'var(--vscode-editorCursor-foreground, #aeafad)',
        padding: '4px 0',
      },
      '.cm-cursor': {
        borderLeftColor: 'var(--vscode-editorCursor-foreground, #aeafad)',
        borderLeftWidth: '2px',
      },
      '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
        backgroundColor: 'var(--vscode-editor-selectionBackground, rgba(38, 79, 120, 0.5)) !important',
      },
      '.cm-gutters': {
        backgroundColor: 'transparent',
        borderRight: 'none',
        color: 'var(--vscode-editorLineNumber-foreground, rgba(255,255,255,0.3))',
      },
      '.cm-activeLineGutter': {
        backgroundColor: 'transparent',
        color: 'var(--vscode-editorLineNumber-activeForeground, rgba(255,255,255,0.6))',
      },
      '.cm-activeLine': {
        backgroundColor: 'var(--vscode-editor-lineHighlightBackground, rgba(255,255,255,0.04))',
      },
      '.cm-placeholder': {
        color: 'var(--vscode-input-placeholderForeground, rgba(255,255,255,0.3))',
        fontStyle: 'italic',
      },
      '.cm-foldGutter': {
        color: 'var(--vscode-editorLineNumber-foreground, rgba(255,255,255,0.3))',
      },
      '.cm-scroller': {
        overflow: 'auto',
      },
    }),
  ]

  // 占位符文本
  if (placeholderText) {
    extensions.push(cmPlaceholder(placeholderText))
  }

  // 语言语法高亮扩展
  const langExts = getLanguageExtension(language)
  extensions.push(...langExts)

  // 深色主题（VS Code webview 默认为深色）
  extensions.push(oneDark)

  return extensions
}

/** 初始化 CodeMirror 编辑器 */
onMounted(() => {
  if (!editorRef.value) return

  const extensions = createExtensions(props.language, props.placeholder)
  const state = EditorState.create({
    doc: props.modelValue,
    extensions,
  })

  editorView = new EditorView({
    state,
    parent: editorRef.value,
  })
})

/** 销毁编辑器实例，释放资源 */
onBeforeUnmount(() => {
  if (editorView) {
    editorView.destroy()
    editorView = null
  }
})

// 监听外部内容变更，同步到编辑器
watch(() => props.modelValue, (newVal) => {
  if (isInternalUpdate || !editorView) return
  const currentVal = editorView.state.doc.toString()
  if (newVal !== currentVal) {
    editorView.dispatch({
      changes: {
        from: 0,
        to: editorView.state.doc.length,
        insert: newVal,
      },
    })
  }
})

// 监听语言变更，重新加载语言扩展
watch(() => props.language, (newLang) => {
  if (!editorView) return
  // 重新构建所有扩展并替换编辑器状态
  const extensions = createExtensions(newLang, props.placeholder)
  const newState = EditorState.create({
    doc: editorView.state.doc.toString(),
    extensions,
  })
  editorView.setState(newState)
})

// 监听占位符变更
watch(() => props.placeholder, (newPlaceholder) => {
  if (!editorView) return
  const extensions = createExtensions(props.language, newPlaceholder)
  const newState = EditorState.create({
    doc: editorView.state.doc.toString(),
    extensions,
  })
  editorView.setState(newState)
})
</script>

<template>
  <div ref="editorRef" class="code-editor-cm"></div>
</template>

<style scoped lang="scss">
.code-editor-cm {
  width: 100%;
  min-height: 180px;
  border-radius: $radius-md;
  overflow: hidden;
  // 在 flex 填充模式下自适应父容器高度
  flex: 1;

  :deep(.cm-editor) {
    height: 100%;
    min-height: 180px;
    border-radius: $radius-md;
  }

  :deep(.cm-editor.cm-focused) {
    outline: none;
  }
}
</style>
