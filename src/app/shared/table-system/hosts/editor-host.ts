import { ComponentRef, DestroyRef, inject, Injectable, Injector, Type } from '@angular/core';
import { EditorSession } from '../editors/editor-session';
import { TableDialogAdapter } from './dialog-adapter';
import { TablePopoverAdapter } from './popover-adapter';
@Injectable({ providedIn: 'root' })
export class TableEditorHost {
  private readonly dialog = inject(TableDialogAdapter);
  private readonly popover = inject(TablePopoverAdapter);
  openDialog<T, V>(
    component: Type<T>,
    session: EditorSession<V>,
    injector: Injector,
    owner: DestroyRef,
    initialize: (component: ComponentRef<T>) => void,
  ): void {
    this.dialog.open(component, session, injector, owner, initialize);
  }
  openPopover<T, V>(
    component: Type<T>,
    session: EditorSession<V>,
    trigger: HTMLElement,
    injector: Injector,
    owner: DestroyRef,
    initialize: (component: ComponentRef<T>) => void,
    fallback: () => void,
    canRestore: () => boolean,
  ): void {
    try {
      this.popover.open(
        component,
        session,
        trigger,
        injector,
        owner,
        initialize,
        fallback,
        canRestore,
      );
    } catch (error) {
      session.close();
      throw error;
    }
  }
}
