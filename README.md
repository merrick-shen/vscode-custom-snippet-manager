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
- **Language icons** for better visual identification
- **Delete confirmation** dialog to prevent accidental deletion
- Consistent styling that blends with VS Code's theme

### 🌐 Internationalization

- Full **Chinese / English** UI support
- One-click language switching
- Language preference is persisted across sessions

### ⌨️ Commands & Keybindings

| Command | Keybinding | Description |
|---|---|---|
| `New Snippet` | — | Create a new snippet |
| `Open Snippet Library` | — | Open the sidebar panel |
| `Insert Snippet` | `Ctrl+Alt+I` / `Cmd+Alt+I` | Insert via QuickPick |
| `Trigger Snippet Completion` | `Ctrl+Alt+Space` / `Cmd+Alt+Space` | Trigger autocomplete |

Right-click context menu also includes "Insert Snippet" when editing text.

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

### Snippet Body Syntax

Use tabstops to define cursor positions:

```javascript
console.log('$1', $2);$0
```

- `$1` — First cursor position
- `$2` — Second cursor position (press Tab to navigate)
- `$0` — Final cursor position

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
