import { ChangeDetectionStrategy, Component, input, signal, viewChild } from '@angular/core';
import { CdkPortalOutlet } from '@angular/cdk/portal';
import type { PopoverGeometry } from './popover-position';

@Component({
  selector: 'app-popover-panel',
  imports: [CdkPortalOutlet],
  host: {
    class: 'kit-popover-panel',
    role: 'dialog',
    tabindex: '-1',
    '[attr.aria-label]': 'title() ? null : label()',
    '[attr.aria-labelledby]': 'title() ? titleId() : null',
    '[attr.aria-modal]': 'backdrop() ? true : null',
    '[attr.data-side]': 'geometry()?.side',
    '[attr.data-placement]': 'geometry()?.placement',
    '[style.--popover-arrow-offset]': '(geometry()?.arrowOffset ?? 0) + "px"',
  },
  template: `
    @if (title()) {
      <h2 class="popover-title" [id]="titleId()">{{ title() }}</h2>
    }
    <div class="popover-body"><ng-template cdkPortalOutlet /></div>
    @if (arrow() && geometry()?.arrowVisible) {
      <span class="popover-arrow" aria-hidden="true"></span>
    }
  `,
  styleUrl: './popover-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PopoverPanel {
  readonly outlet = viewChild.required(CdkPortalOutlet);
  readonly title = input<string>();
  readonly titleId = input('');
  readonly label = input('Popover');
  readonly arrow = input(true);
  readonly backdrop = input(false);

  readonly geometry = signal<PopoverGeometry | null>(null);
}
