/**
 * 片段数据服务
 * 负责代码片段的持久化存储和 CRUD 操作
 * 数据存储在 VS Code 全局存储目录下的 snippets.json 文件中
 * 支持数据变更事件通知，便于补全提供者等模块响应数据变化
 */
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

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
}

/** 数据变更事件类型 */
export type SnippetChangeType = 'create' | 'update' | 'delete';

/** 数据变更事件回调函数类型 */
export type SnippetChangeHandler = (type: SnippetChangeType, snippet: SnippetData) => void;

export class SnippetService {
  /** VS Code 全局存储 URI */
  private readonly storageUri: vscode.Uri;
  /** 数据文件路径 */
  private readonly filePath: string;
  /** 内存中的片段数据缓存 */
  private snippets: SnippetData[] = [];
  /** 数据变更事件处理器列表 */
  private changeHandlers: SnippetChangeHandler[] = [];

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

  /** 从文件加载片段数据到内存，解析失败时重置为空数组 */
  private load(): void {
    if (fs.existsSync(this.filePath)) {
      try {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        this.snippets = JSON.parse(raw) as SnippetData[];
      } catch {
        // 文件损坏时重置为空数组，避免阻塞整个扩展
        this.snippets = [];
      }
    } else {
      this.snippets = [];
    }
  }

  /** 将内存中的片段数据持久化到文件 */
  private save(): void {
    fs.writeFileSync(this.filePath, JSON.stringify(this.snippets, null, 2), 'utf-8');
  }

  /**
   * 注册数据变更事件处理器
   * 当片段被创建、更新或删除时，所有注册的处理器都会被调用
   * @param handler 变更事件回调函数
   * @returns 取消注册的函数
   */
  public onChange(handler: SnippetChangeHandler): () => void {
    this.changeHandlers.push(handler);
    // 返回取消注册的函数，方便调用者管理生命周期
    return () => {
      this.changeHandlers = this.changeHandlers.filter((h) => h !== handler);
    };
  }

  /**
   * 通知所有变更事件处理器
   * @param type 变更类型
   * @param snippet 变更的片段数据
   */
  private notifyChange(type: SnippetChangeType, snippet: SnippetData): void {
    this.changeHandlers.forEach((handler) => {
      try {
        handler(type, snippet);
      } catch {
        // 处理器异常不影响其他处理器和主流程
      }
    });
  }

  /** 获取所有片段的浅拷贝 */
  getAll(): SnippetData[] {
    return [...this.snippets];
  }

  /**
   * 根据 ID 获取单个片段
   * @param id 片段唯一标识符
   * @returns 片段数据，未找到时返回 undefined
   */
  getById(id: string): SnippetData | undefined {
    return this.snippets.find((s) => s.id === id);
  }

  /**
   * 根据语言筛选片段
   * @param language 语言标识符，'*' 返回所有片段
   */
  getByLanguage(language: string): SnippetData[] {
    if (language === '*') {
      return this.getAll();
    }
    return this.snippets.filter((s) => s.language === language || s.language === '*');
  }

  /** 创建新片段，自动生成唯一 ID 并持久化 */
  create(data: Omit<SnippetData, 'id'>): SnippetData {
    const snippet: SnippetData = {
      id: this.generateId(),
      ...data,
    };
    this.snippets.push(snippet);
    this.save();
    this.notifyChange('create', snippet);
    return snippet;
  }

  /** 根据 ID 更新片段，返回更新后的数据，未找到时返回 null */
  update(id: string, data: Omit<SnippetData, 'id'>): SnippetData | null {
    const idx = this.snippets.findIndex((s) => s.id === id);
    if (idx === -1) {
      return null;
    }
    this.snippets[idx] = { id, ...data };
    this.save();
    this.notifyChange('update', this.snippets[idx]);
    return this.snippets[idx];
  }

  /** 根据 ID 删除片段，返回是否删除成功 */
  delete(id: string): boolean {
    const idx = this.snippets.findIndex((s) => s.id === id);
    if (idx === -1) {
      return false;
    }
    const deleted = this.snippets[idx];
    this.snippets.splice(idx, 1);
    this.save();
    this.notifyChange('delete', deleted);
    return true;
  }

  /** 基于时间戳和随机数生成唯一 ID */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
  }
}
