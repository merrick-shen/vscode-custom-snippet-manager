# Custom Snippet Manager

[![VS Code](https://img.shields.io/badge/VSCode-Extension-blue?style=for-the-badge)](https://marketplace.visualstudio.com/)
[![License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)](https://github.com/horyce/vscode-custom-snippet-manager/blob/main/LICENSE)

🚀 A powerful snippet manager for VS Code with a modern UI, smart autocomplete, and multi-language support.
✨ Create, organize, and instantly reuse your code snippets — all in one place.

---

## 🌐 Language

[![English](https://img.shields.io/badge/English-README-blue?style=for-the-badge)](./README.md)
[![中文](https://img.shields.io/badge/中文-说明-red?style=for-the-badge)](./README.zh-CN.md)

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

* Supports 简体中文 / 繁體中文 / English / 日本語 / 한국어
* Easily switch between languages
* Language preference is saved automatically

### 💼 Import & Export

* Export snippets as JSON with metadata
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

## 📖 Usage

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
| Save to Snippet Library | —                              | Save selected code           |

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

Horyce (with AI assistance)

---

## 📬 Contact

For feedback, bug reports, or feature requests:

* Email: [smh070912@gmail.com](mailto:smh070912@gmail.com)

---

## 📄 License

MIT License
