# Change Log

All notable changes to the "Custom Snippet Manager" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

[中文更新日志](./CHANGELOG.zh-CN.md)

## [1.0.0] - 2026-04-24

### Added

- **Snippet Management**: Create, edit, and delete code snippets with name, prefix, body, description, and language fields
- **Smart Autocomplete**: CompletionItemProvider that triggers on prefix input with SnippetString tabstop support (`$1`, `$2`, `$0`)
- **Sidebar UI**: Webview-based snippet list with fuzzy search (Fuse.js) and language filtering
- **Editor UI**: Webview-based form with CodeMirror 6 syntax highlighting and input validation
- **Language Icons**: Iconify-powered language icons in dropdowns and snippet list items
- **Internationalization**: Full Chinese / English UI support with one-click switching and preference persistence
- **Commands**:
  - `New Snippet` — Open editor to create a new snippet
  - `Open Snippet Library` — Focus the sidebar panel
  - `Insert Snippet` — QuickPick-based snippet insertion (`Ctrl+Alt+I`)
  - `Trigger Snippet Completion` — Trigger autocomplete suggestions (`Ctrl+Alt+Space`)
- **Context Menu**: "Insert Snippet" option in the editor right-click menu
- **Data Storage**: Local JSON file persistence using VS Code's `globalStorageUri`
- **Delete Confirmation**: Custom modal dialog to prevent accidental deletion
- **Error Handling**: Animated error bars with auto-dismiss in sidebar and editor views
