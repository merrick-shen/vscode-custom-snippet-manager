/**
 * 英文语言包
 * 与中文语言包结构一一对应，用于国际化切换
 */
export default {
  app: {
    title: 'Snippet Manager',
  },
  list: {
    searchPlaceholder: 'Search snippets...',
    empty: 'No snippets yet',
    emptyDesc: 'Click the button above to create your first snippet',
  },
  form: {
    createTitle: 'Create Snippet',
    editTitle: 'Edit Snippet',
    createSubtitle: 'Fill in the details below to create a new snippet',
    editSubtitle: 'Modify the snippet content and properties',
    name: 'Name',
    namePlaceholder: 'Enter snippet name',
    prefix: 'Prefix',
    prefixPlaceholder: 'Enter trigger prefix, e.g. log',
    body: 'Body',
    bodyPlaceholder: 'Enter snippet body, supports $1, $2, $0 tabstops',
    bodyHint: 'Supports $1, $2, $0 tabstops',
    description: 'Description',
    descriptionPlaceholder: 'Enter snippet description',
    language: 'Language',
    languagePlaceholder: 'Select language scope',
    allLanguages: 'All Languages',
    save: 'Save',
    cancel: 'Cancel',
    nameRequired: 'Name is required',
    prefixRequired: 'Prefix is required',
    bodyRequired: 'Body is required',
  },
  delete: {
    title: 'Delete Confirmation',
    content: 'Are you sure you want to delete snippet "{name}"? This action cannot be undone.',
    confirm: 'Delete',
    cancel: 'Cancel',
  },
  filter: {
    all: 'All',
    label: 'Language Filter',
  },
  actions: {
    create: 'New Snippet',
    edit: 'Edit',
    delete: 'Delete',
  },
  importExport: {
    exportConfig: 'Export',
    importConfig: 'Import',
    exportConfirmTitle: 'Export Confirmation',
    exportConfirmContent: 'Are you sure you want to export all snippets?',
    importConfirmTitle: 'Import Confirmation',
    importConfirmContent: 'Are you sure you want to import snippets? This action cannot be undone.',
    exportSuccess: 'Export successful!',
    exportFailed: 'Export failed',
    importSuccess: 'Import successful! {count} snippet(s) imported.',
    importFailed: 'Import failed',
    importPartial: 'Imported {imported} snippet(s) with {errors} error(s).',
    noDataToExport: 'No data to export',
  },
  lang: {
    name: 'English',
  },
  error: {
    generic: 'Operation failed, please try again',
  },
}
