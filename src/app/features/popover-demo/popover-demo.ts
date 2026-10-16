import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  Injector,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { PopoverService } from '../../shared/popover/popover-service';
import type { PopoverPlacement } from '../../shared/popover/popover.model';
import { DemoPopoverContent } from './demo-popover-content';

@Component({
  selector: 'app-popover-demo',
  imports: [RouterLink],
  template: `
    <main>
      <a routerLink="/grid-demo">Back to the grid</a>
      <h1>Standalone popover</h1>
      <p>Try the twelve placements, click anchors, and viewport-edge fallback.</p>
      <section class="controls" aria-label="Popover settings">
        <label
          ><input
            #scrollableInput
            type="checkbox"
            [checked]="scrollable()"
            (change)="scrollable.set(scrollableInput.checked)"
          />
          Allow background scrolling</label
        >
        <label
          ><input
            #backdropInput
            type="checkbox"
            [checked]="backdrop()"
            (change)="backdrop.set(backdropInput.checked)"
          />
          Backdrop</label
        >
        <label
          ><input
            #dismissInput
            type="checkbox"
            [checked]="dismissBackdrop()"
            (change)="dismissBackdrop.set(dismissInput.checked)"
          />
          Close on backdrop click</label
        >
        <label
          ><input
            #arrowInput
            type="checkbox"
            [checked]="arrow()"
            (change)="arrow.set(arrowInput.checked)"
          />
          Arrow</label
        >
        <label
          >Width
          <input
            #widthInput
            type="number"
            min="80"
            [value]="width()"
            (change)="width.set(widthInput.valueAsNumber)"
        /></label>
        <label
          >Height
          <input
            #heightInput
            type="number"
            min="0"
            [value]="height()"
            (change)="height.set(heightInput.valueAsNumber)"
        /></label>
      </section>
      <section class="placements" aria-label="Placement examples">
        @for (placement of placements; track placement) {
          <button type="button" (click)="open($event, placement, true)">{{ placement }}</button>
        }
      </section>
      <div class="anchor-examples">
        <button type="button" (click)="open($event, 'bottom', false)">Click point anchor</button>
        <button #keyboardTrigger type="button" (click)="openProgrammatic(keyboardTrigger)">
          Programmatic trigger anchor
        </button>
      </div>
      <button class="edge top-left" type="button" (click)="open($event, 'top', true)">
        Top left edge
      </button>
      <button class="edge bottom-right" type="button" (click)="open($event, 'bottom', true)">
        Bottom right edge
      </button>
    </main>
  `,
  styleUrl: './popover-demo.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PopoverDemo {
  private readonly popovers = inject(PopoverService);
  private readonly owner = inject(DestroyRef);
  private readonly injector = inject(Injector);

  readonly backdrop = signal(false);
  readonly scrollable = signal(false);
  readonly dismissBackdrop = signal(true);
  readonly arrow = signal(true);
  readonly width = signal(280);
  readonly height = signal(0);

  readonly placements: readonly PopoverPlacement[] = [
    'top',
    'topLeft',
    'topRight',
    'bottom',
    'bottomLeft',
    'bottomRight',
    'left',
    'leftTop',
    'leftBottom',
    'right',
    'rightTop',
    'rightBottom',
  ];

  open(event: MouseEvent, placement: PopoverPlacement, explicit: boolean): void {
    const trigger = event.currentTarget as HTMLElement;
    this.popovers.open(DemoPopoverContent, {
      trigger,
      owner: this.owner,
      injector: this.injector,
      clickPoint: event.detail ? { x: event.clientX, y: event.clientY } : undefined,
      options: {
        ...this.options(placement),
        anchor: explicit ? { kind: 'element', element: trigger } : undefined,
      },
    });
  }

  openProgrammatic(trigger: HTMLElement): void {
    this.popovers.open(DemoPopoverContent, {
      trigger,
      owner: this.owner,
      injector: this.injector,
      options: this.options('bottom'),
    });
  }

  private options(placement: PopoverPlacement) {
    return {
      placement,
      title: 'Popover example',
      width: this.width(),
      height: this.height() > 0 ? this.height() : undefined,
      arrow: this.arrow(),
      backdrop: this.backdrop(),
      scrollable: this.scrollable(),
      closeOnBackdropClick: this.dismissBackdrop(),
    };
  }
}
