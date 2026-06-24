/**
 * 语言配置统一数据源（后端）
 * 与前端 webview/src/utils/languages.ts 保持同步
 * 新增语言时需同时更新两端配置
 */

/** 语言别名映射，用于代码补全时的语言匹配 */
export const LANGUAGE_ALIASES: Record<string, string[]> = {
  javascript: ['javascript', 'javascriptreact'],
  typescript: ['typescript', 'typescriptreact'],
  python: ['python'],
  html: ['html'],
  css: ['css'],
  json: ['json'],
  markdown: ['markdown'],
  java: ['java'],
  csharp: ['csharp'],
  cpp: ['cpp'],
  c: ['c'],
  go: ['go'],
  rust: ['rust'],
  php: ['php'],
  ruby: ['ruby'],
  swift: ['swift'],
  kotlin: ['kotlin'],
  vue: ['vue'],
  scss: ['scss'],
  less: ['less'],
  shellscript: ['shellscript'],
  sql: ['sql'],
  yaml: ['yaml'],
  xml: ['xml'],
  dart: ['dart'],
  lua: ['lua'],
  r: ['r'],
  dockerfile: ['dockerfile'],
};
