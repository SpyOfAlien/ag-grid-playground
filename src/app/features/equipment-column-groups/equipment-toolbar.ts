import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import {
  EquipmentColumnsMenu,
  type EquipmentColumnCheckbox,
  type EquipmentGroupMode,
  type EquipmentGroupSwitch,
} from './equipment-columns-menu';

// Tailwind classes, written out in full so Tailwind can find them when scanning.
// Tokens (--color-*, --radius-md) come from equipment-column-groups.css.
// Border width is border-1: plain `border` is excluded from scanning in src/tailwind.css.
const BUTTON =
  'inline-flex min-h-8 items-center gap-1.5 whitespace-nowrap rounded-[var(--radius-md)] border-1 border-solid border-[var(--color-border-primary)] bg-[var(--color-bg-primary)] px-3 py-1 [font-family:inherit] text-[12px] leading-[18px] font-semibold text-[var(--color-gray-800)] cursor-pointer enabled:hover:bg-[var(--color-gray-50)] disabled:cursor-not-allowed disabled:border-[var(--color-border-secondary)] disabled:bg-[var(--color-gray-50)] disabled:text-[var(--color-gray-400)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600';
const PRIMARY_BUTTON = `${BUTTON} enabled:border-brand-600 enabled:text-brand-600`;
const ICON =
  'size-4 flex-none fill-none stroke-current stroke-2 [stroke-linecap:round] [stroke-linejoin:round]';

/**
 * Table controls for the equipment table, shown above it and again mid-page below it: view
 * controls (the Columns menu, which holds every column control, and full screen) and data
 * actions (add row).
 */
@Component({
  selector: 'app-equipment-toolbar',
  imports: [EquipmentColumnsMenu],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'group',
    '[attr.aria-label]': 'label()',
    class: 'flex flex-wrap items-center justify-end gap-3',
  },
  template: `
    <app-equipment-columns-menu
      [groups]="groups()"
      [columns]="columns()"
      [groupMode]="groupMode()"
      [(filtersHidden)]="filtersHidden"
      (groupModeSet)="groupModeSet.emit($event)"
      (groupSet)="groupSet.emit($event)"
      (columnSet)="columnSet.emit($event)"
    />
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
    <button type="button" class="${PRIMARY_BUTTON}" (click)="rowAdd.emit()">
      <svg class="${ICON}" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 5v14M5 12h14" />
      </svg>
      Add Row
    </button>
  `,
})
export class EquipmentToolbar {
  /** Names this toolbar apart from the other copy of it. */
  readonly label = input.required<string>();
  readonly groups = input.required<readonly EquipmentGroupSwitch[]>();
  readonly columns = input.required<readonly EquipmentColumnCheckbox[]>();
  readonly groupMode = input.required<EquipmentGroupMode>();
  readonly fullScreen = input(false);
  readonly filtersHidden = model(false);
  readonly groupModeSet = output<EquipmentGroupMode>();
  readonly groupSet = output<{ code: string; open: boolean }>();
  readonly columnSet = output<{ code: string; visible: boolean }>();
  readonly fullScreenToggle = output();
  readonly rowAdd = output();
}
