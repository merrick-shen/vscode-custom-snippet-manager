/**
 * 片段数据服务
 * 负责代码片段的持久化存储和 CRUD 操作
 * 数据存储在 VS Code 全局存储目录下的 snippets.json 文件中
 * 所有文件 I/O 使用异步操作，避免阻塞 Extension Host 事件循环
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
  /** 初始化完成标志，防止在数据加载完成前执行写操作 */
  private initialized = false;
  /** 初始化 Promise，供外部等待数据加载完成 */
  private initPromise: Promise<void>;

  constructor(context: vscode.ExtensionContext) {
    this.storageUri = context.globalStorageUri;
    this.filePath = path.join(this.storageUri.fsPath, 'snippets.json');
    // 异步初始化：加载数据，外部可通过 ready() 等待完成
    this.initPromise = this.init();
  }

  /** 等待服务初始化完成（数据加载完毕），写操作前必须先 await */
  async ready(): Promise<void> {
    await this.initPromise;
  }

  /** 异步初始化：确保目录存在并加载数据 */
  private async init(): Promise<void> {
    await this.ensureStorageDir();
    await this.load();
    this.initialized = true;
  }

  /** 确保存储目录存在，不存在则递归创建 */
  private async ensureStorageDir(): Promise<void> {
    const dir = this.storageUri.fsPath;
    try {
      await fs.promises.access(dir);
    } catch {
      await fs.promises.mkdir(dir, { recursive: true });
    }
  }

  /** 从文件加载片段数据到内存，解析失败时备份损坏文件并提示用户 */
  private async load(): Promise<void> {
    try {
      await fs.promises.access(this.filePath);
    } catch {
      // 文件不存在，使用空列表
      this.snippets = [];
      return;
    }

    try {
      const raw = await fs.promises.readFile(this.filePath, 'utf-8');
      const parsed = JSON.parse(raw) as SnippetData[];
      // 兼容旧数据：为缺少 usageCount/createdAt 的片段补充默认值
      this.snippets = parsed.map((s) => ({
        ...s,
        usageCount: s.usageCount ?? 0,
        createdAt: s.createdAt ?? new Date(0).toISOString(),
      }));
    } catch {
      // 文件损坏时备份原文件，避免数据永久丢失
      await this.backupCorruptedFile();
      this.snippets = [];
    }
  }

  /** 备份损坏的数据文件，并存储错误信息供 Webview 显示 */
  private async backupCorruptedFile(): Promise<void> {
    try {
      const bakPath = this.filePath + '.bak';
      let finalBakPath = bakPath;
      let counter = 1;
      // 检查备份文件是否已存在，避免覆盖
      while (true) {
        try {
          await fs.promises.access(finalBakPath);
          // 文件存在，尝试下一个后缀
          finalBakPath = `${this.filePath}.bak.${counter}`;
          counter++;
        } catch {
          // 文件不存在，可以使用此路径
          break;
        }
      }
      await fs.promises.copyFile(this.filePath, finalBakPath);
      this._loadError = {
        errorKey: 'loadError.corrupted',
        errorParams: { path: finalBakPath },
      };
    } catch {
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

  /** 将内存中的片段数据异步持久化到文件 */
  private async save(): Promise<void> {
    try {
      await fs.promises.writeFile(this.filePath, JSON.stringify(this.snippets, null, 2), 'utf-8');
    } catch (err) {
      // 写入失败时输出错误日志，避免异常向上抛出导致扩展崩溃
      console.error('[SnippetService] Failed to save snippets:', err);
    }
  }

  /** 规范化 language 字段：去除每项前后空格，确保逗号分隔格式一致 */
  private normalizeLanguage(language: string): string {
    return language.split(',').map((l) => l.trim()).filter(Boolean).join(',');
  }

  /** 获取所有片段的浅拷贝（纯内存操作，无需异步） */
  getAll(): SnippetData[] {
    return [...this.snippets];
  }

  /** 创建新片段，自动生成唯一 ID 并持久化 */
  async create(data: Omit<SnippetData, 'id' | 'usageCount' | 'createdAt'>): Promise<SnippetData> {
    const snippet: SnippetData = {
      id: this.generateId(),
      usageCount: 0,
      createdAt: new Date().toISOString(),
      ...data,
      language: this.normalizeLanguage(data.language),
    };
    this.snippets.push(snippet);
    await this.save();
    return snippet;
  }

  /** 根据 ID 更新片段，返回更新后的数据，未找到时返回 null */
  async update(id: string, data: Omit<SnippetData, 'id' | 'usageCount' | 'createdAt'>): Promise<SnippetData | null> {
    const idx = this.snippets.findIndex((s) => s.id === id);
    if (idx === -1) {
      return null;
    }
    const { usageCount, createdAt } = this.snippets[idx];
    this.snippets[idx] = { id, usageCount, createdAt, ...data, language: this.normalizeLanguage(data.language) };
    await this.save();
    return this.snippets[idx];
  }

  /** 根据 ID 删除片段，返回是否删除成功 */
  async delete(id: string): Promise<boolean> {
    const idx = this.snippets.findIndex((s) => s.id === id);
    if (idx === -1) {
      return false;
    }
    this.snippets.splice(idx, 1);
    await this.save();
    return true;
  }

  /** 基于 ID 增加片段的使用计数，用于排序和统计 */
  async incrementUsage(id: string): Promise<boolean> {
    const idx = this.snippets.findIndex((s) => s.id === id);
    if (idx === -1) {
      return false;
    }
    this.snippets[idx].usageCount = (this.snippets[idx].usageCount ?? 0) + 1;
    await this.save();
    return true;
  }

  /**
   * 批量导入片段，所有操作在内存中完成后只写一次文件
   * 用于导入大量片段时避免逐条写文件导致的性能问题
   */
  async batchImport(operations: ImportOperation[]): Promise<void> {
    for (const op of operations) {
      if (op.type === 'create') {
        const snippet: SnippetData = {
          id: this.generateId(),
          usageCount: 0,
          createdAt: new Date().toISOString(),
          ...op.data,
          language: this.normalizeLanguage(op.data.language),
        };
        this.snippets.push(snippet);
      } else if (op.type === 'update' && op.id) {
        const idx = this.snippets.findIndex((s) => s.id === op.id);
        if (idx !== -1) {
          const { usageCount, createdAt } = this.snippets[idx];
          this.snippets[idx] = { id: op.id, usageCount, createdAt, ...op.data, language: this.normalizeLanguage(op.data.language) };
        }
      }
    }
    await this.save();
  }

  /** 基于时间戳和随机数生成唯一 ID */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
  }
}
