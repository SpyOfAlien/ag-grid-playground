import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import type { TableType, ViewMode, ViewState } from './tree-table.model';
import { modeOptions, resolveView, subModeOptions } from './views';

/** Mode buttons, then the sub-mode buttons of the chosen mode. */
@Component({
  selector: 'app-view-switcher',
  imports: [MatButtonToggleModule],
  template: `
    @let current = resolved();
    @if (current) {
      <div class="row">
        <span class="label" [id]="modeLabelId()">Mode</span>
        <mat-button-toggle-group
          hideSingleSelectionIndicator
          [attr.aria-labelledby]="modeLabelId()"
          [value]="current.mode"
          (change)="setMode($event.value)"
        >
          @for (option of modes(); track option.key) {
            <mat-button-toggle [value]="option.key">{{ option.label }}</mat-button-toggle>
          }
        </mat-button-toggle-group>
      </div>
      @if (subModes().length) {
        <div class="row">
          <span class="label" [id]="subModeLabelId()">Sub-mode</span>
          <mat-button-toggle-group
            hideSingleSelectionIndicator
            [attr.aria-labelledby]="subModeLabelId()"
            [value]="current.subMode"
            (change)="view.set({ mode: current.mode, subMode: $event.value })"
          >
            @for (option of subModes(); track option.key) {
              <mat-button-toggle [value]="option.key">{{ option.label }}</mat-button-toggle>
            }
          </mat-button-toggle-group>
        </div>
      }
    }
  `,
  styles: `
    :host {
      display: grid;
      gap: 8px;
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
    }
    .label {
      min-width: 72px;
      font-weight: 600;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ViewSwitcher {
  readonly table = input.required<TableType>();
  readonly view = model<ViewState | undefined>();

  protected readonly resolved = computed(() => resolveView(this.table(), this.view()));
  protected readonly modes = computed(() => modeOptions(this.table()));
  protected readonly subModes = computed(() => {
    const view = this.resolved();
    return view ? subModeOptions(view.mode) : [];
  });
  protected readonly modeLabelId = computed(() => `${this.table()}-mode-label`);
  protected readonly subModeLabelId = computed(() => `${this.table()}-sub-mode-label`);

  /** A new mode starts on its default sub-mode ("All"). */
  protected setMode(mode: ViewMode): void {
    this.view.set(resolveView(this.table(), { mode }));
  }
}
