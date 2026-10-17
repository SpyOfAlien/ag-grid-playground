// Measurement page for the cells kit: 200 columns × 300 rows of tree data.
// Not linked from the app; driven by a Playwright script through `window.cellsPerf`.
import {
  ApplicationRef,
  ChangeDetectionStrategy,
  Component,
  inject,
  Injectable,
} from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';
import { themeQuartz, type ColDef } from 'ag-grid-community';
import {
  applyChanges,
  CellBase,
  cellGridOptions,
  createEditSession,
  DropdownCell,
  NumberCell,
  TextCell,
  ToggleCell,
  type Command,
  type EditPersistence,
  type Result,
  type SaveCommand,
} from '@cells';
import { registerDemoGrid } from '../../shared/ag-grid/grid-registration';

registerDemoGrid();

const COLUMNS = 200;
const GROUPS = 30;
const CHILDREN = 9;

type Row = { readonly id: string; readonly path: readonly string[] } & Readonly<
  Record<string, string | number | boolean | readonly string[]>
>;

function value(column: number, seed: number): string | number | boolean {
  switch (column % 4) {
    case 0:
      return (seed * 7 + column) % 500;
    case 1:
      return `Text ${seed}-${column}`;
    case 2:
      return (seed + column) % 2 === 0;
    default:
      return ['a', 'b', 'c'][(seed + column) % 3];
  }
}

function makeRows(): Row[] {
  const rows: Row[] = [];
  for (let group = 0; group < GROUPS; group++)
    for (let child = 0; child <= CHILDREN; child++) {
      const id = child === 0 ? `g${group}` : `g${group}-${child}`;
      const fields: Record<string, string | number | boolean> = {};
      for (let column = 0; column < COLUMNS; column++)
        fields[`c${column}`] = value(column, group * 10 + child);
      rows.push({
        ...fields,
        id,
        path: child === 0 ? [`Group ${group}`] : [`Group ${group}`, `Item ${child}`],
      } as Row);
    }
  return rows;
}

@Injectable()
class PerfPersistence implements EditPersistence<Row> {
  rows = makeRows();
  load(_command?: Command): Promise<Result<Row>> {
    return Promise.resolve({ replace: this.rows });
  }
  save(command: SaveCommand<Row>): Promise<Result<Row>> {
    const update = applyChanges(this.rows, (row) => row.id, command.changes);
    const changed = new Map(update.map((row) => [row.id, row]));
    this.rows = this.rows.map((row) => changed.get(row.id) ?? row);
    return Promise.resolve({ update });
  }
}

function columns(): ColDef<Row>[] {
  return Array.from({ length: COLUMNS }, (_, column): ColDef<Row> => {
    const field = `c${column}`;
    const base = { field, headerName: `C${column}`, width: 110 } as ColDef<Row>;
    switch (column % 4) {
      case 0:
        return {
          ...base,
          cellRenderer: NumberCell,
          cellRendererParams: {
            number: { decimals: 0 },
            markers: { warning: { when: ({ value }: { value: number }) => value < 20 } },
          },
        };
      case 1:
        return { ...base, cellRenderer: TextCell };
      case 2:
        return { ...base, cellRenderer: ToggleCell, cellRendererParams: {} };
      default:
        return {
          ...base,
          cellRenderer: DropdownCell,
          cellRendererParams: {
            options: ['a', 'b', 'c'].map((option) => ({
              value: option,
              label: option.toUpperCase(),
            })),
          },
        };
    }
  });
}

let refreshes = 0;
const originalRefresh = CellBase.prototype.refresh;
CellBase.prototype.refresh = function (this: CellBase<unknown, unknown, unknown>, params) {
  refreshes++;
  return originalRefresh.call(this, params);
};

const frames = () =>
  new Promise<void>((done) =>
    requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(done))),
  );

@Component({
  selector: 'app-cells-perf',
  imports: [AgGridAngular],
  providers: [PerfPersistence],
  template: `<ag-grid-angular style="display:block;height:900px" [gridOptions]="options" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CellsPerf {
  private readonly persistence = inject(PerfPersistence);
  private readonly app = inject(ApplicationRef);
  private readonly session = createEditSession(this.persistence, (row: Row) => row.id);
  private counter = 0;

  protected readonly options = cellGridOptions(
    this.session,
    {
      columnDefs: columns(),
      treeData: true,
      getDataPath: (row) => [...row.path],
      groupDefaultExpanded: -1,
      autoGroupColumnDef: { headerName: 'Group', width: 200, pinned: 'left' },
      rowHeight: 32,
      animateRows: false,
      suppressColumnVirtualisation: new URLSearchParams(location.search).has('allColumns'),
      theme: themeQuartz,
    },
    // A change to c0 must also refresh ten other columns whose rules read it.
    { refreshOnChange: { c0: Array.from({ length: 10 }, (_, index) => `c${(index + 1) * 4}`) } },
  );

  constructor() {
    (window as unknown as { cellsPerf: unknown }).cellsPerf = {
      ready: async () => {
        await this.session.run('load', {});
        await frames();
        return document.querySelectorAll('.cells-cell').length;
      },
      /** Frame-wait overhead with no change, to subtract from the others. */
      baseline: async () => this.measure(() => Promise.resolve()),
      /** One field in one row changes; returns ms until rendered and renderer refreshes. */
      update: async () =>
        this.measure(() => {
          const field = 'c0';
          return this.session.run('save', {
            changes: [{ rowId: 'g0-1', field, value: 1000 + this.counter++ }],
          });
        }),
      /** A reload where one row differs. */
      replace: async () =>
        this.measure(() => {
          this.persistence.rows = this.persistence.rows.map((row) =>
            row.id === 'g0-2' ? { ...row, c0: 2000 + this.counter++ } : row,
          );
          return this.session.run('load', {});
        }),
      /** A server reload: every row is a new object, one of them with a different value. */
      serverReplace: async () =>
        this.measure(() => {
          this.persistence.rows = this.persistence.rows.map((row) =>
            row.id === 'g0-3' ? { ...row, c0: 3000 + this.counter++ } : { ...row },
          );
          return this.session.run('load', {});
        }),
    };
  }

  private async measure(change: () => Promise<void>) {
    await frames();
    refreshes = 0;
    const start = performance.now();
    await change();
    // Main-thread work only: the change, AG Grid's update and a synchronous change detection.
    this.app.tick();
    const ms = performance.now() - start;
    await frames();
    return { ms, refreshes, rendered: document.querySelectorAll('.cells-cell').length };
  }
}
