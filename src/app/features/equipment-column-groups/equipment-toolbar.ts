import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';

// Tailwind classes, written out in full so Tailwind can find them when scanning.
// Tokens (--color-*, --radius-md) come from equipment-column-groups.css.
// Border width is border-1: plain `border` is excluded from scanning in src/tailwind.css.
const BUTTON =
  'inline-flex min-h-8 items-center gap-1.5 whitespace-nowrap rounded-[var(--radius-md)] border-1 border-solid border-[var(--color-border-primary)] bg-[var(--color-bg-primary)] px-3 py-1 [font-family:inherit] text-[12px] leading-[18px] font-semibold text-[var(--color-gray-800)] cursor-pointer enabled:hover:bg-[var(--color-gray-50)] disabled:cursor-not-allowed disabled:border-[var(--color-border-secondary)] disabled:bg-[var(--color-gray-50)] disabled:text-[var(--color-gray-400)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600';
const PRIMARY_BUTTON = `${BUTTON} enabled:border-brand-600 enabled:text-brand-600`;
const ICON =
  'size-4 flex-none fill-none stroke-current stroke-2 [stroke-linecap:round] [stroke-linejoin:round]';

/**
 * Table controls above the equipment table: view controls (filter row, column groups,
 * column settings, full screen) and data actions (add column, add row).
 * Setting column and Add Column are placeholders until those features exist.
 */
@Component({
  selector: 'app-equipment-toolbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'group',
    'aria-label': 'Table controls',
    class: 'flex flex-wrap items-center justify-end gap-3',
  },
  template: `
    <label
      class="inline-flex items-center gap-2 text-[12px] leading-[18px] font-semibold text-[var(--color-gray-800)] cursor-pointer"
    >
      <input
        #filterCheckbox
        type="checkbox"
        class="m-0 size-4 cursor-pointer accent-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        [checked]="filtersHidden()"
        (change)="filtersHidden.set(filterCheckbox.checked)"
      />
      Hide Filter/Search
    </label>
    <button type="button" class="${BUTTON}" (click)="groupsToggle.emit()">
      <svg class="${ICON}" viewBox="0 0 24 24" aria-hidden="true">
        @if (groupsExpanded()) {
          <path d="M7 20l5-5 5 5M7 4l5 5 5-5" />
        } @else {
          <path d="M7 15l5 5 5-5M7 9l5-5 5 5" />
        }
      </svg>
      {{ groupsExpanded() ? 'Collapse all' : 'Expand all' }}
    </button>
    <button type="button" class="${BUTTON}" disabled>
      <svg class="${ICON}" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" />
        <circle cx="15" cy="6" r="2" />
        <circle cx="9" cy="12" r="2" />
        <circle cx="17" cy="18" r="2" />
      </svg>
      Setting column
    </button>
    <button type="button" class="${BUTTON}" (click)="fullScreenToggle.emit()">
      <svg class="${ICON}" viewBox="0 0 24 24" aria-hidden="true">
        @if (fullScreen()) {
          <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" />
        } @else {
          <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
        }
      </svg>
      {{ fullScreen() ? 'Exit Full Screen' : 'Full Screen' }}
    </button>
    <!-- Separates view controls from data actions. -->
    <span class="h-6 w-px bg-[var(--color-border-secondary)]" aria-hidden="true"></span>
    <button type="button" class="${PRIMARY_BUTTON}" disabled>
      <svg class="${ICON}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
      Add Column
    </button>
    <button type="button" class="${PRIMARY_BUTTON}" (click)="rowAdd.emit()">
      <svg class="${ICON}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
      Add Row
    </button>
  `,
})
export class EquipmentToolbar {
  /** True when every column group is open; the toggle then offers Collapse all. */
  readonly groupsExpanded = input.required<boolean>();
  readonly fullScreen = input(false);
  readonly filtersHidden = model(false);
  readonly groupsToggle = output();
  readonly fullScreenToggle = output();
  readonly rowAdd = output();
}
