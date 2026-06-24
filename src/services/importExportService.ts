/**
 * 导入导出服务
 * 负责代码片段配置文件的导入和导出功能，按文件夹组织
 *
 * 导出：
 *   - 支持一次导出多个文件夹，每个文件夹生成一个独立 JSON 文件
 *   - 通过目录选择对话框选定输出目录，批量写入
 *   - 文件命名：{文件夹名}_{YYYYMMDD_HHMMSS}.json，名称冲突时追加序号
 *
 * 导入：
 *   - 一个 JSON 对应一个文件夹
 *   - 支持导入到已有文件夹（按重复策略处理），或按用户指定名称新建文件夹存放
 *
 * 导出 JSON 顶层包含 folder.name，导入据此推荐新建文件夹名称
 * 所有用户可见提示由 Webview 端根据返回数据用 i18n 显示
 */
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import archiver = require('archiver');
import { SnippetService, SnippetData, ImportOperation } from './snippetService';

/** 导出文件的顶层结构（按文件夹组织） */
interface FolderExportData {
  /** 配置文件格式版本 */
  version: string;
  /** 导出时间，ISO 8601 格式 */
  exportedAt: string;
  /** 导出应用的版本号 */
  appVersion: string;
  /** 来源文件夹信息，导入时据此推荐新建文件夹名称 */
  folder: { name: string };
  /** 代码片段数据列表（不含 usageCount/createdAt/folderId） */
  snippets: SnippetData[];
}

/** 导入时的重复处理策略 */
type DuplicateStrategy = 'overwrite' | 'skip' | 'merge';

/**
 * 导入存放方式
 * - new：按 name 新建文件夹存放（名称由前端校验非空且不重名）
 * - existing：导入到 folderId 指定的已有文件夹，按重复策略处理
 */
type ImportPlacement =
  | { mode: 'new'; name: string }
  | { mode: 'existing'; folderId: string };

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
  /** 目标文件夹显示名称，供结果提示使用 */
  folderName: string;
  /** 错误信息列表 */
  errors: string[];
}

/** 导出结果 */
interface ExportResult {
  /** 是否导出成功 */
  success: boolean;
  /** 成功导出的文件夹数量 */
  folderCount?: number;
  /** 成功导出的片段总数 */
  count?: number;
  /** 导出失败的文件夹数量 */
  failedCount?: number;
  /** 导出失败的文件夹名称列表 */
  failedNames?: string[];
}

/** 导入错误类型，包含 i18n key 和参数，供 Webview 端本地化显示 */
interface ImportError {
  /** i18n 键名，对应 Webview 端 importExport 下的键 */
  errorKey: string;
  /** i18n 插值参数 */
  errorParams?: Record<string, string | number>;
}

/** 当前导出格式版本（按文件夹组织的新格式） */
const EXPORT_VERSION = '2.0';

/** 允许导入的最大片段数量，防止恶意大文件 */
const MAX_IMPORT_SNIPPETS = 10000;

/** 允许单个字段的最大长度，防止注入攻击 */
const MAX_FIELD_LENGTH = 100000;

/** 文件夹名称最大长度，与前端 maxlength 保持一致 */
const MAX_FOLDER_NAME_LENGTH = 50;

export class ImportExportService {
  private readonly snippetService: SnippetService;
  /** 应用版本号，从 package.json 动态读取 */
  private readonly appVersion: string;

  constructor(snippetService: SnippetService, appVersion: string) {
    this.snippetService = snippetService;
    this.appVersion = appVersion;
  }

  /**
   * 导出指定文件夹到 JSON 文件
   * 每个文件夹生成一个独立 JSON，统一写入用户选择的目录
   * @param folderIds 待导出的文件夹 id 列表（缺省或空视为全部文件夹）
   * @returns 导出结果，Webview 端据此用 i18n 显示提示
   */
  async exportFolders(folderIds?: string[]): Promise<ExportResult> {
    const allFolders = this.snippetService.getFolders();
    // 缺省或空列表导出全部文件夹
    const targets =
      folderIds && folderIds.length > 0
        ? allFolders.filter((f) => folderIds.includes(f.id))
        : allFolders;

    if (targets.length === 0) {
      return { success: false };
    }

    // 选择输出目录（仅目录，单选）
    const dirUris = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      title: 'Select Export Directory',
      openLabel: 'Export Here',
    });

    if (!dirUris || dirUris.length === 0) {
      // 用户取消
      return { success: false };
    }

    const outputDir = dirUris[0].fsPath;
    const timestamp = this.formatTimestamp(new Date());
    // 记录本批次已用文件名，避免多个同名文件夹覆盖写入
    const usedNames = new Set<string>();
    let folderCount = 0;
    let snippetCount = 0;
    // 收集单个文件夹写入失败的信息，返回给前端显示部分失败提示
    const failedNames: string[] = [];

    for (const folder of targets) {
      const snippets = this.snippetService.getSnippetsByFolder(folder.id);
      // 剔除运行时与统计字段，仅保留片段本体
      const exportableSnippets = snippets.map(
        ({ usageCount, createdAt, folderId: _fid, ...rest }) => rest
      );

      const exportData: FolderExportData = {
        version: EXPORT_VERSION,
        exportedAt: new Date().toISOString(),
        appVersion: this.appVersion,
        folder: { name: folder.name },
        snippets: exportableSnippets,
      };

      // 生成不冲突的文件名
      const fileName = this.resolveExportFileName(folder.name, timestamp, usedNames);
      const filePath = path.join(outputDir, fileName);

      try {
        await fs.promises.writeFile(filePath, JSON.stringify(exportData, null, 2), 'utf-8');
        folderCount++;
        snippetCount += exportableSnippets.length;
      } catch {
        // 单个文件写入失败时记录文件夹名称，继续导出其余文件夹
        failedNames.push(folder.name);
      }
    }

    if (folderCount === 0 && failedNames.length === 0) {
      // 没有可导出的目标文件夹（用户取消或数据为空已在前面处理）
      return { success: false };
    }

    if (folderCount === 0) {
      // 全部文件夹都导出失败
      return {
        success: false,
        failedCount: failedNames.length,
        failedNames,
      };
    }

    return {
      success: true,
      folderCount,
      count: snippetCount,
      failedCount: failedNames.length,
      failedNames,
    };
  }

  /**
   * 生成导出文件名，处理非法字符与同批次重名
   * @param folderName 文件夹名称，空（默认文件夹）回退为 'default'
   * @param timestamp 统一时间戳
   * @param usedNames 本批次已使用的文件名集合
   */
  private resolveExportFileName(
    folderName: string,
    timestamp: string,
    usedNames: Set<string>
  ): string {
    // 替换文件名非法字符，去除首尾空白
    const safeBase =
      this.sanitizeFileName(folderName) || 'default';
    let candidate = `${safeBase}_${timestamp}.json`;
    let counter = 1;
    while (usedNames.has(candidate.toLowerCase())) {
      candidate = `${safeBase}_${timestamp}_${counter}.json`;
      counter++;
    }
    usedNames.add(candidate.toLowerCase());
    return candidate;
  }

  /** 清理文件名中的非法字符，替换为下划线 */
  private sanitizeFileName(name: string): string {
    return name
      .trim()
      .replace(/[\\/:*?"<>|]/g, '_')
      .replace(/\s+/g, '_')
      .slice(0, 80);
  }

  /**
   * 从 JSON 文件导入代码片段（一个 JSON 对应一个文件夹）
   * 流程：选文件 → 校验 → 询问存放方式 → 按方式执行（新建/并入已有）
   * @param askPlacement 存放方式选择回调（新建文件夹或导入到已有文件夹）
   * @param askStrategy 重复策略选择回调（仅导入到已有文件夹且存在重复时使用）
   * @returns 导入结果统计、导入错误（含 i18n key）、或 null（用户取消）
   */
  async importSnippets(
    askPlacement: (info: { suggestedName: string; count: number }) => Promise<ImportPlacement | null>,
    askStrategy: (count: number) => Promise<string | null>
  ): Promise<ImportResult | ImportError | null> {
    // 选择导入文件（单选）
    const uris = await vscode.window.showOpenDialog({
      canSelectMany: false,
      filters: { 'JSON Files': ['json'] },
      title: 'Import Snippet Configuration',
    });

    if (!uris || uris.length === 0) {
      return null;
    }

    // 读取文件
    let rawContent: string;
    try {
      rawContent = await fs.promises.readFile(uris[0].fsPath, 'utf-8');
    } catch (err) {
      return { errorKey: 'importFileReadError', errorParams: { error: String(err) } };
    }

    // 解析 JSON
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      return { errorKey: 'importInvalidJson' };
    }

    // 校验新格式
    const validation = this.validateExportData(parsed);
    if (!validation.valid) {
      return { errorKey: 'importValidationError', errorParams: { error: validation.error || '' } };
    }

    const exportData = parsed as FolderExportData;
    const incomingSnippets = exportData.snippets;
    // 来源文件夹名作为新建文件夹的推荐名（默认文件夹为空时前端会要求用户填写）
    const suggestedName = (exportData.folder?.name ?? '').trim();

    // 询问存放方式
    const placement = await askPlacement({ suggestedName, count: incomingSnippets.length });
    if (!placement) {
      return null;
    }

    if (placement.mode === 'new') {
      return await this.importIntoNewFolder(placement.name, incomingSnippets);
    }
    return await this.importIntoExistingFolder(placement.folderId, incomingSnippets, askStrategy);
  }

  /**
   * 新建文件夹并导入全部片段（全部视为新建，无重复处理）
   * @param name 文件夹名称（前端已校验非空且不重名，此处做最终保护）
   * @param incoming 待导入片段
   */
  private async importIntoNewFolder(
    name: string,
    incoming: SnippetData[]
  ): Promise<ImportResult | ImportError> {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > MAX_FOLDER_NAME_LENGTH) {
      return { errorKey: 'importFolderNameInvalid' };
    }

    const folder = await this.snippetService.createFolder(trimmed);
    if (!folder) {
      // 名称为空或重名（前端校验兜底）
      return { errorKey: 'importFolderNameConflict', errorParams: { name: trimmed } };
    }

    const operations: ImportOperation[] = incoming.map((snippet) => {
      const { id, usageCount, createdAt, ...data } = snippet;
      return { type: 'create', folderId: folder.id, data };
    });

    if (operations.length > 0) {
      await this.snippetService.batchImport(operations);
    }

    return {
      imported: operations.length,
      skipped: 0,
      overwritten: 0,
      merged: 0,
      total: incoming.length,
      folderName: trimmed,
      errors: [],
    };
  }

  /**
   * 导入到已有文件夹，按重复策略处理与目标文件夹内片段的重复
   * @param folderId 目标文件夹 id
   * @param incoming 待导入片段
   * @param askStrategy 重复策略选择回调
   */
  private async importIntoExistingFolder(
    folderId: string,
    incoming: SnippetData[],
    askStrategy: (count: number) => Promise<string | null>
  ): Promise<ImportResult | ImportError | null> {
    const targetFolder = this.snippetService.getFolders().find((f) => f.id === folderId);
    if (!targetFolder) {
      return { errorKey: 'importFolderNotFound' };
    }
    const folderName = targetFolder.name;

    // 仅与目标文件夹内的现有片段比对重复
    const existing = this.snippetService.getSnippetsByFolder(folderId);
    const duplicates = this.findDuplicates(incoming, existing);

    // 确定重复策略
    let strategy: DuplicateStrategy = 'skip';
    if (duplicates.length > 0) {
      const choice = await askStrategy(duplicates.length);
      if (!choice) {
        return null;
      }
      strategy = choice as DuplicateStrategy;
    }

    return await this.applyImport(incoming, existing, strategy, folderId, folderName);
  }

  /**
   * 校验导入数据的格式与安全性（新格式：含 folder 与 snippets）
   * @param data 待校验数据
   */
  private validateExportData(data: unknown): { valid: boolean; error?: string } {
    if (!data || typeof data !== 'object') {
      return { valid: false, error: 'File content is not a valid object' };
    }

    const obj = data as Record<string, unknown>;

    if (typeof obj.version !== 'string' || !obj.version.trim()) {
      return { valid: false, error: 'Missing valid version field' };
    }

    // folder 字段必须存在且含 name 字符串（新格式标志）
    if (!obj.folder || typeof obj.folder !== 'object') {
      return { valid: false, error: 'Missing folder field' };
    }
    const folder = obj.folder as Record<string, unknown>;
    if (typeof folder.name !== 'string') {
      return { valid: false, error: 'Missing folder.name field' };
    }
    if ((folder.name as string).length > MAX_FOLDER_NAME_LENGTH) {
      return { valid: false, error: 'Folder name too long' };
    }

    if (!Array.isArray(obj.snippets)) {
      return { valid: false, error: 'Missing snippets array field' };
    }

    if (obj.snippets.length > MAX_IMPORT_SNIPPETS) {
      return { valid: false, error: `Too many snippets (max ${MAX_IMPORT_SNIPPETS})` };
    }

    for (let i = 0; i < obj.snippets.length; i++) {
      const err = this.validateSnippet(obj.snippets[i], i);
      if (err) {
        return { valid: false, error: err };
      }
    }

    return { valid: true };
  }

  /**
   * 校验单条片段数据的格式与安全性
   * @param snippet 片段数据
   * @param index 数组索引，用于错误提示
   */
  private validateSnippet(snippet: unknown, index: number): string | null {
    if (!snippet || typeof snippet !== 'object') {
      return `Snippet #${index + 1} has invalid format`;
    }

    const s = snippet as Record<string, unknown>;
    const requiredFields = ['id', 'name', 'prefix', 'body', 'description', 'language'];

    for (const field of requiredFields) {
      if (typeof s[field] !== 'string') {
        return `Snippet #${index + 1} missing ${field} field`;
      }
    }

    for (const field of requiredFields) {
      if ((s[field] as string).length > MAX_FIELD_LENGTH) {
        return `Snippet #${index + 1} has ${field} field too long`;
      }
    }

    if (!(s.name as string).trim()) {
      return `Snippet #${index + 1} has empty name`;
    }
    if (!(s.prefix as string).trim()) {
      return `Snippet #${index + 1} has empty prefix`;
    }

    const langParts = (s.language as string).split(',').map((l) => l.trim()).filter(Boolean);
    if (langParts.length === 0) {
      return `Snippet #${index + 1} has empty language`;
    }

    if (s.usageCount !== undefined && (typeof s.usageCount !== 'number' || s.usageCount < 0)) {
      return `Snippet #${index + 1} has invalid usageCount`;
    }

    if (s.createdAt !== undefined && typeof s.createdAt !== 'string') {
      return `Snippet #${index + 1} has invalid createdAt`;
    }

    return null;
  }

  /**
   * 查找导入数据与目标文件夹现有数据中的重复片段
   * 以 id 相同 或 name+prefix 相同判定为重复
   */
  private findDuplicates(incoming: SnippetData[], existing: SnippetData[]): SnippetData[] {
    const existingIds = new Set(existing.map((s) => s.id));
    const existingNamePrefix = new Set(existing.map((s) => `${s.name}||${s.prefix}`));
    return incoming.filter(
      (s) => existingIds.has(s.id) || existingNamePrefix.has(`${s.name}||${s.prefix}`)
    );
  }

  /**
   * 执行导入到指定文件夹，按策略处理重复，所有操作合并写入
   * @param incoming 待导入片段
   * @param existing 目标文件夹现有片段
   * @param strategy 重复处理策略
   * @param targetFolderId 目标文件夹 id（新建片段归入此处）
   * @param folderName 目标文件夹显示名，用于结果提示
   */
  private async applyImport(
    incoming: SnippetData[],
    existing: SnippetData[],
    strategy: DuplicateStrategy,
    targetFolderId: string,
    folderName: string
  ): Promise<ImportResult> {
    const result: ImportResult = {
      imported: 0,
      skipped: 0,
      overwritten: 0,
      merged: 0,
      total: incoming.length,
      folderName,
      errors: [],
    };

    const existingIds = new Set(existing.map((s) => s.id));
    // name+prefix 到现有片段的映射，用于按名称+前缀匹配的覆盖
    const namePrefixMap = new Map<string, SnippetData>();
    for (const s of existing) {
      const key = `${s.name}||${s.prefix}`;
      if (!namePrefixMap.has(key)) {
        namePrefixMap.set(key, s);
      }
    }
    const operations: ImportOperation[] = [];

    for (const snippet of incoming) {
      try {
        const isIdDuplicate = existingIds.has(snippet.id);
        const namePrefixKey = `${snippet.name}||${snippet.prefix}`;
        const isNamePrefixDuplicate = !isIdDuplicate && namePrefixMap.has(namePrefixKey);
        const isDuplicate = isIdDuplicate || isNamePrefixDuplicate;

        // 剔除 id/usageCount/createdAt，由后端补充
        const { id, usageCount, createdAt, ...snippetData } = snippet;

        if (isDuplicate) {
          switch (strategy) {
            case 'overwrite':
              if (isIdDuplicate) {
                operations.push({ type: 'update', id: snippet.id, data: snippetData });
              } else {
                const existingSnippet = namePrefixMap.get(namePrefixKey)!;
                operations.push({ type: 'update', id: existingSnippet.id, data: snippetData });
              }
              result.overwritten++;
              result.imported++;
              break;

            case 'skip':
              result.skipped++;
              break;

            case 'merge':
              operations.push({ type: 'create', folderId: targetFolderId, data: snippetData });
              result.merged++;
              result.imported++;
              break;
          }
        } else {
          operations.push({ type: 'create', folderId: targetFolderId, data: snippetData });
          result.imported++;
        }
      } catch (err) {
        result.errors.push(`Snippet "${snippet.name}": ${err}`);
      }
    }

    if (operations.length > 0) {
      await this.snippetService.batchImport(operations);
    }

    return result;
  }

  /**
   * 格式化时间戳为 YYYYMMDD_HHMMSS
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
   * 将全部文件夹数据导出为 ZIP 备份文件
   * 每个文件夹生成一个 JSON 文件，打包后写入用户指定路径
   * @returns 导出结果，Webview 端据此用 i18n 显示提示
   */
  async exportAllAsZip(): Promise<ExportResult> {
    const allFolders = this.snippetService.getFolders();
    if (allFolders.length === 0) {
      return { success: false };
    }

    // 检查是否有片段数据
    let totalSnippets = 0;
    for (const folder of allFolders) {
      totalSnippets += this.snippetService.getSnippetsByFolder(folder.id).length;
    }
    if (totalSnippets === 0) {
      return { success: false };
    }

    // 选择保存位置
    const timestamp = this.formatTimestamp(new Date());
    const defaultFileName = `snippet_backup_${timestamp}.zip`;
    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(defaultFileName),
      filters: { 'ZIP Files': ['zip'] },
      title: 'Save Backup',
      saveLabel: 'Save Backup',
    });

    if (!uri) {
      return { success: false };
    }

    const zipPath = uri.fsPath;

    try {
      await this.writeZip(allFolders, zipPath, timestamp);
      return { success: true, folderCount: allFolders.length, count: totalSnippets };
    } catch {
      return { success: false };
    }
  }

  /**
   * 将所有文件夹数据写入 ZIP 文件
   * @param folders 文件夹列表
   * @param zipPath ZIP 输出路径
   * @param timestamp 时间戳，用于 JSON 文件命名
   */
  private writeZip(
    folders: { id: string; name: string }[],
    zipPath: string,
    timestamp: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => resolve());
      output.on('error', (err: Error) => reject(err));
      archive.on('error', (err: Error) => reject(err));

      archive.pipe(output);

      const usedNames = new Set<string>();
      for (const folder of folders) {
        const snippets = this.snippetService.getSnippetsByFolder(folder.id);
        if (snippets.length === 0) {
          continue;
        }

        const exportableSnippets = snippets.map(
          ({ usageCount, createdAt, folderId: _fid, ...rest }) => rest
        );

        const exportData: FolderExportData = {
          version: EXPORT_VERSION,
          exportedAt: new Date().toISOString(),
          appVersion: this.appVersion,
          folder: { name: folder.name },
          snippets: exportableSnippets,
        };

        const fileName = this.resolveExportFileName(folder.name, timestamp, usedNames);
        archive.append(JSON.stringify(exportData, null, 2), { name: fileName });
      }

      archive.finalize();
    });
  }
}