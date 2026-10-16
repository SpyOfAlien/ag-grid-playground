import type { ICellRendererParams } from 'ag-grid-community';
import type { GridContext } from './grid-context.model';

export type RendererParams<R, V, C> = ICellRendererParams<R, V, GridContext> & C;
