import { DOCUMENT } from '@angular/common';
import { Overlay } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { MatDialog } from '@angular/material/dialog';
import { inject, Injectable, InjectionToken, type Provider } from '@angular/core';
import { backgroundScrollStrategy } from '../../../overlay/background-scroll-strategy';
import { registerOverlayEscape } from '../../../overlay/overlay-escape';
import { PopoverService } from '../../../popover/popover-service';
import { POPOVER_REF } from '../../../popover/popover-ref';
import { DialogEditorPanel } from './dialog-editor-panel/dialog-editor-panel';
import type {
  BackdropDismissal,
  DialogOptions,
  EditorPresentationAdapter,
  EditorPresentationAdapters,
  EditorPresentationRequest,
  PopoverEditorOptions,
} from './editor-host.model';

function backdropCloses(
  setting: BackdropDismissal | undefined,
  request: { canDismiss(): boolean },
) {
  return setting === 'when-clean' ? request.canDismiss() : (setting ?? true);
}

function size(value: number | string | undefined): string | undefined {
  return typeof value === 'number' ? `${value}px` : value;
}

@Injectable({ providedIn: 'root' })
export class PopoverEditorPresentation implements EditorPresentationAdapter<PopoverEditorOptions> {
  private readonly popovers = inject(PopoverService);

  open<D>(request: EditorPresentationRequest<D, PopoverEditorOptions>): void {
    const setting = request.options?.closeOnBackdropClick;
    this.popovers.open(request.definition.component, {
      trigger: request.trigger,
      injector: request.injector,
      options: { backdrop: true, ...request.options, closeOnBackdropClick: setting !== false },
      ariaLabel: request.options?.title ?? request.label,
      canCloseOnBackdrop: () => backdropCloses(setting, request),
      initialize: (content) => {
        const ref = content.injector.get(POPOVER_REF);
        const attached = request.attach(
          (reason) => ref.close(reason === 'dismissed' ? 'programmatic' : reason),
          ref.afterClosed,
        );
        if (attached) request.bind(content);
      },
    });
  }
}

@Injectable({ providedIn: 'root' })
export class DialogEditorPresentation implements EditorPresentationAdapter<DialogOptions> {
  private readonly dialogs = inject(MatDialog);
  private readonly overlay = inject(Overlay);
  private readonly document = inject(DOCUMENT);

  open<D>(request: EditorPresentationRequest<D, DialogOptions>): void {
    const options = request.options ?? {};
    const ref = this.dialogs.open<DialogEditorPanel, string | undefined>(DialogEditorPanel, {
      injector: request.injector,
      data: options.title,
      width: size(options.width),
      height: size(options.height),
      maxWidth: `min(${size(options.maxWidth) ?? 'calc(100vw - 24px)'}, calc(100vw - 24px))`,
      maxHeight: `min(${size(options.maxHeight) ?? 'calc(100dvh - 24px)'}, calc(100dvh - 24px))`,
      hasBackdrop: options.backdrop ?? true,
      disableClose: true,
      restoreFocus: false,
      autoFocus: false,
      delayFocusTrap: false,
      scrollStrategy: backgroundScrollStrategy(this.overlay, this.document),
      ariaLabel: options.title ?? request.label,
      ariaModal: options.backdrop ?? true,
      enterAnimationDuration: 0,
      exitAnimationDuration: 0,
    });
    if (!request.attach(() => ref.close(), ref.afterClosed())) return;
    request.addResource(registerOverlayEscape(this.document, () => request.dismiss()));
    request.addResource(
      ref.backdropClick().subscribe(() => {
        if (backdropCloses(options.closeOnBackdropClick, request)) request.dismiss();
      }),
    );

    const panel = ref.componentRef;
    if (!panel) throw new Error('The dialog editor panel was not mounted.');
    panel.changeDetectorRef.detectChanges();
    const content = panel.instance
      .outlet()
      .attachComponentPortal(
        new ComponentPortal(request.definition.component, null, request.injector),
      );
    content.onDestroy(() => request.dismiss());
    if (request.isClosed()) return;
    request.bind(content);
    content.changeDetectorRef.detectChanges();
    if (request.isClosed()) return;
    const element: unknown = panel.location.nativeElement;
    if (element instanceof HTMLElement)
      element
        .querySelector<HTMLElement>('input, textarea, select, button, [tabindex="0"]')
        ?.focus();
  }
}

// Partial: an augmented kind has no adapter until a feature registers one.
export const EDITOR_PRESENTATIONS = new InjectionToken<Partial<EditorPresentationAdapters>>(
  'EDITOR_PRESENTATIONS',
  {
    providedIn: 'root',
    factory: () => ({
      popover: inject(PopoverEditorPresentation),
      dialog: inject(DialogEditorPresentation),
    }),
  },
);

/** Register adapters for augmented presentation kinds, or replace a built-in adapter. */
export function provideEditorPresentations(
  adapters: () => Partial<EditorPresentationAdapters>,
): Provider {
  return {
    provide: EDITOR_PRESENTATIONS,
    useFactory: () => ({
      popover: inject(PopoverEditorPresentation),
      dialog: inject(DialogEditorPresentation),
      ...adapters(),
    }),
  };
}
