/**
 * 扩展入口文件
 * 负责初始化各服务并注册命令和视图提供者
 */
import * as vscode from 'vscode';
import { WebviewPanel } from './webviewPanel';
import { SidebarWebviewProvider } from './sidebarWebviewProvider';
import { SnippetService } from './snippetService';

export function activate(context: vscode.ExtensionContext): void {
  // 初始化片段数据服务，使用全局存储路径持久化数据
  const snippetService = new SnippetService(context);

  // 创建侧边栏 Webview 视图提供者，负责渲染片段列表
  const sidebarProvider = new SidebarWebviewProvider(context.extensionUri, snippetService, context);

  // 注册侧边栏 Webview 视图，设置为 webview 类型并保留上下文
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      SidebarWebviewProvider.viewType,
      sidebarProvider,
      {
        webviewOptions: {
          // 切换到其他视图时保留 webview 状态，避免重新加载
          retainContextWhenHidden: true,
        },
      }
    )
  );

  // 注册 openEditor 命令：从侧边栏打开编辑器面板，可传入片段数据进行编辑
  context.subscriptions.push(
    vscode.commands.registerCommand('custom-snippet-manager.openEditor', (snippet) => {
      WebviewPanel.createOrShow(context.extensionUri, snippetService, context, snippet ?? null);
    })
  );

  // 注册 refreshSidebar 命令：编辑器保存/删除片段后刷新侧边栏列表
  context.subscriptions.push(
    vscode.commands.registerCommand('custom-snippet-manager.refreshSidebar', () => {
      sidebarProvider.refresh();
    })
  );
}

export function deactivate(): void {}
