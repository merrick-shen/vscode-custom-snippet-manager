/**
 * 日本語言パック
 * アプリケーション内のすべてのユーザー表示テキストをカバー
 */
export default {
  app: {
    title: 'スニペットマネージャー',
  },
  list: {
    searchPlaceholder: 'スニペットを検索...',
    empty: 'スニペットがありません',
    emptyDesc: '上のボタンをクリックして最初のスニペットを作成してください',
  },
  form: {
    createTitle: 'スニペットを作成',
    editTitle: 'スニペットを編集',
    createSubtitle: '以下の情報を入力して新しいスニペットを作成してください',
    editSubtitle: 'スニペットの内容とプロパティを変更してください',
    name: '名前',
    namePlaceholder: 'スニペット名を入力',
    prefix: 'プレフィックス',
    prefixPlaceholder: 'トリガープレフィックスを入力（例: log）',
    body: 'コード内容',
    bodyPlaceholder: 'コード内容を入力（$1, $2, $0 タブストップ対応）',
    bodyHint: '$1, $2, $0 タブストップ対応',
    description: '説明',
    descriptionPlaceholder: 'スニペットの説明を入力',
    language: '対象言語',
    languagePlaceholder: '対象言語を選択',
    allLanguages: 'すべての言語',
    save: '保存',
    cancel: 'キャンセル',
    nameRequired: '名前を入力してください',
    prefixRequired: 'プレフィックスを入力してください',
    bodyRequired: 'コード内容を入力してください',
  },
  delete: {
    title: '削除の確認',
    content: 'スニペット「{name}」を削除してよろしいですか？この操作は取り消せません。',
    confirm: '削除',
    cancel: 'キャンセル',
  },
  filter: {
    all: 'すべて',
    label: '言語フィルター',
  },
  actions: {
    create: '新規作成',
    edit: '編集',
    delete: '削除',
  },
  importExport: {
    exportConfig: 'エクスポート',
    importConfig: 'インポート',
    exportConfirmTitle: 'エクスポートの確認',
    exportConfirmContent: 'すべてのスニペットをエクスポートしてよろしいですか？',
    importConfirmTitle: 'インポートの確認',
    importConfirmContent: 'スニペットをインポートしてよろしいですか？この操作は取り消せません。',
    exportSuccess: 'エクスポート成功！',
    exportFailed: 'エクスポート失敗',
    importSuccess: 'インポート成功！{count} 件のスニペットをインポートしました。',
    importFailed: 'インポート失敗',
    importPartial: '{imported} 件をインポート、{errors} 件でエラーが発生しました。',
    noDataToExport: 'エクスポートするデータがありません',
  },
  lang: {
    name: '日本語',
  },
  error: {
    generic: '操作に失敗しました。もう一度お試しください',
  },
}
