import {
  arrowGeometry,
  popoverPositions,
  resolvePopoverAnchor,
  viewportShift,
  type Rectangle,
} from './popover-position';
import type { PopoverPlacement } from './popover.model';
const rect = (left: number, top: number, width: number, height: number): Rectangle => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
});
const placements: PopoverPlacement[] = [
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
describe('Popover positioning', () => {
  it('keeps the viewport margin when CDK pushes a large panel to the screen edge', () => {
    expect(viewportShift(rect(0, 0, 1416, 976), 1440, 1000)).toEqual({ x: 12, y: 12 });
    expect(viewportShift(rect(100, 100, 200, 100), 1440, 1000)).toEqual({ x: 0, y: 0 });
    expect(viewportShift(rect(1300, 900, 200, 200), 1440, 1000)).toEqual({ x: -72, y: -112 });
  });
  it.each(placements)('puts %s first with all twelve distinct fallback candidates', (placement) => {
    const positions = popoverPositions(placement);
    expect(positions[0].panelClass).toBe(`kit-popover-${placement}`);
    expect(new Set(positions.map((position) => position.panelClass)).size).toBe(12);
    expect(positions[0].offsetX || positions[0].offsetY).toBeDefined();
  });
  it('resolves explicit anchor, click point, then programmatic trigger in that order', () => {
    const trigger = document.createElement('button');
    const other = document.createElement('span');
    expect(
      resolvePopoverAnchor(trigger, { x: 10, y: 20 }, { kind: 'element', element: other }),
    ).toEqual({ kind: 'element', element: other });
    expect(resolvePopoverAnchor(trigger, { x: 10, y: 20 })).toEqual({
      kind: 'point',
      x: 10,
      y: 20,
    });
    expect(resolvePopoverAnchor(trigger)).toEqual({ kind: 'element', element: trigger });
  });
  it('orients the arrow from final geometry after a fallback', () => {
    expect(arrowGeometry(rect(100, 100, 40, 20), rect(60, 132, 120, 80), 'top')).toEqual({
      placement: 'top',
      side: 'bottom',
      arrowOffset: 60,
      arrowVisible: true,
    });
    expect(arrowGeometry(rect(100, 100, 40, 20), rect(152, 60, 120, 80), 'left').side).toBe(
      'right',
    );
  });
  it('clamps an arrow after viewport shifting and hides it when the panel covers its anchor', () => {
    expect(arrowGeometry(rect(0, 0, 0, 0), rect(12, 12, 200, 100), 'bottom').arrowOffset).toBe(16);
    expect(arrowGeometry(rect(100, 100, 0, 0), rect(0, 0, 200, 200), 'bottom').arrowVisible).toBe(
      false,
    );
  });
});
