# Change Log

All notable changes to the "Custom Snippet Manager" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

[中文更新日志](./CHANGELOG.zh-CN.md)

## [Unreleased]

### Added

- **Snippet Editor**: New "Save and Continue" button in creation mode lets you save the current snippet and immediately start creating the next one without closing the editor
- **Snippet Editor**: Added a collapsible VS Code snippet syntax help panel in the code body area, covering tabstops, placeholders, variables, transforms, and escapes

### Changed

- **Snippet Editor**: Removed tabstop placeholder hints from the code body field for a cleaner editing interface
- **Search Performance**: Cached the Fuse.js instance so it is only rebuilt when snippets or language filter changes, reducing lag while typing search queries with many snippets

### Fixed

- **Code Completion**: Fixed inaccurate replacement range when snippet prefix contains spaces or special characters (e.g. `for of`)
- **Language Selector**: Fixed multi-select mode where clicking an already-selected language could not deselect it in some cases
- **Export**: Fixed silently skipped failures when exporting multiple folders; partial failures now show a warning with the success and failure counts

## [1.3.3] - 2026-06-21

### Added

- **Language Settings**: Plugin language now auto-syncs with VS Code display language; language selector moved from header to settings page with manual override and reset-to-auto option

### Changed

- **Editor Layout**: Restructured the snippet editor page — name and prefix inputs fixed at the top, description/language/folder selectors fixed at the bottom, code editor auto-fills the remaining space

### Fixed

- **Code Completion**: Fixed the issue where code completion could fail to show snippets if triggered before data loading completed
- **Import Folder Name Validation**: Fixed the issue where entering the default folder's localized display name (e.g. "default folder") was incorrectly rejected during import placement
- **ZIP Backup Export**: Fixed the issue where ZIP backup could hang indefinitely when the write stream encountered errors (e.g. disk full, permission denied)

## [1.3.2] - 2026-06-16

### Changed

- **Folder Drag**: Improved folder drag to show the entire folder item following the cursor instead of only the drag icon
- **Notification Bar**: Redesigned notification bar with type icons and colored accent bar for quick type distinction, added auto-hide progress indicator

### Fixed

- **Snippet Preview Position**: Fixed the issue where the hover preview card could appear at wrong position after scrolling the snippet list
- **Settings Page Notification**: Fixed the issue where the clear-all notification appeared on the main page instead of the settings page

## [1.3.1] - 2026-06-04

### Changed

- **Checkbox & Radio Style**: Replaced native checkboxes and radio buttons with custom BaseCheckbox and BaseRadio components, providing a consistent look that matches the plugin's design theme

### Fixed

- **Folder Dropdown in Import Dialog**: Fixed the issue where the folder selection drop-down menu was cut off by the dialog boundary

## [1.3.0] - 2026-06-03

### Added

- **Folders**: Added folder support to organize snippets — create, rename, and delete folders, and assign a folder when creating or editing a snippet
- **Folder Export**: Export now lets you select multiple folders, each exported as a separate JSON file
- **Import Destination**: When importing, you can create a new folder or import into an existing folder
- **Backup All Data**: Added "Backup All Data" button in settings page to export all snippets as a ZIP file, providing a complete backup before clearing data
- **Folder Multi-Select**: Added "Manage Folders" mode in sidebar to select multiple folders for batch deletion and reordering, with drag-and-drop support for reordering
- **Keyboard Shortcuts**: Added keyboard shortcuts section in settings page, displaying all available commands and their keybindings (auto-detects macOS/Windows)
- **12 New Languages**: Added support for **Svenska / Dansk / Suomi / Nederlands / Čeština / Magyar / ไทย / Tiếng Việt / Українська / Română / Ελληνικά / हिन्दी** (now 25 languages total)

### Changed

- **Icon System**: Replaced all inline SVG icons with @iconify/vue icon library (carbon icon set)
- **Sidebar Layout**: Sidebar now displays snippets as a collapsible folder-grouped tree
- **Storage Structure**: Snippets are now stored in separate files per folder; existing data is migrated automatically and the original data is backed up
- **Export Files**: Export files are now organized by folder, with the folder name included in the file name
- **Duplicate Detection**: When importing into an existing folder, duplicate detection only considers snippets within that folder
- **Import Compatibility**: Export files from 1.2.0 and earlier (flat snippet array format) cannot be imported; only the new folder-based format is supported

### Fixed

- **Save Button**: Fixed save button becoming clickable again before the backend responds, which could cause duplicate snippet creation
- **Language Badge**: Fixed "ALL" label on language badges not being translated when a snippet applies to all languages
- **Language Selector**: Fixed language selector showing only an icon with no text when "All" is selected, now displays both icon and label
- **Settings Icons**: Fixed settings page icons (GitHub, Feedback) not displaying due to missing pre-extracted icon data, which caused runtime network requests blocked by CSP
- **Import Sorting**: Fixed imported snippets having identical creation timestamps, which caused sorting by date to fail; each imported snippet now gets a unique, incrementing creation time

## [1.2.0] - 2026-05-26

### Added

- **Settings Entry**: Added a settings button in the sidebar to view plugin version, license, repository link, and other info
- **Open Directory**: Added an "Open Snippets Directory" button in the settings page to open the data storage location in the system file manager, with the storage path displayed
- **Snippet Preview**: Hover over a list item to show a preview card with syntax-highlighted code and description, allowing quick inspection without opening the editor
- **Clear All Data**: Added a "Clear All Data" button in the settings page to remove all snippets at once, with a confirmation dialog to prevent accidental deletion
- **Interface Optimization**: Improved the user interface by refining the layout, adding space between elements, and enhancing the visual appeal

### Changed

- **Notification Position**: Moved sidebar notification toasts from the top to the bottom of the page, preventing layout shifts in the header area when notifications appear
- **Performance**: Optimized data storage to prevent editor lag when managing many snippets
- **Performance**: Reduced unnecessary file writes when using snippet completions, improving responsiveness during frequent use
- **Multi-language filter**: Sidebar language filter now supports selecting multiple languages at once, consistent with the editor's language scope selector
- **Architecture**: Unified language configuration into a single data source
- **Language Switch Button**: Replaced the translate icon with the current language's flag, and each language option in the dropdown now shows its corresponding flag
- **Style Architecture**: Refactored frontend styles using Sass for improved maintainability and extensibility
- **Sort Preference**: Sidebar sort order is now persisted across sessions, no longer resets every time the sidebar is opened

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
