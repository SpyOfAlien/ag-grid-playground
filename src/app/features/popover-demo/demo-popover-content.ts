import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { POPOVER_REF } from '../../shared/popover/popover-ref';
@Component({
  selector: 'app-demo-popover-content',
  template: `
    <p>A standalone popover. This component owns its content and actions.</p>
    <label>Example value <input aria-label="Example value" value="Sample" /></label>
    @if (expanded()) {
      <p class="expanded">
        Extra content changes the panel height. The position and arrow follow its final geometry.
      </p>
    }
    <div class="actions">
      <button type="button" (click)="expanded.set(!expanded())">Resize content</button>
      <button type="button" (click)="ref.close()">Close popover</button>
    </div>
  `,
  styleUrl: './demo-popover-content.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DemoPopoverContent {
  readonly ref = inject(POPOVER_REF);

  readonly expanded = signal(false);
}
