# Change Log

All notable changes to the "Custom Snippet Manager" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

[中文更新日志](./CHANGELOG.zh-CN.md)

## [1.2.0] - 2026-05-26

### Added

- **Settings Entry**: Added a settings button in the sidebar to view plugin version, license, repository link, and other info

### Changed

- **Notification Position**: Moved sidebar notification toasts from the top to the bottom of the page, preventing layout shifts in the header area when notifications appear
- **Performance**: Optimized data storage to prevent editor lag when managing many snippets
- **Performance**: Reduced unnecessary file writes when using snippet completions, improving responsiveness during frequent use
- **Multi-language filter**: Sidebar language filter now supports selecting multiple languages at once, consistent with the editor's language scope selector
- **Architecture**: Unified language configuration into a single data source

## [1.1.3] - 2026-05-25

### Added

- **Language Switch Icon**: Added a translate icon to the sidebar language switch button for better discoverability

### Fixed

- **Import ID Overwrite**: Fixed imported snippets keeping their original `id` instead of generating new ones, which caused duplicate IDs when using the merge strategy and incorrect IDs for non-duplicate imports
- **Import Duplicate Detection**: Fixed duplicate detection only matching by ID; now also detects duplicates by name+prefix, so re-importing the same file correctly shows the duplicate strategy dialog
- **Editor Panel Reuse**: Fixed editor panel not clearing the form when switching from edit mode to create mode; the form now resets correctly
- **Editor Panel Title**: Fixed panel title always showing "New Snippet" in edit mode; now correctly displays "Edit: {name}"
- **Language Field Matching**: Fixed language filtering and completion failing when the language field contains spaces after commas; language values are now automatically normalized
- **Import Hang Prevention**: Added 5-minute timeout and cleanup mechanism for the duplicate strategy dialog, preventing the import flow from hanging indefinitely if the sidebar is closed
- **Editor Panel Language Sync**: Fixed language changes not taking effect in the editor panel while it's open; language settings now sync in real-time
- **Delete Notification Timing**: Fixed success notification showing before backend confirms deletion; notification now only appears after successful deletion
- **Editor Error Residue**: Fixed previous error message not clearing when switching to edit a different snippet

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
