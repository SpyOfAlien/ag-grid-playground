import type { Type } from '@angular/core';
import type {
  CellClassParams,
  ColDef,
  ICellRendererParams,
  ITooltipParams,
  ValueFormatterParams,
} from 'ag-grid-community';
import { toCellContext, type CellContext, type CellFacts } from '../core/cell-context';
import { computeContent, type ContentPart } from '../capabilities/content';
import { computeValueContent } from '../capabilities/number';

/** Only agInit is needed to infer a renderer's configuration, including custom renderers. */
type Renderer = { agInit(params: never): void };

type RendererInput<C extends Renderer> = Parameters<C['agInit']>[0];

export type CellRendererConfig<C extends Renderer> = Omit<
  RendererInput<C>,
  keyof ICellRendererParams<unknown, unknown, unknown>
>;

/** The value type a renderer declares through its params. */
export type CellRendererValue<C extends Renderer> =
  RendererInput<C> extends { value?: infer V } ? NonNullable<V> : unknown;

/** Bind a fixed renderer once per column, checking its config before AG Grid erases the types. */
export function bindCellRenderer<C extends Renderer>(
  component: Type<C>,
  params: NoInfer<CellRendererConfig<C>>,
): { cellRenderer: Type<C>; cellRendererParams: CellRendererConfig<C> } {
  return { cellRenderer: component, cellRendererParams: params };
}

/** Grid values can always be missing, so a column may produce null or undefined too. */
type ColumnValue<C extends Renderer> = CellRendererValue<C> | null | undefined;

export type CellColumn<R, C extends Renderer> = Omit<
  ColDef<R, ColumnValue<C>>,
  'cellRenderer' | 'cellRendererParams' | 'cellRendererSelector'
> & { readonly params: CellRendererConfig<C> };

/**
 * Define a column whose `field` or `valueGetter` must produce the renderer's value type,
 * alongside its checked renderer config.
 */
export function cellColumn<R>() {
  return <C extends Renderer>(
    component: Type<C>,
    column: NoInfer<CellColumn<R, C>>,
  ): ColDef<R, ColumnValue<C>> => {
    const { params, ...definition } = column;
    return { ...definition, cellRenderer: component, cellRendererParams: params };
  };
}

type GridCellParams<R, V> =
  ValueFormatterParams<R, V> | CellClassParams<R, V> | ITooltipParams<R, V>;

function facts<R, V>(params: GridCellParams<R, V>, content: ContentPart<R, V>['content']) {
  const cell: CellFacts<R, V> & ContentPart<R, V> = {
    value: params.value as V | null | undefined,
    data: params.data,
    node: params.node ?? {},
    column:
      'column' in params && params.column && 'getColId' in params.column
        ? params.column
        : undefined,
    colDef: params.colDef as CellFacts<R, V>['colDef'],
    content,
  };
  return { params: cell, cell: toCellContext(cell) as CellContext<R, V> };
}

/**
 * Display a read-only column without an Angular renderer. Only content rules apply; markers and
 * controls need a renderer. AG Grid evaluates these callbacks during its own refresh, so a rule
 * that reads an application signal needs `api.refreshCells()` when that signal changes.
 */
export function bindPlainCell<R, V>(
  content: NonNullable<ContentPart<R, V>['content']>,
): Pick<ColDef<R, V>, 'valueFormatter' | 'cellClassRules' | 'cellStyle' | 'tooltipValueGetter'> {
  const state = (params: GridCellParams<R, V>) => {
    const { params: cellParams, cell } = facts(params, content);
    return computeContent(cellParams, cell);
  };
  return {
    valueFormatter: (params) => {
      const { params: cellParams, cell } = facts(params, content);
      return computeValueContent(cellParams, cell)?.text ?? '';
    },
    cellClassRules: {
      'grid-cell-highlighted': (params) => state(params)?.highlighted ?? false,
      'grid-cell-muted': (params) => state(params)?.disabled ?? false,
    },
    cellStyle: (params) => ({ textAlign: state(params)?.alignment ?? 'start' }),
    tooltipValueGetter: (params) => state(params)?.tooltip ?? null,
  };
}
