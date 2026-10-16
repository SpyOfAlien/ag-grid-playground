import { RevisionConflictError } from '../../../shared/table-system/model/errors';
import { Operation } from '../../../shared/table-system/operations/operation-controller';
import { TableModel } from '../../../shared/table-system/model/table-model';
import { SimulatedServer } from '../persistence/simulated-server';
import { LabRow } from './lab-row';
import { canEditAmount } from './lab-operations';
export interface DetailsDraft {
  readonly name: string;
  readonly amount: number | null;
  readonly note: string;
}
export interface DetailsCommand {
  readonly id: string;
  readonly draft: DetailsDraft;
  readonly action: 'save' | 'approve';
  readonly baseRevision: number;
}
export function createDetailsOperation(
  server: SimulatedServer,
  mayApprove: () => boolean,
): Operation<LabRow, DetailsCommand> {
  return {
    name: 'details',
    scope: () => ({ kind: 'table' }),
    authorize: (c, model) => canEditAmount(model, c.id) && (c.action !== 'approve' || mayApprove()),
    validate: (c, model) => {
      if (model.lookup(c.id)?.revision !== c.baseRevision) throw new RevisionConflictError();
      if (
        !c.draft.name.trim() ||
        c.draft.note.length > 500 ||
        (c.draft.amount !== null && (!Number.isFinite(c.draft.amount) || c.draft.amount < 0))
      )
        throw new Error('Invalid details');
    },
    execute: (c, model, abort) => {
      const dependent = model.rows().find((row) => row.id !== c.id);
      return server.persist(
        {
          kind: 'patch',
          rows: [
            {
              id: c.id,
              expectedRevision: c.baseRevision,
              changes: {
                ...c.draft,
                name: c.draft.name.trim(),
                reviewed: c.action === 'approve' ? true : model.lookup(c.id)!.reviewed,
                revision: c.baseRevision + 1,
              },
            },
            ...(dependent
              ? [
                  {
                    id: dependent.id,
                    expectedRevision: dependent.revision,
                    changes: {
                      note: `Dependent update from ${c.draft.name.trim()}`,
                      revision: dependent.revision + 1,
                    },
                  },
                ]
              : []),
          ],
        },
        abort,
      );
    },
  };
}
export interface TextCommand {
  readonly id: string;
  readonly field: 'name' | 'note';
  readonly value: string;
  readonly baseRevision: number;
}
export function createTextOperation(server: SimulatedServer): Operation<LabRow, TextCommand> {
  return {
    name: 'text',
    scope: (c) => ({ kind: 'entity', id: c.id }),
    authorize: (c, model) => canEditAmount(model, c.id),
    validate: (c, model) => {
      if (model.lookup(c.id)?.revision !== c.baseRevision) throw new RevisionConflictError();
      if (c.value.length > 500 || (c.field === 'name' && !c.value.trim()))
        throw new Error('Invalid text');
    },
    execute: (c, _model, abort) =>
      server.persist(
        {
          kind: 'patch',
          rows: [
            {
              id: c.id,
              expectedRevision: c.baseRevision,
              changes: { [c.field]: c.value, revision: c.baseRevision + 1 },
            },
          ],
        },
        abort,
      ),
  };
}
