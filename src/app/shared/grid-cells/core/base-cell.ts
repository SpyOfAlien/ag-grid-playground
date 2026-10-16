import { inject, signal } from '@angular/core';
import type { ICellRendererAngularComp } from 'ag-grid-angular';
import type { ICellRendererParams } from 'ag-grid-community';
import { GRID_CELL_MARKERS } from '../capabilities/marker';
import { GRID_CELL_LABELS } from './labels';

export abstract class BaseCell<P extends ICellRendererParams> implements ICellRendererAngularComp {
  protected readonly labels = inject(GRID_CELL_LABELS);
  protected readonly markerDefinitions = inject(GRID_CELL_MARKERS);

  private readonly source = signal<P | null>(null);
  protected readonly params = this.source.asReadonly();

  agInit(params: P): void {
    this.validate(params);
    this.updateParams(params);
  }

  refresh(params: P): boolean {
    this.updateParams(params);
    return true;
  }

  /** Report configuration errors when the grid first renders instead of on interaction. */
  protected validate(_params: P): void {}

  private updateParams(params: P): void {
    this.source.set({ ...params });
  }
}
