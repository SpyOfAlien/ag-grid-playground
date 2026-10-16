import { signal } from '@angular/core';
import type { ICellRendererAngularComp } from 'ag-grid-angular';
import type { ICellRendererParams } from 'ag-grid-community';

export abstract class BaseCell<P extends ICellRendererParams> implements ICellRendererAngularComp {
  private readonly source = signal<P | null>(null);
  protected readonly params = this.source.asReadonly();

  agInit(params: P): void {
    this.updateParams(params);
  }

  refresh(params: P): boolean {
    this.updateParams(params);
    return true;
  }

  private updateParams(params: P): void {
    this.source.set({ ...params });
  }
}
