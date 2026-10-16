import { ComponentRef, DestroyRef, inject, Injectable, Injector, Type } from '@angular/core';
import { Subscription } from 'rxjs';
import { Dialog } from '@angular/cdk/dialog';
import { EditorSession } from '../editors/editor-session';
@Injectable({ providedIn: 'root' })
export class TableDialogAdapter {
  private readonly dialogs = inject(Dialog);
  open<T, V>(
    component: Type<T>,
    session: EditorSession<V>,
    injector: Injector,
    owner: DestroyRef,
    initialize: (component: ComponentRef<T>) => void,
  ): void {
    const ref = this.dialogs.open<unknown, undefined, T>(component, {
      injector,
      ariaLabel: 'Edit table details',
      panelClass: 'tsys-dialog',
      autoFocus: 'first-tabbable',
      restoreFocus: true,
    });
    const resources = new Subscription();
    resources.add(
      ref.closed.subscribe(() => {
        resources.unsubscribe();
        session.close();
      }),
    );
    resources.add(owner.onDestroy(() => ref.close()));
    try {
      if (!ref.componentRef) throw new Error('Dialog content missing');
      initialize(ref.componentRef);
      resources.add(session.onClose(() => ref.close()));
      if (!session.closed) ref.componentRef.changeDetectorRef.detectChanges();
    } catch (error) {
      resources.unsubscribe();
      ref.close();
      session.close();
      throw error;
    }
  }
}
