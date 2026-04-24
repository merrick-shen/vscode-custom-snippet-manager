# Custom Snippet Manager - 自定义片段管理器

轻松管理自定义代码片段，支持创建、编辑和组织片段，提供现代化界面、智能补全和多语言支持。

[English](./README.md)

## ✨ 功能特性

### 📝 片段管理

- 通过直观的 Webview 界面**创建、编辑、删除**代码片段
- 每个片段包含：**名称**、**触发前缀**、**代码内容**、**描述**、**适用语言**
- 支持**"所有语言"**或指定特定语言范围
- 片段通过 VS Code 全局存储本地持久化保存

### 🚀 智能补全

- 输入片段的**触发前缀**即可触发自动补全建议
- 完整支持 **SnippetString** — 使用 `$1`、`$2`、`$0` 实现 Tab 光标跳转
- 按语言智能筛选 — 仅显示与当前文件相关的片段
- 部分前缀匹配 — 输入即可获得补全建议

### 🎨 现代化界面

- **侧边栏面板**，包含片段列表、搜索和语言筛选
- **编辑器面板**，支持表单校验和代码高亮（CodeMirror 6）
- 基于 Fuse.js 的**模糊搜索**
- **语言图标**，提升视觉辨识度
- **删除确认**弹窗，防止误删
- 与 VS Code 主题融合的统一视觉风格

### 🌐 国际化

- 完整的**简体中文 / 繁體中文 / English / 日本語 / 한국어**界面支持
- 下拉菜单切换语言
- 语言偏好跨会话持久保存

### 💼 导入与导出

- **导出**代码片段为 JSON 文件，包含版本信息和元数据
- **导入** JSON 文件中的代码片段，带数据验证和安全检查
- 重复处理策略：**覆盖**、**跳过**或**合并**（保留两者）
- 文件命名格式：`code_snippet_config_YYYYMMDD_HHMMSS.json`
- 导入/导出操作前均有确认对话框

### ⌨️ 命令与快捷键

| 命令 | 快捷键 | 说明 |
|---|---|---|
| `新建片段` | — | 创建新的代码片段 |
| `打开片段库` | — | 打开侧边栏面板 |
| `插入片段` | `Ctrl+Alt+I` / `Cmd+Alt+I` | 通过 QuickPick 选择并插入片段 |
| `触发片段补全` | `Ctrl+Alt+Space` / `Cmd+Alt+Space` | 触发代码补全建议 |

编辑器右键菜单也包含"插入片段"选项。

## 📖 使用方法

### 创建片段

1. 点击活动栏中的 **Custom Snippet Manager** 图标
2. 点击**"新建片段"**按钮
3. 填写表单：
   - **名称**：片段的描述性名称
   - **前缀**：触发关键词（如 `log`、`forof`）
   - **代码内容**：片段内容（支持 `$1`、`$2`、`$0` 光标跳转）
   - **描述**：可选的片段描述
   - **语言**：选择特定语言或"所有语言"
4. 点击**保存**

### 使用片段

**自动补全** — 在编辑器中输入前缀，从补全建议中选择。

**快速选择** — 按 `Ctrl+Alt+I` 浏览并插入片段。

**右键菜单** — 在编辑器中右键 → "插入片段"。

### 片段体语法

使用制表位定义光标位置：

```javascript
console.log('$1', $2);$0
```

- `$1` — 第一个光标位置
- `$2` — 第二个光标位置（按 Tab 跳转）
- `$0` — 最终光标位置

### 导入与导出片段

**导出** — 点击侧边栏标题栏中的**「导出配置」**按钮，在文件对话框中选择保存位置。导出的 JSON 文件包含所有片段及版本元数据。

**导入** — 点击侧边栏标题栏中的**「导入配置」**按钮，选择要导入的 JSON 文件。如果发现重复片段，可以选择：
- **覆盖**：用导入的片段替换现有片段
- **跳过**：保留现有片段不变
- **合并**：保留两者（导入的片段会生成新 ID）

## 🗂️ 支持的语言

JavaScript, TypeScript, Python, HTML, CSS, JSON, Markdown, Java, C#, C++, C, Go, Rust, PHP, Ruby, Swift, Kotlin, Vue, React JSX, React TSX, SCSS, LESS, Shell, SQL, YAML, XML, Dart, Lua, R, Dockerfile

## 💾 数据存储

片段存储在 VS Code 全局存储目录下的 `snippets.json` 文件中：

- **Windows**: `%APPDATA%\Code\User\globalStorage\custom-snippet-manager\`
- **macOS**: `~/Library/Application Support/Code/User/globalStorage/custom-snippet-manager/`
- **Linux**: `~/.config/Code/User/globalStorage/custom-snippet-manager/`

## 📦 安装

1. 打开 VS Code
2. 按 `Ctrl+Shift+X` 打开扩展面板
3. 搜索 **"Custom Snippet Manager"**
4. 点击**安装**

## 🤝 贡献

欢迎在 [GitHub](https://github.com/horyce/vscode-custom-snippet-manager) 提交 Issue 和 Pull Request。

## 📄 许可证

[MIT](https://github.com/horyce/vscode-custom-snippet-manager/blob/main/LICENSE)
