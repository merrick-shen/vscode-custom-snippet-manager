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
import localesData from '../locales.json';

/** Webview 消息格式 */
interface WebviewMessage {
  type: string;
  payload?: unknown;
}

/**
 * 导入存放方式选择结果
 * - new：按 name 新建文件夹存放
 * - existing：导入到 folderId 指定的已有文件夹
 */
type ImportPlacementChoice =
  | { mode: 'new'; name: string }
  | { mode: 'existing'; folderId: string };

export class SidebarWebviewProvider implements vscode.WebviewViewProvider {
  /** 视图标识，需与 package.json 中的 views.id 一致 */
  public static readonly viewType = 'custom-snippet-manager.sidebar';
  /** 侧边栏 Webview 视图实例 */
  private view?: vscode.WebviewView;
  /** 扩展资源 URI */
  private readonly extensionUri: vscode.Uri;
  /** 片段数据服务 */
  private readonly snippetService: SnippetService;
  /** 扩展上下文，用于访问 globalState 持久化语言偏好 */
  private readonly context: vscode.ExtensionContext;
  /** 重复策略选择的 Promise resolve 回调 */
  private pendingStrategyResolve: ((strategy: string | null) => void) | null = null;
  /** 重复策略选择的超时定时器 */
  private pendingStrategyTimer: ReturnType<typeof setTimeout> | null = null;
  /** 导入存放方式选择的 Promise resolve 回调 */
  private pendingPlacementResolve: ((placement: ImportPlacementChoice | null) => void) | null = null;
  /** 导入存放方式选择的超时定时器 */
  private pendingPlacementTimer: ReturnType<typeof setTimeout> | null = null;
  /** 导入导出服务，在 init 中异步初始化 */
  private importExportService!: ImportExportService;
  /** 初始化 Promise，确保 ImportExportService 创建完成 */
  private initPromise: Promise<void>;
  /** 插件版本号，在 init 中从 package.json 读取 */
  private appVersion = '0.0.0';

  constructor(extensionUri: vscode.Uri, snippetService: SnippetService, context: vscode.ExtensionContext) {
    this.extensionUri = extensionUri;
    this.snippetService = snippetService;
    this.context = context;
    // 异步初始化：读取版本号并创建 ImportExportService
    this.initPromise = this.init(context.extensionPath);
  }

  /** 异步初始化：读取版本号并创建导入导出服务 */
  private async init(extensionPath: string): Promise<void> {
    this.appVersion = await this.readAppVersion(extensionPath);
    this.importExportService = new ImportExportService(this.snippetService, this.appVersion);
  }

  /** 从扩展目录的 package.json 读取版本号 */
  private async readAppVersion(extensionPath: string): Promise<string> {
    try {
      const pkgPath = path.join(extensionPath, 'package.json');
      const raw = await fs.promises.readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(raw);
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

  /** 获取排序偏好，默认倒序（由新至旧） */
  public getSortOrder(): string {
    return this.context.globalState.get<string>('sortOrder', 'desc');
  }

  /** 保存排序偏好到 globalState */
  private setSortOrder(order: string): void {
    this.context.globalState.update('sortOrder', order);
  }

  /**
   * VS Code 调用此方法解析 webview 视图
   * 在侧边栏首次展开或视图需要重建时触发
   */
  public async resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): Promise<void> {
    this.view = webviewView;

    // Webview 重新加载时，清理可能残留的重复策略回调
    this.cleanupPendingStrategy();

    // 等待数据加载完成和导入导出服务初始化
    await this.snippetService.ready();
    await this.initPromise;

    // 配置 webview 选项：启用脚本并限制资源加载范围
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, 'webview', 'dist'),
      ],
    };

    // 加载 webview HTML 内容
    webviewView.webview.html = await this.getWebviewHtml(webviewView.webview);

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
        this.postSnippetsList();
        break;

      // 前端请求创建文件夹
      case 'createFolder': {
        const { name } = msg.payload as { name: string };
        const folder = await this.snippetService.createFolder(name ?? '');
        if (folder) {
          this.postFoldersList();
          this.showNotification('success', 'folder.createSuccess', { name: folder.name });
        } else {
          // 名称为空或重名
          this.showNotification('warning', 'folder.createFailed');
        }
        break;
      }

      // 前端请求重命名文件夹
      case 'renameFolder': {
        const { id, name } = msg.payload as { id: string; name: string };
        const ok = await this.snippetService.renameFolder(id, name ?? '');
        if (ok) {
          this.postFoldersList();
          this.showNotification('success', 'folder.renameSuccess', { name: (name ?? '').trim() });
        } else {
          this.showNotification('warning', 'folder.renameFailed');
        }
        break;
      }

      // 前端请求删除文件夹，action 决定片段处理方式（move/delete）
      case 'deleteFolder': {
        const { id, action } = msg.payload as { id: string; action: 'move' | 'delete' };
        const ok = await this.snippetService.deleteFolder(id, action === 'delete' ? 'delete' : 'move');
        if (ok) {
          // 文件夹及片段归属变化，需同时刷新文件夹清单和片段列表
          this.postFoldersList();
          this.postSnippetsList();
          this.showNotification('success', 'folder.deleteSuccess');
        } else {
          this.showNotification('warning', 'folder.deleteFailed');
        }
        break;
      }

      // 前端请求打开编辑器（新建或编辑片段）
      case 'openEditor':
        vscode.commands.executeCommand('custom-snippet-manager.openEditor', msg.payload);
        break;

      // 前端请求删除片段
      case 'deleteSnippet': {
        const { id } = msg.payload as { id: string };
        if (!id) {
          this.postToView('error', { errorKey: 'error.invalidSnippetId' });
          return;
        }
        // 删除前获取片段名称，用于通知
        const allSnippets = this.snippetService.getAll();
        const snippetToDelete = allSnippets.find(s => s.id === id);
        const success = await this.snippetService.delete(id);
        if (success) {
          // 删除成功后刷新列表并发送通知
          this.postSnippetsList();
          this.showNotification('success', 'delete.success', { name: snippetToDelete?.name ?? '' });
        } else {
          this.postToView('error', { errorKey: 'error.snippetNotFound' });
        }
        break;
      }

      // 前端切换语言，持久化保存到 globalState
      case 'changeLocale': {
        const locale = msg.payload as string;
        // 从共享的 locales.json 获取有效语言列表，避免与前端重复维护
        const validLocales = localesData.locales.map(l => l.value);
        if (validLocales.includes(locale)) {
          this.setLocale(locale);
          // 同步语言设置到编辑器面板
          WebviewPanel.currentPanel?.postToWebview('localeChanged', locale);
        }
        break;
      }

      // 前端切换排序方向，持久化保存
      case 'changeSortOrder': {
        const order = msg.payload as string;
        if (order === 'asc' || order === 'desc') {
          this.setSortOrder(order);
        }
        break;
      }

      // 前端请求导出代码片段，payload.folderIds 指定导出范围，缺省/空表示全部文件夹
      case 'exportSnippets': {
        const payload = (msg.payload ?? {}) as { folderIds?: string[] };
        const result = await this.importExportService.exportFolders(payload.folderIds);
        this.postToView('exportResult', {
          success: result.success,
          folderCount: result.folderCount,
          count: result.count,
        });
        break;
      }

      // 前端请求导入代码片段（先选存放方式，再按需选重复策略）
      case 'importSnippets': {
        const result = await this.importExportService.importSnippets(
          (info) => this.askPlacementViaWebview(info),
          (count) => this.askDuplicateStrategyViaWebview(count)
        );
        if (result) {
          // 检查是否为导入错误（含 errorKey 字段）
          if ('errorKey' in result) {
            const err = result as { errorKey: string; errorParams?: Record<string, string | number> };
            this.postToView('importError', { errorKey: err.errorKey, errorParams: err.errorParams });
          } else {
            // 导入可能新建文件夹，需同时刷新文件夹清单和片段列表
            this.postToView('importResult', result);
            this.postFoldersList();
            this.postSnippetsList();
          }
        }
        break;
      }

      // 前端返回导入存放方式选择结果
      case 'importPlacementChoice': {
        const placement = msg.payload as ImportPlacementChoice | null;
        if (this.pendingPlacementResolve) {
          if (this.pendingPlacementTimer) {
            clearTimeout(this.pendingPlacementTimer);
            this.pendingPlacementTimer = null;
          }
          this.pendingPlacementResolve(placement);
          this.pendingPlacementResolve = null;
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

      // 前端请求在外部浏览器中打开链接
      case 'openExternal': {
        const url = msg.payload as string;
        if (url && typeof url === 'string') {
          vscode.env.openExternal(vscode.Uri.parse(url));
        }
        break;
      }

      // 前端请求打开代码片段存储目录
      case 'openSnippetsDirectory': {
        const storagePath = this.snippetService.getStoragePath();
        try {
          // 确保目录存在
          await fs.promises.access(storagePath);
          // 使用系统文件管理器打开目录
          const uri = vscode.Uri.file(storagePath);
          await vscode.env.openExternal(uri);
        } catch {
          // 目录不存在时显示错误提示
          vscode.window.showErrorMessage(vscode.l10n.t('Snippets directory does not exist. Please restart the extension.'));
        }
        break;
      }

      // 前端请求清空所有数据（删除全部用户文件夹及片段，仅保留默认文件夹）
      case 'clearAllSnippets': {
        const count = await this.snippetService.clearAll();
        this.postSnippetsList();
        this.postFoldersList();
        this.showNotification('success', 'clearAll.success', { count: String(count) });
        break;
      }

      // 前端请求导出全部数据为 ZIP 备份
      case 'exportAllBackup': {
        const result = await this.importExportService.exportAllAsZip();
        this.postToView('exportBackupResult', {
          success: result.success,
          folderCount: result.folderCount,
          count: result.count,
        });
        break;
      }
    }
  }

  /** 刷新侧边栏列表，由编辑器面板保存/删除片段后调用 */
  public refresh(): void {
    if (this.view) {
      this.postSnippetsList();
    }
  }

  /** 下发片段列表（含运行时 folderId）给侧边栏 */
  private postSnippetsList(): void {
    this.postToView('snippetsList', this.snippetService.getAll());
  }

  /** 下发文件夹清单给侧边栏 */
  private postFoldersList(): void {
    this.postToView('foldersList', this.snippetService.getFolders());
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

  /**
   * 通过 Webview 自定义对话框询问导入存放方式
   * 发送来源文件夹推荐名与片段数，等待用户选择新建文件夹或并入已有文件夹
   * 超时 5 分钟自动取消
   * @param info 来源文件夹推荐名与片段数量
   * @returns 存放方式选择，null 表示取消或超时
   */
  private askPlacementViaWebview(info: {
    suggestedName: string;
    count: number;
  }): Promise<ImportPlacementChoice | null> {
    return new Promise((resolve) => {
      this.cleanupPendingPlacement();
      this.pendingPlacementResolve = resolve;
      this.pendingPlacementTimer = setTimeout(() => {
        this.pendingPlacementResolve = null;
        this.pendingPlacementTimer = null;
        resolve(null);
      }, 5 * 60 * 1000);
      // 下发当前文件夹清单，供前端选择已有文件夹
      this.postToView('showImportPlacementDialog', {
        suggestedName: info.suggestedName,
        count: info.count,
        folders: this.snippetService.getFolders(),
      });
    });
  }

  /** 清理残留的存放方式回调，用于 Webview 重新加载或关闭时 */
  private cleanupPendingPlacement(): void {
    if (this.pendingPlacementTimer) {
      clearTimeout(this.pendingPlacementTimer);
      this.pendingPlacementTimer = null;
    }
    if (this.pendingPlacementResolve) {
      this.pendingPlacementResolve(null);
      this.pendingPlacementResolve = null;
    }
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
    // 同时清理存放方式回调，避免导入流程中途 Webview 重载导致 Promise 挂起
    this.cleanupPendingPlacement();
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
  private async getWebviewHtml(webview: vscode.Webview): Promise<string> {
    const distUri = vscode.Uri.joinPath(this.extensionUri, 'webview', 'dist');
    const distPath = distUri.fsPath;

    const htmlPath = path.join(distPath, 'index.html');
    try {
      await fs.promises.access(htmlPath);
    } catch {
      return this.getErrorHtml('Run "npm run build:webview" first.');
    }

    let html = await fs.promises.readFile(htmlPath, 'utf-8');

    // 注入视图模式、语言偏好、排序偏好、版本号、存储路径、文件夹清单和 VS Code API
    const locale = this.getLocale();
    const sortOrder = this.getSortOrder();
    const version = this.appVersion;
    const storagePath = this.snippetService.getStoragePath();
    // 文件夹清单序列化注入，供前端首屏渲染分组结构
    const foldersJson = JSON.stringify(this.snippetService.getFolders()).replace(/</g, '\\u003c');
    html = html.replace(
      '<head>',
      `<head><script>window.__VIEW_MODE = 'sidebar'; window.__LOCALE = '${locale}'; window.__SORT_ORDER = '${sortOrder}'; window.__APP_VERSION = '${version}'; window.__STORAGE_PATH = '${storagePath.replace(/\\/g, '\\\\')}'; window.__FOLDERS = ${foldersJson}; window.vscode = acquireVsCodeApi()</script>`
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
