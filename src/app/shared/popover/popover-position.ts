import type { ConnectedPosition } from '@angular/cdk/overlay';
import type { PopoverAnchor, PopoverPlacement } from './popover.model';

export type PopoverSide = 'top' | 'bottom' | 'left' | 'right';

export interface PopoverGeometry {
  readonly placement: PopoverPlacement;
  readonly side: PopoverSide;
  readonly arrowOffset: number;
  readonly arrowVisible: boolean;
}

export type Rectangle = Pick<
  DOMRectReadOnly,
  'left' | 'top' | 'right' | 'bottom' | 'width' | 'height'
>;

export function viewportShift(panel: Rectangle, width: number, height: number, margin = 12) {
  return {
    x: Math.max(margin - panel.left, Math.min(0, width - margin - panel.right)),
    y: Math.max(margin - panel.top, Math.min(0, height - margin - panel.bottom)),
  };
}

const GAP = 12;
const POSITIONS: Record<PopoverPlacement, ConnectedPosition> = {
  top: { originX: 'center', originY: 'top', overlayX: 'center', overlayY: 'bottom', offsetY: -GAP },
  topLeft: {
    originX: 'start',
    originY: 'top',
    overlayX: 'start',
    overlayY: 'bottom',
    offsetY: -GAP,
  },
  topRight: { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -GAP },
  bottom: {
    originX: 'center',
    originY: 'bottom',
    overlayX: 'center',
    overlayY: 'top',
    offsetY: GAP,
  },
  bottomLeft: {
    originX: 'start',
    originY: 'bottom',
    overlayX: 'start',
    overlayY: 'top',
    offsetY: GAP,
  },
  bottomRight: {
    originX: 'end',
    originY: 'bottom',
    overlayX: 'end',
    overlayY: 'top',
    offsetY: GAP,
  },
  left: { originX: 'start', originY: 'center', overlayX: 'end', overlayY: 'center', offsetX: -GAP },
  leftTop: { originX: 'start', originY: 'top', overlayX: 'end', overlayY: 'top', offsetX: -GAP },
  leftBottom: {
    originX: 'start',
    originY: 'bottom',
    overlayX: 'end',
    overlayY: 'bottom',
    offsetX: -GAP,
  },
  right: { originX: 'end', originY: 'center', overlayX: 'start', overlayY: 'center', offsetX: GAP },
  rightTop: { originX: 'end', originY: 'top', overlayX: 'start', overlayY: 'top', offsetX: GAP },
  rightBottom: {
    originX: 'end',
    originY: 'bottom',
    overlayX: 'start',
    overlayY: 'bottom',
    offsetX: GAP,
  },
};
const OPPOSITE: Record<PopoverPlacement, PopoverPlacement> = {
  top: 'bottom',
  topLeft: 'bottomLeft',
  topRight: 'bottomRight',
  bottom: 'top',
  bottomLeft: 'topLeft',
  bottomRight: 'topRight',
  left: 'right',
  leftTop: 'rightTop',
  leftBottom: 'rightBottom',
  right: 'left',
  rightTop: 'leftTop',
  rightBottom: 'leftBottom',
};

export function popoverPositions(preferred: PopoverPlacement): ConnectedPosition[] {
  const order = Array.from(
    new Set<PopoverPlacement>([
      preferred,
      OPPOSITE[preferred],
      'top',
      'bottom',
      'right',
      'left',
      ...(Object.keys(POSITIONS) as PopoverPlacement[]),
    ]),
  );
  return order.map((placement) => ({
    ...POSITIONS[placement],
    panelClass: `kit-popover-${placement}`,
  }));
}

export function placementOf(position: ConnectedPosition): PopoverPlacement {
  const name = typeof position.panelClass === 'string' ? position.panelClass : '';
  return name.slice('kit-popover-'.length) as PopoverPlacement;
}

export function resolvePopoverAnchor(
  trigger: HTMLElement,
  clickPoint?: { readonly x: number; readonly y: number },
  configured?: PopoverAnchor,
): PopoverAnchor {
  return (
    configured ??
    (clickPoint ? { kind: 'point', ...clickPoint } : { kind: 'element', element: trigger })
  );
}

export function anchorRectangle(anchor: PopoverAnchor): Rectangle {
  return anchor.kind === 'element'
    ? anchor.element.getBoundingClientRect()
    : { left: anchor.x, right: anchor.x, top: anchor.y, bottom: anchor.y, width: 0, height: 0 };
}

export function arrowGeometry(
  anchor: Rectangle,
  panel: Rectangle,
  placement: PopoverPlacement,
): PopoverGeometry {
  const x = anchor.left + anchor.width / 2;
  const y = anchor.top + anchor.height / 2;
  let side: PopoverSide = placement.startsWith('top')
    ? 'top'
    : placement.startsWith('bottom')
      ? 'bottom'
      : placement.startsWith('left')
        ? 'left'
        : 'right';
  if (panel.bottom <= anchor.top) side = 'top';
  else if (panel.top >= anchor.bottom) side = 'bottom';
  else if (panel.right <= anchor.left) side = 'left';
  else if (panel.left >= anchor.right) side = 'right';
  const vertical = side === 'top' || side === 'bottom';
  const length = vertical ? panel.width : panel.height;
  const offset = vertical ? x - panel.left : y - panel.top;
  const inset = Math.min(16, length / 2);
  return {
    placement,
    side,
    arrowOffset: Math.max(inset, Math.min(length - inset, offset)),
    arrowVisible:
      length > 0 && !(x >= panel.left && x <= panel.right && y >= panel.top && y <= panel.bottom),
  };
}
