/**
 * Webview 通用工具函数
 * 供 sidebarWebviewProvider 与 webviewPanel 共享，避免重复实现
 */

/**
 * 构建 Webview 错误提示 HTML
 * 当构建产物缺失或发生其他初始化错误时展示
 * @param message 错误提示文本
 */
export function getErrorHtml(message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Error</title></head>
<body style="padding:20px;color:var(--vscode-errorForeground);font-family:var(--vscode-font-family);">
  <h2>⚠️ Error</h2>
  <p>${message}</p>
</body>
</html>`;
}
