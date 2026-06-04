<div align="center">
  <img src="./resources/logo.png" alt="Custom Snippet Manager" width="128" />
  <h1>Custom Snippet Manager</h1>
  <p>
    <a href="https://marketplace.visualstudio.com/items?itemName=Horyce.custom-snippet-manager">
      <img src="https://img.shields.io/badge/VSCode-Extension-blue?style=for-the-badge" alt="VS Code" />
    </a>
    <a href="https://github.com/horyce/vscode-custom-snippet-manager/blob/main/LICENSE">
      <img src="https://img.shields.io/badge/license-MIT-green?style=for-the-badge" alt="License" />
    </a>
    <a href="./README.md">
      <img src="https://img.shields.io/badge/English-README-blue?style=for-the-badge" alt="English" />
    </a>
    <a href="./README.zh-CN.md">
      <img src="https://img.shields.io/badge/中文-README-red?style=for-the-badge" alt="中文" />
    </a>
  </p>
  <p>🚀 A powerful snippet manager for VS Code with a modern UI, smart autocomplete, and multi-language support.</p>
  <p>✨ Create, organize, and instantly reuse your code snippets — all in one place.</p>
</div>

---

## ✨ Features

### 🧠 Smart Snippet Management

* Create, edit, and delete snippets with an intuitive UI
* Organize snippets by language or use them globally
* Automatically saved locally — no manual file handling needed

### ⚡ Powerful Autocomplete

* Trigger snippets instantly using prefixes
* Supports editing multiple positions with Tab navigation (using `$1`, `$2`, `$0` placeholders)
* Language-aware suggestions
* Fuzzy matching for faster searching

### 🎨 Modern UI Experience

* Sidebar panel with search, filtering, and sorting
* Built-in code editor with syntax highlighting (CodeMirror 6)
* Fast fuzzy search powered by Fuse.js
* Seamless integration with VS Code theme

### 🌐 Multi-language Support

![language](./resources/SwitchLanguage.gif)

* Supports 25 languages: 简体中文 / 繁體中文 / English / 日本語 / 한국어 / Русский / Deutsch / Français / Español / Português / Italiano / Polski / Türkçe / Svenska / Dansk / Suomi / Nederlands / Čeština / Magyar / ไทย / Tiếng Việt / Українська / Română / Ελληνικά / हिन्दी
* Easily switch between languages
* Language preference is saved automatically

### 📂 Folder Management

![newfolder](./resources/NewFolder.gif)

* Organize snippets into folders for better categorization
* Drag-and-drop to reorder folders
* Multi-select mode for batch folder deletion
* Default folder automatically collects uncategorized snippets

### 💼 Import & Export

* Export snippets by folder as JSON with metadata
* One-click backup all data as a ZIP file
* Secure import with validation
* Handle duplicates with:

  * Overwrite
  * Skip
  * Merge

### 🖱️ Save Code as Snippet (Highlight Feature 🔥)

* Select any code in the editor
* Right-click → Save directly to snippet library
* No need for copy & paste

---

## 📖 Usage  `The following demonstration uses the old interface.`

### ➕ Create Snippets

**Method 1: Right-click**

![Right-click](./resources/savecode1.gif)

**Method 2: UI Panel**

![UI](./resources/savecode2.gif)

---

### ⚡ Use Snippets

**Autocomplete**

![Autocomplete](./resources/usecode1.gif)

**Right-click Menu**

![Context Menu](./resources/usecode2.gif)

**Quick Pick**

![Quick Pick](./resources/usecode3.gif)

---

## ✨ Snippet Syntax

```javascript
console.log('$1', $2);$0
```

* `$1` First cursor position
* `$2` Next position (Tab to jump)
* `$0` Final cursor position

---

## ⌨️ Commands & Shortcuts

| Command                 | Shortcut                       | Description                  |
| ----------------------- | ------------------------------ | ---------------------------- |
| New Snippet             | —                              | Create a new snippet         |
| Open Snippet Library    | —                              | Open sidebar panel           |
| Insert Snippet          | Ctrl+Alt+I / Cmd+Alt+I         | Insert snippet via QuickPick |
| Trigger Completion      | Ctrl+Alt+Space / Cmd+Alt+Space | Trigger autocomplete         |
| Save to Snippet Library | Context Menu                    | Save selected code           |

---

## 🗂️ Supported Languages

Supports 50+ popular programming languages and file formats

---

## 💾 Data Storage

Snippets are stored in VS Code global storage:

* Windows: `%APPDATA%\Code\User\globalStorage\custom-snippet-manager\`
* macOS: `~/Library/Application Support/Code/User/globalStorage/custom-snippet-manager/`
* Linux: `~/.config/Code/User/globalStorage/custom-snippet-manager/`

---

## 📦 Installation

1. Open VS Code
2. Go to Extensions (`Ctrl+Shift+X`)
3. Search **Custom Snippet Manager**
4. Click Install

---

## 🤝 Contributing

Issues and Pull Requests are welcome:

👉 https://github.com/horyce/vscode-custom-snippet-manager

---

## 👥 Team

Horyce

---

## 📬 Contact

For feedback, bug reports, or feature requests:

* Email: [smh070912@gmail.com](mailto:smh070912@gmail.com)

---

## 📄 License

MIT License
