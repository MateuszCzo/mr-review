# MR Review

A VS Code extension for reviewing merge requests and comparing branches directly in the editor — with full editor support on the current file side.

## Features

- 🔀 **Compare any branch** — type or pick from an autocomplete list of local and remote branches
- 📄 **Changed files tree** — grouped by directory, with status badges: `A` added · `M` modified · `D` deleted · `R` renamed
- 🔴🟢 **Native VS Code diff** — red lines removed, green lines added, with character-level column highlighting out of the box
- ✏️ **Fully editable right side** — the current file is a real file on disk, so IntelliSense, Go to Definition, Find References, and all other extensions work normally

## Requirements

- VS Code 1.85+
- Git installed and available in `PATH`
- A workspace folder with a git repository

## Installation

### Option A — Developer mode (no packaging needed)

1. Open the extension folder in VS Code
2. Press `F5` — a new Extension Development Host window opens with the extension active

### Option B — Install as `.vsix`

```bash
npm install -g @vscode/vsce
npm run compile
vsce package --no-dependencies
code --install-extension mr-review-0.1.0.vsix
```

Or in VS Code: `Ctrl+Shift+P` → **Extensions: Install from VSIX...** → select the file.

## Usage

1. Click the **MR Review** icon in the Activity Bar (left sidebar)
2. In the **"Compare branch"** panel, type the base branch name (e.g. `main`, `develop`, `feature/xyz`) — autocomplete suggests all local and remote branches
3. Click **⇄ Compare**
4. The **"Changed files"** panel populates with all modified files
5. Click any file to open a diff view:
   - **Left side** — file content from the base branch (read-only)
   - **Right side** — your current file on disk (fully editable, all extensions active)

## How it works

The extension uses VS Code's built-in `vscode.diff` command with two URIs:

- **Left (base):** a virtual document served by a custom `mr-review-diff:` URI scheme. Content is fetched via `git show <merge-base>:<path>`, so the diff is based on the common ancestor — not the tip of the base branch. This matches how GitHub and GitLab calculate MR diffs.
- **Right (current):** the real file from disk (`vscode.Uri.file(...)`), giving you a fully functional editor with all extensions.

Character-level (column) highlighting is handled natively by VS Code's diff editor — no extra code needed.

## Project structure

```
src/
├── extension.ts              # Entry point, command registration
├── gitService.ts             # All git operations (branch list, diff, file content)
├── branchCompareView.ts      # Webview — "Compare branch" sidebar panel
├── changedFilesProvider.ts   # TreeDataProvider — changed files list
└── diffContentProvider.ts    # TextDocumentContentProvider — base branch file content
resources/
└── icon.svg                  # Activity bar icon
```

## Commands

| Command | Description |
|---|---|
| `MR Review: Open panel` | Focus the MR Review sidebar |
| `MR Review: Refresh` | Re-run the comparison and update the file tree |

## Known limitations

- Comparison is against the **merge base** (common ancestor), not the tip of the target branch — this is intentional and matches standard MR diff behavior
- Binary files are listed in the tree but open without useful diff content
- Rename detection relies on git's default similarity threshold (50%)