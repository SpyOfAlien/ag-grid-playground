import { RevisionConflictError } from '../../../shared/table-system/model/errors';
import { Operation } from '../../../shared/table-system/operations/operation-controller';
import { TableModel } from '../../../shared/table-system/model/table-model';
import { SimulatedServer } from '../persistence/simulated-server';
import { LabRow } from './lab-row';
export interface ReviewCommand {
  readonly id: string;
  readonly reviewed: boolean;
  readonly baseRevision: number;
}
export function canReview(model: TableModel<LabRow>, id: string): boolean {
  return !!model.lookup(id);
}
export function createReviewOperation(server: SimulatedServer): Operation<LabRow, ReviewCommand> {
  return {
    name: 'review',
    scope: (c) => ({ kind: 'entity', id: c.id }),
    authorize: (c, model) => canReview(model, c.id),
    validate: (c, model) => {
      if (model.lookup(c.id)?.revision !== c.baseRevision) throw new RevisionConflictError();
    },
    execute: (c, _model, abort) =>
      server.persist(
        {
          kind: 'patch',
          rows: [
            {
              id: c.id,
              expectedRevision: c.baseRevision,
              changes: { reviewed: c.reviewed, revision: c.baseRevision + 1 },
            },
          ],
        },
        abort,
      ),
  };
}

export interface AmountCommand {
  readonly id: string;
  readonly amount: number | null;
  readonly baseRevision: number;
}
export function canEditAmount(model: TableModel<LabRow>, id: string): boolean {
  const row = model.lookup(id);
  return !!row && !row.locked;
}
export function createAmountOperation(server: SimulatedServer): Operation<LabRow, AmountCommand> {
  return {
    name: 'amount',
    scope: (c) => ({ kind: 'entity', id: c.id }),
    authorize: (c, model) => canEditAmount(model, c.id),
    validate: (c, model) => {
      if (model.lookup(c.id)?.revision !== c.baseRevision) throw new RevisionConflictError();
      if (c.amount !== null && (!Number.isFinite(c.amount) || c.amount < 0))
        throw new Error('Invalid amount');
    },
    execute: (c, _model, abort) =>
      server.persist(
        {
          kind: 'patch',
          rows: [
            {
              id: c.id,
              expectedRevision: c.baseRevision,
              changes: {
                amount: c.amount === null ? null : Math.round(c.amount * 1000) / 1000,
                revision: c.baseRevision + 1,
              },
            },
          ],
        },
        abort,
      ),
  };
}

export interface CategoryCommand {
  readonly id: string;
  readonly category: LabRow['category'];
  readonly baseRevision: number;
}
export function createCategoryOperation(
  server: SimulatedServer,
): Operation<LabRow, CategoryCommand> {
  return {
    name: 'category',
    scope: (c) => ({ kind: 'entity', id: c.id }),
    authorize: (c, model) => canEditAmount(model, c.id),
    validate: (c, model) => {
      if (model.lookup(c.id)?.revision !== c.baseRevision) throw new RevisionConflictError();
      if (!['parts', 'labor'].includes(c.category)) throw new Error('Disabled or invalid category');
    },
    execute: (c, _model, abort) =>
      server.persist(
        {
          kind: 'patch',
          rows: [
            {
              id: c.id,
              expectedRevision: c.baseRevision,
              changes: { category: c.category, revision: c.baseRevision + 1 },
            },
          ],
        },
        abort,
      ),
  };
}

export function categoryFromDraft(value: string): LabRow['category'] {
  if (value === 'parts' || value === 'labor' || value === 'other') return value;
  throw new Error('Invalid category');
}
