import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';
import {
  AllCommunityModule,
  themeQuartz,
  type ColDef,
  type ColumnGroupOpenedEvent,
  type GetRowIdParams,
  type GridApi,
  type GridReadyEvent,
} from 'ag-grid-community';
import { ServerSideRowModelApiModule, ServerSideRowModelModule } from 'ag-grid-enterprise';
import {
  columnOptions,
  createSignalDatasource,
  INITIALLY_OPEN_GROUPS,
  SIGNAL_COLUMNS,
  SIGNAL_GROUPS,
  SIGNAL_ROWS,
} from './signal-data';
import type { SignalRow } from './signal.model';
import { clipHeaderAtPinnedEdge } from './clip-header-at-pinned-edge';
import { buildSignalColumnDefs } from './columns/build-signal-column-defs';

/** Leaf column codes under a group, nested groups included. */
function groupColumnCodes(groupCode: string): string[] {
  const childGroups = SIGNAL_GROUPS.filter(({ parentCode }) => parentCode === groupCode);
  return [
    ...SIGNAL_COLUMNS.filter((column) => column.groupCode === groupCode).map(({ code }) => code),
    ...childGroups.flatMap(({ code }) => groupColumnCodes(code)),
  ];
}

const chevron = (path: string) =>
  `<svg class="signal-chevron" viewBox="0 0 20 20" aria-hidden="true"><path d="${path}"/></svg>`;

/**
 * The signal grid's collapsed-group rails, styled after the Signal List Management Figma frame,
 * with each rail drawn whole by its header component (RailLabelHeader): the table and column defs
 * are the ref's, and the only addition is CSS (rail-header-label-rails.css) that cuts the header
 * off at the pinned edge as it scrolls sideways.
 */
@Component({
  selector: 'app-rail-header-label',
  imports: [AgGridAngular],
  template: `
    <main class="signal-page">
      <header class="signal-toolbar">
        <h1>Signal Data</h1>
        <div class="signal-controls" role="group" aria-label="Table controls">
          <button type="button" (click)="setGroupsOpen(true)">Expand all</button>
          <button type="button" (click)="setGroupsOpen(false)">Collapse all</button>
          <label>
            <input
              type="checkbox"
              [checked]="filtersHidden()"
              (change)="setFiltersHidden($event)"
            />
            Hide Filter/Search
          </label>
        </div>
      </header>
      <ag-grid-angular
        class="signal-grid rail-header-labels"
        [modules]="modules"
        [theme]="theme"
        rowModelType="serverSide"
        [serverSideDatasource]="datasource"
        [cacheBlockSize]="100"
        [getRowId]="getRowId"
        [columnDefs]="columnDefs"
        [defaultColDef]="defaultColDef()"
        [icons]="icons"
        [rowHeight]="44"
        [hidePaddedHeaderRows]="true"
        (gridReady)="onGridReady($event)"
        (columnGroupOpened)="onColumnGroupOpened($event)"
      />
    </main>
  `,
  styleUrls: ['./rail-header-label.css', './rail-header-label-rails.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class RailHeaderLabel {
  private readonly destroyRef = inject(DestroyRef);
  private readonly host: HTMLElement = inject(ElementRef).nativeElement;

  protected readonly filtersHidden = signal(false);

  protected readonly defaultColDef = computed((): ColDef<SignalRow> => ({
    minWidth: 140,
    flex: 1,
    resizable: true,
    sortable: false,
    wrapHeaderText: true,
    autoHeaderHeight: true,
    suppressHeaderMenuButton: true,
    floatingFilter: !this.filtersHidden(),
  }));

  private gridApi: GridApi<SignalRow> | null = null;
  protected readonly columnDefs = buildSignalColumnDefs(SIGNAL_GROUPS, SIGNAL_COLUMNS, {
    changeCountFor: (groupCode) => this.changeCount(groupCode),
    selectOptionsFor: columnOptions,
  });
  protected readonly modules = [
    AllCommunityModule,
    ServerSideRowModelModule,
    ServerSideRowModelApiModule,
  ];
  protected readonly datasource = createSignalDatasource(() => SIGNAL_ROWS);
  // As in Figma: an open group shows a right chevron, a collapsed one (its rail) a down one.
  protected readonly icons = {
    columnGroupOpened: chevron('m7.5 15 5-5-5-5'),
    columnGroupClosed: chevron('m5 7.5 5 5 5-5'),
  };
  // Colours and sizes from the Figma variables (see rail-header-label.css for the tokens).
  protected readonly theme = themeQuartz.withParams({
    fontFamily: 'Inter, sans-serif',
    fontSize: 14,
    foregroundColor: '#181d27',
    backgroundColor: '#ffffff',
    headerBackgroundColor: '#ffffff',
    headerTextColor: '#414651',
    headerFontWeight: 500,
    borderColor: '#e9eaeb',
    wrapperBorder: false,
    wrapperBorderRadius: 0,
    rowBorder: false,
    columnBorder: false,
    headerColumnBorder: true,
    headerColumnBorderHeight: '100%',
    headerRowBorder: false,
    cellHorizontalPadding: 12,
    accentColor: '#004e50',
    browserColorScheme: 'light',
  });

  protected readonly getRowId = ({ data }: GetRowIdParams<SignalRow>) => data.signalId;

  protected onGridReady(event: GridReadyEvent<SignalRow>): void {
    this.gridApi = event.api;
    event.api.setGridAriaProperty('label', 'Signal data');
    event.api.setColumnGroupState(
      SIGNAL_GROUPS.map(({ code }) => ({ groupId: code, open: INITIALLY_OPEN_GROUPS.has(code) })),
    );
    const grid = this.host.querySelector<HTMLElement>('.rail-header-labels');
    if (grid) clipHeaderAtPinnedEdge(grid, this.destroyRef);
  }

  // As in the signal grid: header components are rebuilt on every toggle.
  protected onColumnGroupOpened(event: ColumnGroupOpenedEvent<SignalRow>): void {
    event.api.refreshHeader();
  }

  protected setGroupsOpen(open: boolean): void {
    this.gridApi?.setColumnGroupState(SIGNAL_GROUPS.map(({ code }) => ({ groupId: code, open })));
  }

  protected setFiltersHidden(event: Event): void {
    this.filtersHidden.set((event.target as HTMLInputElement).checked);
  }

  private changeCount(groupCode: string): number {
    const codes = groupColumnCodes(groupCode);
    return SIGNAL_ROWS.reduce(
      (total, row) => total + codes.filter((code) => row.modifiedCodes.includes(code)).length,
      0,
    );
  }
}
