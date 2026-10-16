import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type { EditCommand } from '@grid-cells';
import { RowState, type Row } from './row-state';

function isRow(value: unknown): value is Row {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row['id'] === 'string' &&
    row['id'].length > 0 &&
    (row['amount'] === null ||
      (typeof row['amount'] === 'number' && Number.isFinite(row['amount']))) &&
    typeof row['unit'] === 'string' &&
    typeof row['reviewed'] === 'boolean' &&
    typeof row['notes'] === 'string'
  );
}

@Injectable()
export class ApiExample {
  private readonly http = inject(HttpClient);
  private readonly state = inject(RowState);
  async saveAmount(command: EditCommand<{ value: number | null }>): Promise<void> {
    const currentRow = this.state.getRow(command.cell.rowId);
    if (!currentRow) throw new Error('Missing row.');
    if (!currentRow.reviewed) throw new Error('Review this row before editing.');
    let params = new HttpParams();
    for (const [key, value] of Object.entries(command.queryParams ?? {})) {
      for (const item of Array.isArray(value) ? value : [value])
        params = params.append(key, String(item));
    }
    const response = await firstValueFrom(
      this.http.patch<unknown>(
        `/api/rows/${encodeURIComponent(currentRow.id)}`,
        { amount: command.data.value },
        {
          params,
        },
      ),
    );
    if (!Array.isArray(response) || !response.every(isRow))
      throw new Error('Invalid row-set response.');
    this.state.replaceRows(response);
  }
}
