import { Overlay, type ConnectedPosition, type OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  Directive,
  inject,
  Injectable,
  input,
  signal,
  type ComponentRef,
} from '@angular/core';
import { observePopoverAnchor } from '../../popover/observe-popover-anchor';

/** Plain text, or HTML that is sanitized before it is shown. */
export type TooltipContent = string | { readonly html: string };

/** Material's tooltip positions; `before` and `after` follow the text direction. */
export type TooltipPosition = 'above' | 'below' | 'left' | 'right' | 'before' | 'after';

const TEXT = 'data-cells-tooltip';
/** Pointer rest time before a tooltip shows; focus shows at once. */
const SHOW_DELAY = 100;
/** Material's touch timings: hold to show, then hide this long after release. */
const TOUCH_HOLD = 500;
const TOUCH_HIDE_DELAY = 1500;
const HTML = 'data-cells-tooltip-html';
const POSITION = 'data-cells-tooltip-position';
/** Marks an element whose own text is shown when it is cut off and it has no other tooltip. */
const OVERFLOW = 'data-cells-tooltip-overflow';
const ANY_TOOLTIP = `[${TEXT}], [${HTML}], [${OVERFLOW}]`;
/** The one tooltip element's id; the visible tooltip's element points at it. */
const TOOLTIP_ID = 'cells-tooltip';

/**
 * The single tooltip element; it exists in the DOM only while a tooltip is shown. Like Material's
 * tooltip it is visual only (`aria-hidden`): it lives outside the page's landmarks.
 */
@Component({
  selector: 'cells-tooltip-panel',
  template: `
    @if (content(); as content) {
      <div
        class="cells-tooltip"
        id="cells-tooltip"
        aria-hidden="true"
        [attr.data-position]="content.position"
      >
        @if (content.html !== null) {
          <div [innerHTML]="content.html"></div>
        } @else {
          {{ content.text }}
        }
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CellsTooltipPanel {
  readonly content = signal<{
    text: string;
    html: string | null;
    position: TooltipPosition;
  } | null>(null);
}

/** One tooltip for the whole page, driven by delegated document events. */
@Injectable({ providedIn: 'root' })
export class CellsTooltipService {
  private readonly overlay = inject(Overlay);
  private readonly document = inject(DOCUMENT);
  private readonly lifetime = inject(DestroyRef);
  private started = false;
  private overlayRef?: OverlayRef;
  private panel?: ComponentRef<CellsTooltipPanel>;
  private timer?: ReturnType<typeof setTimeout>;
  /** The element whose tooltip is visible. */
  private shown: HTMLElement | null = null;
  private stopWatching?: () => void;
  /** Like Material, focus shows a tooltip only when the last input was the keyboard. */
  private keyboard = false;

  /** Starts listening once; called by every `cellsTooltip` directive. */
  start(): void {
    if (this.started) return;
    this.started = true;
    const listeners: [string, (event: Event) => void][] = [
      ['focusin', (event) => this.keyboard && this.show(target(event))],
      ['pointerover', (event) => !isTouch(event) && this.hover(target(event))],
      ['pointerout', (event) => !isTouch(event) && this.leave(event as MouseEvent)],
      ['focusout', (event) => event.target === this.shown && this.hide()],
      ['keydown', (event) => this.key(event as KeyboardEvent)],
      // Like Material: follow the element while it scrolls, hide once it scrolls out of view.
      ['scroll', (event) => this.scrolled(event)],
      ['pointerdown', (event) => this.press(event)],
      ['pointerup', (event) => isTouch(event) && this.release()],
      ['pointercancel', () => this.hide()],
    ];
    for (const [type, listener] of listeners) this.document.addEventListener(type, listener, true);
    this.lifetime.onDestroy(() => {
      for (const [type, listener] of listeners)
        this.document.removeEventListener(type, listener, true);
      clearTimeout(this.timer);
      this.stopWatching?.();
      this.overlayRef?.dispose();
    });
  }

  private scrolled(event: Event): void {
    const element = this.shown;
    const container = event.target instanceof Element ? event.target : null;
    if (!element || (container && !container.contains(element))) return;
    const area = container?.getBoundingClientRect() ?? {
      top: 0,
      left: 0,
      bottom: this.document.documentElement.clientHeight,
      right: this.document.documentElement.clientWidth,
    };
    const box = element.getBoundingClientRect();
    const visible =
      box.bottom > area.top &&
      box.top < area.bottom &&
      box.right > area.left &&
      box.left < area.right;
    // A pending hover is not cancelled: the pointer may still rest on an element.
    if (visible) this.overlayRef?.updatePosition();
    else this.hide(false);
  }

  private key(event: KeyboardEvent): void {
    this.keyboard = true;
    if (event.key === 'Escape') this.hide();
  }

  private press(event: Event): void {
    this.keyboard = false;
    this.hide();
    const element = target(event);
    if (isTouch(event) && element) this.timer = setTimeout(() => this.show(element), TOUCH_HOLD);
  }

  /** A tap ends before the hold; a shown tooltip stays briefly so it can be read. */
  private release(): void {
    clearTimeout(this.timer);
    if (this.shown) this.timer = setTimeout(() => this.hide(), TOUCH_HIDE_DELAY);
  }

  private hover(element: HTMLElement | null): void {
    clearTimeout(this.timer);
    if (!element || element === this.shown) return;
    // Moving along controls while a tooltip is visible needs no second delay.
    if (this.shown) this.show(element);
    else this.timer = setTimeout(() => this.show(element), SHOW_DELAY);
  }

  private leave(event: MouseEvent): void {
    clearTimeout(this.timer);
    const next = event.relatedTarget instanceof Node ? event.relatedTarget : null;
    // The pointer may rest on the tooltip itself, or move to another element with a tooltip.
    if (next && (this.overlayRef?.overlayElement.contains(next) || this.shown?.contains(next)))
      return;
    if (next instanceof Element && next.closest(ANY_TOOLTIP)) return;
    this.hide();
  }

  /** `cancelPending` is false for scrolling, which must not cancel a hover still waiting. */
  private hide(cancelPending = true): void {
    if (cancelPending) clearTimeout(this.timer);
    if (!this.shown) return;
    describe(this.shown, false);
    this.shown = null;
    this.stopWatching?.();
    this.panel?.instance.content.set(null);
    this.panel?.changeDetectorRef.detectChanges();
  }

  private show(element: HTMLElement | null): void {
    // Teardown can move focus (a closing popover restores it) after this injector is gone.
    if (!element || this.lifetime.destroyed) return;
    const html = element.getAttribute(HTML);
    const text = element.getAttribute(TEXT) ?? (html === null ? cutOffText(element) : null);
    if (html === null && !text) return this.hide();
    const moved = this.shown !== element;
    if (moved) {
      this.stopWatching?.();
      if (this.shown) describe(this.shown, false);
      this.shown = element;
      this.stopWatching = this.watch(element);
      describe(element, true);
    }
    const position = (element.getAttribute(POSITION) as TooltipPosition | null) ?? 'below';
    const panel = this.attach(element, position);
    if (moved) this.raise();
    panel.instance.content.set({ text: text ?? '', html, position });
    panel.changeDetectorRef.detectChanges();
    this.overlayRef?.updatePosition();
  }

  /** Hides when the element is removed and follows its content while visible. */
  private watch(element: HTMLElement): () => void {
    const stopRemoval = observePopoverAnchor([element], () => this.hide());
    const content = new MutationObserver(() => this.show(element));
    // Text changes matter too: a cut-off text tooltip shows the element's own text.
    content.observe(element, {
      attributeFilter: [TEXT, HTML, OVERFLOW],
      childList: true,
      subtree: true,
      characterData: true,
    });
    return () => {
      stopRemoval();
      content.disconnect();
    };
  }

  private attach(element: HTMLElement, side: TooltipPosition): ComponentRef<CellsTooltipPanel> {
    const position = this.overlay
      .position()
      .flexibleConnectedTo(element)
      .withPositions(connectedPositions(side, getComputedStyle(element).direction === 'rtl'))
      .withPush(true)
      .withViewportMargin(8);
    if (!this.overlayRef) {
      this.overlayRef = this.overlay.create({
        positionStrategy: position,
        panelClass: 'cells-tooltip-pane',
      });
      this.panel = this.overlayRef.attach(new ComponentPortal(CellsTooltipPanel));
    } else this.overlayRef.updatePositionStrategy(position);
    return this.panel!;
  }

  /**
   * The tooltip's overlay is created once, so one opened since (a dropdown panel) would cover it.
   * Native popovers stack in the order they were shown; without them, overlays stack in DOM order.
   * Called whenever the tooltip moves to an element, since a panel may open while it is visible.
   */
  private raise(): void {
    const host = this.overlayRef?.hostElement;
    if (!host) return;
    if (host.hasAttribute('popover')) {
      // Like CDK's own calls: some browsers throw for a popover in an unexpected state.
      try {
        host.hidePopover();
        host.showPopover();
      } catch {
        // Stacking stays as it was; the tooltip still shows.
      }
    } else if (host.nextElementSibling) host.parentElement?.appendChild(host);
  }
}

const GAP = 8;
const SIDES: Record<'above' | 'below' | 'left' | 'right', ConnectedPosition> = {
  below: {
    originX: 'center',
    originY: 'bottom',
    overlayX: 'center',
    overlayY: 'top',
    offsetY: GAP,
  },
  above: {
    originX: 'center',
    originY: 'top',
    overlayX: 'center',
    overlayY: 'bottom',
    offsetY: -GAP,
  },
  // The overlay is laid out left to right, so start and end are physical left and right here.
  left: { originX: 'start', originY: 'center', overlayX: 'end', overlayY: 'center', offsetX: -GAP },
  right: { originX: 'end', originY: 'center', overlayX: 'start', overlayY: 'center', offsetX: GAP },
};
const OPPOSITE = { below: 'above', above: 'below', left: 'right', right: 'left' } as const;

/** The requested side first, then its opposite for when it does not fit. */
function connectedPositions(position: TooltipPosition, rtl: boolean): ConnectedPosition[] {
  const side =
    position === 'before'
      ? rtl
        ? 'right'
        : 'left'
      : position === 'after'
        ? rtl
          ? 'left'
          : 'right'
        : position;
  return [SIDES[side], SIDES[OPPOSITE[side]]];
}

/**
 * Adds or removes the tooltip from the element's description, keeping its own descriptions.
 * Only the element whose tooltip is visible carries it, so cells add nothing permanent.
 */
function describe(element: HTMLElement, described: boolean): void {
  const ids = (element.getAttribute('aria-describedby') ?? '')
    .split(/\s+/)
    .filter((id) => id && id !== TOOLTIP_ID);
  if (described) ids.push(TOOLTIP_ID);
  if (ids.length) element.setAttribute('aria-describedby', ids.join(' '));
  else element.removeAttribute('aria-describedby');
}

function isTouch(event: Event): boolean {
  return (event as PointerEvent).pointerType === 'touch';
}

function target(event: Event): HTMLElement | null {
  return event.target instanceof Element ? event.target.closest<HTMLElement>(ANY_TOOLTIP) : null;
}

/** The element's own text when it or a descendant is cut off, for elements marked overflow. */
function cutOffText(element: HTMLElement): string | null {
  if (!element.hasAttribute(OVERFLOW)) return null;
  const clipped = [element, ...element.querySelectorAll('*')].some(
    (node) => node.scrollWidth > node.clientWidth,
  );
  return clipped ? element.textContent?.trim() || null : null;
}

/** What an element carries for the shared tooltip to read. */
export interface TooltipAttributes {
  readonly text: string | null;
  readonly html: string | null;
  readonly position: TooltipPosition | null;
  /** Present (`''`) when the element's own text shows if cut off; only without other content. */
  readonly overflow: '' | null;
}

/** The tooltip attributes for content and a position; for elements that bind them themselves. */
export function tooltipAttributes(
  content: TooltipContent | null | undefined,
  position: TooltipPosition | null | undefined,
  overflow = false,
): TooltipAttributes {
  const text = typeof content === 'string' && content ? content : null;
  const html = content && typeof content === 'object' ? content.html : null;
  return {
    text,
    html,
    position: position ?? null,
    overflow: overflow && text === null && html === null ? '' : null,
  };
}

/**
 * Gives an element a tooltip. It only writes the content onto the element; one shared service
 * shows it, so a grid of thousands of cells adds no listeners or overlays per cell.
 */
@Directive({
  selector: '[cellsTooltip]',
  host: {
    '[attr.data-cells-tooltip]': 'attributes().text',
    '[attr.data-cells-tooltip-html]': 'attributes().html',
    '[attr.data-cells-tooltip-position]': 'attributes().position',
    '[attr.data-cells-tooltip-overflow]': 'attributes().overflow',
  },
})
export class CellsTooltip {
  readonly content = input<TooltipContent | null | undefined>(null, { alias: 'cellsTooltip' });
  /** Defaults to `below`. */
  readonly position = input<TooltipPosition | null | undefined>(null, {
    alias: 'cellsTooltipPosition',
  });

  /** With no content, show the element's own text when it is cut off. */
  readonly overflow = input(false, { alias: 'cellsTooltipOverflow' });

  protected readonly attributes = computed(() =>
    tooltipAttributes(this.content(), this.position(), this.overflow()),
  );

  constructor() {
    inject(CellsTooltipService).start();
  }
}
