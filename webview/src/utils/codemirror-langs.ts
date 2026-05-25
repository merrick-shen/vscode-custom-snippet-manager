/**
 * CodeMirror 语言扩展映射
 * 将 VS Code languageId 映射到对应的 CodeMirror 语言扩展
 * 语言列表从统一配置 languages.ts 获取，此处仅负责 CodeMirror 扩展的工厂函数映射
 */
import { type LanguageSupport } from '@codemirror/language'
import { highlightCode, classHighlighter } from '@lezer/highlight'
import { javascript } from '@codemirror/lang-javascript'
import { html } from '@codemirror/lang-html'
import { css } from '@codemirror/lang-css'
import { python } from '@codemirror/lang-python'
import { java } from '@codemirror/lang-java'
import { json } from '@codemirror/lang-json'
import { markdown } from '@codemirror/lang-markdown'
import { cpp } from '@codemirror/lang-cpp'
import { go } from '@codemirror/lang-go'
import { rust } from '@codemirror/lang-rust'
import { php } from '@codemirror/lang-php'
import { sql } from '@codemirror/lang-sql'
import { xml } from '@codemirror/lang-xml'

/** 语言映射表：VS Code languageId -> CodeMirror 语言扩展工厂函数 */
const languageMap: Record<string, () => LanguageSupport> = {
  javascript: () => javascript(),
  typescript: () => javascript({ typescript: true }),
  javascriptreact: () => javascript({ jsx: true }),
  typescriptreact: () => javascript({ jsx: true, typescript: true }),
  html: () => html(),
  css: () => css(),
  scss: () => css(),
  less: () => css(),
  python: () => python(),
  java: () => java(),
  json: () => json(),
  markdown: () => markdown(),
  c: () => cpp(),
  cpp: () => cpp(),
  csharp: () => cpp(),
  go: () => go(),
  rust: () => rust(),
  php: () => php(),
  ruby: () => php(), // Ruby 无官方扩展，暂用通用高亮
  sql: () => sql(),
  xml: () => xml(),
  vue: () => html(), // Vue 模板基于 HTML
  yaml: () => xml(), // YAML 无官方扩展，暂用通用高亮
  shellscript: () => python(), // Shell 无官方扩展，暂用通用高亮
  swift: () => cpp(), // Swift 无官方扩展，暂用类 C 高亮
  kotlin: () => java(), // Kotlin 无官方扩展，暂用 Java 高亮
  dart: () => java(), // Dart 无官方扩展，暂用 Java 高亮
  lua: () => python(), // Lua 无官方扩展，暂用通用高亮
  r: () => python(), // R 无官方扩展，暂用通用高亮
  dockerfile: () => python(), // Dockerfile 无官方扩展，暂用通用高亮
}

/**
 * 根据语言 ID 获取 CodeMirror 语言扩展
 * @param languageId VS Code 的 languageId，如 'javascript'、'python' 等
 * @returns CodeMirror LanguageSupport 数组，无匹配时返回空数组
 */
export function getLanguageExtension(languageId: string): LanguageSupport[] {
  const factory = languageMap[languageId]
  if (factory) {
    return [factory()]
  }
  return []
}

/** HTML 转义辅助函数 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * 轻量级语法高亮函数，使用 CodeMirror 的 highlightCode API
 * 将代码字符串转换为带语法高亮的 HTML
 * @param code 需要高亮的代码字符串
 * @param languageId VS Code 的 languageId
 * @returns 高亮后的 HTML 字符串，无匹配语言时返回转义后的纯文本
 */
export function highlightCodeString(code: string, languageId: string): string {
  const extensions = getLanguageExtension(languageId)
  if (extensions.length === 0) {
    return escapeHtml(code)
  }

  const languageSupport = extensions[0]
  const parser = languageSupport.language.parser
  if (!parser) {
    return escapeHtml(code)
  }

  const tree = parser.parse(code)
  const parts: string[] = []

  highlightCode(
    code,
    tree,
    classHighlighter,
    (text: string, cls: string) => {
      if (cls) {
        parts.push(`<span class="${cls}">${escapeHtml(text)}</span>`)
      } else {
        parts.push(escapeHtml(text))
      }
    },
    () => {
      parts.push('\n')
    }
  )

  return parts.join('')
}
