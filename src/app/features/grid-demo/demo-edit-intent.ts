import type { EditCommand } from '../../shared/grid-cells/editing/edit-command.model';
import type { DemoRow } from './demo-row.model';
import { demoReviewPermission } from './demo-edit-permission';
import { DemoEditError, type DemoEditAction, type DemoActionData } from './demo-persistence.model';
import type { DemoPayload } from './api/demo-api.model';

export type DemoEdit = {
  [A in DemoEditAction]: { readonly action: A; readonly command: EditCommand<DemoActionData[A]> };
}[DemoEditAction];

const actionColumns: Record<DemoEditAction, readonly string[]> = {
  applyReviewDemo: ['review'],
  saveName: ['name'],
  saveAmount: ['metric-2', 'toggle-number'],
  saveNotes: ['notes'],
  saveReview: ['review-toggle', 'toggle-number'],
  saveUnit: ['unit-dropdown'],
  saveDetails: ['details'],
  approveDetails: ['details'],
};

export function authorizeDemoEdit(
  action: DemoEditAction,
  columnId: string,
  row: Readonly<DemoRow>,
): void {
  if (!actionColumns[action].includes(columnId))
    throw new DemoEditError('denied', 'This action is not available for the originating column.');
  if (action === 'saveReview' || action === 'saveDetails' || action === 'approveDetails') return;
  const permission = demoReviewPermission(row);
  if (!permission.allowed) throw new DemoEditError('denied', permission.reason);
}

export function buildDemoPayload(edit: DemoEdit, row: Readonly<DemoRow>): DemoPayload {
  const fields = (changes: Partial<DemoRow>): DemoPayload => ({
    row,
    columnId: edit.command.cell.columnId,
    changes,
  });
  switch (edit.action) {
    case 'applyReviewDemo':
      return fields({
        name: `${row.name} (edited)`,
        metrics: row.metrics.map((value, index) => (index === 0 ? (value ?? 0) + 1 : value)),
        metadata: { ...row.metadata, unit: row.metadata.unit === 'kg' ? 't' : 'kg' },
      });
    case 'saveName': {
      const name = edit.command.data.value ?? '';
      if (!name.trim() || name.length > 60)
        throw new DemoEditError('invalid-command', 'Enter a name with 1 to 60 characters.');
      return fields({ name });
    }
    case 'saveAmount': {
      const amount = edit.command.data.value;
      validateAmount(amount);
      return fields({
        metrics: row.metrics.map((value, index) =>
          index === (edit.command.cell.columnId === 'toggle-number' ? 7 : 2) ? amount : value,
        ),
      });
    }
    case 'saveNotes': {
      const notes = edit.command.data.value;
      validateNotes(notes);
      return fields({ notes });
    }
    case 'saveReview':
      return fields({ metadata: { ...row.metadata, reviewed: edit.command.data.value } });
    case 'saveUnit':
      return fields({ metadata: { ...row.metadata, unit: edit.command.data.value } });
    case 'saveDetails':
    case 'approveDetails': {
      const draft = edit.command.data;
      if (!Number.isSafeInteger(draft.revision) || draft.revision !== row.metadata.revision)
        throw new DemoEditError(
          'revision-conflict',
          'The row changed. Reopen the editor before saving.',
        );
      if (!draft.name.trim() || draft.name.length > 60)
        throw new DemoEditError('invalid-command', 'Enter a name with 1 to 60 characters.');
      if (draft.amount === null)
        throw new DemoEditError('invalid-command', 'Details require an amount.');
      validateAmount(draft.amount);
      validateNotes(draft.notes);
      return { row, details: { name: draft.name, amount: draft.amount, notes: draft.notes } };
    }
  }
}

function validateAmount(value: number | null): void {
  if (value !== null && (!Number.isFinite(value) || value < 0))
    throw new DemoEditError('invalid-command', 'Enter a finite, non-negative amount.');
}

function validateNotes(value: string): void {
  if (value.length > 2000)
    throw new DemoEditError('invalid-command', 'Notes can have up to 2,000 characters.');
}
