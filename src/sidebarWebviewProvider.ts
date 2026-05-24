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
import { WebviewPanel } from './webviewPanel';

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
  /** 重复策略选择的 Promise resolve 回调 */
  private pendingStrategyResolve: ((strategy: string | null) => void) | null = null;
  /** 重复策略选择的超时定时器 */
  private pendingStrategyTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(extensionUri: vscode.Uri, snippetService: SnippetService, context: vscode.ExtensionContext) {
    this.extensionUri = extensionUri;
    this.snippetService = snippetService;
    // 从扩展目录的 package.json 动态读取版本号，避免硬编码
    const appVersion = this.readAppVersion(context.extensionPath);
    this.importExportService = new ImportExportService(snippetService, appVersion);
    this.context = context;
  }

  /** 从扩展目录的 package.json 读取版本号 */
  private readAppVersion(extensionPath: string): string {
    try {
      const pkgPath = path.join(extensionPath, 'package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      return pkg.version || '0.0.0';
    } catch {
      return '0.0.0';
    }
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

    // Webview 重新加载时，清理可能残留的重复策略回调
    this.cleanupPendingStrategy();

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

    // 检查片段数据加载时是否有错误，通过 Webview 通知显示
    const loadError = this.snippetService.consumeLoadError();
    if (loadError) {
      this.showNotification('error', loadError.errorKey, loadError.errorParams);
    }
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
        const validLocales = ['zh', 'zh-TW', 'en', 'ja', 'ko', 'ru', 'de', 'fr', 'es', 'pt', 'it', 'pl', 'tr'];
        if (validLocales.includes(locale)) {
          this.setLocale(locale);
          // 同步语言设置到编辑器面板
          WebviewPanel.currentPanel?.postToWebview('localeChanged', locale);
        }
        break;
      }

      // 前端请求导出代码片段
      case 'exportSnippets': {
        const result = await this.importExportService.exportSnippets();
        this.postToView('exportResult', { success: result.success, count: result.count });
        break;
      }

      // 前端请求导入代码片段
      case 'importSnippets': {
        const result = await this.importExportService.importSnippets(
          (count) => this.askDuplicateStrategyViaWebview(count)
        );
        if (result) {
          // 检查是否为导入错误（含 errorKey 字段）
          if ('errorKey' in result) {
            const err = result as { errorKey: string; errorParams?: Record<string, string | number> };
            this.postToView('importError', { errorKey: err.errorKey, errorParams: err.errorParams });
          } else {
            // 导入成功后刷新列表
            this.postToView('importResult', result);
            this.postToView('snippetsList', this.snippetService.getAll());
          }
        }
        break;
      }

      // 前端返回重复策略选择结果
      case 'duplicateStrategyChoice': {
        const strategy = msg.payload as string | null;
        if (this.pendingStrategyResolve) {
          // 清除超时定时器
          if (this.pendingStrategyTimer) {
            clearTimeout(this.pendingStrategyTimer);
            this.pendingStrategyTimer = null;
          }
          this.pendingStrategyResolve(strategy);
          this.pendingStrategyResolve = null;
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

  /**
   * 在侧边栏显示通知消息
   * 由编辑器面板创建/更新片段成功后调用
   * @param type 通知类型：success / warning / error
   * @param messageKey i18n 键名（如 create.success、update.success）
   * @param params i18n 插值参数
   */
  public showNotification(type: 'success' | 'warning' | 'error', messageKey: string, params?: Record<string, string>): void {
    if (this.view) {
      this.postToView('showNotification', { type, messageKey, params: params ?? {} });
    }
  }

  /**
   * 通过 Webview 自定义对话框询问重复片段处理策略
   * 发送消息到前端显示对话框，等待用户选择后返回结果
   * 超时 5 分钟自动取消，防止 Webview 被关闭后 Promise 永远挂起
   * @param count 重复片段数量
   * @returns 用户选择的策略，null 表示取消或超时
   */
  private askDuplicateStrategyViaWebview(count: number): Promise<string | null> {
    return new Promise((resolve) => {
      // 清理上一次可能残留的回调（防御性处理）
      this.cleanupPendingStrategy();
      this.pendingStrategyResolve = resolve;
      // 5 分钟超时，自动取消等待
      this.pendingStrategyTimer = setTimeout(() => {
        this.pendingStrategyResolve = null;
        this.pendingStrategyTimer = null;
        resolve(null);
      }, 5 * 60 * 1000);
      this.postToView('showDuplicateDialog', { count });
    });
  }

  /** 清理残留的重复策略回调，用于 Webview 重新加载或关闭时 */
  private cleanupPendingStrategy(): void {
    if (this.pendingStrategyTimer) {
      clearTimeout(this.pendingStrategyTimer);
      this.pendingStrategyTimer = null;
    }
    if (this.pendingStrategyResolve) {
      this.pendingStrategyResolve(null);
      this.pendingStrategyResolve = null;
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
