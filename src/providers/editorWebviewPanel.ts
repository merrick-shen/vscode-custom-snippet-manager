/**
 * 编辑器 Webview 面板
 * 负责创建和管理用于新建/编辑代码片段的独立面板
 * 通过 postMessage 与前端 Vue 应用进行双向通信
 * 支持编辑器就绪检测，确保数据在 webview 完全加载后才发送
 */
import * as vscode from 'vscode';
import { SnippetService, SnippetData } from '../services/snippetService';
import { buildWebviewHtml, resolveLocale as resolveLocaleShared } from '../shared/webviewHtmlBuilder';

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
  /** 当前正在编辑的片段引用，用于更新面板标题 */
  private currentSnippet: SnippetData | null = null;
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

    // 异步加载 webview HTML 内容
    this.loadWebviewHtml();

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

  /** 异步加载 webview HTML 内容 */
  private async loadWebviewHtml(): Promise<void> {
    this.panel.webview.html = await this.getWebviewHtml(this.panel.webview);
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

    // 面板已存在时复用，并发送片段数据（编辑模式）或清空表单（新建模式）
    if (WebviewPanel.currentPanel) {
      WebviewPanel.currentPanel.panel.reveal(column);
      // 无论编辑还是新建，都发送 setSnippet 消息
      // 编辑模式传入片段数据，新建模式传入 null 清空表单
      WebviewPanel.currentPanel.postToWebview('setSnippet', snippet ?? null);
      // 更新当前编辑的片段引用和面板标题
      WebviewPanel.currentPanel.currentSnippet = snippet ?? null;
      WebviewPanel.currentPanel.updateTitle();
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
      // 初始化当前编辑片段引用
      WebviewPanel.currentPanel.currentSnippet = snippet;
    }
  }

  /** 更新面板标题，反映当前编辑状态 */
  private updateTitle(): void {
    if (this.currentSnippet) {
      this.panel.title = `Edit: ${this.currentSnippet.name}`;
    } else {
      this.panel.title = 'New Snippet';
    }
  }

  /**
   * 处理来自 webview 的消息
   * 根据消息类型执行对应的 CRUD 操作
   */
  private async handleMessage(msg: WebviewMessage): Promise<void> {
    switch (msg.type) {
      // 新建片段
      case 'createSnippet': {
        const data = msg.payload as Omit<SnippetData, 'id'>;
        // 校验必填字段
        if (!data.name?.trim() || !data.prefix?.trim() || !data.body?.trim()) {
          this.postToWebview('error', { errorKey: 'error.missingRequiredFields' });
          return;
        }
        const created = await this.snippetService.create(data);
        this.postToWebview('snippetCreated', created);
        // 通知侧边栏刷新列表并显示成功通知
        vscode.commands.executeCommand('custom-snippet-manager.createSnippetSuccess', created.name);
        break;
      }

      // 更新片段
      case 'updateSnippet': {
        const payload = msg.payload as { id: string } & Omit<SnippetData, 'id'>;
        const { id, ...data } = payload;
        // 校验必填字段
        if (!id || !data.name?.trim() || !data.prefix?.trim() || !data.body?.trim()) {
          this.postToWebview('error', { errorKey: 'error.missingRequiredFields' });
          return;
        }
        const updated = await this.snippetService.update(id, data);
        if (updated) {
          this.postToWebview('snippetUpdated', updated);
          // 通知侧边栏刷新列表并显示成功通知
          vscode.commands.executeCommand('custom-snippet-manager.updateSnippetSuccess', updated.name);
        } else {
          this.postToWebview('error', { errorKey: 'error.snippetNotFound' });
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
          // 同步更新当前编辑片段引用和面板标题
          this.currentSnippet = this.pendingSnippet;
          this.pendingSnippet = null;
          this.updateTitle();
        }
        break;
    }
  }

  /** 向 webview 发送消息 */
  public postToWebview(type: string, payload?: unknown): void {
    this.panel.webview.postMessage({ type, payload });
  }

  /**
   * 生成 webview 的 HTML 内容
   * 委托共享构建函数，注入编辑器特有的全局变量
   */
  private async getWebviewHtml(webview: vscode.Webview): Promise<string> {
    const locale = resolveLocaleShared(this.context);
    // 文件夹清单注入，供编辑器"所属文件夹"下拉框渲染
    const foldersJson = JSON.stringify(this.snippetService.getFolders()).replace(/</g, '\\u003c');

    return buildWebviewHtml(webview, this.extensionUri, {
      viewMode: 'editor',
      locale,
      injectVars: {
        __FOLDERS: foldersJson,
      },
    });
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
