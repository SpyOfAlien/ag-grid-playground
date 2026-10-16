# Equipment table — design spec

Design reference for the `/equipment-column-groups` demo: a full-page AG Grid table of ICU equipment with nested, collapsible column groups. The page shows only the table and a slim toolbar with **Expand all** / **Collapse all**; a visually hidden `<h1>` gives it a title and a `role="status"` paragraph announces bulk expand/collapse to screen readers.

Code: `src/app/features/equipment-column-groups/` · Tests: `e2e/equipment-column-groups.spec.ts`.

Renderers: `renderers/cells/revised-cell.ts` (`RevisedCell`) and `renderers/headers/collapsed-group-header.ts` (`CollapsedGroupHeader`). A *rail* is the 38px placeholder column shown while a group is collapsed.

## 1. Design tokens

Brand colours (`--color-brand-*`) are Tailwind theme tokens in `src/tailwind.css` (emitted with `@theme static`, so plain CSS can use them too). The other tokens are defined on `app-equipment-column-groups` in `equipment-column-groups.css`. The scale follows an Untitled UI–style system with a warm orange brand.

```css
app-equipment-column-groups {
  /* Brand (warm orange) */
  --color-brand-900: #511c10; /* text on light group levels */
  --color-brand-700: #7c2d12; /* top-level groups */
  --color-brand-600: #b93815; /* accent, focus */
  --color-brand-50-alt: #fdead7; /* level-1 groups */
  --color-brand-primary-alt: #fef6ee; /* level-2 groups */

  /* Gray */
  --color-gray-900: #181d27; /* primary cell text */
  --color-gray-800: #252b37; /* filter button icon */
  --color-gray-700: #414651; /* header text, secondary cell text */
  --color-gray-400: #a4a7ae; /* filter-row divider tick */
  --color-gray-100: #f5f5f5; /* filter row background */
  --color-gray-50: #fafafa; /* row-number column */

  /* Surfaces & borders */
  --color-bg-primary: #ffffff;
  --color-border-secondary: #e9eaeb;
  --color-row-divider: rgba(33, 33, 33, 0.12);

  /* Status */
  --color-error-solid: #d92d20; /* changed revision */
  --color-error-bg: #fef3f2; /* changed cell background */

  /* Alpha */
  --alpha-white-10: rgba(255, 255, 255, 0.1);
  --alpha-black-10: rgba(0, 0, 0, 0.1);

  /* Spacing and radius */
  --spacing-xxs: 2px;
  --spacing-xs: 4px;
  --spacing-sm: 6px;
  --spacing-md: 8px;
  --spacing-xl: 16px;
  --radius-xs: 4px;
  --radius-sm: 6px;
  --radius-md: 8px;

  /* Typography (Inter, loaded in src/index.html) */
  --font-family-body: 'Inter', sans-serif;
}
```

### Text styles

| Style | Size / line-height | Weight | Used for |
| --- | --- | --- | --- |
| Body semibold | 14 / 20 | 600 | Group headers |
| Body medium | 14 / 20 | 500 | Column headers (18px line-height), rotated rail labels |
| Body | 14 / 20 | 400 | Cell values, filter inputs |
| Small semibold | 12 / 18 | 600 | Count badge |
| Old value | 12 / 16 | 400, line-through | Previous value in changed cells |

## 2. Layout

| Region | Size | Notes |
| --- | --- | --- |
| Page | full viewport height | the grid fills the page |
| Toolbar | 32px buttons | padding 6px 12px, right-aligned, gap 12px, bottom border `--color-border-secondary`; buttons radius 8, 1px `--color-border-primary`, 12/18 semibold `--color-gray-800` |
| Table header | label cell + 44px filter row | labels bottom-aligned (padding-bottom 16px) |
| Table row | 44px | cell padding 12px |

## 3. Components

### Count badge

On collapsed rails: 20×20, radius 4, bg `#f04438`, 12/18 semibold white (Tailwind classes in `renderers/headers/collapsed-group-header.ts`).

### Filter input

Height 36, radius 8, white, 1px `--color-border-secondary`, 20px search icon at 12px from the left (text starts at 40px).

### Table

- **Header label cell:** bottom-aligned 14/18 medium `--color-gray-700`, full-height right border `--color-border-secondary`.
- **Filter row:** 44px, bg `--color-gray-100`, input + 28px filter button. Column divider is a 1×16px `--color-gray-400` tick, vertically centred.
- **Row-number column:** 48px, bg `--color-gray-50`, right border, centred `--color-gray-700`.
- **Body cell:** 44px, padding 12px, ellipsis. `--color-gray-900` for primary data, `--color-gray-700` for secondary (Room, Biomed Owner).
- **Row divider:** 1px bottom `--color-row-divider`.
- **Changed cell:** bg `--color-error-bg`; old value (12/16, line-through, `#535862`) above new value (14/20 medium `#b42318`).
- **Changed revision:** `--color-error-solid`.
- **Column widths:** No# 48 · Revision 110 · Device Type 140 · Ward 190 · Ward Code 140 · Room 140 · Biomed Owner 140 · group columns 170–220.

### Column groups

Group headers and rails are styled with **Tailwind** utility classes, kept in `equipment-group-classes.ts`. AG Grid creates these elements itself, so `buildGroup()` in `equipment-columns.ts` applies the classes through `headerClass` / `cellClass`. Group colour comes from nesting depth: each level's classes set `--group-bg` and `--group-divider`, which the shared classes read. Levels 3 and deeper share the level-3 colours. `equipment-group`, `equipment-rail`, `equipment-rail-cell` and `equipment-level-N` stay on the elements as unstyled hooks for `equipment-table.css` and the tests.

Tailwind setup (`src/tailwind.css`, `.postcssrc.json`):

- No Preflight, so the other demos and Angular Material keep their base styles.
- Only this feature's folder is scanned; words from comments that would become stray utilities are excluded with `@source not inline(...)`.
- Utilities are `!important`, because AG Grid's theme CSS is unlayered and would otherwise beat anything in a cascade layer. Watch for utilities that change `display` on AG Grid elements: they also override `.ag-hidden`, so scope them with `:not(.ag-hidden)`.

| Level | Background | Text | Divider |
| --- | --- | --- | --- |
| 0 (top level) | `--color-brand-700` `#7c2d12` | white | `--alpha-white-10` |
| 1 | `--color-brand-50-alt` `#fdead7` | `--color-brand-900` | `--alpha-black-10` |
| 2 | `--color-brand-primary-alt` `#fef6ee` | `--color-brand-900` | `--alpha-black-10` |
| 3 and deeper | white | `--color-brand-900` | `rgba(185, 56, 21, 0.24)` (orange outline) |

- **Group header (expanded):** 36px, 24px chevron button + 14 semibold label in the level colours.
- **Collapsed rail:** 38px wide, full height, level background, 1px inset divider on both sides through the group header, column header, filter row and body. Contents from top: 20px count badge, then the label rotated −90°, 14/20 medium with ellipsis, both centred.
- **Filter-row slot:** AG Grid doesn't put column classes on filter-row cells, so the rail header's `::after` paints the 44px slot below itself (`after:` utilities in `RAIL_HEADER_CLASSES`).

### Icons

Untitled UI–style line icons in `public/equipment-column-groups/`: `filter-lines`, `search-md`, `group-chevron-right`, `rail-chevron-down`. Grid icons are applied as CSS masks so they take the level's text colour; all are 16px except the 20px search icon in filter inputs.

## 4. Accessibility notes

Colours are chosen to meet WCAG AA (4.5:1) for text:

- Changed cell old value uses `#535862` and the new value `#b42318`; the lighter `#717680` and `#d92d20` fall below 4.5:1 on `#fef3f2`.
- The changed revision uses `--color-error-solid` `#d92d20` on white (4.8:1).
- `RevisedCell` (used only for changed cells, via `cellRendererSelector`) adds screen-reader-only "Previous value:" / "New value:" labels.
