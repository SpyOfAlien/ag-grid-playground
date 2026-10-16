import type { RendererParams } from '@grid-cells';
import type { NumberCellParams } from '@grid-cells';
import type { ToggleCellParams } from '@grid-cells';
import type { DropdownCellParams } from '@grid-cells';
import { computeContent } from '@grid-cells/composition';
import { computeMarker } from '@grid-cells/composition';
import { computeAction } from '@grid-cells/composition';
import { computeNumberContent } from '@grid-cells/composition';
import { computeToggle } from '@grid-cells/composition';
import { computeDropdown } from '@grid-cells/composition';

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
