import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  DestroyRef,
  inject,
  Injectable,
  Injector,
  Type,
  ComponentRef,
} from '@angular/core';
import { PopoverService } from '../../popover/popover-service';
import { EditorSession } from '../editors/editor-session';
@Injectable({ providedIn: 'root' })
export class TablePopoverAdapter {
  private readonly document = inject(DOCUMENT);
  private readonly popovers = inject(PopoverService);
  open<T, V>(
    component: Type<T>,
    session: EditorSession<V>,
    trigger: HTMLElement,
    injector: Injector,
    owner: DestroyRef,
    initialize: (component: ComponentRef<T>) => void,
    fallback: () => void,
    canRestore: () => boolean,
  ): void {
    const ref = this.popovers.open(component, {
      trigger,
      injector,
      owner,
      ariaLabel: 'Edit table value',
      options: { placement: 'bottom', backdrop: true, scrollable: true, width: 360 },
      initialize,
    });
    const release = session.onClose(() => ref.close());
    ref.afterClosed.subscribe((reason) => {
      release();
      session.close();
      // The native close may restore a trigger before Angular renders its pending disabled state.
      // Check once after rendering, and preserve any meaningful focus or newer presentation.
      if (reason === 'owner-destroyed' || owner.destroyed || !canRestore()) return;
      let unregister = () => {};
      const restore = afterNextRender(
        () => {
          unregister();
          if (owner.destroyed || !canRestore()) return;
          const focused = this.document.activeElement;
          if (
            focused instanceof HTMLElement &&
            focused.isConnected &&
            focused !== this.document.body &&
            focused !== this.document.documentElement
          )
            return;
          fallback();
        },
        { injector },
      );
      unregister = owner.onDestroy(() => restore.destroy());
    });
  }
}
