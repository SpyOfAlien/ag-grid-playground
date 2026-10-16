import type { ComponentRef, InputSignal, Injector, Signal, Type } from '@angular/core';
import type { Observable, TeardownLogic } from 'rxjs';
import type { PopoverOptions } from '../../../popover/popover.model';

/**
 * Whether a backdrop click closes an editor. `'when-clean'` keeps an editor with unsaved changes
 * open; Escape and Cancel still discard. The default, `true`, always discards.
 */
export type BackdropDismissal = boolean | 'when-clean';

/** Popover options for a hosted editor. */
export type PopoverEditorOptions = Omit<PopoverOptions, 'closeOnBackdropClick'> & {
  closeOnBackdropClick?: BackdropDismissal;
};

export interface DialogOptions {
  width?: number | string;
  height?: number | string;
  maxWidth?: number | string;
  maxHeight?: number | string;
  title?: string;
  backdrop?: boolean;
  closeOnBackdropClick?: BackdropDismissal;
}

export interface HostedEditor<D> {
  readonly data: InputSignal<D>;
  /** Unsaved changes; presentations with `closeOnBackdropClick: 'when-clean'` stay open while true. */
  readonly dirty?: Signal<boolean>;
}

export interface EditorDefinition<D> {
  readonly component: Type<HostedEditor<D>>;
  readonly data: NoInfer<D>;
}

export interface EditorOpenContext {
  readonly trigger: HTMLElement;
}

/**
 * Presentation kinds and their options. Augment this interface and register an adapter with
 * `provideEditorPresentations` to add a kind such as a side panel.
 */
export interface EditorPresentations {
  popover: PopoverEditorOptions;
  dialog: DialogOptions;
}

export type EditorPresentationKind = keyof EditorPresentations;

export type EditorPresentation = {
  readonly [K in EditorPresentationKind]: {
    readonly kind: K;
    readonly options?: EditorPresentations[K];
  };
}[EditorPresentationKind];

export type EditorCloseReason = 'dismissed' | 'owner-destroyed' | 'error';

/** What the host gives an adapter for one opening. The host owns lifetime and focus. */
export interface EditorPresentationRequest<D, O> {
  readonly definition: EditorDefinition<D>;
  readonly options: O | undefined;
  readonly trigger: HTMLElement;
  /** Provides `EditorRef`; mount the editor content with it. */
  readonly injector: Injector;
  readonly label: string;
  /**
   * Call once the native presentation exists. Returns false when the editor already closed,
   * for example from its constructor; the adapter must then stop mounting.
   */
  attach(close: (reason: EditorCloseReason) => void, afterClosed: Observable<unknown>): boolean;
  /** Bind editor data before the content's first change detection. */
  bind(content: ComponentRef<HostedEditor<D>>): void;
  /** Close the editor as a user dismissal. */
  dismiss(): void;
  /** False while the mounted editor reports unsaved changes. */
  canDismiss(): boolean;
  isClosed(): boolean;
  /** Teardown runs when the editor closes, or immediately if it already has. */
  addResource(teardown: TeardownLogic): void;
}

export interface EditorPresentationAdapter<O> {
  open<D>(request: EditorPresentationRequest<D, O>): void;
}

export type EditorPresentationAdapters = {
  readonly [K in EditorPresentationKind]: EditorPresentationAdapter<EditorPresentations[K]>;
};
