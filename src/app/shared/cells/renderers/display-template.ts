/** Marker and content markup shared by the read-only renderers; expects a `view` signal. */
export const DISPLAY_TEMPLATE = `
  @if (view(); as view) {
    @if (view.marker; as marker) {
      <span class="cells-marker" [attr.data-kind]="marker.kind" [title]="marker.tooltip"></span>
    }
    <span
      class="cells-text"
      [class.cells-highlighted]="view.highlighted"
      [class.cells-muted]="view.muted"
      [attr.title]="view.tooltip"
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
      [attr.title]="view.pen.tooltip"
      (click)="open($event)"
    ></button>
  }
`;
