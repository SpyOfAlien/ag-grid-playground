import { ChangeDetectionStrategy, Component, computed, inject, Injector } from '@angular/core';
import { Validators } from '@angular/forms';
import {
  CellBase,
  CellsTooltip,
  cellEditorData,
  controlView,
  FieldEditor,
  openCellPopover,
  submitEdit,
  type EditParams,
  type FieldEditorData,
} from '@cells';
import type { InventoryPersistence } from './inventory-persistence';
import type { Item } from './inventory.model';

type P = InventoryPersistence;

/** Each control sends its own command. */
export interface ReorderCellParams {
  toggle: EditParams<Item, null, P, boolean>;
  level: EditParams<Item, null, P, number | null>;
}

/** A composite cell: a reorder switch and a pen for the reorder level. */
@Component({
  selector: 'app-reorder-cell',
  imports: [CellsTooltip],
  host: { class: 'cells-cell' },
  template: `
    @if (view(); as view) {
      <button
        type="button"
        role="switch"
        class="cells-toggle"
        aria-label="Reorder"
        [attr.aria-checked]="view.reorder"
        [attr.aria-disabled]="view.toggle.disabled"
        [cellsTooltip]="view.toggle.tooltip"
        (click)="toggle($event)"
      ></button>
      <span class="cells-text" [class.cells-muted]="!view.reorder"
        >Reorder at {{ view.level }}</span
      >
      <button
        type="button"
        class="cells-pen"
        aria-label="Edit reorder level"
        [attr.aria-disabled]="view.pen.disabled"
        [cellsTooltip]="view.pen.tooltip"
        (click)="edit($event)"
      ></button>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReorderCell extends CellBase<Item, null, ReorderCellParams> {
  private readonly injector = inject(Injector);

  protected readonly view = computed(() => {
    const params = this.params();
    const cell = this.cell();
    if (!params || !cell) return null;
    const session = params.context.session;
    return {
      reorder: cell.row.reorder,
      level: cell.row.reorderLevel,
      toggle: controlView(params.toggle, cell, session),
      pen: controlView(params.level, cell, session),
    };
  });

  protected toggle(event: MouseEvent): void {
    event.stopPropagation();
    const params = this.params();
    const cell = this.cell();
    if (!params || !cell || this.view()?.toggle.disabled) return;
    const target = { ...params.toggle, context: params.context };
    void submitEdit(target, cell, !cell.row.reorder).catch(() => undefined);
  }

  protected edit(event: MouseEvent): void {
    event.stopPropagation();
    const params = this.params();
    const cell = this.cell();
    if (!params || !cell || this.view()?.pen.disabled) return;
    openCellPopover(
      this.injector,
      event.currentTarget as HTMLElement,
      FieldEditor<Item, number>,
      (close): FieldEditorData<Item, number> => ({
        ...cellEditorData({ ...params.level, context: params.context }, cell, close),
        value: cell.row.reorderLevel,
        label: 'Reorder level',
        mode: 'number',
        validators: [Validators.required, Validators.min(0)],
      }),
      { title: 'Reorder level', width: 280 },
    );
  }
}
