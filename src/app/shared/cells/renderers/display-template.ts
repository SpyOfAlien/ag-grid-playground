/** Marker and content markup shared by the read-only renderers; expects a `view` signal. */
export const DISPLAY_TEMPLATE = `
  @if (view(); as view) {
    @if (view.marker; as marker) {
      <span class="cells-marker" [attr.data-kind]="marker.kind" [cellsTooltip]="marker.tooltip"
        [cellsTooltipPosition]="view.tooltipPosition"></span>
    }
    <span
      class="cells-text"
      [class.cells-highlighted]="view.highlighted"
      [class.cells-muted]="view.muted"
      [cellsTooltip]="view.tooltip"
        [cellsTooltipPosition]="view.tooltipPosition"
      >{{ view.text }}</span
    >
  }
`;

/** The read-only markup plus a pen that calls `open($event)`; expects `view` from `editView`. */
export const EDIT_TEMPLATE = `
  ${DISPLAY_TEMPLATE}
  @if (view(); as view) {
    <button
      type="button"
      class="cells-pen"
      [attr.aria-label]="view.label"
      [attr.aria-disabled]="view.pen.disabled"
      [cellsTooltip]="view.pen.tooltip"
        [cellsTooltipPosition]="view.tooltipPosition"
      (click)="open($event)"
    ></button>
  }
`;
