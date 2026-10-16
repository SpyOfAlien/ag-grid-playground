import { DOCUMENT } from '@angular/common';
import { DestroyRef, inject, Injectable, Injector, type Type } from '@angular/core';
import { Overlay } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { FocusTrapFactory } from '@angular/cdk/a11y';
import { Subscription } from 'rxjs';
import { PopoverPanel } from './popover-panel';
import { POPOVER_REF, PopoverRef } from './popover-ref';
import type { PopoverOpenRequest } from './popover-open.model';
import { backgroundScrollStrategy } from '../overlay/background-scroll-strategy';
import { registerOverlayEscape } from '../overlay/overlay-escape';
import { observePopoverAnchor } from './observe-popover-anchor';
import {
  anchorRectangle,
  arrowGeometry,
  placementOf,
  popoverPositions,
  resolvePopoverAnchor,
  viewportShift,
} from './popover-position';

function viewportLimit(value: number | string | undefined, axis: 'width' | 'height'): string {
  const viewport = axis === 'width' ? 'calc(100vw - 24px)' : 'calc(100dvh - 24px)';
  return value === undefined
    ? viewport
    : `min(${typeof value === 'number' ? `${value}px` : value}, ${viewport})`;
}

@Injectable({ providedIn: 'root' })
export class PopoverService {
  private readonly overlay = inject(Overlay);
  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);
  private readonly focusTraps = inject(FocusTrapFactory);
  private readonly destroyRef = inject(DestroyRef);
  private readonly active = new Set<PopoverRef<unknown>>();
  private nextId = 0;
  constructor() {
    this.destroyRef.onDestroy(() => {
      for (const ref of Array.from(this.active)) ref.close('owner-destroyed');
    });
  }
  open<T>(component: Type<T>, request: PopoverOpenRequest<T>): PopoverRef<T> {
    const options = { ...request.options };
    const anchor = resolvePopoverAnchor(request.trigger, request.clickPoint, options.anchor);

    if (!request.trigger.isConnected || (anchor.kind === 'element' && !anchor.element.isConnected))
      throw new Error('Popover anchor is not connected.');

    const strategy = this.overlay
      .position()
      .flexibleConnectedTo(
        anchor.kind === 'element' ? anchor.element : { x: anchor.x, y: anchor.y },
      )
      .withPositions(popoverPositions(options.placement ?? 'top'))
      .withFlexibleDimensions(false)
      .withPush(true)
      .withViewportMargin(12);

    const overlay = this.overlay.create({
      positionStrategy: strategy,
      scrollStrategy: options.scrollable
        ? this.overlay.scrollStrategies.reposition()
        : backgroundScrollStrategy(this.overlay, this.document),
      panelClass: 'kit-popover-pane',
      hasBackdrop: options.backdrop ?? false,
      backdropClass: 'kit-popover-backdrop',
      width: options.width,
      height: options.height,
      maxWidth: viewportLimit(options.maxWidth, 'width'),
      maxHeight: viewportLimit(options.maxHeight, 'height'),
    });

    const resources = new Subscription();
    const previousFocus = this.document.activeElement;
    const ref = new PopoverRef<T>((reason) => {
      resources.unsubscribe();
      this.active.delete(ref);
      overlay.dispose();
      if (reason !== 'owner-destroyed' && reason !== 'error') {
        const target = request.trigger.isConnected ? request.trigger : previousFocus;
        if (target instanceof HTMLElement && target.isConnected)
          target.focus({ preventScroll: true });
      }
    });
    this.active.add(ref);
    resources.add(registerOverlayEscape(this.document, () => ref.close('escape')));
    try {
      const panel = overlay.attach(new ComponentPortal(PopoverPanel));
      panel.setInput('title', options.title);
      panel.setInput('titleId', `kit-popover-title-${++this.nextId}`);
      panel.setInput('label', request.ariaLabel ?? 'Popover');
      panel.setInput('arrow', options.arrow ?? true);
      panel.setInput('backdrop', options.backdrop ?? false);
      panel.changeDetectorRef.detectChanges();
      const contentInjector = Injector.create({
        parent: request.injector ?? this.injector,
        providers: [{ provide: POPOVER_REF, useValue: ref }],
      });
      const content = panel.instance
        .outlet()
        .attachComponentPortal(new ComponentPortal(component, null, contentInjector));
      ref.attachContent(content);
      resources.add(() => contentInjector.destroy());
      request.initialize?.(content);
      if (ref.isClosed()) return ref;
      content.changeDetectorRef.detectChanges();
      if (ref.isClosed()) return ref;
      const trap = this.focusTraps.create(panel.location.nativeElement);
      resources.add(() => trap.destroy());
      if (!trap.focusInitialElement())
        (panel.location.nativeElement as HTMLElement).focus({ preventScroll: true });
      resources.add(
        observePopoverAnchor(
          anchor.kind === 'element' ? [request.trigger, anchor.element] : [request.trigger],
          () => ref.close('anchor-removed'),
        ),
      );
      resources.add(
        overlay.backdropClick().subscribe(() => {
          if (options.closeOnBackdropClick ?? true) ref.close('backdrop');
        }),
      );
      resources.add(overlay.detachments().subscribe(() => ref.close()));
      if (request.owner) resources.add(request.owner.onDestroy(() => ref.close('owner-destroyed')));
      content.onDestroy(() => ref.close('content-destroyed'));
      let placement = options.placement ?? 'top';
      const syncGeometry = () => {
        if (ref.isClosed()) return;
        const element = panel.location.nativeElement as HTMLElement;
        element.style.translate = '';
        const shift = viewportShift(
          element.getBoundingClientRect(),
          this.document.documentElement.clientWidth,
          this.document.documentElement.clientHeight,
        );
        element.style.translate = `${shift.x}px ${shift.y}px`;
        const geometry = arrowGeometry(
          anchorRectangle(anchor),
          element.getBoundingClientRect(),
          placement,
        );
        panel.instance.geometry.set(geometry);
        ref.updatePosition(geometry);
      };
      resources.add(
        strategy.positionChanges.subscribe((change) => {
          placement = placementOf(change.connectionPair);
          syncGeometry();
        }),
      );
      const view = this.document.defaultView;
      let frame: number | undefined;
      const schedulePosition = () => {
        if (!view || frame !== undefined) return;
        frame = view.requestAnimationFrame(() => {
          frame = undefined;
          if (!ref.isClosed()) {
            overlay.updatePosition();
            syncGeometry();
          }
        });
      };
      if (typeof ResizeObserver !== 'undefined') {
        const observer = new ResizeObserver(schedulePosition);
        observer.observe(panel.location.nativeElement);
        if (anchor.kind === 'element') observer.observe(anchor.element);
        resources.add(() => observer.disconnect());
      }
      view?.addEventListener('resize', schedulePosition);
      const onScroll = (event: Event) => {
        if (
          !(event.target instanceof Node) ||
          !(panel.location.nativeElement as HTMLElement).contains(event.target)
        )
          schedulePosition();
      };
      this.document.addEventListener('scroll', onScroll, true);
      resources.add(() => {
        view?.removeEventListener('resize', schedulePosition);
        this.document.removeEventListener('scroll', onScroll, true);
        if (frame !== undefined) view?.cancelAnimationFrame(frame);
      });
      overlay.updatePosition();
      syncGeometry();
      return ref;
    } catch (error: unknown) {
      ref.close('error');
      throw error;
    }
  }
}
