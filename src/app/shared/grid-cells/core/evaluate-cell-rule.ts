import type { CellContext, CellRule } from './cell-context.model';

export function evaluateCellRule<R, V, T>(rule: CellRule<R, V, T>, cell: CellContext<R, V>): T {
  // Callbacks are the only function-valued rules supported by this contract.
  return typeof rule === 'function' ? (rule as (cell: CellContext<R, V>) => T)(cell) : rule;
}
