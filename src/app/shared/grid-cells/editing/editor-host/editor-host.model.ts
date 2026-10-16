import type { InputSignal, Type } from '@angular/core';
import type { PopoverOptions } from '../../../popover/popover.model';
import type { DialogOptions } from './dialog-options.model';

export interface HostedEditor<D> {
  readonly data: InputSignal<D>;
}

export interface EditorDefinition<D> {
  readonly component: Type<HostedEditor<D>>;
  readonly data: NoInfer<D>;
}

export interface EditorOpenContext {
  readonly trigger: HTMLElement;
}

export type EditorPresentation =
  | { readonly kind: 'popover'; readonly options?: PopoverOptions }
  | { readonly kind: 'dialog'; readonly options?: DialogOptions };
