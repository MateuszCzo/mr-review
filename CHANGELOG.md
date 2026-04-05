# Change Log

## [Unreleased]

## [0.2.0] - 2026-04-05

### Changed

- Changed files panel now displays a nested folder tree instead of a flat list — folders collapse and expand individually
- Folders with a single child are automatically collapsed into one node (e.g. `src/AppBundle/AI/Model` instead of four separate levels)

## [0.1.0] - 2026-03-28

### Added

- Activity Bar icon and sidebar panel with two views: **Compare branch** and **Changed files**
- Branch input with autocomplete — fetches all local and remote branches via `git branch`
- Comparison based on **merge base** (common ancestor), matching standard MR diff behavior
- Changed files tree grouped by directory with status badges: `A` added · `M` modified · `D` deleted · `R` renamed
- Click any file in the tree to open a native VS Code diff view
- Left side of diff shows base branch file content (read-only, served via custom `mr-review-diff:` URI scheme)
- Right side of diff is the real file on disk — fully editable with IntelliSense, Go to Definition, Find References, and all other extensions working normally
- Character-level (column) highlighting handled natively by VS Code's diff editor
- Diff stats summary after comparison: number of changed files, lines added, lines removed
- **Refresh** button in the changed files panel to re-run the comparison
- Automatic `git fetch` before comparison to ensure remote branch refs are up to date