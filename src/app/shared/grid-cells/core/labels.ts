import { InjectionToken, type Provider } from '@angular/core';

/** User-facing text owned by the kit. Provide translations at the application or feature. */
export interface GridCellLabels {
  /** Names a pen button; receives the column header, which can be empty. */
  readonly editAction: (column: string) => string;
  readonly toggle: string;
  readonly dropdown: string;
  readonly dropdownPlaceholder: string;
  readonly dropdownList: string;
  readonly editor: string;
  readonly rowUnavailable: string;
  readonly save: string;
  readonly saving: string;
  readonly cancel: string;
  readonly invalid: string;
}

export const DEFAULT_GRID_CELL_LABELS: GridCellLabels = {
  editAction: (column) => (column ? `Edit ${column}` : 'Edit value'),
  toggle: 'Toggle value',
  dropdown: 'Dropdown value',
  dropdownPlaceholder: 'Choose a value',
  dropdownList: 'Choose value',
  editor: 'Editor',
  rowUnavailable: 'Row is unavailable.',
  save: 'Save',
  saving: 'Saving…',
  cancel: 'Cancel',
  invalid: 'Enter a valid value.',
};

export const GRID_CELL_LABELS = new InjectionToken<GridCellLabels>('GRID_CELL_LABELS', {
  providedIn: 'root',
  factory: () => DEFAULT_GRID_CELL_LABELS,
});

export function provideGridCellLabels(labels: Partial<GridCellLabels>): Provider {
  return { provide: GRID_CELL_LABELS, useValue: { ...DEFAULT_GRID_CELL_LABELS, ...labels } };
}
