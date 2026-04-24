/**
 * 扩展入口文件
 * 负责初始化各服务并注册命令、视图提供者和代码补全提供者
 * 实现代码片段的完整生命周期：创建、编辑、删除、补全和插入
 * 支持中英文国际化提示信息
 */
import * as vscode from 'vscode';
import { WebviewPanel } from './webviewPanel';
import { SidebarWebviewProvider } from './sidebarWebviewProvider';
import { SnippetService } from './snippetService';
import { SnippetCompletionProvider } from './snippetProvider';

/**
 * 国际化文本映射
 * 根据当前 VS Code 语言设置返回对应的提示文本
 * 覆盖所有命令中用户可见的提示信息
 */
function getI18n(): Record<string, string> {
  const lang = vscode.env.language;
  // 中文语言环境（包括 zh-CN, zh-TW, zh-HK 等）
  const isZh = lang.startsWith('zh');

  if (isZh) {
    return {
      noActiveEditor: '没有活动的编辑器',
      noSnippets: '暂无代码片段，请先创建一个！',
      noSnippetsForLang: '当前语言没有可用的代码片段。',
      selectSnippet: '选择要插入的代码片段',
      snippetInserted: '代码片段已插入',
      noSelection: '请先选中代码再保存到片段库',
      enterPrefix: '输入代码片段前缀（用于触发补全）',
      enterName: '输入代码片段名称',
      prefixRequired: '前缀不能为空',
      nameRequired: '名称不能为空',
      snippetSaved: '代码片段「{name}」已保存到片段库',
      saveFailed: '保存代码片段失败',
    };
  }

  return {
    noActiveEditor: 'No active editor',
    noSnippets: 'No snippets available. Create one first!',
    noSnippetsForLang: 'No snippets available for this language.',
    selectSnippet: 'Select a snippet to insert',
    snippetInserted: 'Snippet inserted',
    noSelection: 'Please select code before saving to snippet library',
    enterPrefix: 'Enter snippet prefix (for triggering completion)',
    enterName: 'Enter snippet name',
    prefixRequired: 'Prefix is required',
    nameRequired: 'Name is required',
    snippetSaved: 'Snippet "{name}" saved to library',
    saveFailed: 'Failed to save snippet',
  };
}

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
          retainContextWhenHidden: true,
        },
      }
    )
  );

  // ===== 代码补全提供者 =====
  // 为所有文件类型注册通用的补全提供者
  // 内部根据片段的 language 属性自动筛选适用的片段
  const completionProvider = new SnippetCompletionProvider(snippetService);
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      { scheme: 'file' },
      completionProvider
    )
  );

  // ===== 命令注册 =====

  // 增加片段使用计数：补全项被接受时自动调用
  context.subscriptions.push(
    vscode.commands.registerCommand('custom-snippet-manager.incrementUsage', (snippetId: string) => {
      if (snippetId) {
        snippetService.incrementUsage(snippetId);
      }
    })
  );

  // 打开编辑器面板：从侧边栏打开，可传入片段数据进行编辑
  context.subscriptions.push(
    vscode.commands.registerCommand('custom-snippet-manager.openEditor', (snippet) => {
      WebviewPanel.createOrShow(context.extensionUri, snippetService, context, snippet ?? null);
    })
  );

  // 刷新侧边栏：编辑器保存/删除片段后刷新侧边栏列表
  context.subscriptions.push(
    vscode.commands.registerCommand('custom-snippet-manager.refreshSidebar', () => {
      sidebarProvider.refresh();
    })
  );

  // 打开代码片段库：聚焦侧边栏视图
  context.subscriptions.push(
    vscode.commands.registerCommand('custom-snippet-manager.openSnippetLibrary', () => {
      vscode.commands.executeCommand('custom-snippet-manager.sidebar.focus');
    })
  );

  // 插入代码片段：通过 QuickPick 选择片段并插入到当前编辑器
  context.subscriptions.push(
    vscode.commands.registerCommand('custom-snippet-manager.insertSnippet', async () => {
      const i18n = getI18n();
      const editor = vscode.window.activeTextEditor;
      // 没有活动编辑器时提示用户
      if (!editor) {
        vscode.window.showWarningMessage(i18n.noActiveEditor);
        return;
      }

      const allSnippets = snippetService.getAll();
      // 没有任何片段时提示创建
      if (allSnippets.length === 0) {
        vscode.window.showInformationMessage(i18n.noSnippets);
        return;
      }

      // 筛选适用于当前语言的片段
      const currentLang = editor.document.languageId;
      const matchedSnippets = allSnippets.filter((s) =>
        s.language === '*' || s.language === currentLang
      );

      // 当前语言没有匹配的片段
      if (matchedSnippets.length === 0) {
        vscode.window.showInformationMessage(i18n.noSnippetsForLang);
        return;
      }

      // 构建 QuickPick 选项，显示前缀、名称和描述
      const items = matchedSnippets.map((s) => ({
        label: s.prefix,
        description: s.name,
        detail: s.description || '',
        snippet: s,
      }));

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: i18n.selectSnippet,
        matchOnDescription: true,
        matchOnDetail: true,
      });

      if (!selected) {
        return;
      }

      const snippetString = new vscode.SnippetString(selected.snippet.body);
      editor.insertSnippet(snippetString);
      // 插入成功后增加使用计数
      snippetService.incrementUsage(selected.snippet.id);
    })
  );

  // 触发代码片段补全：手动触发 VS Code 的建议列表
  context.subscriptions.push(
    vscode.commands.registerCommand('custom-snippet-manager.triggerCompletion', () => {
      vscode.commands.executeCommand('editor.action.triggerSuggest');
    })
  );

  // 保存选中代码到片段库：右键菜单或命令面板触发
  context.subscriptions.push(
    vscode.commands.registerCommand('custom-snippet-manager.saveSelectionToSnippet', async () => {
      const i18n = getI18n();
      const editor = vscode.window.activeTextEditor;

      // 没有活动编辑器
      if (!editor) {
        vscode.window.showWarningMessage(i18n.noActiveEditor);
        return;
      }

      // 获取选中的文本
      const selection = editor.selection;
      const selectedText = editor.document.getText(selection);

      // 没有选中内容
      if (!selectedText.trim()) {
        vscode.window.showWarningMessage(i18n.noSelection);
        return;
      }

      // 自动识别当前文件的语言
      const currentLang = editor.document.languageId;

      // 第一步：输入前缀
      const prefix = await vscode.window.showInputBox({
        prompt: i18n.enterPrefix,
        placeHolder: 'log',
        validateInput: (value) => {
          if (!value.trim()) {
            return i18n.prefixRequired;
          }
          return undefined;
        },
      });

      // 用户取消输入
      if (prefix === undefined) {
        return;
      }

      // 第二步：输入名称
      const name = await vscode.window.showInputBox({
        prompt: i18n.enterName,
        placeHolder: 'Console Log',
        value: prefix,
        validateInput: (value) => {
          if (!value.trim()) {
            return i18n.nameRequired;
          }
          return undefined;
        },
      });

      // 用户取消输入
      if (name === undefined) {
        return;
      }

      // 创建片段，自动设置语言和代码内容
      try {
        snippetService.create({
          name: name.trim(),
          prefix: prefix.trim(),
          body: selectedText,
          description: '',
          language: currentLang,
        });

        // 刷新侧边栏
        sidebarProvider.refresh();

        // 保存成功提示
        vscode.window.showInformationMessage(
          i18n.snippetSaved.replace('{name}', name.trim())
        );
      } catch {
        vscode.window.showErrorMessage(i18n.saveFailed);
      }
    })
  );
}

export function deactivate(): void {}
