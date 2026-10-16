import type { ComponentRef, DestroyRef, Injector } from '@angular/core';
import type { PopoverOptions } from './popover.model';
export interface PopoverOpenRequest<T> {
  readonly trigger: HTMLElement;
  readonly clickPoint?: { readonly x: number; readonly y: number };
  readonly options?: PopoverOptions;
  readonly ariaLabel?: string;
  readonly injector?: Injector;
  readonly owner?: DestroyRef;
  readonly initialize?: (content: ComponentRef<T>) => void;
  /** Consulted on each backdrop click when `closeOnBackdropClick` allows closing. */
  readonly canCloseOnBackdrop?: () => boolean;
}

export type PopoverCloseReason =
  | 'programmatic'
  | 'escape'
  | 'backdrop'
  | 'owner-destroyed'
  | 'content-destroyed'
  | 'anchor-removed'
  | 'error';
