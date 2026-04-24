/**
 * 导入导出服务
 * 负责代码片段配置文件的导入和导出功能
 * 导出格式为 JSON，包含版本号、导出时间和片段数据
 * 导入时支持数据验证、重复处理策略（覆盖/跳过/合并）
 * 文件命名格式：code_snippet_config_YYYYMMDD_HHMMSS.json
 */
import * as vscode from 'vscode';
import * as fs from 'fs';
import { SnippetService, SnippetData } from './snippetService';

/** 导出文件的顶层结构 */
export interface ExportData {
  /** 配置文件格式版本，用于向后兼容 */
  version: string;
  /** 导出时间，ISO 8601 格式 */
  exportedAt: string;
  /** 导出应用的版本号 */
  appVersion: string;
  /** 代码片段数据列表 */
  snippets: SnippetData[];
}

/** 导入时的重复处理策略 */
export type DuplicateStrategy = 'overwrite' | 'skip' | 'merge';

/** 导入结果统计 */
export interface ImportResult {
  /** 成功导入的数量 */
  imported: number;
  /** 被跳过的数量 */
  skipped: number;
  /** 被覆盖的数量 */
  overwritten: number;
  /** 被合并的数量 */
  merged: number;
  /** 总数量 */
  total: number;
  /** 错误信息列表 */
  errors: string[];
}

/** 当前导出格式版本 */
const EXPORT_VERSION = '1.0';

/** 应用版本，从 package.json 读取 */
const APP_VERSION = '1.0.0';

/** 允许导入的最大片段数量，防止恶意大文件 */
const MAX_IMPORT_SNIPPETS = 10000;

/** 允许单个字段的最大长度，防止注入攻击 */
const MAX_FIELD_LENGTH = 100000;

export class ImportExportService {
  private readonly snippetService: SnippetService;

  constructor(snippetService: SnippetService) {
    this.snippetService = snippetService;
  }

  /**
   * 导出所有代码片段到 JSON 文件
   * 使用 VS Code 原生文件保存对话框选择保存位置
   * 文件命名格式：code_snippet_config_YYYYMMDD_HHMMSS.json
   * @returns 是否导出成功
   */
  async exportSnippets(): Promise<boolean> {
    const snippets = this.snippetService.getAll();

    // 构造导出数据
    const exportData: ExportData = {
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      appVersion: APP_VERSION,
      snippets,
    };

    // 生成默认文件名
    const now = new Date();
    const timestamp = this.formatTimestamp(now);
    const defaultFileName = `code_snippet_config_${timestamp}.json`;

    // 打开文件保存对话框
    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(defaultFileName),
      filters: {
        'JSON Files': ['json'],
      },
      title: this.getI18nText('exportDialogTitle'),
    });

    if (!uri) {
      // 用户取消
      return false;
    }

    try {
      const jsonStr = JSON.stringify(exportData, null, 2);
      fs.writeFileSync(uri.fsPath, jsonStr, 'utf-8');
      vscode.window.showInformationMessage(
        this.getI18nText('exportSuccess', String(snippets.length))
      );
      return true;
    } catch (err) {
      vscode.window.showErrorMessage(
        this.getI18nText('exportFailed', String(err))
      );
      return false;
    }
  }

  /**
   * 从 JSON 文件导入代码片段
   * 使用 VS Code 原生文件选择对话框，支持数据验证和重复处理
   * @returns 导入结果统计
   */
  async importSnippets(): Promise<ImportResult | null> {
    // 打开文件选择对话框
    const uris = await vscode.window.showOpenDialog({
      canSelectMany: false,
      filters: {
        'JSON Files': ['json'],
      },
      title: this.getI18nText('importDialogTitle'),
    });

    if (!uris || uris.length === 0) {
      // 用户取消
      return null;
    }

    // 读取文件内容
    let rawContent: string;
    try {
      rawContent = fs.readFileSync(uris[0].fsPath, 'utf-8');
    } catch (err) {
      vscode.window.showErrorMessage(
        this.getI18nText('importFileReadError', String(err))
      );
      return null;
    }

    // 解析并验证 JSON
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      vscode.window.showErrorMessage(this.getI18nText('importInvalidJson'));
      return null;
    }

    // 验证数据格式
    const validation = this.validateExportData(parsed);
    if (!validation.valid) {
      vscode.window.showErrorMessage(
        this.getI18nText('importValidationError', validation.error || '')
      );
      return null;
    }

    const exportData = parsed as ExportData;
    const incomingSnippets = exportData.snippets;

    // 检查是否有重复片段
    const existingSnippets = this.snippetService.getAll();
    const duplicates = this.findDuplicates(incomingSnippets, existingSnippets);

    // 确定重复处理策略
    let strategy: DuplicateStrategy | null = 'skip';
    if (duplicates.length > 0) {
      // 有重复时让用户选择处理策略
      strategy = await this.askDuplicateStrategy(duplicates.length);
      if (!strategy) {
        // 用户取消
        return null;
      }
    }

    // 执行导入
    const result = this.applyImport(incomingSnippets, existingSnippets, strategy);

    // 显示导入结果
    if (result.errors.length > 0) {
      vscode.window.showWarningMessage(
        this.getI18nText('importPartialSuccess', String(result.imported), String(result.errors.length))
      );
    } else {
      vscode.window.showInformationMessage(
        this.getI18nText('importSuccess', String(result.imported))
      );
    }

    return result;
  }

  /**
   * 验证导入数据的格式和内容安全性
   * 检查顶层结构、字段类型、内容长度和恶意内容
   * @param data 待验证的数据
   * @returns 验证结果
   */
  private validateExportData(data: unknown): { valid: boolean; error?: string } {
    // 必须是对象
    if (!data || typeof data !== 'object') {
      return { valid: false, error: this.getI18nText('validationNotObject') };
    }

    const obj = data as Record<string, unknown>;

    // 检查 version 字段
    if (typeof obj.version !== 'string' || !obj.version.trim()) {
      return { valid: false, error: this.getI18nText('validationMissingVersion') };
    }

    // 检查 snippets 字段
    if (!Array.isArray(obj.snippets)) {
      return { valid: false, error: this.getI18nText('validationMissingSnippets') };
    }

    // 检查片段数量上限
    if (obj.snippets.length > MAX_IMPORT_SNIPPETS) {
      return { valid: false, error: this.getI18nText('validationTooManySnippets', String(MAX_IMPORT_SNIPPETS)) };
    }

    // 逐条验证片段数据
    for (let i = 0; i < obj.snippets.length; i++) {
      const snippet = obj.snippets[i];
      const err = this.validateSnippet(snippet, i);
      if (err) {
        return { valid: false, error: err };
      }
    }

    return { valid: true };
  }

  /**
   * 验证单条片段数据的格式和安全性
   * @param snippet 片段数据
   * @param index 在数组中的索引，用于错误提示
   * @returns 错误信息，无错误时返回 null
   */
  private validateSnippet(snippet: unknown, index: number): string | null {
    if (!snippet || typeof snippet !== 'object') {
      return this.getI18nText('validationInvalidSnippet', String(index + 1));
    }

    const s = snippet as Record<string, unknown>;
    const requiredFields: (keyof SnippetData)[] = ['id', 'name', 'prefix', 'body', 'description', 'language'];

    // 检查必填字段
    for (const field of requiredFields) {
      if (typeof s[field] !== 'string') {
        return this.getI18nText('validationMissingField', String(index + 1), field);
      }
    }

    // 检查字段长度限制，防止恶意超长内容
    const stringFields: (keyof SnippetData)[] = ['id', 'name', 'prefix', 'body', 'description', 'language'];
    for (const field of stringFields) {
      if ((s[field] as string).length > MAX_FIELD_LENGTH) {
        return this.getI18nText('validationFieldTooLong', String(index + 1), field);
      }
    }

    // 检查 name 和 prefix 非空
    if (!(s.name as string).trim()) {
      return this.getI18nText('validationEmptyName', String(index + 1));
    }
    if (!(s.prefix as string).trim()) {
      return this.getI18nText('validationEmptyPrefix', String(index + 1));
    }

    return null;
  }

  /**
   * 查找导入数据与现有数据中的重复片段
   * 以 id 相同判定为重复
   * @param incoming 导入的片段列表
   * @param existing 现有的片段列表
   * @returns 重复的片段列表
   */
  private findDuplicates(incoming: SnippetData[], existing: SnippetData[]): SnippetData[] {
    const existingIds = new Set(existing.map((s) => s.id));
    return incoming.filter((s) => existingIds.has(s.id));
  }

  /**
   * 询问用户如何处理重复片段
   * @param duplicateCount 重复数量
   * @returns 用户选择的策略，取消时返回 null
   */
  private async askDuplicateStrategy(duplicateCount: number): Promise<DuplicateStrategy | null> {
    const isZh = vscode.env.language.startsWith('zh');

    const overwriteLabel = isZh ? '覆盖' : 'Overwrite';
    const skipLabel = isZh ? '跳过' : 'Skip';
    const mergeLabel = isZh ? '合并（保留两者）' : 'Merge (Keep Both)';
    const cancelLabel = isZh ? '取消' : 'Cancel';

    const message = isZh
      ? `发现 ${duplicateCount} 个重复片段，如何处理？`
      : `Found ${duplicateCount} duplicate snippet(s). How would you like to handle them?`;

    const result = await vscode.window.showInformationMessage(
      message,
      { modal: true },
      overwriteLabel,
      skipLabel,
      mergeLabel,
      cancelLabel
    );

    switch (result) {
      case overwriteLabel: return 'overwrite';
      case skipLabel: return 'skip';
      case mergeLabel: return 'merge';
      default: return null;
    }
  }

  /**
   * 执行导入操作，根据策略处理重复数据
   * @param incoming 导入的片段列表
   * @param existing 现有的片段列表
   * @param strategy 重复处理策略
   * @returns 导入结果统计
   */
  private applyImport(
    incoming: SnippetData[],
    existing: SnippetData[],
    strategy: DuplicateStrategy | null
  ): ImportResult {
    const result: ImportResult = {
      imported: 0,
      skipped: 0,
      overwritten: 0,
      merged: 0,
      total: incoming.length,
      errors: [],
    };

    const existingIds = new Set(existing.map((s) => s.id));

    for (const snippet of incoming) {
      try {
        const isDuplicate = existingIds.has(snippet.id);

        if (isDuplicate) {
          switch (strategy) {
            case 'overwrite':
              // 覆盖：更新现有片段
              this.snippetService.update(snippet.id, {
                name: snippet.name,
                prefix: snippet.prefix,
                body: snippet.body,
                description: snippet.description,
                language: snippet.language,
              });
              result.overwritten++;
              result.imported++;
              break;

            case 'skip':
              // 跳过：不处理
              result.skipped++;
              break;

            case 'merge':
              // 合并：生成新 ID 保留两者
              this.snippetService.create({
                name: snippet.name,
                prefix: snippet.prefix,
                body: snippet.body,
                description: snippet.description,
                language: snippet.language,
              });
              result.merged++;
              result.imported++;
              break;
          }
        } else {
          // 非重复：直接创建
          this.snippetService.create({
            name: snippet.name,
            prefix: snippet.prefix,
            body: snippet.body,
            description: snippet.description,
            language: snippet.language,
          });
          result.imported++;
        }
      } catch (err) {
        result.errors.push(
          `Snippet "${snippet.name}": ${err}`
        );
      }
    }

    return result;
  }

  /**
   * 格式化时间戳为 YYYYMMDD_HHMMSS
   * @param date 日期对象
   * @returns 格式化的时间戳字符串
   */
  private formatTimestamp(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    return `${y}${m}${d}_${h}${min}${s}`;
  }

  /**
   * 获取国际化文本
   * 根据当前 VS Code 语言设置返回对应的提示文本
   * @param key 文本键
   * @param args 格式化参数
   * @returns 国际化文本
   */
  private getI18nText(key: string, ...args: string[]): string {
    const isZh = vscode.env.language.startsWith('zh');

    const texts: Record<string, Record<string, string>> = {
      exportDialogTitle: {
        zh: '导出代码片段配置',
        en: 'Export Snippet Configuration',
      },
      exportSuccess: {
        zh: '成功导出 {0} 个代码片段',
        en: 'Successfully exported {0} snippet(s)',
      },
      exportFailed: {
        zh: '导出失败：{0}',
        en: 'Export failed: {0}',
      },
      importDialogTitle: {
        zh: '导入代码片段配置',
        en: 'Import Snippet Configuration',
      },
      importFileReadError: {
        zh: '无法读取文件：{0}',
        en: 'Cannot read file: {0}',
      },
      importInvalidJson: {
        zh: '文件内容不是有效的 JSON 格式',
        en: 'File content is not valid JSON',
      },
      importValidationError: {
        zh: '数据验证失败：{0}',
        en: 'Data validation failed: {0}',
      },
      importSuccess: {
        zh: '成功导入 {0} 个代码片段',
        en: 'Successfully imported {0} snippet(s)',
      },
      importPartialSuccess: {
        zh: '导入了 {0} 个片段，{1} 个出错',
        en: 'Imported {0} snippet(s) with {1} error(s)',
      },
      validationNotObject: {
        zh: '文件内容不是有效的对象',
        en: 'File content is not a valid object',
      },
      validationMissingVersion: {
        zh: '缺少有效的 version 字段',
        en: 'Missing valid version field',
      },
      validationMissingSnippets: {
        zh: '缺少 snippets 数组字段',
        en: 'Missing snippets array field',
      },
      validationTooManySnippets: {
        zh: '片段数量超过上限（最大 {0}）',
        en: 'Too many snippets (max {0})',
      },
      validationInvalidSnippet: {
        zh: '第 {0} 个片段数据格式无效',
        en: 'Snippet #{0} has invalid format',
      },
      validationMissingField: {
        zh: '第 {0} 个片段缺少 {1} 字段',
        en: 'Snippet #{0} missing {1} field',
      },
      validationFieldTooLong: {
        zh: '第 {0} 个片段的 {1} 字段过长',
        en: 'Snippet #{0} has {1} field too long',
      },
      validationEmptyName: {
        zh: '第 {0} 个片段名称为空',
        en: 'Snippet #{0} has empty name',
      },
      validationEmptyPrefix: {
        zh: '第 {0} 个片段前缀为空',
        en: 'Snippet #{0} has empty prefix',
      },
    };

    const textMap = texts[key];
    if (!textMap) {
      return key;
    }

    let text = isZh ? textMap.zh : textMap.en;
    // 替换 {0}, {1} 等占位符
    args.forEach((arg, i) => {
      text = text.replace(`{${i}}`, arg);
    });

    return text;
  }
}
