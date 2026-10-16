import type { CellRule } from '../../core/cell-context.model';

export type EditPermission = { allowed: true } | { allowed: false; reason: string };

export interface ActionConfig<R, V> {
  enabled?: boolean;
  permission?: CellRule<R, V, EditPermission>;
  tooltip?: CellRule<R, V, string | null>;
}

export interface ActionPart<R, V, E = never> {
  action?: ActionConfig<R, V> & ([E] extends [never] ? object : { editor: E });
}

export interface ActionState {
  readonly visible: boolean;
  readonly disabled: boolean;
  readonly tooltip: string | null;
}
