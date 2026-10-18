/** Marker and content markup shared by the read-only renderers; expects a `state` signal. */
export const DISPLAY_TEMPLATE = `
  @if (state(); as state) {
    @if (state.marker; as marker) {
      <span [cellsMarker]="marker" [position]="state.tooltipPosition"></span>
    }
    <span
      class="cells-text"
      [class.cells-highlighted]="state.highlighted"
      [class.cells-muted]="state.muted"
      [cellsTooltip]="state.tooltip"
      [cellsTooltipPosition]="state.tooltipPosition"
      [cellsTooltipOverflow]="true"
      >{{ state.text }}</span
    >
  }
`;

/** The read-only markup plus a pen that calls `open($event)`; expects `state` from `editState`. */
export const EDIT_TEMPLATE = `
  ${DISPLAY_TEMPLATE}
  @if (state(); as state) {
    <button
      type="button"
      class="cells-pen"
      [attr.aria-label]="state.label"
      [attr.aria-disabled]="state.pen.disabled"
      [cellsTooltip]="state.pen.tooltip"
      [cellsTooltipPosition]="state.tooltipPosition"
      (click)="open($event)"
    ></button>
  }
`;
