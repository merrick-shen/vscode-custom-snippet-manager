/**
 * 编辑器 Webview 面板
 * 负责创建和管理用于新建/编辑代码片段的独立面板
 * 通过 postMessage 与前端 Vue 应用进行双向通信
 */
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { SnippetService, SnippetData } from './snippetService';

/** Webview 发送的消息格式 */
interface WebviewMessage {
  type: string;
  payload?: unknown;
}

export class WebviewPanel {
  /** 当前面板实例的单例引用 */
  public static currentPanel: WebviewPanel | undefined;
  /** VS Code Webview 面板对象 */
  private readonly panel: vscode.WebviewPanel;
  /** 扩展资源 URI，用于定位 webview 构建产物 */
  private readonly extensionUri: vscode.Uri;
  /** 片段数据服务，处理 CRUD 操作 */
  private readonly snippetService: SnippetService;
  /** 需要在面板销毁时一并释放的资源 */
  private disposables: vscode.Disposable[] = [];

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    snippetService: SnippetService
  ) {
    this.panel = panel;
    this.extensionUri = extensionUri;
    this.snippetService = snippetService;

    // 加载 webview HTML 内容
    this.panel.webview.html = this.getWebviewHtml(this.panel.webview);

    // 监听来自 webview 的消息
    this.panel.webview.onDidReceiveMessage(
      (msg: WebviewMessage) => this.handleMessage(msg),
      null,
      this.disposables
    );

    // 面板关闭时释放资源
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
  }

  /**
   * 创建或显示编辑器面板
   * 如果面板已存在则复用，否则创建新面板
   * @param extensionUri 扩展资源路径
   * @param snippetService 片段数据服务
   * @param snippet 可选的片段数据，传入时进入编辑模式
   */
  public static createOrShow(
    extensionUri: vscode.Uri,
    snippetService: SnippetService,
    snippet?: SnippetData | null
  ): void {
    // 确定面板显示在哪一列
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // 面板已存在时复用，并发送片段数据（编辑模式）
    if (WebviewPanel.currentPanel) {
      WebviewPanel.currentPanel.panel.reveal(column);
      if (snippet) {
        WebviewPanel.currentPanel.postToWebview('setSnippet', snippet);
      }
      return;
    }

    // 创建新的 webview 面板
    const panel = vscode.window.createWebviewPanel(
      'snippetEditor',
      snippet ? `Edit: ${snippet.name}` : 'New Snippet',
      column ?? vscode.ViewColumn.One,
      {
        enableScripts: true,
        // 切换标签页时保留状态
        retainContextWhenHidden: true,
        // 限制资源加载范围，仅允许 webview/dist 目录
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'webview', 'dist'),
        ],
      }
    );

    WebviewPanel.currentPanel = new WebviewPanel(panel, extensionUri, snippetService);

    // 延迟发送片段数据，等待 webview 加载完成后再回填表单
    if (snippet) {
      setTimeout(() => {
        WebviewPanel.currentPanel?.postToWebview('setSnippet', snippet);
      }, 300);
    }
  }

  /**
   * 处理来自 webview 的消息
   * 根据消息类型执行对应的 CRUD 操作
   */
  private handleMessage(msg: WebviewMessage): void {
    switch (msg.type) {
      // 新建片段
      case 'createSnippet': {
        const created = this.snippetService.create(msg.payload as Omit<SnippetData, 'id'>);
        this.postToWebview('snippetCreated', created);
        // 通知侧边栏刷新列表
        vscode.commands.executeCommand('custom-snippet-manager.refreshSidebar');
        break;
      }

      // 更新片段
      case 'updateSnippet': {
        const payload = msg.payload as { id: string } & Omit<SnippetData, 'id'>;
        const { id, ...data } = payload;
        const updated = this.snippetService.update(id, data);
        this.postToWebview('snippetUpdated', updated);
        vscode.commands.executeCommand('custom-snippet-manager.refreshSidebar');
        break;
      }

      // 关闭编辑器面板
      case 'closeEditor':
        this.dispose();
        break;
    }
  }

  /** 向 webview 发送消息 */
  private postToWebview(type: string, payload?: unknown): void {
    this.panel.webview.postMessage({ type, payload });
  }

  /**
   * 生成 webview 的 HTML 内容
   * 读取构建产物 index.html，注入视图模式标识、CSP 策略，并替换资源路径
   */
  private getWebviewHtml(webview: vscode.Webview): string {
    const distUri = vscode.Uri.joinPath(this.extensionUri, 'webview', 'dist');
    const distPath = distUri.fsPath;

    const htmlPath = path.join(distPath, 'index.html');
    // 构建产物不存在时显示错误提示
    if (!fs.existsSync(htmlPath)) {
      return this.getErrorHtml('Run "npm run build:webview" first.');
    }

    let html = fs.readFileSync(htmlPath, 'utf-8');

    // 注入视图模式标识和 VS Code API，前端根据此值决定渲染侧边栏还是编辑器
    html = html.replace('<head>', `<head><script>window.__VIEW_MODE = 'editor'; window.vscode = acquireVsCodeApi()</script>`);

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

  /** 释放面板及相关资源 */
  public dispose(): void {
    WebviewPanel.currentPanel = undefined;
    this.panel.dispose();
    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}
