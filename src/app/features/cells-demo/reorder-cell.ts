import { ChangeDetectionStrategy, Component, computed, inject, Injector } from '@angular/core';
import { Validators } from '@angular/forms';
import {
  CellBase,
  CellsTooltip,
  cellEditorData,
  cellControl,
  FieldEditor,
  openCellPopover,
  runCommand,
  type ActionParams,
  type FieldEditorData,
} from '@cells';
import type { InventoryPersistence } from './inventory-persistence';
import type { Item } from './inventory.model';

type P = InventoryPersistence;

/** One action block per control; each sends its own command. */
export interface ReorderCellParams {
  toggle: ActionParams<Item, null, P, boolean>;
  level: ActionParams<Item, null, P, number | null>;
}

/** A composite cell: a reorder switch and a pen for the reorder level. */
@Component({
  selector: 'app-reorder-cell',
  imports: [CellsTooltip],
  host: { class: 'cells-cell' },
  template: `
    @if (state(); as state) {
      <button
        type="button"
        role="switch"
        class="cells-toggle"
        [attr.aria-label]="state.toggle.name"
        [attr.aria-checked]="state.reorder"
        [attr.aria-disabled]="state.toggle.disabled"
        [cellsTooltip]="state.toggle.tooltip"
        (click)="toggle($event)"
      ></button>
      <span class="cells-text" [class.cells-muted]="!state.reorder"
        >Reorder at {{ state.level }}</span
      >
      <button
        type="button"
        class="cells-pen"
        [attr.aria-label]="'Edit ' + state.pen.name"
        [attr.aria-disabled]="state.pen.disabled"
        [cellsTooltip]="state.pen.tooltip"
        (click)="edit($event)"
      ></button>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReorderCell extends CellBase<Item, null, ReorderCellParams> {
  private readonly injector = inject(Injector);

  protected readonly state = computed(() => {
    const params = this.params();
    const cell = this.cell();
    if (!params || !cell) return null;
    const session = params.context.session;
    return {
      reorder: cell.row.reorder,
      level: cell.row.reorderLevel,
      toggle: cellControl(params.toggle, cell, session, 'Reorder'),
      pen: cellControl(params.level, cell, session, 'reorder level'),
    };
  });

  protected toggle(event: MouseEvent): void {
    event.stopPropagation();
    const params = this.params();
    const cell = this.cell();
    if (!params || !cell || this.state()?.toggle.disabled) return;
    void runCommand(params, params.toggle.command, cell, !cell.row.reorder).catch(() => undefined);
  }

  protected edit(event: MouseEvent): void {
    event.stopPropagation();
    const params = this.params();
    const cell = this.cell();
    if (!params || !cell || this.state()?.pen.disabled) return;
    openCellPopover(
      this.injector,
      event.currentTarget as HTMLElement,
      FieldEditor<Item, number>,
      {
        ...cellEditorData(params, params.level.command, cell),
        value: cell.row.reorderLevel,
        label: 'Reorder level',
        mode: 'number',
        validators: [Validators.required, Validators.min(0)],
      } satisfies Omit<FieldEditorData<Item, number>, 'close'>,
      { title: 'Reorder level', width: 280 },
    );
  }
}
