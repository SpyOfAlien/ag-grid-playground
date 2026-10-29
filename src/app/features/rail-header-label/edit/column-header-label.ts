import { ChangeDetectionStrategy, Component, computed, effect, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import type { IInnerHeaderAngularComp } from 'ag-grid-angular';
import type { IHeaderParams } from 'ag-grid-community';
import { Checkbox } from 'primeng/checkbox';
import type { SignalRow } from '../signal.model';
import type { SignalEditState, SignalGridContext } from './signal-edit-state';

/**
 * The name in a data column's header (AG Grid's inner header: its own icons stay around it).
 * In edit mode a checkbox comes first, ticking the column for Replace Value. The checkbox stops
 * its mouse events from reaching the header, which would otherwise start dragging the column.
 */
@Component({
  selector: 'app-column-header-label',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Checkbox, ReactiveFormsModule],
  host: { class: 'flex min-w-0 items-center gap-2' },
  template: `
    @if (edit()?.editMode()) {
      <p-checkbox
        [binary]="true"
        [formControl]="control"
        (onChange)="setChecked($event.checked)"
        [ariaLabel]="'Tick ' + name() + ' for Replace Value'"
        (mousedown)="$event.stopPropagation()"
        (click)="$event.stopPropagation()"
      />
    }
    <span class="ag-header-cell-text">{{ name() }}</span>
  `,
})
export class ColumnHeaderLabel implements IInnerHeaderAngularComp {
  protected readonly control = new FormControl(false, { nonNullable: true });

  private readonly params = signal<IHeaderParams<SignalRow, SignalGridContext> | null>(null);

  protected readonly name = computed(() => this.params()?.displayName ?? '');
  protected readonly edit = computed(
    (): SignalEditState | undefined => this.params()?.context.edit,
  );
  protected readonly checked = computed(() => {
    const params = this.params();
    return !!params && !!this.edit()?.checkedColumns().has(params.column.getColId());
  });

  constructor() {
    // The tick lives in the edit state (Replace Value reads it there); mirror it here.
    effect(() => this.control.setValue(this.checked(), { emitEvent: false }));
  }

  agInit(params: IHeaderParams<SignalRow, SignalGridContext>): void {
    this.params.set(params);
  }

  refresh(params: IHeaderParams<SignalRow, SignalGridContext>): boolean {
    this.params.set(params);
    return true;
  }

  protected setChecked(checked: boolean): void {
    const params = this.params();
    if (params) this.edit()?.setChecked(params.column.getColId(), checked);
  }
}
