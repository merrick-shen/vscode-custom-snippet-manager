/**
 * 文件夹管理对话框状态管理 composable
 * 从 SidebarView.vue 提取，管理文件夹编辑、删除两个对话框的状态和操作
 */
import type { Ref } from 'vue'
import type { Snippet, Folder } from '@/types'
import { DEFAULT_FOLDER_ID } from '@/types'
import { postToExt } from '@/composables/useMessage'

/** composable 依赖配置 */
interface UseFolderDialogsOptions {
  /** 片段列表（用于统计文件夹下片段数量） */
  snippets: Ref<Snippet[]>
  /** i18n 翻译函数 */
  t: (key: string, params?: Record<string, unknown>) => string
  /** 显示警告通知 */
  showWarning: (msg: string) => void
}

/** 文件夹编辑对话框状态：mode 区分新建和重命名 */
interface FolderDialogState {
  visible: boolean
  mode: 'create' | 'rename'
  id: string
  name: string
}

/** 删除文件夹对话框状态，展示该文件夹下的片段数量供用户决策 */
interface DeleteFolderDialogState {
  visible: boolean
  id: string
  name: string
  count: number
}

export function useFolderDialogs(options: UseFolderDialogsOptions) {
  const { snippets, t, showWarning } = options

  // ===== 文件夹编辑对话框（新建/重命名） =====
  const folderDialog = ref<FolderDialogState>({
    visible: false,
    mode: 'create',
    id: '',
    name: '',
  })

  /** 打开新建文件夹对话框 */
  function openCreateFolder() {
    folderDialog.value = { visible: true, mode: 'create', id: '', name: '' }
  }

  /** 打开重命名文件夹对话框（默认文件夹不可重命名） */
  function openRenameFolder(folder: Folder) {
    if (folder.id === DEFAULT_FOLDER_ID) return
    folderDialog.value = { visible: true, mode: 'rename', id: folder.id, name: folder.name }
  }

  /** 提交文件夹对话框：新建或重命名 */
  function submitFolderDialog() {
    const name = folderDialog.value.name.trim()
    if (!name) {
      showWarning(t('folder.nameRequired'))
      return
    }
    if (folderDialog.value.mode === 'create') {
      postToExt('createFolder', { name })
    } else {
      postToExt('renameFolder', { id: folderDialog.value.id, name })
    }
    folderDialog.value.visible = false
  }

  /** 取消文件夹对话框 */
  function cancelFolderDialog() {
    folderDialog.value.visible = false
  }

  // ===== 删除文件夹对话框 =====
  const deleteFolderDialog = ref<DeleteFolderDialogState>({
    visible: false,
    id: '',
    name: '',
    count: 0,
  })

  /** 打开删除文件夹对话框（默认文件夹不可删除） */
  function openDeleteFolder(folder: Folder) {
    if (folder.id === DEFAULT_FOLDER_ID) return
    // 统计该文件夹下的片段数量
    const count = snippets.value.filter((s) => (s.folderId ?? DEFAULT_FOLDER_ID) === folder.id).length
    deleteFolderDialog.value = { visible: true, id: folder.id, name: folder.name, count }
  }

  /** 确认删除文件夹，action 决定片段处理方式 */
  function confirmDeleteFolder(action: 'move' | 'delete') {
    postToExt('deleteFolder', { id: deleteFolderDialog.value.id, action })
    deleteFolderDialog.value.visible = false
  }

  /** 取消删除文件夹 */
  function cancelDeleteFolder() {
    deleteFolderDialog.value.visible = false
  }

  return {
    // 文件夹编辑对话框
    folderDialog,
    openCreateFolder,
    openRenameFolder,
    submitFolderDialog,
    cancelFolderDialog,
    // 删除文件夹对话框
    deleteFolderDialog,
    openDeleteFolder,
    confirmDeleteFolder,
    cancelDeleteFolder,
  }
}
