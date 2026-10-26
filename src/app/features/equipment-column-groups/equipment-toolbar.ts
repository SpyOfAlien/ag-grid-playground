import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';

/**
 * Table controls above the equipment grid: view controls (filter row, column groups,
 * column settings, full screen) and data actions (add column, add row).
 * Setting column and Add Column are placeholders until those features exist.
 */
@Component({
  selector: 'app-equipment-toolbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'group', 'aria-label': 'Table controls' },
  styleUrl: './equipment-toolbar.css',
  template: `
    <label class="toolbar-check">
      <input
        #filterCheckbox
        type="checkbox"
        [checked]="filtersHidden()"
        (change)="filtersHidden.set(filterCheckbox.checked)"
      />
      Hide Filter/Search
    </label>
    <button type="button" class="toolbar-button" (click)="groupsToggle.emit()">
      <svg class="toolbar-icon" viewBox="0 0 24 24" aria-hidden="true">
        @if (groupsExpanded()) {
          <path d="M7 20l5-5 5 5M7 4l5 5 5-5" />
        } @else {
          <path d="M7 15l5 5 5-5M7 9l5-5 5 5" />
        }
      </svg>
      {{ groupsExpanded() ? 'Collapse all' : 'Expand all' }}
    </button>
    <button type="button" class="toolbar-button" disabled>
      <svg class="toolbar-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" />
        <circle cx="15" cy="6" r="2" />
        <circle cx="9" cy="12" r="2" />
        <circle cx="17" cy="18" r="2" />
      </svg>
      Setting column
    </button>
    <button type="button" class="toolbar-button" (click)="fullScreenToggle.emit()">
      <svg class="toolbar-icon" viewBox="0 0 24 24" aria-hidden="true">
        @if (fullScreen()) {
          <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" />
        } @else {
          <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
        }
      </svg>
      {{ fullScreen() ? 'Exit Full Screen' : 'Full Screen' }}
    </button>
    <span class="toolbar-divider" aria-hidden="true"></span>
    <button type="button" class="toolbar-button toolbar-button-primary" disabled>
      <svg class="toolbar-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
      Add Column
    </button>
    <button type="button" class="toolbar-button toolbar-button-primary" (click)="rowAdd.emit()">
      <svg class="toolbar-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
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
