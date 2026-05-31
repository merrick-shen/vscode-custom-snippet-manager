/**
 * 片段数据服务
 * 负责代码片段的持久化存储、CRUD 操作以及文件夹分类管理
 * 存储结构：
 *   - folders.json：文件夹清单（id/name/createdAt/order）
 *   - folders/{folderId}.json：每个文件夹下的片段数组
 *   - snippets.json：旧版单文件，迁移后保留作为备份，不再写入
 * 片段的归属文件夹由其所在文件决定，文件内不冗余存储 folderId
 * 所有文件 I/O 使用异步操作，避免阻塞 Extension Host 事件循环
 */
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

/** 默认文件夹 ID，不可删除；删除其他文件夹并选择保留片段时，片段移入此处 */
export const DEFAULT_FOLDER_ID = 'default';

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
  /** 所属文件夹 ID，运行时附加字段，不持久化（由所在文件决定） */
  folderId?: string;
}

/** 文件夹元数据 */
export interface FolderMeta {
  /** 文件夹唯一标识符 */
  id: string;
  /** 文件夹名称，默认文件夹为空字符串（前端用 i18n 显示） */
  name: string;
  /** 创建时间，ISO 8601 格式 */
  createdAt: string;
  /** 排序序号 */
  order: number;
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
  /** 创建操作的目标文件夹 ID，缺省进默认文件夹 */
  folderId?: string;
  /** 片段数据（不含 id、usageCount、createdAt、folderId） */
  data: Omit<SnippetData, 'id' | 'usageCount' | 'createdAt' | 'folderId'>;
}

/** 删除文件夹时片段的处理方式：move 移入默认文件夹，delete 连同片段删除 */
export type DeleteFolderAction = 'move' | 'delete';

export class SnippetService {
  /** VS Code 全局存储 URI */
  private readonly storageUri: vscode.Uri;
  /** 旧版单文件路径，用于迁移和备份 */
  private readonly legacyFilePath: string;
  /** 文件夹清单文件路径 */
  private readonly foldersMetaPath: string;
  /** 各文件夹片段文件所在目录 */
  private readonly foldersDir: string;
  /** 内存中的文件夹清单 */
  private folders: FolderMeta[] = [];
  /** 内存中各文件夹的片段缓存（元素不含 folderId） */
  private snippetsByFolder: Map<string, SnippetData[]> = new Map();
  /** 加载时的错误信息，供侧边栏 Webview 显示通知 */
  private _loadError: LoadError | null = null;
  /** 初始化 Promise，供外部等待数据加载完成 */
  private initPromise: Promise<void>;
  /** 有未持久化 usageCount 变更的文件夹集合 */
  private dirtyFolders: Set<string> = new Set();
  /** 防抖写入定时器 */
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  /** 防抖延迟（毫秒），高频更新时合并写入 */
  private static readonly DEBOUNCE_MS = 2000;

  constructor(context: vscode.ExtensionContext) {
    this.storageUri = context.globalStorageUri;
    this.legacyFilePath = path.join(this.storageUri.fsPath, 'snippets.json');
    this.foldersMetaPath = path.join(this.storageUri.fsPath, 'folders.json');
    this.foldersDir = path.join(this.storageUri.fsPath, 'folders');
    // 异步初始化：加载数据，外部可通过 ready() 等待完成
    this.initPromise = this.init();
  }

  /** 等待服务初始化完成（数据加载完毕），写操作前必须先 await */
  async ready(): Promise<void> {
    await this.initPromise;
  }

  /** 获取片段数据存储目录路径，供前端"打开目录"功能使用 */
  getStoragePath(): string {
    return this.storageUri.fsPath;
  }

  /** 异步初始化：确保目录存在并加载数据 */
  private async init(): Promise<void> {
    await this.ensureStorageDir();
    await this.load();
  }

  /** 确保存储目录和文件夹子目录存在，不存在则递归创建 */
  private async ensureStorageDir(): Promise<void> {
    for (const dir of [this.storageUri.fsPath, this.foldersDir]) {
      try {
        await fs.promises.access(dir);
      } catch {
        await fs.promises.mkdir(dir, { recursive: true });
      }
    }
  }

  /** 加载文件夹清单和各文件夹片段；首次启用文件夹结构时执行旧数据迁移 */
  private async load(): Promise<void> {
    let metaExists = false;
    try {
      await fs.promises.access(this.foldersMetaPath);
      metaExists = true;
    } catch {
      metaExists = false;
    }

    // 文件夹清单不存在：首次启用文件夹结构，执行迁移
    if (!metaExists) {
      await this.migrateFromLegacy();
      return;
    }

    // 加载文件夹清单
    try {
      const raw = await fs.promises.readFile(this.foldersMetaPath, 'utf-8');
      const parsed = JSON.parse(raw) as FolderMeta[];
      this.folders = this.normalizeFolders(parsed);
    } catch {
      // 清单损坏：备份并重置为仅含默认文件夹
      await this.backupCorruptedFile(this.foldersMetaPath);
      this.folders = [this.createDefaultFolderMeta()];
    }

    // 确保默认文件夹始终存在且排在最前
    if (!this.folders.some((f) => f.id === DEFAULT_FOLDER_ID)) {
      this.folders.unshift(this.createDefaultFolderMeta());
    }

    // 逐个加载文件夹片段到内存
    for (const folder of this.folders) {
      const list = await this.loadFolderSnippets(folder.id);
      this.snippetsByFolder.set(folder.id, list);
    }
  }

  /**
   * 从旧版单文件迁移到文件夹结构
   * 旧 snippets.json 的片段整体并入默认文件夹，旧文件保留不动作为备份
   */
  private async migrateFromLegacy(): Promise<void> {
    this.folders = [this.createDefaultFolderMeta()];
    let legacySnippets: SnippetData[] = [];

    let legacyExists = false;
    try {
      await fs.promises.access(this.legacyFilePath);
      legacyExists = true;
    } catch {
      legacyExists = false;
    }

    if (legacyExists) {
      try {
        const raw = await fs.promises.readFile(this.legacyFilePath, 'utf-8');
        const parsed = JSON.parse(raw) as SnippetData[];
        legacySnippets = parsed.map((s) => this.normalizeSnippet(s));
      } catch {
        // 旧文件损坏：备份后以空数据迁移，避免数据永久丢失
        await this.backupCorruptedFile(this.legacyFilePath);
        legacySnippets = [];
      }
    }

    this.snippetsByFolder.set(DEFAULT_FOLDER_ID, legacySnippets);
    // 写入新结构，旧 snippets.json 不删除（作为备份）
    await this.saveFoldersMeta();
    await this.saveFolderSnippets(DEFAULT_FOLDER_ID);
  }

  /** 构造默认文件夹元数据，name 留空由前端用 i18n 显示 */
  private createDefaultFolderMeta(): FolderMeta {
    return { id: DEFAULT_FOLDER_ID, name: '', createdAt: new Date(0).toISOString(), order: 0 };
  }

  /** 规范化文件夹清单，过滤非法项并补全缺失字段 */
  private normalizeFolders(parsed: FolderMeta[]): FolderMeta[] {
    if (!Array.isArray(parsed)) {
      return [this.createDefaultFolderMeta()];
    }
    return parsed
      .filter((f) => f && typeof f.id === 'string' && f.id)
      .map((f, i) => ({
        id: f.id,
        name: typeof f.name === 'string' ? f.name : '',
        createdAt: typeof f.createdAt === 'string' ? f.createdAt : new Date().toISOString(),
        order: typeof f.order === 'number' ? f.order : i,
      }));
  }

  /** 规范化单条片段，剔除运行时 folderId 并补全缺省字段 */
  private normalizeSnippet(s: SnippetData): SnippetData {
    const { folderId: _omit, ...rest } = s;
    void _omit;
    return {
      ...rest,
      usageCount: rest.usageCount ?? 0,
      createdAt: rest.createdAt ?? new Date(0).toISOString(),
    };
  }

  /** 加载单个文件夹的片段文件，解析失败时备份并返回空数组 */
  private async loadFolderSnippets(folderId: string): Promise<SnippetData[]> {
    const filePath = this.folderFilePath(folderId);
    try {
      await fs.promises.access(filePath);
    } catch {
      return [];
    }
    try {
      const raw = await fs.promises.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(raw) as SnippetData[];
      return parsed.map((s) => this.normalizeSnippet(s));
    } catch {
      await this.backupCorruptedFile(filePath);
      return [];
    }
  }

  /** 计算指定文件夹片段文件的绝对路径 */
  private folderFilePath(folderId: string): string {
    return path.join(this.foldersDir, `${folderId}.json`);
  }

  /** 备份损坏的数据文件，并存储错误信息供 Webview 显示 */
  private async backupCorruptedFile(filePath: string): Promise<void> {
    try {
      let finalBakPath = filePath + '.bak';
      let counter = 1;
      // 检查备份文件是否已存在，避免覆盖
      while (true) {
        try {
          await fs.promises.access(finalBakPath);
          finalBakPath = `${filePath}.bak.${counter}`;
          counter++;
        } catch {
          break;
        }
      }
      await fs.promises.copyFile(filePath, finalBakPath);
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

  /** 持久化文件夹清单到 folders.json */
  private async saveFoldersMeta(): Promise<void> {
    try {
      await fs.promises.writeFile(this.foldersMetaPath, JSON.stringify(this.folders, null, 2), 'utf-8');
    } catch (err) {
      console.error('[SnippetService] Failed to save folders meta:', err);
    }
  }

  /** 持久化单个文件夹的片段到 folders/{folderId}.json */
  private async saveFolderSnippets(folderId: string): Promise<void> {
    const list = this.snippetsByFolder.get(folderId) ?? [];
    try {
      await fs.promises.writeFile(this.folderFilePath(folderId), JSON.stringify(list, null, 2), 'utf-8');
    } catch (err) {
      console.error(`[SnippetService] Failed to save folder "${folderId}":`, err);
    }
  }

  /** 删除文件夹的片段文件，文件不存在则忽略 */
  private async deleteFolderFile(folderId: string): Promise<void> {
    try {
      await fs.promises.unlink(this.folderFilePath(folderId));
    } catch {
      // 文件不存在，无需处理
    }
  }

  /** 规范化 language 字段：去除每项前后空格，确保逗号分隔格式一致 */
  private normalizeLanguage(language: string): string {
    return language.split(',').map((l) => l.trim()).filter(Boolean).join(',');
  }

  /** 基于时间戳和随机数生成唯一 ID */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
  }

  // ===== 文件夹查询 =====

  /** 获取文件夹清单（按 order 升序），返回副本避免外部修改内部状态 */
  getFolders(): FolderMeta[] {
    return [...this.folders].sort((a, b) => a.order - b.order);
  }

  // ===== 片段查询 =====

  /**
   * 获取所有片段，每条附加运行时 folderId 字段（标识所属文件夹）
   * 补全、插入等全局功能直接使用；前端据 folderId 分组显示
   * 顺序：按文件夹 order，再按文件夹内原有顺序
   */
  getAll(): SnippetData[] {
    const result: SnippetData[] = [];
    for (const folder of this.getFolders()) {
      const list = this.snippetsByFolder.get(folder.id) ?? [];
      for (const s of list) {
        result.push({ ...s, folderId: folder.id });
      }
    }
    return result;
  }

  /**
   * 获取指定文件夹的片段（不含 folderId），供按文件夹导出使用
   * 文件夹不存在时返回空数组
   */
  getSnippetsByFolder(folderId: string): SnippetData[] {
    const list = this.snippetsByFolder.get(folderId) ?? [];
    return list.map((s) => ({ ...s }));
  }

  /**
   * 在所有文件夹中按 id 定位片段
   * @returns 片段所在文件夹 id、数组下标和片段引用，未找到返回 null
   */
  private findLocation(id: string): { folderId: string; index: number; snippet: SnippetData } | null {
    for (const [folderId, list] of this.snippetsByFolder) {
      const index = list.findIndex((s) => s.id === id);
      if (index !== -1) {
        return { folderId, index, snippet: list[index] };
      }
    }
    return null;
  }

  /** 校验并归一目标文件夹 id：不存在的文件夹回退到默认文件夹 */
  private resolveFolderId(folderId?: string): string {
    if (folderId && this.folders.some((f) => f.id === folderId)) {
      return folderId;
    }
    return DEFAULT_FOLDER_ID;
  }

  // ===== 片段 CRUD =====

  /**
   * 创建片段，存入 data.folderId 指定的文件夹（缺省进默认文件夹）
   * 自动生成 id、初始化 usageCount 和 createdAt
   * @returns 创建的片段（附带 folderId）
   */
  async create(data: Omit<SnippetData, 'id'>): Promise<SnippetData> {
    await this.ready();
    const folderId = this.resolveFolderId(data.folderId);
    // 剔除运行时 folderId，存储体不含该字段
    const { folderId: _omit, ...rest } = data;
    void _omit;
    const snippet: SnippetData = {
      ...rest,
      id: this.generateId(),
      language: this.normalizeLanguage(rest.language ?? '*'),
      usageCount: rest.usageCount ?? 0,
      createdAt: rest.createdAt ?? new Date().toISOString(),
    };
    const list = this.snippetsByFolder.get(folderId) ?? [];
    list.push(snippet);
    this.snippetsByFolder.set(folderId, list);
    await this.saveFolderSnippets(folderId);
    return { ...snippet, folderId };
  }

  /**
   * 更新片段；若 data.folderId 与当前不同，则将片段迁移到目标文件夹
   * 保留原 id、usageCount 和 createdAt
   * @returns 更新后的片段（附带 folderId），未找到返回 null
   */
  async update(id: string, data: Omit<SnippetData, 'id'>): Promise<SnippetData | null> {
    await this.ready();
    const loc = this.findLocation(id);
    if (!loc) {
      return null;
    }
    const oldFolderId = loc.folderId;
    const newFolderId =
      data.folderId !== undefined ? this.resolveFolderId(data.folderId) : oldFolderId;
    const { folderId: _omit, ...rest } = data;
    void _omit;
    // 合并字段，强制保留原 id/usageCount/createdAt
    const updated: SnippetData = {
      ...loc.snippet,
      ...rest,
      id,
      language: this.normalizeLanguage(rest.language ?? loc.snippet.language),
      usageCount: loc.snippet.usageCount,
      createdAt: loc.snippet.createdAt,
    };

    if (newFolderId === oldFolderId) {
      // 同文件夹内原地更新
      const list = this.snippetsByFolder.get(oldFolderId)!;
      list[loc.index] = updated;
      await this.saveFolderSnippets(oldFolderId);
    } else {
      // 跨文件夹迁移：旧文件夹移除，新文件夹追加，两个文件都需持久化
      const oldList = this.snippetsByFolder.get(oldFolderId)!;
      oldList.splice(loc.index, 1);
      const newList = this.snippetsByFolder.get(newFolderId) ?? [];
      newList.push(updated);
      this.snippetsByFolder.set(newFolderId, newList);
      await Promise.all([
        this.saveFolderSnippets(oldFolderId),
        this.saveFolderSnippets(newFolderId),
      ]);
    }
    return { ...updated, folderId: newFolderId };
  }

  /**
   * 删除片段，跨文件夹查找
   * @returns 是否删除成功
   */
  async delete(id: string): Promise<boolean> {
    await this.ready();
    const loc = this.findLocation(id);
    if (!loc) {
      return false;
    }
    const list = this.snippetsByFolder.get(loc.folderId)!;
    list.splice(loc.index, 1);
    this.dirtyFolders.delete(loc.folderId);
    await this.saveFolderSnippets(loc.folderId);
    return true;
  }

  /**
   * 增加片段使用计数，使用防抖批量写入降低高频补全时的磁盘开销
   * 立即更新内存，延迟持久化
   */
  incrementUsage(id: string): void {
    const loc = this.findLocation(id);
    if (!loc) {
      return;
    }
    loc.snippet.usageCount = (loc.snippet.usageCount ?? 0) + 1;
    this.dirtyFolders.add(loc.folderId);
    this.scheduleSave();
  }

  /** 安排防抖写入：DEBOUNCE_MS 后将所有脏文件夹写入磁盘 */
  private scheduleSave(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
    this.saveTimer = setTimeout(() => {
      void this.flushDirty();
    }, SnippetService.DEBOUNCE_MS);
  }

  /** 将所有脏文件夹写入磁盘并清空脏标记 */
  private async flushDirty(): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    const dirty = Array.from(this.dirtyFolders);
    this.dirtyFolders.clear();
    await Promise.all(dirty.map((folderId) => this.saveFolderSnippets(folderId)));
  }

  /** 立即刷盘所有待写入的 usageCount 变更，扩展停用时调用 */
  flush(): void {
    void this.flushDirty();
  }

  /**
   * 清空所有数据：删除全部用户文件夹及其片段，仅保留空的默认文件夹
   * @returns 被清空的片段总数
   */
  async clearAll(): Promise<number> {
    await this.ready();
    let count = 0;
    // 待删除磁盘文件的文件夹 id（默认文件夹只清空不删文件）
    const filesToDelete: string[] = [];
    for (const [folderId, list] of this.snippetsByFolder) {
      count += list.length;
      if (folderId !== DEFAULT_FOLDER_ID) {
        filesToDelete.push(folderId);
      }
    }
    // 仅保留空的默认文件夹，移除其余文件夹的清单与内存缓存
    this.folders = [this.createDefaultFolderMeta()];
    this.snippetsByFolder.clear();
    this.snippetsByFolder.set(DEFAULT_FOLDER_ID, []);
    // 清除脏标记，避免防抖刷盘覆盖空数据后又写回旧计数
    this.dirtyFolders.clear();
    await Promise.all([
      this.saveFoldersMeta(),
      this.saveFolderSnippets(DEFAULT_FOLDER_ID),
      ...filesToDelete.map((folderId) => this.deleteFolderFile(folderId)),
    ]);
    return count;
  }

  // ===== 批量导入 =====

  /**
   * 批量执行导入操作，所有变更在内存完成后按文件夹合并写入
   * create 操作进入 op.folderId 指定的文件夹（缺省默认文件夹）
   * update 操作就地更新（不改变所属文件夹）
   * @param operations 导入操作列表
   */
  async batchImport(operations: ImportOperation[]): Promise<void> {
    await this.ready();
    const affected = new Set<string>();
    // 批量导入时为每个片段生成递增 1ms 的唯一时间戳，避免同批次片段 createdAt 相同导致排序失效
    const baseTime = Date.now();

    for (let i = 0; i < operations.length; i++) {
      const op = operations[i];
      if (op.type === 'create') {
        const folderId = this.resolveFolderId(op.folderId);
        const snippet: SnippetData = {
          ...op.data,
          id: this.generateId(),
          language: this.normalizeLanguage(op.data.language ?? '*'),
          usageCount: 0,
          createdAt: new Date(baseTime + i).toISOString(),
        };
        const list = this.snippetsByFolder.get(folderId) ?? [];
        list.push(snippet);
        this.snippetsByFolder.set(folderId, list);
        affected.add(folderId);
      } else if (op.type === 'update' && op.id) {
        const loc = this.findLocation(op.id);
        if (loc) {
          const list = this.snippetsByFolder.get(loc.folderId)!;
          // 覆盖更新：保留原 id/usageCount/createdAt
          list[loc.index] = {
            ...loc.snippet,
            ...op.data,
            id: op.id,
            language: this.normalizeLanguage(op.data.language ?? loc.snippet.language),
            usageCount: loc.snippet.usageCount,
            createdAt: loc.snippet.createdAt,
          };
          affected.add(loc.folderId);
        }
      }
    }

    await Promise.all(Array.from(affected).map((folderId) => this.saveFolderSnippets(folderId)));
  }

  // ===== 文件夹 CRUD =====

  /**
   * 创建文件夹，名称需非空且不与现有文件夹重名（忽略大小写、去空格）
   * @returns 创建的文件夹元数据，名称非法或重名时返回 null
   */
  async createFolder(name: string): Promise<FolderMeta | null> {
    await this.ready();
    const trimmed = name.trim();
    if (!trimmed) {
      return null;
    }
    if (this.folderNameExists(trimmed)) {
      return null;
    }
    const maxOrder = this.folders.reduce((m, f) => Math.max(m, f.order), 0);
    const folder: FolderMeta = {
      id: this.generateId(),
      name: trimmed,
      createdAt: new Date().toISOString(),
      order: maxOrder + 1,
    };
    this.folders.push(folder);
    this.snippetsByFolder.set(folder.id, []);
    await Promise.all([this.saveFoldersMeta(), this.saveFolderSnippets(folder.id)]);
    return folder;
  }

  /**
   * 重命名文件夹，默认文件夹不可重命名
   * 新名称需非空且不与其他文件夹重名
   * @returns 是否成功
   */
  async renameFolder(folderId: string, name: string): Promise<boolean> {
    await this.ready();
    if (folderId === DEFAULT_FOLDER_ID) {
      return false;
    }
    const folder = this.folders.find((f) => f.id === folderId);
    if (!folder) {
      return false;
    }
    const trimmed = name.trim();
    if (!trimmed || this.folderNameExists(trimmed, folderId)) {
      return false;
    }
    folder.name = trimmed;
    await this.saveFoldersMeta();
    return true;
  }

  /**
   * 删除文件夹，默认文件夹不可删除
   * @param action move 将片段移入默认文件夹，delete 连同片段一并删除
   * @returns 是否成功
   */
  async deleteFolder(folderId: string, action: DeleteFolderAction): Promise<boolean> {
    await this.ready();
    if (folderId === DEFAULT_FOLDER_ID) {
      return false;
    }
    const idx = this.folders.findIndex((f) => f.id === folderId);
    if (idx === -1) {
      return false;
    }
    const snippets = this.snippetsByFolder.get(folderId) ?? [];

    if (action === 'move' && snippets.length > 0) {
      // 将片段并入默认文件夹后再删除文件夹
      const defaultList = this.snippetsByFolder.get(DEFAULT_FOLDER_ID) ?? [];
      defaultList.push(...snippets);
      this.snippetsByFolder.set(DEFAULT_FOLDER_ID, defaultList);
      await this.saveFolderSnippets(DEFAULT_FOLDER_ID);
    }

    // 从清单和内存缓存移除，删除磁盘文件
    this.folders.splice(idx, 1);
    this.snippetsByFolder.delete(folderId);
    this.dirtyFolders.delete(folderId);
    await Promise.all([this.saveFoldersMeta(), this.deleteFolderFile(folderId)]);
    return true;
  }

  /** 检查文件夹名称是否已存在（忽略大小写和首尾空格），excludeId 排除自身 */
  private folderNameExists(name: string, excludeId?: string): boolean {
    const lower = name.trim().toLowerCase();
    return this.folders.some(
      (f) => f.id !== excludeId && f.name.trim().toLowerCase() === lower
    );
  }
}