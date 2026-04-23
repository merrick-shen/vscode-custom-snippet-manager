/**
 * 中文语言包
 * 覆盖应用中所有用户可见的文本内容
 */
export default {
  app: {
    title: '代码片段管理器',
  },
  list: {
    searchPlaceholder: '搜索代码片段...',
    empty: '暂无代码片段',
    emptyDesc: '点击上方按钮创建你的第一个代码片段',
  },
  form: {
    createTitle: '新建代码片段',
    editTitle: '编辑代码片段',
    createSubtitle: '填写以下信息创建新的代码片段',
    editSubtitle: '修改代码片段的内容和属性',
    name: '名称',
    namePlaceholder: '输入代码片段名称',
    prefix: '前缀',
    prefixPlaceholder: '输入触发前缀，如 log',
    body: '代码内容',
    bodyPlaceholder: '输入代码内容，支持 $1, $2, $0 光标占位符',
    bodyHint: '支持 $1, $2, $0 光标占位符',
    description: '描述',
    descriptionPlaceholder: '输入代码片段描述',
    language: '适用语言',
    languagePlaceholder: '选择适用语言',
    allLanguages: '所有语言',
    save: '保存',
    cancel: '取消',
    nameRequired: '请输入名称',
    prefixRequired: '请输入前缀',
    bodyRequired: '请输入代码内容',
  },
  delete: {
    title: '删除确认',
    content: '确定要删除代码片段「{name}」吗？此操作不可撤销。',
    confirm: '删除',
    cancel: '取消',
  },
  filter: {
    all: '全部',
    label: '语言筛选',
  },
  actions: {
    create: '新建片段',
    edit: '编辑',
    delete: '删除',
  },
  lang: {
    switchTo: 'English',
  },
  error: {
    generic: '操作失败，请重试',
  },
}
