import { signal } from '@angular/core';
import type { SignalRow } from '../signal.model';

/**
 * Edit mode of the signal grid: whether it's on, and which data columns are ticked in their
 * header (the columns Replace Value starts with). Leaving edit mode clears the ticks; drafts
 * stay (SignalDrafts).
 */
export class SignalEditState {
  private readonly checked = signal<ReadonlySet<string>>(new Set());

  readonly editMode = signal(false);
  readonly checkedColumns = this.checked.asReadonly();

  setEditMode(on: boolean): void {
    this.editMode.set(on);
    if (!on) this.checked.set(new Set());
  }

  setChecked(columnCode: string, checked: boolean): void {
    this.checked.update((codes) => {
      const next = new Set(codes);
      if (checked) next.add(columnCode);
      else next.delete(columnCode);
      return next;
    });
  }
}

/**
 * Front-end drafts of the signal grid, not yet saved: whole-column replacements from Replace
 * Value, newest last. Rows load from the server in blocks as the table scrolls, so a draft can't
 * be stored per row: rows not loaded yet would miss it. It's stored per column instead, and
 * applied to every row as it arrives (createSignalDatasource) and to rows already loaded
 * (SignalDrafts.applyTo, from the page).
 */
export class SignalDrafts {
  private readonly values = signal<Readonly<Record<string, string>>>({});

  readonly replacements = this.values.asReadonly();

  replace(columnCodes: readonly string[], value: string): void {
    this.values.update((values) => ({
      ...values,
      ...Object.fromEntries(columnCodes.map((code) => [code, value])),
    }));
  }

  /** The row with the drafts applied: a copy; the server's row is left as it is. */
  applyTo(row: SignalRow): SignalRow {
    const values = this.values();
    return Object.keys(values).length ? { ...row, data: { ...row.data, ...values } } : row;
  }
}

/** Shared with the grid's header components through its context. */
export interface SignalGridContext {
  edit: SignalEditState;
}
