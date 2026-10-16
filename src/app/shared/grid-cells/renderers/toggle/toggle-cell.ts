import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { BaseCell } from '../../core/base-cell';
import type { RendererParams } from '../../core/renderer-params.model';
import type { ToggleCellParams } from './toggle-cell-params.model';
import { CellContent } from '../../capabilities/content/cell-content';
import { CellMarker } from '../../capabilities/marker/cell-marker';
import { computeContent } from '../../capabilities/content/compute-content';
import { computeMarker } from '../../capabilities/marker/compute-marker';
import { computeToggle } from '../../capabilities/toggle/compute-toggle';
import { toCellContext } from '../../core/cell-context';

@Component({
  selector: 'app-toggle-cell',
  imports: [CellContent, CellMarker],
  host: { class: 'grid-cell' },
  template: `
    @if (cellMarker(); as marker) {
      <span [cellMarker]="marker"></span>
    }
    @if (cellContent(); as content) {
      @if (cellToggle(); as toggle) {
        <button
          type="button"
          role="switch"
          [cellContent]="content"
          [attr.aria-label]="label()"
          [attr.aria-checked]="toggle.checked"
          [attr.aria-disabled]="toggle.disabled || saving()"
          [attr.aria-busy]="saving()"
          [attr.title]="toggle.disabled ? toggle.tooltip : error() || toggle.tooltip"
          (click)="activate($event)"
        ></button>
      }
    }
  `,
  styleUrl: './toggle-cell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToggleCell<R> extends BaseCell<RendererParams<R, boolean, ToggleCellParams<R>>> {
  readonly saving = signal(false);
  readonly error = signal('');

  readonly cellContent = computed(() => computeContent(this.params()));
  readonly cellMarker = computed(() => computeMarker(this.params()));
  readonly cellToggle = computed(() => computeToggle(this.params()));
  readonly label = computed(() => this.params()?.colDef?.headerName ?? 'Toggle value');

  async activate(event: MouseEvent): Promise<void> {
    event.stopPropagation();
    const params = this.params();
    const state = this.cellToggle();
    if (!params || !state || state.disabled || this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    try {
      await params.toggle.save(!state.checked, toCellContext(params));
    } catch (error: unknown) {
      this.error.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.saving.set(false);
    }
  }
}
