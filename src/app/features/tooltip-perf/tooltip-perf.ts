// Measurement page: 300 rows × 200 columns where every cell has a tooltip, using either the
// cells kit tooltip, Angular Material's matTooltip, or none. Driven by perf/tooltip.spec.ts.
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { MatTooltip } from '@angular/material/tooltip';
import type { ICellRendererAngularComp } from 'ag-grid-angular';
import { AgGridAngular } from 'ag-grid-angular';
import {
  themeQuartz,
  type ColDef,
  type GridApi,
  type ICellRendererParams,
} from 'ag-grid-community';
import { CellsTooltip } from '@cells';
import { registerDemoGrid } from '../../shared/ag-grid/grid-registration';

registerDemoGrid();

type Mode = 'none' | 'cells' | 'mat';
const MODE = (new URLSearchParams(location.search).get('mode') ?? 'none') as Mode;
const ROWS = 300;
const COLUMNS = 200;

@Component({
  selector: 'app-tip-cell',
  imports: [CellsTooltip, MatTooltip],
  template: `
    @switch (mode) {
      @case ('cells') {
        <span [cellsTooltip]="tip()">{{ value() }}</span>
      }
      @case ('mat') {
        <span [matTooltip]="tip()">{{ value() }}</span>
      }
      @default {
        <span>{{ value() }}</span>
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TipCell implements ICellRendererAngularComp {
  protected readonly mode = MODE;
  protected readonly value = signal('');
  protected readonly tip = signal('');

  agInit(params: ICellRendererParams): void {
    this.refresh(params);
  }

  refresh(params: ICellRendererParams): boolean {
    this.value.set(String(params.value));
    this.tip.set(`Row ${params.node.id}, ${params.colDef?.headerName}: ${params.value}`);
    return true;
  }
}

const frames = () =>
  new Promise<void>((done) =>
    requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(done))),
  );

/** Resolves once the number of drawn cells stops changing for three checks in a row. */
async function settled(): Promise<void> {
  let last = -1;
  let stable = 0;
  while (stable < 3) {
    await frames();
    const count = document.querySelectorAll('app-tip-cell').length;
    stable = count === last ? stable + 1 : 0;
    last = count;
  }
}

@Component({
  selector: 'app-tooltip-perf',
  imports: [AgGridAngular],
  template: `<ag-grid-angular style="display:block;height:900px" [gridOptions]="options" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TooltipPerf {
  private readonly created = performance.now();
  private api?: GridApi;
  private rendered?: Promise<number>;

  protected readonly options = {
    columnDefs: Array.from({ length: COLUMNS }, (_, column): ColDef => ({
      field: `c${column}`,
      headerName: `C${column}`,
      width: 90,
      cellRenderer: TipCell,
    })),
    rowData: Array.from({ length: ROWS }, (_, row) =>
      Object.fromEntries(
        Array.from({ length: COLUMNS }, (_, column) => [`c${column}`, row * column]),
      ),
    ),
    rowHeight: 28,
    suppressColumnVirtualisation: true,
    animateRows: false,
    theme: themeQuartz,
    onGridReady: ({ api }: { api: GridApi }) => (this.api = api),
    onFirstDataRendered: () => {
      this.rendered = settled().then(() => performance.now() - this.created);
    },
  };

  constructor() {
    (window as unknown as { tooltipPerf: unknown }).tooltipPerf = {
      mode: MODE,
      /** Time from page component creation until every visible cell is drawn. */
      firstRender: async () => {
        while (!this.rendered) await frames();
        return this.rendered;
      },
      cells: () => document.querySelectorAll('app-tip-cell').length,
      /** Scrolls to the bottom and back in steps; rows are recycled each step. */
      scroll: async () => {
        const start = performance.now();
        for (let row = 0; row < ROWS; row += 30) {
          this.api!.ensureIndexVisible(row, 'top');
          await frames();
        }
        this.api!.ensureIndexVisible(0, 'top');
        await frames();
        return performance.now() - start;
      },
      /** Forces every drawn renderer to refresh. */
      refresh: async () => {
        const start = performance.now();
        this.api!.refreshCells({ force: true });
        await frames();
        return performance.now() - start;
      },
    };
  }
}
