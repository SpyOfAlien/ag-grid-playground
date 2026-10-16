/**
 * Tailwind classes for column group headers and their rails.
 *
 * AG Grid creates these elements itself, so the classes are applied through
 * headerClass / cellClass in equipment-columns.ts rather than in a template.
 * Every class is written out in full so Tailwind can find it when scanning.
 *
 * The `equipment-group`, `equipment-rail`, `equipment-rail-cell` and
 * `equipment-level-N` classes carry no styles: they are hooks for
 * equipment-table.css and the e2e tests.
 */

/**
 * Colours per nesting level, each lighter than its parent. Sets the variables the
 * shared classes below read: --group-bg (background) and --group-divider (rail edges).
 * Groups at level 3 and deeper share the last entry.
 */
export const GROUP_LEVEL_CLASSES = [
  'equipment-level-0 text-white [--group-bg:var(--color-brand-700)] [--group-divider:rgba(255,255,255,0.1)]',
  'equipment-level-1 text-brand-900 [--group-bg:var(--color-brand-50-alt)] [--group-divider:rgba(0,0,0,0.1)]',
  'equipment-level-2 text-brand-900 [--group-bg:var(--color-brand-primary-alt)] [--group-divider:rgba(0,0,0,0.1)]',
  'equipment-level-3 text-brand-900 [--group-bg:var(--color-white)] [--group-divider:rgba(185,56,21,0.24)]',
] as const;

/** Dividers on both sides of a rail; inset so the rail keeps its 38px width. */
const RAIL_DIVIDERS =
  'border-x-0 shadow-[inset_1px_0_0_var(--group-divider),inset_-1px_0_0_var(--group-divider)]';

/** Group header cell (`.ag-header-group-cell`), expanded or collapsed. */
export const GROUP_HEADER_CLASSES = [
  'equipment-group bg-[var(--group-bg)] font-semibold',
  // Nested levels get a bottom border in their divider colour.
  'not-[.equipment-level-0]:border-0 not-[.equipment-level-0]:border-b not-[.equipment-level-0]:border-solid not-[.equipment-level-0]:border-b-[var(--group-divider)]',
  // Focus ring stays visible on the dark top level.
  '[&.equipment-level-0]:focus-within:outline-white',
  // Expand / collapse button, using the design's chevrons tinted with the text colour.
  // Utilities are !important, so `grid` must skip AG Grid's hidden chevron (.ag-hidden).
  // 6px radius is written out: the page's own --radius-md token (8px) would win over rounded-md.
  '[&_.ag-header-expand-icon]:-order-1 [&_.ag-header-expand-icon:not(.ag-hidden)]:grid [&_.ag-header-expand-icon]:size-6 [&_.ag-header-expand-icon]:place-content-center [&_.ag-header-expand-icon]:rounded-[6px] [&_.ag-header-expand-icon]:ml-0 [&_.ag-header-expand-icon]:mr-1',
  '[&_.ag-icon]:text-inherit [&_.ag-icon::before]:[mask-size:contain] [&_.ag-icon::before]:[mask-repeat:no-repeat] [&_.ag-icon::before]:[mask-position:center]',
  '[&_.ag-icon-expanded::before]:[mask-image:url(/equipment-column-groups/group-chevron-right.svg)]',
  '[&_.ag-icon-contracted::before]:[mask-image:url(/equipment-column-groups/rail-chevron-down.svg)]',
  // Collapsed: only the centred chevron shows; the name stays for screen readers.
  'aria-[expanded=false]:p-0 aria-[expanded=false]:border-x-0 aria-[expanded=false]:shadow-[inset_1px_0_0_var(--group-divider),inset_-1px_0_0_var(--group-divider)] aria-[expanded=false]:after:hidden',
  '[&[aria-expanded=false]_.ag-header-group-text]:sr-only [&[aria-expanded=false]_.ag-header-group-cell-label]:justify-center [&[aria-expanded=false]_.ag-header-expand-icon]:m-0',
].join(' ');

/**
 * Rail column header. AG Grid never puts column classes on filter-row cells, so the
 * header's ::after paints the 44px filter-row slot below itself, behind the label.
 */
export const RAIL_HEADER_CLASSES = [
  `equipment-rail bg-[var(--group-bg)] overflow-visible p-0 ${RAIL_DIVIDERS}`,
  '[&_.ag-header-cell-comp-wrapper]:size-full [&_.ag-header-cell-comp-wrapper]:max-h-none [&_.ag-header-cell-comp-wrapper]:items-start',
  'after:absolute after:inset-x-0 after:top-full after:-z-1 after:block after:h-11 after:w-auto after:border-0 after:bg-[var(--group-bg)] after:shadow-[inset_1px_0_0_var(--group-divider),inset_-1px_0_0_var(--group-divider)]',
].join(' ');

/** Rail body cells. */
export const RAIL_CELL_CLASSES = `equipment-rail-cell bg-[var(--group-bg)] border-y-0 ${RAIL_DIVIDERS}`;
