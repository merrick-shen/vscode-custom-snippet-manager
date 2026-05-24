# Change Log

All notable changes to the "Custom Snippet Manager" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

[中文更新日志](./CHANGELOG.zh-CN.md)

## [1.1.3] - 2026-05-25

### Fixed

- **Import ID Overwrite**: Fixed imported snippets keeping their original `id` instead of generating new ones, which caused duplicate IDs when using the merge strategy and incorrect IDs for non-duplicate imports

## [1.1.2] - 2026-05-24

### Fixed

- **App Version in Export**: Fixed `APP_VERSION` being hardcoded as `'1.0.0'` in `importExportService.ts`, now dynamically reads version from `package.json` so exported files always contain the correct `appVersion`
- **C/C++ Completion**: Fixed `LANGUAGE_ALIASES` mapping overlap where `cpp` snippets incorrectly triggered in `c` files; `cpp` now only matches `cpp` language
- **Data Safety**: Fixed `SnippetService.load()` silently resetting to empty array on JSON parse failure; now backs up the corrupted file and shows a notification
- **Import Performance**: Fixed import writing file on every snippet, now batches all operations and writes once

## [1.1.1] - 2026-05-24

### Fixed

- **Package Size**: Fixed `.vscodeignore` not excluding `webview/node_modules/`, reducing VSIX from ~29 MB to ~3.9 MB
- **Package Cleanup**: Excluded webview source files, build scripts, and config files from the packaged extension

## [1.1.0] - 2026-05-24

### Added

- **Multi-language Selection**: Snippet language field now supports selecting multiple languages
- **WebView Dialogs**: Replaced all VS Code native dialogs (import/export confirmations, duplicate handling) with custom WebView-based dialogs that match the plugin's UI style
- **WebView Notifications**: Replaced VS Code native notifications with custom WebView-based notifications for consistent UI experience
- **Action Feedback**: Added success notifications for snippet creation, editing, and deletion
- **Extended Internationalization**: Added support for **Русский / Deutsch / Français / Español / Português / Italiano / Polski / Türkçe** (now 13 languages total)

### Changed

- **Internationalization**: Improved i18n completeness — all UI text now properly switches when changing language
- **Import/Export**: Import and export result messages now use WebView notifications with proper i18n support

### Removed

- **Redundant Code**: Removed unused change notification system from SnippetService
- **Redundant i18n Keys**: Cleaned up unused validation and duplicate message keys from all language files
- **Internal Exports**: Removed unnecessary `export` modifiers from internal interfaces in ImportExportService

## [1.0.0] - 2026-05-01

### Added

- **Snippet Management**: Create, edit, and delete code snippets with name, prefix, body, description, and language fields
- **Smart Autocomplete**: CompletionItemProvider that triggers on prefix input with SnippetString tabstop support (`$1`, `$2`, `$0`)
- **Sidebar UI**: Webview-based snippet list with fuzzy search (Fuse.js) and language filtering
- **Editor UI**: Webview-based form with CodeMirror 6 syntax highlighting and input validation
- **Language Icons**: Iconify-powered language icons in dropdowns and snippet list items
- **Internationalization**: Full **简体中文 / 繁體中文 / English / 日本語 / 한국어** UI support with dropdown language switcher and preference persistence
- **Import & Export**: Export snippets to JSON file (`code_snippet_config_YYYYMMDD_HHMMSS.json`) with version metadata; Import from JSON with data validation, security checks, and duplicate handling (Overwrite / Skip / Merge)
- **Sorting**: Sort snippets by date added with ascending/descending toggle; sort fields excluded from export
- **Commands**:
  - `New Snippet` — Open editor to create a new snippet
  - `Open Snippet Library` — Focus the sidebar panel
  - `Insert Snippet` — QuickPick-based snippet insertion (`Ctrl+Alt+I`)
  - `Trigger Snippet Completion` — Trigger autocomplete suggestions (`Ctrl+Alt+Space`)
  - `Save to Snippet Library` — Save selected code as a snippet via right-click menu (auto-detects language)
- **Context Menu**: "Insert Snippet" and "Save to Snippet Library" options in the editor right-click menu
- **Data Storage**: Local JSON file persistence using VS Code's `globalStorageUri`
- **Delete Confirmation**: Custom modal dialog to prevent accidental deletion
- **Error Handling**: Animated error bars with auto-dismiss in sidebar and editor views
