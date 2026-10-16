import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { BaseCell } from '../../../../shared/grid-cells/core/base-cell';
import type { RendererParams } from '../../../../shared/grid-cells/core/renderer-params.model';
import type { ToggleNumberCellParams } from './toggle-number-cell-params.model';
import { CellContent } from '../../../../shared/grid-cells/capabilities/content/cell-content';
import { CellMarker } from '../../../../shared/grid-cells/capabilities/marker/cell-marker';
import { CellEditAction } from '../../../../shared/grid-cells/capabilities/action/cell-edit-action';
import { computeNumberContent } from '../../../../shared/grid-cells/capabilities/number/compute-number-content';
import { computeToggle } from '../../../../shared/grid-cells/capabilities/toggle/compute-toggle';
import { computeMarker } from '../../../../shared/grid-cells/capabilities/marker/compute-marker';
import { computeAction } from '../../../../shared/grid-cells/capabilities/action/compute-action';
import { toCellContext } from '../../../../shared/grid-cells/core/cell-context';

@Component({
  selector: 'app-toggle-number-cell',
  imports: [CellContent, CellMarker, CellEditAction],
  host: { class: 'grid-cell' },
  template: `
    @if (cellMarker(); as marker) {
      <span [cellMarker]="marker"></span>
    }
    @if (cellContent(); as content) {
      <div class="grid-cell-content composite-content">
        @if (cellToggle(); as toggle) {
          <button
            class="toggle"
            type="button"
            role="switch"
            aria-label="Review measurement"
            [attr.aria-checked]="toggle.checked"
            [attr.aria-disabled]="toggle.disabled || saving()"
            [attr.aria-busy]="saving()"
            [attr.title]="toggle.disabled ? toggle.tooltip : error() || toggle.tooltip"
            (click)="changeToggle($event)"
          ></button>
        }
        <span [cellContent]="content">{{ content.text }}</span>
      </div>
    }
    @if (cellAction(); as action) {
      @if (action.visible) {
        <button [cellEditAction]="action" (activated)="open($event)"></button>
      }
    }
  `,
  styleUrl: './toggle-number-cell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToggleNumberCell<R, D> extends BaseCell<
  RendererParams<R, number, ToggleNumberCellParams<R, D>>
> {
  readonly saving = signal(false);
  readonly error = signal('');

  readonly cellContent = computed(() => computeNumberContent(this.params()));
  readonly cellToggle = computed(() => computeToggle(this.params()));
  readonly cellMarker = computed(() => computeMarker(this.params()));
  readonly cellAction = computed(() => {
    const action = computeAction(this.params());
    return action && this.saving()
      ? { ...action, disabled: true, tooltip: 'Saving review status.' }
      : action;
  });

  async changeToggle(event: MouseEvent): Promise<void> {
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

  open(event: MouseEvent): void {
    const params = this.params();
    const action = this.cellAction();
    const trigger = event.currentTarget;
    if (
      !params?.action ||
      !action?.visible ||
      action.disabled ||
      this.saving() ||
      !(trigger instanceof HTMLElement)
    )
      return;
    const hosts = params.context.editorHost;
    if (!hosts) throw new Error('Provide editorHost in grid context.');
    const cell = {
      ...toCellContext(params),
      trigger,
    };
    hosts.open(
      { component: params.action.editor.component, data: params.action.editor.data(cell) },
      {
        kind: 'popover',
        options:
          typeof params.action.editor.popover === 'function'
            ? params.action.editor.popover(cell)
            : params.action.editor.popover,
      },
      { trigger },
    );
  }
}
