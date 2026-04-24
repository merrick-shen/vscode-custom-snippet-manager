/**
 * 繁體中文語言包
 * 覆蓋應用中所有使用者可見的文字內容
 */
export default {
  app: {
    title: '程式碼片段管理器',
  },
  list: {
    searchPlaceholder: '搜尋程式碼片段...',
    empty: '暫無程式碼片段',
    emptyDesc: '點擊上方按鈕建立你的第一個程式碼片段',
  },
  form: {
    createTitle: '新建程式碼片段',
    editTitle: '編輯程式碼片段',
    createSubtitle: '填寫以下資訊建立新的程式碼片段',
    editSubtitle: '修改程式碼片段的內容和屬性',
    name: '名稱',
    namePlaceholder: '輸入程式碼片段名稱',
    prefix: '前綴',
    prefixPlaceholder: '輸入觸發前綴，如 log',
    body: '程式碼內容',
    bodyPlaceholder: '輸入程式碼內容，支援 $1, $2, $0 游標佔位符',
    bodyHint: '支援 $1, $2, $0 游標佔位符',
    description: '描述',
    descriptionPlaceholder: '輸入程式碼片段描述',
    language: '適用語言',
    languagePlaceholder: '選擇適用語言',
    allLanguages: '所有語言',
    save: '儲存',
    cancel: '取消',
    nameRequired: '請輸入名稱',
    prefixRequired: '請輸入前綴',
    bodyRequired: '請輸入程式碼內容',
  },
  delete: {
    title: '刪除確認',
    content: '確定要刪除程式碼片段「{name}」嗎？此操作無法撤銷。',
    confirm: '刪除',
    cancel: '取消',
  },
  filter: {
    all: '全部',
    label: '語言篩選',
  },
  actions: {
    create: '新建片段',
    edit: '編輯',
    delete: '刪除',
  },
  importExport: {
    exportConfig: '匯出配置',
    importConfig: '匯入配置',
    exportConfirmTitle: '匯出確認',
    exportConfirmContent: '確定要匯出目前所有程式碼片段嗎？',
    importConfirmTitle: '匯入確認',
    importConfirmContent: '確定要匯入程式碼片段配置嗎？匯入後資料將無法撤銷。',
    exportSuccess: '匯出成功！',
    exportFailed: '匯出失敗',
    importSuccess: '匯入成功！共匯入 {count} 個片段。',
    importFailed: '匯入失敗',
    importPartial: '匯入了 {imported} 個片段，{errors} 個出錯。',
    noDataToExport: '暫無資料可匯出',
  },
  sort: {
    newestFirst: '由新至舊',
    oldestFirst: '由舊至新',
  },
  lang: {
    name: '繁體中文',
  },
  error: {
    generic: '操作失敗，請重試',
  },
}
