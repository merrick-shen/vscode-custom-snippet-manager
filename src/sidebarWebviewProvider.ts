/**
 * 侧边栏 Webview 视图提供者
 * 在 VS Code 侧边栏中渲染片段列表，处理列表相关的消息通信
 * 点击新建/编辑时通过命令打开编辑器面板
 * 管理语言偏好持久化，确保侧边栏和编辑器语言设置同步
 */
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { SnippetService } from './snippetService';
import { ImportExportService } from './importExportService';

/** Webview 消息格式 */
interface WebviewMessage {
  type: string;
  payload?: unknown;
}

export class SidebarWebviewProvider implements vscode.WebviewViewProvider {
  /** 视图标识，需与 package.json 中的 views.id 一致 */
  public static readonly viewType = 'custom-snippet-manager.sidebar';
  /** 侧边栏 Webview 视图实例 */
  private view?: vscode.WebviewView;
  /** 扩展资源 URI */
  private readonly extensionUri: vscode.Uri;
  /** 片段数据服务 */
  private readonly snippetService: SnippetService;
  /** 导入导出服务 */
  private readonly importExportService: ImportExportService;
  /** 扩展上下文，用于访问 globalState 持久化语言偏好 */
  private readonly context: vscode.ExtensionContext;

  constructor(extensionUri: vscode.Uri, snippetService: SnippetService, context: vscode.ExtensionContext) {
    this.extensionUri = extensionUri;
    this.snippetService = snippetService;
    this.importExportService = new ImportExportService(snippetService);
    this.context = context;
  }

  /** 获取当前保存的语言偏好，默认中文 */
  public getLocale(): string {
    return this.context.globalState.get<string>('locale', 'zh');
  }

  /** 保存语言偏好到 globalState */
  private setLocale(locale: string): void {
    this.context.globalState.update('locale', locale);
  }

  /**
   * VS Code 调用此方法解析 webview 视图
   * 在侧边栏首次展开或视图需要重建时触发
   */
  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.view = webviewView;

    // 配置 webview 选项：启用脚本并限制资源加载范围
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, 'webview', 'dist'),
      ],
    };

    // 加载 webview HTML 内容
    webviewView.webview.html = this.getWebviewHtml(webviewView.webview);

    // 监听来自侧边栏 webview 的消息
    webviewView.webview.onDidReceiveMessage((msg: WebviewMessage) => {
      this.handleMessage(msg);
    });
  }

  /**
   * 处理来自 webview 的消息
   * 统一消息分发入口，根据类型执行对应操作
   */
  private async handleMessage(msg: WebviewMessage): Promise<void> {
    switch (msg.type) {
      // 前端请求获取片段列表
      case 'getSnippets':
        this.postToView('snippetsList', this.snippetService.getAll());
        break;

      // 前端请求打开编辑器（新建或编辑片段）
      case 'openEditor':
        vscode.commands.executeCommand('custom-snippet-manager.openEditor', msg.payload);
        break;

      // 前端请求删除片段
      case 'deleteSnippet': {
        const { id } = msg.payload as { id: string };
        if (!id) {
          this.postToView('error', 'Invalid snippet ID');
          return;
        }
        const success = this.snippetService.delete(id);
        if (success) {
          // 删除成功后刷新列表
          this.postToView('snippetsList', this.snippetService.getAll());
        } else {
          this.postToView('error', 'Snippet not found');
        }
        break;
      }

      // 前端切换语言，持久化保存到 globalState
      case 'changeLocale': {
        const locale = msg.payload as string;
        // 支持所有已注册的语言标识
        const validLocales = ['zh', 'zh-TW', 'en', 'ja', 'ko'];
        if (validLocales.includes(locale)) {
          this.setLocale(locale);
        }
        break;
      }

      // 前端请求导出代码片段
      case 'exportSnippets': {
        const success = await this.importExportService.exportSnippets();
        this.postToView('exportResult', { success });
        break;
      }

      // 前端请求导入代码片段
      case 'importSnippets': {
        const result = await this.importExportService.importSnippets();
        if (result) {
          // 导入成功后刷新列表
          this.postToView('importResult', result);
          this.postToView('snippetsList', this.snippetService.getAll());
        }
        break;
      }
    }
  }

  /** 刷新侧边栏列表，由编辑器面板保存/删除片段后调用 */
  public refresh(): void {
    if (this.view) {
      this.postToView('snippetsList', this.snippetService.getAll());
    }
  }

  /** 向侧边栏 webview 发送消息 */
  private postToView(type: string, payload?: unknown): void {
    this.view?.webview.postMessage({ type, payload });
  }

  /**
   * 生成侧边栏 webview 的 HTML 内容
   * 与编辑器面板共享同一套 Vue 构建产物，通过 __VIEW_MODE 区分渲染
   * 注入 __LOCALE 确保语言偏好与编辑器面板同步
   * 所有资源路径必须使用 asWebviewUri 处理
   */
  private getWebviewHtml(webview: vscode.Webview): string {
    const distUri = vscode.Uri.joinPath(this.extensionUri, 'webview', 'dist');
    const distPath = distUri.fsPath;

    const htmlPath = path.join(distPath, 'index.html');
    if (!fs.existsSync(htmlPath)) {
      return this.getErrorHtml('Run "npm run build:webview" first.');
    }

    let html = fs.readFileSync(htmlPath, 'utf-8');

    // 注入视图模式、语言偏好和 VS Code API
    const locale = this.getLocale();
    html = html.replace(
      '<head>',
      `<head><script>window.__VIEW_MODE = 'sidebar'; window.__LOCALE = '${locale}'; window.vscode = acquireVsCodeApi()</script>`
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

    // 注入内容安全策略
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

  /** 构建产物缺失时显示的错误页面 */
  private getErrorHtml(message: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Error</title></head>
<body style="padding:20px;color:var(--vscode-errorForeground);font-family:var(--vscode-font-family);">
  <h2>⚠️ Error</h2>
  <p>${message}</p>
</body>
</html>`;
  }
}
