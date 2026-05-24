/**
 * 导入导出服务
 * 负责代码片段配置文件的导入和导出功能
 * 导出格式为 JSON，包含版本号、导出时间和片段数据
 * 导入时支持数据验证、重复处理策略（覆盖/跳过/合并）
 * 文件命名格式：code_snippet_config_YYYYMMDD_HHMMSS.json
 * 所有用户可见的提示信息由 Webview 端根据返回数据用 i18n 显示
 */
import * as vscode from 'vscode';
import * as fs from 'fs';
import { SnippetService, SnippetData } from './snippetService';

/** 导出文件的顶层结构 */
interface ExportData {
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
type DuplicateStrategy = 'overwrite' | 'skip' | 'merge';

/** 导入结果统计 */
interface ImportResult {
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

/** 导出结果 */
interface ExportResult {
  /** 是否导出成功 */
  success: boolean;
  /** 导出的片段数量（成功时有值） */
  count?: number;
}

/** 导入错误类型，包含 i18n key 和参数，供 Webview 端本地化显示 */
interface ImportError {
  /** i18n 键名，对应 Webview 端 importExport 下的键 */
  errorKey: string;
  /** i18n 插值参数 */
  errorParams?: Record<string, string | number>;
}

/** 当前导出格式版本 */
const EXPORT_VERSION = '1.0';

/** 允许导入的最大片段数量，防止恶意大文件 */
const MAX_IMPORT_SNIPPETS = 10000;

/** 允许单个字段的最大长度，防止注入攻击 */
const MAX_FIELD_LENGTH = 100000;

export class ImportExportService {
  private readonly snippetService: SnippetService;
  /** 应用版本号，从 package.json 动态读取 */
  private readonly appVersion: string;

  constructor(snippetService: SnippetService, appVersion: string) {
    this.snippetService = snippetService;
    this.appVersion = appVersion;
  }

  /**
   * 导出所有代码片段到 JSON 文件
   * 使用 VS Code 原生文件保存对话框选择保存位置
   * 文件命名格式：code_snippet_config_YYYYMMDD_HHMMSS.json
   * @returns 导出结果，Webview 端根据 success 和 count 用 i18n 显示提示
   */
  async exportSnippets(): Promise<ExportResult> {
    const snippets = this.snippetService.getAll();

    // 导出时剔除 usageCount 和 createdAt 字段
    const exportableSnippets = snippets.map(({ usageCount, createdAt, ...rest }) => rest);

    // 构造导出数据
    const exportData: ExportData = {
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      appVersion: this.appVersion,
      snippets: exportableSnippets,
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
      title: 'Export Snippet Configuration',
    });

    if (!uri) {
      // 用户取消
      return { success: false };
    }

    try {
      const jsonStr = JSON.stringify(exportData, null, 2);
      fs.writeFileSync(uri.fsPath, jsonStr, 'utf-8');
      return { success: true, count: snippets.length };
    } catch {
      return { success: false };
    }
  }

  /**
   * 从 JSON 文件导入代码片段
   * 使用 VS Code 原生文件选择对话框，支持数据验证和重复处理
   * @param askStrategy 重复策略选择回调，用于 Webview 自定义对话框
   * @returns 导入结果统计、导入错误（含 i18n key）、或 null（用户取消）
   */
  async importSnippets(
    askStrategy?: (count: number) => Promise<string | null>
  ): Promise<ImportResult | ImportError | null> {
    // 打开文件选择对话框
    const uris = await vscode.window.showOpenDialog({
      canSelectMany: false,
      filters: {
        'JSON Files': ['json'],
      },
      title: 'Import Snippet Configuration',
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
      return {
        errorKey: 'importFileReadError',
        errorParams: { error: String(err) },
      };
    }

    // 解析并验证 JSON
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      return { errorKey: 'importInvalidJson' };
    }

    // 验证数据格式
    const validation = this.validateExportData(parsed);
    if (!validation.valid) {
      return {
        errorKey: 'importValidationError',
        errorParams: { error: validation.error || '' },
      };
    }

    const exportData = parsed as ExportData;
    const incomingSnippets = exportData.snippets;

    // 检查是否有重复片段
    const existingSnippets = this.snippetService.getAll();
    const duplicates = this.findDuplicates(incomingSnippets, existingSnippets);

    // 确定重复处理策略
    let strategy: DuplicateStrategy | null = 'skip';
    if (duplicates.length > 0) {
      // 优先使用外部传入的回调（Webview 自定义对话框），否则使用系统对话框
      if (askStrategy) {
        const choice = await askStrategy(duplicates.length);
        if (!choice) {
          return null;
        }
        strategy = choice as DuplicateStrategy;
      } else {
        // 降级：使用 VS Code 原生对话框
        const result = await vscode.window.showInformationMessage(
          `Found ${duplicates.length} duplicate snippet(s). How would you like to handle them?`,
          { modal: true },
          'Overwrite',
          'Skip',
          'Merge'
        );
        switch (result) {
          case 'Overwrite': strategy = 'overwrite'; break;
          case 'Skip': strategy = 'skip'; break;
          case 'Merge': strategy = 'merge'; break;
          default: return null;
        }
      }
    }

    // 执行导入
    return this.applyImport(incomingSnippets, existingSnippets, strategy);
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
      return { valid: false, error: 'File content is not a valid object' };
    }

    const obj = data as Record<string, unknown>;

    // 检查 version 字段
    if (typeof obj.version !== 'string' || !obj.version.trim()) {
      return { valid: false, error: 'Missing valid version field' };
    }

    // 检查 snippets 字段
    if (!Array.isArray(obj.snippets)) {
      return { valid: false, error: 'Missing snippets array field' };
    }

    // 检查片段数量上限
    if (obj.snippets.length > MAX_IMPORT_SNIPPETS) {
      return { valid: false, error: `Too many snippets (max ${MAX_IMPORT_SNIPPETS})` };
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
      return `Snippet #${index + 1} has invalid format`;
    }

    const s = snippet as Record<string, unknown>;
    // 必填字段不包含 usageCount 和 createdAt，导入时自动补充
    const requiredFields = ['id', 'name', 'prefix', 'body', 'description', 'language'];

    // 检查必填字段
    for (const field of requiredFields) {
      if (typeof s[field] !== 'string') {
        return `Snippet #${index + 1} missing ${field} field`;
      }
    }

    // 检查字段长度限制，防止恶意超长内容
    const stringFields = ['id', 'name', 'prefix', 'body', 'description', 'language'];
    for (const field of stringFields) {
      if ((s[field] as string).length > MAX_FIELD_LENGTH) {
        return `Snippet #${index + 1} has ${field} field too long`;
      }
    }

    // 检查 name 和 prefix 非空
    if (!(s.name as string).trim()) {
      return `Snippet #${index + 1} has empty name`;
    }
    if (!(s.prefix as string).trim()) {
      return `Snippet #${index + 1} has empty prefix`;
    }

    // 检查 language 字段：支持逗号分隔的多语言，每个值必须非空
    const langValue = s.language as string;
    const langParts = langValue.split(',').map((l: string) => l.trim()).filter(Boolean);
    if (langParts.length === 0) {
      return `Snippet #${index + 1} has empty language`;
    }

    // 如果存在 usageCount，必须为非负数字
    if (s.usageCount !== undefined && (typeof s.usageCount !== 'number' || s.usageCount < 0)) {
      return `Snippet #${index + 1} has invalid usageCount`;
    }

    // 如果存在 createdAt，必须为有效字符串
    if (s.createdAt !== undefined && typeof s.createdAt !== 'string') {
      return `Snippet #${index + 1} has invalid createdAt`;
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

        // 导入时过滤掉 usageCount 和 createdAt，由 create 方法自动补充
        const { usageCount, createdAt, ...snippetData } = snippet;

        if (isDuplicate) {
          switch (strategy) {
            case 'overwrite':
              // 覆盖：更新现有片段（保留原有的 usageCount 和 createdAt）
              this.snippetService.update(snippet.id, {
                name: snippetData.name,
                prefix: snippetData.prefix,
                body: snippetData.body,
                description: snippetData.description,
                language: snippetData.language,
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
                name: snippetData.name,
                prefix: snippetData.prefix,
                body: snippetData.body,
                description: snippetData.description,
                language: snippetData.language,
              });
              result.merged++;
              result.imported++;
              break;
          }
        } else {
          // 非重复：直接创建
          this.snippetService.create({
            name: snippetData.name,
            prefix: snippetData.prefix,
            body: snippetData.body,
            description: snippetData.description,
            language: snippetData.language,
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
}
