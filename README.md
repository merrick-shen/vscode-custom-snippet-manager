# Custom Snippet Manager

Manage custom code snippets with ease. Create, edit, and organize your snippets with a modern UI, smart autocomplete, and multi-language support.

[中文文档](./README.zh-CN.md)

## ✨ Features

### 📝 Snippet Management

- **Create, Edit, Delete** snippets through an intuitive webview UI
- Each snippet contains: **name**, **prefix**, **body**, **description**, **language**
- Support **"All Languages"** or specify a particular language scope
- Snippets are persisted locally using VS Code's global storage

### 🚀 Smart Autocomplete

- Type a snippet's **prefix** to trigger autocomplete suggestions
- Full **SnippetString** support — use `$1`, `$2`, `$0` for tabstop cursor jumps
- Language-aware filtering — only relevant snippets appear for the current file
- Partial prefix matching — start typing and get suggestions instantly

### 🎨 Modern Webview UI

- **Sidebar panel** with snippet list, search, and language filtering
- **Editor panel** with form validation and code highlighting (CodeMirror 6)
- **Fuzzy search** powered by Fuse.js
- **Sorting** by date added with ascending/descending toggle
- **Language icons** for better visual identification
- **Delete confirmation** dialog to prevent accidental deletion
- Consistent styling that blends with VS Code's theme

### 🌐 Internationalization

- Full **简体中文 / 繁體中文 / English / 日本語 / 한국어** UI support
- Dropdown menu for language switching
- Language preference is persisted across sessions

### 💼 Import & Export

- **Export** snippets to a JSON file with version info and metadata
- **Import** snippets from a JSON file with data validation and security checks
- Duplicate handling strategies: **Overwrite**, **Skip**, or **Merge** (keep both)
- File naming format: `code_snippet_config_YYYYMMDD_HHMMSS.json`
- Confirmation dialogs before import/export operations

### ⌨️ Commands & Keybindings

| Command | Keybinding | Description |
|---|---|---|
| `New Snippet` | — | Create a new snippet |
| `Open Snippet Library` | — | Open the sidebar panel |
| `Insert Snippet` | `Ctrl+Alt+I` / `Cmd+Alt+I` | Insert via QuickPick |
| `Trigger Snippet Completion` | `Ctrl+Alt+Space` / `Cmd+Alt+Space` | Trigger autocomplete |
| `Save to Snippet Library` | — | Save selected code as a snippet |

Right-click context menu includes "Insert Snippet" and "Save to Snippet Library" (shown when text is selected).

## 📖 Usage

### Create a Snippet

1. Click the **Custom Snippet Manager** icon in the Activity Bar
2. Click the **"New Snippet"** button
3. Fill in the form:
   - **Name**: A descriptive name for your snippet
   - **Prefix**: The trigger keyword (e.g., `log`, `forof`)
   - **Body**: The snippet content (supports `$1`, `$2`, `$0` tabstops)
   - **Description**: Optional description
   - **Language**: Choose a specific language or "All Languages"
4. Click **Save**

### Use a Snippet

**Autocomplete** — Type the prefix in an editor and select from suggestions.

**QuickPick** — Press `Ctrl+Alt+I` to browse and insert a snippet.

**Context Menu** — Right-click in the editor → "Insert Snippet".

**Save Selection** — Select code in the editor, right-click → "Save to Snippet Library". Enter a prefix and name, and the snippet is saved with the current file's language automatically detected.

### Snippet Body Syntax

Use tabstops to define cursor positions:

```javascript
console.log('$1', $2);$0
```

- `$1` — First cursor position
- `$2` — Second cursor position (press Tab to navigate)
- `$0` — Final cursor position

### Import & Export Snippets

**Export** — Click the **"Export"** button in the sidebar header. Choose a save location in the file dialog. The exported JSON file includes all snippets with version metadata.

**Import** — Click the **"Import"** button in the sidebar header. Select a JSON file to import. If duplicate snippets are found, you can choose to:
- **Overwrite**: Replace existing snippets with imported ones
- **Skip**: Keep existing snippets unchanged
- **Merge**: Keep both (imported snippets get new IDs)

## 🗂️ Supported Languages

JavaScript, TypeScript, Python, HTML, CSS, JSON, Markdown, Java, C#, C++, C, Go, Rust, PHP, Ruby, Swift, Kotlin, Vue, React JSX, React TSX, SCSS, LESS, Shell, SQL, YAML, XML, Dart, Lua, R, Dockerfile

## 💾 Data Storage

Snippets are stored in a `snippets.json` file under VS Code's global storage directory:

- **Windows**: `%APPDATA%\Code\User\globalStorage\custom-snippet-manager\`
- **macOS**: `~/Library/Application Support/Code/User/globalStorage/custom-snippet-manager/`
- **Linux**: `~/.config/Code/User/globalStorage/custom-snippet-manager/`

## 📦 Installation

1. Open VS Code
2. Press `Ctrl+Shift+X` to open the Extensions panel
3. Search for **"Custom Snippet Manager"**
4. Click **Install**

## 🤝 Contributing

Issues and pull requests are welcome at [GitHub](https://github.com/horyce/vscode-custom-snippet-manager).

## 📄 License

[MIT](https://github.com/horyce/vscode-custom-snippet-manager/blob/main/LICENSE)
