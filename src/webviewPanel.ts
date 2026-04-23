/**
 * 编辑器 Webview 面板
 * 负责创建和管理用于新建/编辑代码片段的独立面板
 * 通过 postMessage 与前端 Vue 应用进行双向通信
 * 支持编辑器就绪检测，确保数据在 webview 完全加载后才发送
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
  /** 待发送给 webview 的片段数据，等 webview 就绪后发送 */
  private pendingSnippet: SnippetData | null = null;
  /** 扩展上下文，用于读取 globalState 中的语言偏好 */
  private readonly context: vscode.ExtensionContext;

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    snippetService: SnippetService,
    context: vscode.ExtensionContext
  ) {
    this.panel = panel;
    this.extensionUri = extensionUri;
    this.snippetService = snippetService;
    this.context = context;

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

    // 面板状态变化时更新标题
    this.panel.onDidChangeViewState(() => {
      this.updateTitle();
    }, null, this.disposables);
  }

  /**
   * 创建或显示编辑器面板
   * 如果面板已存在则复用，否则创建新面板
   * @param extensionUri 扩展资源路径
   * @param snippetService 片段数据服务
   * @param context 扩展上下文
   * @param snippet 可选的片段数据，传入时进入编辑模式
   */
  public static createOrShow(
    extensionUri: vscode.Uri,
    snippetService: SnippetService,
    context: vscode.ExtensionContext,
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

    WebviewPanel.currentPanel = new WebviewPanel(panel, extensionUri, snippetService, context);

    // 保存待发送的片段数据，等 webview 发送 editorReady 后再回填表单
    // 避免使用 setTimeout 固定延迟，确保 webview 完全加载后再通信
    if (snippet) {
      WebviewPanel.currentPanel.pendingSnippet = snippet;
    }
  }

  /** 更新面板标题，反映当前编辑状态 */
  private updateTitle(): void {
    if (this.pendingSnippet) {
      this.panel.title = `Edit: ${this.pendingSnippet.name}`;
    } else {
      this.panel.title = 'New Snippet';
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
        const data = msg.payload as Omit<SnippetData, 'id'>;
        // 校验必填字段
        if (!data.name?.trim() || !data.prefix?.trim() || !data.body?.trim()) {
          this.postToWebview('error', 'Missing required fields');
          return;
        }
        const created = this.snippetService.create(data);
        this.postToWebview('snippetCreated', created);
        // 通知侧边栏刷新列表
        vscode.commands.executeCommand('custom-snippet-manager.refreshSidebar');
        break;
      }

      // 更新片段
      case 'updateSnippet': {
        const payload = msg.payload as { id: string } & Omit<SnippetData, 'id'>;
        const { id, ...data } = payload;
        // 校验必填字段
        if (!id || !data.name?.trim() || !data.prefix?.trim() || !data.body?.trim()) {
          this.postToWebview('error', 'Missing required fields');
          return;
        }
        const updated = this.snippetService.update(id, data);
        if (updated) {
          this.postToWebview('snippetUpdated', updated);
          vscode.commands.executeCommand('custom-snippet-manager.refreshSidebar');
        } else {
          this.postToWebview('error', 'Snippet not found');
        }
        break;
      }

      // 关闭编辑器面板
      case 'closeEditor':
        this.dispose();
        break;

      // webview 就绪通知，此时前端 Vue 应用已挂载，可以安全发送片段数据
      case 'editorReady':
        if (this.pendingSnippet) {
          this.postToWebview('setSnippet', this.pendingSnippet);
          this.pendingSnippet = null;
        }
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
   * 所有资源路径必须使用 asWebviewUri 处理，确保 webview 安全策略下可访问
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

    // 注入视图模式、语言偏好和 VS Code API
    // 前端根据 __VIEW_MODE 决定渲染侧边栏还是编辑器
    const locale = this.context.globalState.get<string>('locale', 'zh');
    html = html.replace(
      '<head>',
      `<head><script>window.__VIEW_MODE = 'editor'; window.__LOCALE = '${locale}'; window.vscode = acquireVsCodeApi()</script>`
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
