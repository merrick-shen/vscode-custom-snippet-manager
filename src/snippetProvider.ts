/**
 * 代码补全提供者
 * 根据代码片段的 prefix 属性提供自动补全建议
 * 根据当前编辑器语言自动筛选适用的代码片段
 */
import * as vscode from 'vscode';
import { SnippetService, SnippetData } from './snippetService';

/**
 * VS Code 语言标识符到片段 language 值的别名映射
 * 用于将片段的 language 属性映射到 VS Code 实际使用的 languageId
 * 例如：片段 language 为 'javascript' 时，在 javascriptreact 文件中也应生效
 */
const LANGUAGE_ALIASES: Record<string, string[]> = {
  javascript: ['javascript', 'javascriptreact'],
  typescript: ['typescript', 'typescriptreact'],
  html: ['html'],
  css: ['css'],
  json: ['json'],
  markdown: ['markdown'],
  java: ['java'],
  csharp: ['csharp'],
  cpp: ['cpp', 'c'],
  c: ['c'],
  go: ['go'],
  rust: ['rust'],
  php: ['php'],
  ruby: ['ruby'],
  swift: ['swift'],
  kotlin: ['kotlin'],
  vue: ['vue'],
  scss: ['scss'],
  less: ['less'],
  shellscript: ['shellscript'],
  sql: ['sql'],
  yaml: ['yaml'],
  xml: ['xml'],
  dart: ['dart'],
  lua: ['lua'],
  r: ['r'],
  dockerfile: ['dockerfile'],
};

export class SnippetCompletionProvider implements vscode.CompletionItemProvider {
  /** 片段数据服务，用于获取片段列表 */
  private readonly snippetService: SnippetService;

  constructor(snippetService: SnippetService) {
    this.snippetService = snippetService;
  }

  /**
   * 提供补全项
   * 根据当前文档语言筛选匹配的片段，将 prefix 作为触发关键词
   * 通过分析当前行已输入的文本来确定替换范围
   */
  public provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken,
    _context: vscode.CompletionContext
  ): vscode.CompletionItem[] {
    // 获取当前编辑器的语言标识符
    const currentLang = document.languageId;
    // 获取所有片段
    const allSnippets = this.snippetService.getAll();
    // 筛选适用于当前语言的片段
    const matchedSnippets = this.filterByLanguage(allSnippets, currentLang);

    // 获取当前行从行首到光标位置的文本，用于确定替换范围
    const linePrefix = document.lineAt(position.line).text.substring(0, position.character);

    return matchedSnippets.map((snippet) => {
      const item = new vscode.CompletionItem(
        snippet.prefix,
        vscode.CompletionItemKind.Snippet
      );

      item.insertText = new vscode.SnippetString(snippet.body);
      // 补全详情显示片段名称
      item.detail = snippet.name;
      // 补全文档显示描述和代码预览
      item.documentation = new vscode.MarkdownString(
        this.buildDocumentation(snippet)
      );
      // 设置排序和过滤文本，确保 prefix 能被正确匹配
      item.filterText = snippet.prefix;
      item.sortText = snippet.prefix;

      // 计算替换范围：从当前行中与 prefix 匹配的起始位置到光标位置
      // 这样用户输入部分 prefix 时，补全会替换已输入的部分
      const replaceRange = this.getReplaceRange(linePrefix, snippet.prefix, position);
      if (replaceRange) {
        item.range = replaceRange;
      }

      return item;
    });
  }

  /**
   * 计算补全项的替换范围
   * 从当前行已输入文本中找到与 prefix 重叠的部分，确定替换的起始位置
   * 例如：用户输入 "con"，prefix 为 "console"，则替换范围为 "con" 所在的位置
   * @param linePrefix 当前行从行首到光标的文本
   * @param snippetPrefix 片段的触发前缀
   * @param position 当前光标位置
   */
  private getReplaceRange(
    linePrefix: string,
    snippetPrefix: string,
    position: vscode.Position
  ): vscode.Range | undefined {
    // 从行首文本中查找与 prefix 匹配的起始位置
    // 使用不区分大小写的匹配，提升用户体验
    const lowerLine = linePrefix.toLowerCase();
    const lowerPrefix = snippetPrefix.toLowerCase();

    // 尝试从行尾向前查找 prefix 的起始位置
    for (let i = linePrefix.length; i >= 0; i--) {
      const remaining = lowerLine.substring(i);
      if (lowerPrefix.startsWith(remaining) && remaining.length > 0) {
        return new vscode.Range(
          new vscode.Position(position.line, i),
          position
        );
      }
    }

    // 如果没有找到重叠部分，则不设置范围（使用默认行为）
    return undefined;
  }

  /**
   * 根据当前编辑器语言筛选适用的片段
   * language 为 '*' 的片段适用于所有语言
   * 特定语言的片段通过 LANGUAGE_ALIASES 映射匹配
   */
  private filterByLanguage(snippets: SnippetData[], currentLang: string): SnippetData[] {
    return snippets.filter((snippet) => {
      // 所有语言都匹配
      if (snippet.language === '*') {
        return true;
      }
      // 精确匹配
      if (snippet.language === currentLang) {
        return true;
      }
      // 通过别名映射匹配
      const aliases = LANGUAGE_ALIASES[snippet.language];
      if (aliases && aliases.includes(currentLang)) {
        return true;
      }
      return false;
    });
  }

  /**
   * 构建补全项的 Markdown 文档
   * 包含描述和代码预览，方便用户确认片段内容
   */
  private buildDocumentation(snippet: SnippetData): string {
    let doc = '';
    if (snippet.description) {
      doc += snippet.description + '\n\n';
    }
    // 代码预览使用对应语言的语法高亮
    doc += '```' + (snippet.language === '*' ? '' : snippet.language) + '\n';
    doc += snippet.body;
    doc += '\n```';
    return doc;
  }
}
