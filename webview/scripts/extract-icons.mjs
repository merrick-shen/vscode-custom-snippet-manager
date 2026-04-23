/**
 * 图标数据提取脚本
 * 从 @iconify-json 完整数据包中提取所需图标，生成轻量级数据文件
 * 避免 webview 打包时引入数千个未使用的图标 SVG 数据
 */
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

/** 需要提取的图标配置：{ 图标集前缀: [图标名列表] } */
const NEEDED_ICONS = {
  'simple-icons': [
    'javascript', 'typescript', 'python', 'html5', 'css3',
    'csharp', 'cplusplus', 'c', 'go',
    'rust', 'php', 'ruby', 'swift', 'kotlin',
    'vuedotjs', 'react', 'sass', 'less', 'gnubash',
    'sqlite', 'dart', 'lua', 'r', 'docker',
    'markdown',
  ],
  'mdi': [
    'code-json',
    'file-code-outline',
    'xml',
    'language-java',
  ],
  'carbon': [
    'code',
  ],
}

/** 图标集对应的 npm 包路径 */
const PACKAGE_MAP = {
  'simple-icons': '@iconify-json/simple-icons/icons.json',
  'mdi': '@iconify-json/mdi/icons.json',
  'carbon': '@iconify-json/carbon/icons.json',
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

// 提取所有需要的图标集
const collections = Object.entries(NEEDED_ICONS).map(([prefix, names]) =>
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

// 写入生成的文件（直接输出为 icons.ts，无需中间转发层）
const outputPath = resolve(__dirname, '..', 'src', 'utils', 'icons.ts')
writeFileSync(outputPath, output, 'utf-8')
console.log(`Generated: ${outputPath}`)
