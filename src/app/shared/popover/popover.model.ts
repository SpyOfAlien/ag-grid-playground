export type PopoverAnchor =
  { kind: 'element'; element: HTMLElement } | { kind: 'point'; x: number; y: number };

export type PopoverPlacement =
  | 'top'
  | 'topLeft'
  | 'topRight'
  | 'bottom'
  | 'bottomLeft'
  | 'bottomRight'
  | 'left'
  | 'leftTop'
  | 'leftBottom'
  | 'right'
  | 'rightTop'
  | 'rightBottom';

export interface PopoverOptions {
  anchor?: PopoverAnchor;
  placement?: PopoverPlacement;
  width?: number | string;
  height?: number | string;
  maxWidth?: number | string;
  maxHeight?: number | string;
  title?: string;
  arrow?: boolean;
  backdrop?: boolean;
  /** Allow background scrolling and reposition on scroll. Defaults to false. */
  scrollable?: boolean;
  closeOnBackdropClick?: boolean;
}
