/**
 * Webview HTML 构建与语言偏好解析的共享逻辑
 * 供 sidebarWebviewProvider 与 webviewPanel 复用，消除重复代码
 */
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getErrorHtml } from './webviewUtils';
import localesData from '../../locales.json';

/** Webview HTML 构建选项 */
export interface WebviewHtmlOptions {
  /** 视图模式：sidebar 或 editor，前端据此渲染对应视图 */
  viewMode: 'sidebar' | 'editor';
  /** 语言偏好，注入为 window.__LOCALE */
  locale: string;
  /**
   * 注入的额外全局变量
   * 键为变量名（不含 window. 前缀），值为已序列化的 JS 表达式字符串
   * 例如：{ __SORT_ORDER: "'desc'", __FOLDERS: '[{"id":"default"}]' }
   */
  injectVars?: Record<string, string>;
}

/**
 * 构建 Webview HTML 内容
 * 读取 webview/dist 构建产物，注入全局变量和 CSP，替换资源路径为 webview 可访问的 URI
 * 侧边栏和编辑器共用同一套 Vue 构建产物，通过 viewMode 区分渲染
 */
export async function buildWebviewHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  options: WebviewHtmlOptions
): Promise<string> {
  const distUri = vscode.Uri.joinPath(extensionUri, 'webview', 'dist');
  const distPath = distUri.fsPath;

  const htmlPath = path.join(distPath, 'index.html');
  // 构建产物不存在时显示错误提示
  try {
    await fs.promises.access(htmlPath);
  } catch {
    return getErrorHtml('Run "npm run build:webview" first.');
  }

  let html = await fs.promises.readFile(htmlPath, 'utf-8');

  // 拼接注入的全局变量脚本
  // 固定注入 __VIEW_MODE、__LOCALE 和 vscode API，额外变量由 injectVars 提供
  const injectEntries: string[] = [
    `window.__VIEW_MODE = '${options.viewMode}'`,
    `window.__LOCALE = '${options.locale}'`,
  ];
  if (options.injectVars) {
    for (const [key, value] of Object.entries(options.injectVars)) {
      injectEntries.push(`window.${key} = ${value}`);
    }
  }
  injectEntries.push('window.vscode = acquireVsCodeApi()');

  html = html.replace(
    '<head>',
    `<head><script>${injectEntries.join('; ')}</script>`
  );

  // 替换 CSS 资源路径为 webview 可访问的 URI
  html = html.replace(
    /(<link[^>]*href=")([^"]*)(")/g,
    (_match: string, p1: string, p2: string, p3: string) => {
      const uri = webview.asWebviewUri(vscode.Uri.joinPath(distUri, p2));
      return `${p1}${uri}${p3}`;
    }
  );

  // 替换 JS 资源路径为 webview 可访问的 URI
  html = html.replace(
    /(<script[^>]*src=")([^"]*)(")/g,
    (_match: string, p1: string, p2: string, p3: string) => {
      const uri = webview.asWebviewUri(vscode.Uri.joinPath(distUri, p2));
      return `${p1}${uri}${p3}`;
    }
  );

  // 注入内容安全策略，限制资源加载来源
  const csp = `
      <meta http-equiv="Content-Security-Policy"
        content="default-src 'none';
        style-src ${webview.cspSource} 'unsafe-inline';
        script-src ${webview.cspSource} 'unsafe-inline';
        img-src ${webview.cspSource} https: data:;
        font-src ${webview.cspSource};"
      />`;

  html = html.replace('<head>', `<head>${csp}`);

  return html;
}

/**
 * 获取语言来源：'auto' 跟随 VS Code 语言，'manual' 手动设置
 */
export function getLocaleSource(context: vscode.ExtensionContext): 'auto' | 'manual' {
  return context.globalState.get<'auto' | 'manual'>('localeSource', 'auto');
}

/**
 * 解析当前生效的语言偏好
 * auto 模式：根据 vscode.env.language 映射到支持的语言列表
 * manual 模式：直接返回手动设置的 locale 值
 */
export function resolveLocale(context: vscode.ExtensionContext): string {
  const source = getLocaleSource(context);
  if (source === 'manual') {
    return context.globalState.get<string>('locale', 'zh');
  }
  // auto 模式：从 VS Code 语言设置映射
  return mapVscodeLocale(vscode.env.language);
}

/**
 * 将 VS Code 语言标识映射到插件支持的语言
 * 使用大小写不敏感匹配，未匹配时回退到英文
 */
export function mapVscodeLocale(vscodeLang: string): string {
  const validLocales = localesData.locales.map(l => l.value);
  const lower = vscodeLang.toLowerCase();
  // 精确匹配（忽略大小写）
  const exact = validLocales.find(l => l.toLowerCase() === lower);
  if (exact) {
    return exact;
  }
  // 前缀匹配：如 'zh-cn' 匹配 'zh'，'pt-br' 匹配 'pt'
  const prefix = lower.split('-')[0];
  const prefixMatch = validLocales.find(l => l.toLowerCase() === prefix);
  if (prefixMatch) {
    return prefixMatch;
  }
  // 未匹配时回退到英文
  return 'en';
}
