import { DOCUMENT } from '@angular/common';
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
import { GRID_CELL_LABELS } from '../../core/labels';
import { bindEditorData } from './bind-editor-data';
import { EditorRef } from './editor-ref';
import { EDITOR_PRESENTATIONS } from './presentations';
import type {
  EditorCloseReason,
  EditorDefinition,
  EditorOpenContext,
  EditorPresentation,
  EditorPresentationAdapter,
} from './editor-host.model';

interface ActiveEditor {
  readonly ref: EditorRef;
  readonly trigger: HTMLElement;
  readonly previousFocus: Element | null;
  readonly resources: Subscription;
  closed: boolean;
  reason?: EditorCloseReason;
  isDirty?: () => boolean;
  closePresentation?: (reason: EditorCloseReason) => void;
}

/** Provide at the owning feature component, never on a virtualized renderer. */
@Injectable()
export class EditorHostService {
  private readonly injector = inject(Injector);
  private readonly lifetime = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly ownerElement = inject<ElementRef<HTMLElement>>(ElementRef, { optional: true });
  private readonly presentations = inject(EDITOR_PRESENTATIONS);
  private readonly labels = inject(GRID_CELL_LABELS);

  private readonly currentEditor = signal<ActiveEditor | null>(null);

  readonly active = computed(() => this.currentEditor() !== null);

  constructor() {
    this.lifetime.onDestroy(() => {
      const editor = this.currentEditor();
      if (editor) this.dismiss(editor, 'owner-destroyed');
    });
  }

  isOpen(ref: EditorRef | undefined): boolean {
    return ref !== undefined && this.currentEditor()?.ref === ref;
  }

  open<D>(
    definition: EditorDefinition<D>,
    presentation: EditorPresentation,
    context: EditorOpenContext,
  ): EditorRef | undefined {
    if (this.lifetime.destroyed || this.currentEditor() || !context.trigger.isConnected)
      return undefined;
    // Kinds and option types correlate through EditorPresentation; the lookup cannot express it.
    const adapter = this.presentations[presentation.kind] as
      EditorPresentationAdapter<unknown> | undefined;
    if (!adapter)
      throw new Error(`No editor presentation is registered for "${presentation.kind}".`);

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
        adapter.open({
          definition,
          options: presentation.options,
          trigger: context.trigger,
          injector,
          label: this.labels.editor,
          attach: (close, afterClosed) => this.attachPresentation(editor, close, afterClosed),
          bind: (content) => {
            editor.isDirty = () => content.instance.dirty?.() ?? false;
            bindEditorData(content, definition.data);
          },
          dismiss: () => this.dismiss(editor, 'dismissed'),
          canDismiss: () => !(editor.isDirty?.() ?? false),
          isClosed: () => editor.closed,
          addResource: (teardown) => editor.resources.add(teardown),
        });
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
    close: (reason: EditorCloseReason) => void,
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

  private dismiss(editor: ActiveEditor, reason: EditorCloseReason): void {
    if (editor.closed) return;
    editor.closed = true;
    editor.reason = reason;
    editor.isDirty = undefined;
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
}
