import type { EditorRef } from '../../editing/editor-host/public-api';
import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { BaseCell } from '../../core/base-cell';
import type { RendererParams } from '../../core/renderer-params.model';
import type { DropdownCellParams } from './dropdown-cell-params.model';
import { CellContent } from '../../capabilities/content/cell-content';
import { CellMarker } from '../../capabilities/marker/cell-marker';
import { computeContent } from '../../capabilities/content/compute-content';
import { computeMarker } from '../../capabilities/marker/compute-marker';
import { computeDropdown } from '../../capabilities/dropdown/compute-dropdown';
import { toCellContext } from '../../core/cell-context';
import { DropdownOptionsEditor } from './dropdown-options-editor';

@Component({
  selector: 'app-dropdown-cell',
  imports: [CellContent, CellMarker],
  host: { class: 'grid-cell' },
  template: `
    @if (cellMarker(); as marker) {
      <span [cellMarker]="marker"></span>
    }
    @if (cellContent(); as content) {
      @if (cellDropdown(); as dropdown) {
        <button
          type="button"
          [cellContent]="content"
          aria-haspopup="dialog"
          [attr.aria-expanded]="opened()"
          [attr.aria-label]="label() + ': ' + dropdown.label"
          [attr.aria-disabled]="dropdown.disabled"
          [attr.title]="dropdown.tooltip"
          (click)="open($event)"
        >
          {{ dropdown.label }}
        </button>
      }
    }
  `,
  styleUrl: './dropdown-cell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DropdownCell<R, V> extends BaseCell<RendererParams<R, V, DropdownCellParams<R, V>>> {
  private readonly editorRef = signal<EditorRef | undefined>(undefined);

  readonly opened = computed(
    () => this.params()?.context.editorHost?.isOpen(this.editorRef()) ?? false,
  );

  readonly cellContent = computed(() => computeContent(this.params()));
  readonly cellMarker = computed(() => computeMarker(this.params()));
  readonly cellDropdown = computed(() => computeDropdown(this.params()));
  readonly label = computed(() => this.params()?.colDef?.headerName ?? 'Dropdown value');

  open(event: MouseEvent): void {
    event.stopPropagation();
    const params = this.params();
    const state = this.cellDropdown();

    const trigger = event.currentTarget;
    if (!params || !state || state.disabled || this.opened() || !(trigger instanceof HTMLElement))
      return;
    const hosts = params.context.editorHost;
    if (!hosts) throw new Error('Provide editorHost in grid context.');
    const cell = toCellContext(params);
    const handle = hosts.open(
      {
        component: DropdownOptionsEditor<V>,
        data: {
          initialValue: cell.value,
          options: state.options,
          equals: params.dropdown.equals,
          placeholder: params.dropdown.placeholder,
          save: (value: V) => params.dropdown.save(value, cell),
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
          ...params.dropdown.popover,
        },
      },
      { trigger },
    );
    this.editorRef.set(handle);
  }
}
