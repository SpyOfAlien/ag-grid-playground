import type { TableColumn } from '../../../shared/table-system/ag-grid/typed-columns';
import type { CellAddress } from '../../../shared/table-system/model/table-model';
import type { NumberDisplay } from '../../../shared/table-system/presentation/display';
import type { AmountCommand } from '../domain/lab-operations';
import type { LabRow } from '../domain/lab-row';
export type AmountColumn = TableColumn<LabRow, number | null, AmountCommand>;
export interface AmountContext {
  readonly display: () => NumberDisplay;
  readonly editAmount: (
    id: string,
    trigger: HTMLElement,
    column?: AmountColumn,
    address?: CellAddress,
  ) => void;
  readonly canEditAmount: (id: string) => boolean;
}
