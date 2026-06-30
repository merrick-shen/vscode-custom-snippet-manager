/**
 * 图标数据提取脚本
 * 从 @iconify-json 完整数据包中提取所需图标，生成轻量级数据文件
 * 避免 webview 打包时引入数千个未使用的图标 SVG 数据
 * 
 * 图标列表从 languages.ts 统一配置自动解析，新增语言时无需手动维护图标列表
 */
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

/** 图标集对应的 npm 包路径 */
const PACKAGE_MAP = {
  'simple-icons': '@iconify-json/simple-icons/icons.json',
  'mdi': '@iconify-json/mdi/icons.json',
  'carbon': '@iconify-json/carbon/icons.json',
  'circle-flags': '@iconify-json/circle-flags/icons.json',
}

/**
 * 从 languages.ts 中解析所有语言图标配置
 * 避免在脚本中重复维护图标列表，确保与统一配置同步
 */
function parseIconsFromLanguages() {
  const languagesPath = resolve(__dirname, '..', '..', 'src', 'shared', 'languages.ts')
  const content = readFileSync(languagesPath, 'utf-8')

  // 提取所有 icon 字段值，格式如 icon: 'simple-icons:javascript'
  const iconRegex = /icon:\s*'([^']+)'/g
  const icons = {}
  let match

  while ((match = iconRegex.exec(content)) !== null) {
    const fullIcon = match[1]
    const colonIndex = fullIcon.indexOf(':')
    if (colonIndex === -1) continue
    const prefix = fullIcon.substring(0, colonIndex)
    const name = fullIcon.substring(colonIndex + 1)
    if (!icons[prefix]) {
      icons[prefix] = []
    }
    // 避免重复
    if (!icons[prefix].includes(name)) {
      icons[prefix].push(name)
    }
  }

  // 补充非语言图标
  if (!icons['mdi']) icons['mdi'] = []
  if (!icons['carbon']) icons['carbon'] = []
  if (!icons['carbon'].includes('code')) icons['carbon'].push('code')

  // carbon UI 通用图标（替代内联 SVG）
  const carbonUiIcons = [
    'settings', 'chevron-down', 'chevron-left', 'chevron-up',
    'checkmark', 'add', 'upload', 'download', 'folder-add',
    'search', 'close', 'arrow-down', 'arrow-up',
    'folder', 'edit', 'trash-can', 'error-outline', 'link',
    'save', 'information', 'launch',
    'draggable', 'checkbox', 'checkbox-checked',
    'copy',
  ]
  for (const name of carbonUiIcons) {
    if (!icons['carbon'].includes(name)) icons['carbon'].push(name)
  }

  // mdi UI 图标（设置页等非语言图标）
  const mdiUiIcons = ['github', 'message-text-outline']
  for (const name of mdiUiIcons) {
    if (!icons['mdi'].includes(name)) icons['mdi'].push(name)
  }

  // 从 locales.json 解析国旗图标
  const localesPath = resolve(__dirname, '..', '..', 'locales.json')
  const localesData = JSON.parse(readFileSync(localesPath, 'utf-8'))
  if (!icons['circle-flags']) icons['circle-flags'] = []
  for (const locale of localesData.locales) {
    if (locale.flag && !icons['circle-flags'].includes(locale.flag)) {
      icons['circle-flags'].push(locale.flag)
    }
  }

  return icons
}

/**
 * 从完整图标集中提取指定图标的数据
 * @param prefix 图标集前缀
 * @param iconNames 需要的图标名列表
 */
function extractIcons(prefix, iconNames) {
  const packagePath = resolve(__dirname, '..', 'node_modules', PACKAGE_MAP[prefix])
  const fullData = JSON.parse(readFileSync(packagePath, 'utf-8'))
  const icons = {}

  for (const name of iconNames) {
    const iconData = fullData.icons[name]
    if (iconData) {
      icons[name] = {
        body: iconData.body,
        width: iconData.width || fullData.width || 24,
        height: iconData.height || fullData.height || 24,
      }
    }
  }

  return { prefix, icons, width: fullData.width, height: fullData.height }
}

// 从统一配置解析图标列表
const neededIcons = parseIconsFromLanguages()

// 提取所有需要的图标集
const collections = Object.entries(neededIcons).map(([prefix, names]) =>
  extractIcons(prefix, names)
)

// 统计提取的图标数量
const totalIcons = collections.reduce((sum, c) => sum + Object.keys(c.icons).length, 0)
console.log(`Extracted ${totalIcons} icons from ${collections.length} icon sets`)

// 生成 TypeScript 代码
const output = `/**
 * 预提取的图标数据（自动生成，请勿手动修改）
 * 由 scripts/extract-icons.mjs 从 @iconify-json 包中提取
 * 仅包含应用实际使用的图标，避免打包完整图标集
 */
import { addCollection } from '@iconify/vue'

/** 注册所有预提取的图标到 @iconify/vue */
export function registerIcons(): void {
${collections.map(c => `  addCollection(${JSON.stringify(c)})`).join('\n')}
}
`

// 写入生成的文件
const outputPath = resolve(__dirname, '..', 'src', 'utils', 'icons.ts')
writeFileSync(outputPath, output, 'utf-8')
console.log(`Generated: ${outputPath}`)
