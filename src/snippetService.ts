/**
 * 片段数据服务
 * 负责代码片段的持久化存储和 CRUD 操作
 * 数据存储在 VS Code 全局存储目录下的 snippets.json 文件中
 * 支持数据变更事件通知，便于补全提供者等模块响应数据变化
 */
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

/** 片段数据结构 */
export interface SnippetData {
  /** 唯一标识符 */
  id: string;
  /** 片段名称 */
  name: string;
  /** 触发前缀，输入此值触发补全 */
  prefix: string;
  /** 代码片段内容 */
  body: string;
  /** 片段描述 */
  description: string;
  /** 适用语言，'*' 表示所有语言 */
  language: string;
  /** 使用次数，用于按频率排序 */
  usageCount?: number;
  /** 创建时间，ISO 8601 格式，用于按日期排序 */
  createdAt?: string;
}

/** 加载错误信息，供 Webview 端用 i18n 渲染 */
export interface LoadError {
  /** i18n 键名 */
  errorKey: string;
  /** i18n 插值参数 */
  errorParams?: Record<string, string>;
}

/** 批量导入操作类型 */
export interface ImportOperation {
  /** 操作类型：创建或更新 */
  type: 'create' | 'update';
  /** 更新操作的目标片段 ID */
  id?: string;
  /** 片段数据（不含 id、usageCount、createdAt） */
  data: Omit<SnippetData, 'id' | 'usageCount' | 'createdAt'>;
}

export class SnippetService {
  /** VS Code 全局存储 URI */
  private readonly storageUri: vscode.Uri;
  /** 数据文件路径 */
  private readonly filePath: string;
  /** 内存中的片段数据缓存 */
  private snippets: SnippetData[] = [];
  /** 加载时的错误信息，供侧边栏 Webview 显示通知 */
  private _loadError: LoadError | null = null;

  constructor(context: vscode.ExtensionContext) {
    this.storageUri = context.globalStorageUri;
    this.filePath = path.join(this.storageUri.fsPath, 'snippets.json');
    this.ensureStorageDir();
    this.load();
  }

  /** 确保存储目录存在，不存在则递归创建 */
  private ensureStorageDir(): void {
    const dir = this.storageUri.fsPath;
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /** 从文件加载片段数据到内存，解析失败时备份损坏文件并提示用户 */
  private load(): void {
    if (fs.existsSync(this.filePath)) {
      try {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw) as SnippetData[];
        // 兼容旧数据：为缺少 usageCount/createdAt 的片段补充默认值
        this.snippets = parsed.map((s) => ({
          ...s,
          usageCount: s.usageCount ?? 0,
          createdAt: s.createdAt ?? new Date(0).toISOString(),
        }));
      } catch {
        // 文件损坏时备份原文件，避免数据永久丢失
        this.backupCorruptedFile();
        this.snippets = [];
      }
    } else {
      this.snippets = [];
    }
  }

  /** 备份损坏的数据文件，并存储错误信息供 Webview 显示 */
  private backupCorruptedFile(): void {
    try {
      const bakPath = this.filePath + '.bak';
      // 如果备份文件已存在，添加数字后缀避免覆盖
      let finalBakPath = bakPath;
      let counter = 1;
      while (fs.existsSync(finalBakPath)) {
        finalBakPath = `${this.filePath}.bak.${counter}`;
        counter++;
      }
      fs.copyFileSync(this.filePath, finalBakPath);
      // 存储错误信息，供侧边栏 Webview 用 i18n 渲染通知
      this._loadError = {
        errorKey: 'loadError.corrupted',
        errorParams: { path: finalBakPath },
      };
    } catch {
      // 备份也失败时存储另一种错误信息
      this._loadError = {
        errorKey: 'loadError.backupFailed',
      };
    }
  }

  /** 获取加载错误信息，调用后自动清除 */
  consumeLoadError(): LoadError | null {
    const err = this._loadError;
    this._loadError = null;
    return err;
  }

  /** 将内存中的片段数据持久化到文件 */
  private save(): void {
    fs.writeFileSync(this.filePath, JSON.stringify(this.snippets, null, 2), 'utf-8');
  }

  /** 规范化 language 字段：去除每项前后空格，确保逗号分隔格式一致 */
  private normalizeLanguage(language: string): string {
    return language.split(',').map((l) => l.trim()).filter(Boolean).join(',');
  }

  /** 获取所有片段的浅拷贝 */
  getAll(): SnippetData[] {
    return [...this.snippets];
  }

  /** 创建新片段，自动生成唯一 ID 并持久化 */
  create(data: Omit<SnippetData, 'id' | 'usageCount' | 'createdAt'>): SnippetData {
    const snippet: SnippetData = {
      id: this.generateId(),
      usageCount: 0,
      createdAt: new Date().toISOString(),
      ...data,
      // 规范化 language 字段，去除多余空格
      language: this.normalizeLanguage(data.language),
    };
    this.snippets.push(snippet);
    this.save();
    return snippet;
  }

  /** 根据 ID 更新片段，返回更新后的数据，未找到时返回 null */
  update(id: string, data: Omit<SnippetData, 'id' | 'usageCount' | 'createdAt'>): SnippetData | null {
    const idx = this.snippets.findIndex((s) => s.id === id);
    if (idx === -1) {
      return null;
    }
    // 保留原有的 usageCount 和 createdAt
    const { usageCount, createdAt } = this.snippets[idx];
    this.snippets[idx] = { id, usageCount, createdAt, ...data, language: this.normalizeLanguage(data.language) };
    this.save();
    return this.snippets[idx];
  }

  /** 根据 ID 删除片段，返回是否删除成功 */
  delete(id: string): boolean {
    const idx = this.snippets.findIndex((s) => s.id === id);
    if (idx === -1) {
      return false;
    }
    this.snippets.splice(idx, 1);
    this.save();
    return true;
  }

  /** 基于 ID 增加片段的使用计数，用于排序和统计 */
  incrementUsage(id: string): boolean {
    const idx = this.snippets.findIndex((s) => s.id === id);
    if (idx === -1) {
      return false;
    }
    this.snippets[idx].usageCount = (this.snippets[idx].usageCount ?? 0) + 1;
    this.save();
    return true;
  }

  /**
   * 批量导入片段，所有操作在内存中完成后只写一次文件
   * 用于导入大量片段时避免逐条写文件导致的性能问题
   * @param operations 导入操作列表
   */
  batchImport(operations: ImportOperation[]): void {
    for (const op of operations) {
      if (op.type === 'create') {
        const snippet: SnippetData = {
          id: this.generateId(),
          usageCount: 0,
          createdAt: new Date().toISOString(),
          ...op.data,
          // 规范化 language 字段，去除多余空格
          language: this.normalizeLanguage(op.data.language),
        };
        this.snippets.push(snippet);
      } else if (op.type === 'update' && op.id) {
        const idx = this.snippets.findIndex((s) => s.id === op.id);
        if (idx !== -1) {
          // 保留原有的 usageCount 和 createdAt
          const { usageCount, createdAt } = this.snippets[idx];
          this.snippets[idx] = { id: op.id, usageCount, createdAt, ...op.data, language: this.normalizeLanguage(op.data.language) };
        }
      }
    }
    // 所有操作完成后只写一次文件
    this.save();
  }

  /** 基于时间戳和随机数生成唯一 ID */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
  }
}
