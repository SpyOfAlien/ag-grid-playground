import { Injectable, signal } from '@angular/core';
export interface Row {
  id: string;
  amount: number | null;
  unit: string;
  reviewed: boolean;
  notes: string;
}
@Injectable()
export class RowState {
  private readonly source = signal<Row[]>([
    { id: 'one', amount: 12, unit: 'kg', reviewed: true, notes: '' },
  ]);
  readonly rows = this.source.asReadonly();
  getRow(id: string) {
    return this.rows().find((row) => row.id === id);
  }
  replaceRows(rows: readonly Row[]): void {
    const ids = new Set(rows.map((row) => row.id));
    if (ids.size !== rows.length || rows.some((row) => !row.id))
      throw new Error('Invalid row identities.');
    this.source.set([...rows]);
  }
}
