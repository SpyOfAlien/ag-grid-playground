import type { RendererParams } from '../src/app/shared/grid-cells/core/renderer-params.model';
import type { NumberCellParams } from '../src/app/shared/grid-cells/renderers/number/number-cell-params.model';
import type { ToggleCellParams } from '../src/app/shared/grid-cells/renderers/toggle/toggle-cell-params.model';
import type { DropdownCellParams } from '../src/app/shared/grid-cells/renderers/dropdown/dropdown-cell-params.model';
import { computeContent } from '../src/app/shared/grid-cells/capabilities/content/compute-content';
import { computeMarker } from '../src/app/shared/grid-cells/capabilities/marker/compute-marker';
import { computeAction } from '../src/app/shared/grid-cells/capabilities/action/compute-action';
import { computeNumberContent } from '../src/app/shared/grid-cells/capabilities/number/compute-number-content';
import { computeToggle } from '../src/app/shared/grid-cells/capabilities/toggle/compute-toggle';
import { computeDropdown } from '../src/app/shared/grid-cells/capabilities/dropdown/compute-dropdown';

interface Row {
  amount: number;
  active: boolean;
  status: string;
}
// Ensure real AG Grid runtime params work with the compute functions' small structural input.
export function checkRuntimeParams(
  number: RendererParams<Row, number, NumberCellParams<Row>> | null,
  toggle: RendererParams<Row, boolean, ToggleCellParams<Row>> | null,
  dropdown: RendererParams<Row, string, DropdownCellParams<Row, string>> | null,
): void {
  computeContent(number);
  computeMarker(number);
  computeNumberContent(number);
  computeAction(number);
  computeToggle(toggle);
  computeDropdown(dropdown);
}
