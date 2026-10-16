import { InjectionToken, signal, type ComponentRef } from '@angular/core';
import { ReplaySubject } from 'rxjs';
import type { PopoverCloseReason } from './popover-open.model';
import type { PopoverGeometry } from './popover-position';

export const POPOVER_REF = new InjectionToken<PopoverRef<unknown>>('Popover reference');
export class PopoverRef<T> {
  private contentRef?: ComponentRef<T>;
  private readonly closedSource = signal(false);
  private readonly positionSource = signal<PopoverGeometry | null>(null);
  private readonly closedEvents = new ReplaySubject<PopoverCloseReason>(1);
  readonly isClosed = this.closedSource.asReadonly();
  readonly position = this.positionSource.asReadonly();
  readonly afterClosed = this.closedEvents.asObservable();
  private dispose?: (reason: PopoverCloseReason) => void;
  constructor(dispose: (reason: PopoverCloseReason) => void) {
    this.dispose = dispose;
  }
  get content(): ComponentRef<T> {
    if (!this.contentRef) throw new Error('Popover content is not attached.');
    return this.contentRef;
  }
  /** @internal Used by the service before returning the opened reference. */
  attachContent(content: ComponentRef<T>): void {
    this.contentRef = content;
  }
  /** @internal Final geometry is maintained by the service. */
  updatePosition(position: PopoverGeometry): void {
    this.positionSource.set(position);
  }

  close(reason: PopoverCloseReason = 'programmatic'): void {
    if (this.isClosed()) return;
    this.closedSource.set(true);
    const dispose = this.dispose;
    this.dispose = undefined;
    try {
      dispose?.(reason);
    } finally {
      this.contentRef = undefined;
      this.closedEvents.next(reason);
      this.closedEvents.complete();
    }
  }
}
