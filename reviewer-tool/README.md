# Reviewer Tool Notes

Built for the revise workflow defined in `projects/grok_computer_office_trials/l0-tutor-skill.md`.

## Extracted revise-command rules

- Review the deliverable manually and walk front to back.
- Be extremely picky. Tiny local issues count.
- Order fixes by workflow priority:
  1. Structure
  2. Factual issues
  3. Content gaps
  4. Tables and charts
  5. Font and typography
  6. Layout and spacing
  7. Headers and footers
  8. Colors and branding
  9. Polish
- Strict workflow mode needs exactly 20 turns.
- Each turn must contain 1 to 4 prompt items.
- Items inside a turn are separated with semicolons.
- Every item must be a direct modification request, not a verification request.
- Keep each item short, local, blunt, and human.
- No explanations, no justifications, no filler.
- No hex codes in turn text. Use plain color names.
- No periods at the end of turns.

## App architecture

- Standalone app: top-level `reviewer-tool/` Vite React app.
- Data source: static JSON files in `reviewer-tool/public/reviewer-data/`.
- State: browser local storage for favorites, selected prompts, strict mode, and turn start number.
- No backend dependency for this tool path.

## Data model

### `public/reviewer-data/categories.json`

- `id`
- `label`
- `description`
- `priority_group`
- `subcategories[]`
  - `id`
  - `label`
  - `description`

### `public/reviewer-data/library-manifest.json`

- ordered list of category library files to load

### `public/reviewer-data/library/*.json`

- `category`
- `groups[]`
  - `subcategory`
  - `priority`
  - `doc_type`
  - `tags`
  - `entries[]`
    - `id`
    - `prompt_text`
    - `tags`
    - `doc_type`
    - `favorite`
    - `active`

## Component structure

- `src/App.jsx`
  - standalone app shell for the reviewer tool
- `src/reviewer/ReviewerPage.jsx`
  - top-level data loading, filtering, selected prompt state, queue state, export actions
- `src/reviewer/components/CategorySidebar.jsx`
  - category navigation and workflow priority reference
- `src/reviewer/components/ContextPanel.jsx`
  - subcategory picker with real prompt counts
- `src/reviewer/components/LibraryPanel.jsx`
  - search, filters, sort, prompt browsing, favorites, add-to-tray
- `src/reviewer/components/SelectedTray.jsx`
  - inline editing, manual prompt entry, reorder, dedupe, turn assignment
- `src/reviewer/components/TurnQueuePanel.jsx`
  - strict mode, auto split, queue preview, validation, copy, download
- `src/reviewer/utils.js`
  - queue splitting, export formatting, strict linting, sorting helpers

## Run instructions

```bash
cd reviewer-tool
npm install
npm run dev
```

Then open the local URL Vite prints, usually `http://localhost:5173`.

Production build check:

```bash
cd reviewer-tool
npm run build
```

## Best next steps

- Add save/load queue presets as editable local files, not only browser state.
- Add import from an existing `prompt.md` so the reviewer can continue a queue instead of starting blank.
- Add stronger prompt linting for banned phrasing and overly broad requests.
- Add diff-friendly export variants for appending directly into task folders.
- Add optional document metadata sidecars later if you want the tool to pre-seed likely prompt packs from a human-entered review checklist.
