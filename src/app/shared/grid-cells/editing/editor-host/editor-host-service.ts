import { DOCUMENT } from '@angular/common';
import { Overlay } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { MatDialog } from '@angular/material/dialog';
import {
  DestroyRef,
  ElementRef,
  Injectable,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Subscription, type Observable } from 'rxjs';
import { backgroundScrollStrategy } from '../../../overlay/background-scroll-strategy';
import { registerOverlayEscape } from '../../../overlay/overlay-escape';
import { PopoverService } from '../../../popover/popover-service';
import { POPOVER_REF } from '../../../popover/popover-ref';
import { bindEditorData } from './bind-editor-data';
import { DialogEditorPanel } from './dialog-editor-panel/dialog-editor-panel';
import { EditorRef } from './editor-ref';
import type { EditorDefinition, EditorOpenContext, EditorPresentation } from './editor-host.model';
import type { DialogOptions } from './dialog-options.model';
import type { PopoverOptions } from '../../../popover/popover.model';

type CloseReason = 'dismissed' | 'owner-destroyed' | 'error';

interface ActiveEditor {
  readonly ref: EditorRef;
  readonly trigger: HTMLElement;
  readonly previousFocus: Element | null;
  readonly resources: Subscription;
  closed: boolean;
  reason?: CloseReason;
  closePresentation?: (reason: CloseReason) => void;
}

function size(value: number | string | undefined): string | undefined {
  return typeof value === 'number' ? `${value}px` : value;
}

/** Provide at the owning feature component, never on a virtualized renderer. */
@Injectable()
export class EditorHostService {
  private readonly injector = inject(Injector);
  private readonly lifetime = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly ownerElement = inject<ElementRef<HTMLElement>>(ElementRef, { optional: true });
  private readonly popovers = inject(PopoverService);
  private readonly dialogs = inject(MatDialog);
  private readonly overlay = inject(Overlay);

  private readonly currentEditor = signal<ActiveEditor | null>(null);

  readonly active = computed(() => this.currentEditor() !== null);

  isOpen(ref: EditorRef | undefined): boolean {
    return ref !== undefined && this.currentEditor()?.ref === ref;
  }

  constructor() {
    this.lifetime.onDestroy(() => {
      const editor = this.currentEditor();
      if (editor) this.dismiss(editor, 'owner-destroyed');
    });
  }

  open<D>(
    definition: EditorDefinition<D>,
    presentation: EditorPresentation,
    context: EditorOpenContext,
  ): EditorRef | undefined {
    if (this.lifetime.destroyed || this.currentEditor() || !context.trigger.isConnected)
      return undefined;

    const editor: ActiveEditor = {
      ref: { close: () => this.dismiss(editor, 'dismissed') },
      trigger: context.trigger,
      previousFocus: this.document.activeElement,
      resources: new Subscription(),
      closed: false,
    };
    this.currentEditor.set(editor);

    try {
      const injector = Injector.create({
        parent: this.injector,
        providers: [{ provide: EditorRef, useValue: editor.ref }],
      });
      try {
        if (presentation.kind === 'popover')
          this.openPopover(editor, definition, injector, presentation.options);
        else this.openDialog(editor, definition, injector, presentation.options);
      } finally {
        // Angular may still use this injector after an editor closes in its constructor.
        // Register disposal after mounting finishes; a closed subscription runs it now.
        editor.resources.add(() => injector.destroy());
      }
      return editor.ref;
    } catch (error: unknown) {
      this.dismiss(editor, 'error');
      throw error;
    }
  }

  close(): void {
    const editor = this.currentEditor();
    if (editor) editor.ref.close();
  }

  private attachPresentation(
    editor: ActiveEditor,
    close: (reason: CloseReason) => void,
    afterClosed: Observable<unknown>,
  ): boolean {
    // An editor can close from its constructor before native mounting returns.
    if (editor.closed) {
      close(editor.reason ?? 'dismissed');
      return false;
    }
    editor.closePresentation = close;
    editor.resources.add(afterClosed.subscribe(() => this.dismiss(editor, 'dismissed')));
    return !editor.closed;
  }

  private dismiss(editor: ActiveEditor, reason: CloseReason): void {
    if (editor.closed) return;
    editor.closed = true;
    editor.reason = reason;
    if (this.currentEditor() === editor) this.currentEditor.set(null);
    try {
      editor.resources.unsubscribe();
    } finally {
      editor.closePresentation?.(reason);
      editor.closePresentation = undefined;
      if (reason === 'dismissed') this.restoreFocus(editor);
    }
  }

  private restoreFocus(editor: ActiveEditor): void {
    afterNextRender(
      () => {
        if (this.lifetime.destroyed || this.currentEditor()) return;
        const previous = editor.previousFocus;
        const fallback = this.ownerElement?.nativeElement.querySelector<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), a[href], [tabindex="0"]',
        );
        const target = editor.trigger.isConnected
          ? editor.trigger
          : previous?.isConnected
            ? previous
            : fallback;
        if (target instanceof HTMLElement && target.isConnected)
          target.focus({ preventScroll: true });
      },
      { injector: this.injector },
    );
  }

  private openPopover<D>(
    editor: ActiveEditor,
    definition: EditorDefinition<D>,
    injector: Injector,
    options?: PopoverOptions,
  ): void {
    this.popovers.open(definition.component, {
      trigger: editor.trigger,
      injector,
      options: { backdrop: true, closeOnBackdropClick: true, ...options },
      ariaLabel: options?.title ?? 'Editor',
      initialize: (content) => {
        const ref = content.injector.get(POPOVER_REF);
        const attached = this.attachPresentation(
          editor,
          (reason) => {
            ref.close(reason === 'dismissed' ? 'programmatic' : reason);
          },
          ref.afterClosed,
        );
        if (attached) bindEditorData(content, definition.data);
      },
    });
  }

  private openDialog<D>(
    editor: ActiveEditor,
    definition: EditorDefinition<D>,
    injector: Injector,
    options: DialogOptions = {},
  ): void {
    const ref = this.dialogs.open<DialogEditorPanel, string | undefined>(DialogEditorPanel, {
      injector,
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
      ariaLabel: options.title ?? 'Editor',
      ariaModal: options.backdrop ?? true,
      enterAnimationDuration: 0,
      exitAnimationDuration: 0,
    });
    if (!this.attachPresentation(editor, () => ref.close(), ref.afterClosed())) return;
    editor.resources.add(registerOverlayEscape(this.document, () => editor.ref.close()));
    editor.resources.add(
      ref.backdropClick().subscribe(() => {
        if (options.closeOnBackdropClick ?? true) editor.ref.close();
      }),
    );

    const panel = ref.componentRef;
    if (!panel) throw new Error('The dialog editor panel was not mounted.');
    panel.changeDetectorRef.detectChanges();
    const content = panel.instance
      .outlet()
      .attachComponentPortal(new ComponentPortal(definition.component, null, injector));
    content.onDestroy(() => this.dismiss(editor, 'dismissed'));
    if (editor.closed) return;
    bindEditorData(content, definition.data);
    content.changeDetectorRef.detectChanges();
    if (!editor.closed) {
      const element: unknown = panel.location.nativeElement;
      if (element instanceof HTMLElement)
        element
          .querySelector<HTMLElement>('input, textarea, select, button, [tabindex="0"]')
          ?.focus();
    }
  }
}
