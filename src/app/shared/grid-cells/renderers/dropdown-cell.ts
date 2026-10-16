import { ChangeDetectionStrategy, Component, computed, isDevMode, signal } from '@angular/core';
import { BaseCell } from '../core/base-cell';
import { toCellContext, type CellFacts } from '../core/cell-context';
import { requireEditorHost, type GridContext, type RendererParams } from '../core/grid-context';
import { CellContent, computeContent, type ContentPart } from '../capabilities/content';
import {
  CellDropdown,
  computeDropdown,
  type DropdownPart,
  type DropdownState,
} from '../capabilities/dropdown';
import { CellMarker, computeMarker, type MarkerPart } from '../capabilities/marker';
import type { EditablePart } from '../capabilities/permission';
import type { EditorRef } from '../editing/editor-host/editor-ref';
import { DropdownOptionsEditor } from './dropdown-options-editor';

export type DropdownCellParams<R, V> = ContentPart<R, V> &
  MarkerPart<R, V> &
  EditablePart<R, V> &
  DropdownPart<R, V>;

/** Opens the options popover for a dropdown; composite renderers reuse it. */
export function openDropdownEditor<R, V>(
  params: CellFacts<R, V> & { readonly context: GridContext } & DropdownPart<R, V>,
  state: DropdownState<V>,
  trigger: HTMLElement,
): EditorRef | undefined {
  const host = requireEditorHost(params.context);
  const cell = toCellContext(params);
  const config = params.dropdown;
  return host.open(
    {
      component: DropdownOptionsEditor<V>,
      data: {
        initialValue: cell.value,
        options: state.options,
        equals: config.equals,
        placeholder: config.placeholder,
        save: (value: V) => config.save(value, cell),
      },
    },
    {
      kind: 'popover',
      options: {
        anchor: { kind: 'element', element: trigger },
        placement: 'bottom',
        width: 280,
        maxHeight: 360,
        backdrop: true,
        closeOnBackdropClick: true,
        ...config.popover,
      },
    },
    { trigger },
  );
}

@Component({
  selector: 'app-dropdown-cell',
  imports: [CellContent, CellMarker, CellDropdown],
  host: { class: 'grid-cell' },
  template: `
    @if (cellMarker(); as marker) {
      <span [cellMarker]="marker"></span>
    }
    @if (cellContent(); as content) {
      <span [cellContent]="content">
        @if (cellDropdown(); as dropdown) {
          <button
            [cellDropdown]="dropdown"
            [cellDropdownExpanded]="opened()"
            (opened)="open($event)"
          >
            {{ dropdown.text }}
          </button>
        }
      </span>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DropdownCell<R, V> extends BaseCell<RendererParams<R, V, DropdownCellParams<R, V>>> {
  private readonly editorRef = signal<EditorRef | undefined>(undefined);

  readonly opened = computed(
    () => this.params()?.context.editorHost?.isOpen(this.editorRef()) ?? false,
  );
  readonly cellContent = computed(() => computeContent(this.params()));
  readonly cellMarker = computed(() =>
    computeMarker(this.params(), undefined, this.markerDefinitions),
  );
  readonly cellDropdown = computed(() => computeDropdown(this.params(), undefined, this.labels));

  open(trigger: HTMLElement): void {
    const params = this.params();
    const state = this.cellDropdown();
    if (!params || !state || state.disabled || this.opened()) return;
    this.editorRef.set(openDropdownEditor(params, state, trigger));
  }

  protected override validate(params: RendererParams<R, V, DropdownCellParams<R, V>>): void {
    if (isDevMode()) requireEditorHost(params.context);
  }
}
