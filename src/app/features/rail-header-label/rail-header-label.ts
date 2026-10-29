import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  DOCUMENT,
  ElementRef,
  inject,
  signal,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import type { MenuItem } from 'primeng/api';
import { ContextMenu } from 'primeng/contextmenu';
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
import {
  ReplaceValueDialog,
  type ReplaceColumnOption,
  type ReplaceValueRequest,
} from './edit/replace-value-dialog';
import { SignalDrafts, SignalEditState, type SignalGridContext } from './edit/signal-edit-state';

/** Leaf column codes under a group, nested groups included. */
function groupColumnCodes(groupCode: string): string[] {
  const childGroups = SIGNAL_GROUPS.filter(({ parentCode }) => parentCode === groupCode);
  return [
    ...SIGNAL_COLUMNS.filter((column) => column.groupCode === groupCode).map(({ code }) => code),
    ...childGroups.flatMap(({ code }) => groupColumnCodes(code)),
  ];
}

/** Columns with a header checkbox and the right-click menu in edit mode: the data columns. */
const DATA_COLUMN_CODES: ReadonlySet<string> = new Set(SIGNAL_COLUMNS.map(({ code }) => code));

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
  imports: [AgGridAngular, ContextMenu, ReplaceValueDialog],
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
          <button type="button" [attr.aria-pressed]="edit.editMode()" (click)="toggleEditMode()">
            {{ edit.editMode() ? 'Done' : 'Edit' }}
          </button>
        </div>
      </header>
      <ag-grid-angular
        class="signal-grid rail-header-labels"
        [modules]="modules"
        [theme]="theme"
        rowModelType="serverSide"
        [serverSideDatasource]="datasource"
        [cacheBlockSize]="20"
        [getRowId]="getRowId"
        [columnDefs]="columnDefs"
        [context]="gridContext"
        [defaultColDef]="defaultColDef()"
        [icons]="icons"
        [rowHeight]="44"
        [hidePaddedHeaderRows]="true"
        (gridReady)="onGridReady($event)"
        (columnGroupOpened)="onColumnGroupOpened($event)"
        (contextmenu)="openHeaderMenu($event)"
      />
      <p-contextmenu
        #headerMenu
        [model]="headerMenuItems"
        appendTo="body"
        ariaLabel="Column actions"
        styleClass="column-actions-menu"
        (onShow)="focusHeaderMenu()"
        (onHide)="restoreHeaderFocus(false)"
      >
        <ng-template #item let-item>
          <!-- An "itemlink": on Enter, PrimeNG clicks it (the click reaches its item handler).
               Without one Enter does nothing with a custom item template. -->
          <a
            data-pc-section="itemlink"
            class="flex items-center gap-3 px-3 py-2 text-sm font-medium text-[#181d27]"
          >
            <!-- "T" for text, as in Figma -->
            <svg viewBox="0 0 20 20" class="size-5 text-[#414651]" aria-hidden="true">
              <path
                d="M4.167 5.833V4.167h11.666v1.666M10 4.167v11.666m-2.5 0h5"
                fill="none"
                stroke="currentColor"
                stroke-width="1.67"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            {{ item.label }}
          </a>
        </ng-template>
      </p-contextmenu>
      <app-replace-value-dialog
        [columns]="replaceColumns()"
        (replace)="applyReplace($event)"
        (closed)="restoreHeaderFocus(true)"
      />
    </main>
  `,
  styleUrls: ['./rail-header-label.css', './rail-header-label-rails.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class RailHeaderLabel {
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly host: HTMLElement = inject(ElementRef).nativeElement;

  private readonly headerMenu = viewChild.required<ContextMenu>('headerMenu');
  private readonly replaceDialog = viewChild.required(ReplaceValueDialog);

  protected readonly filtersHidden = signal(false);
  /** Data columns in table order, for Replace Value's column list (set once the grid exists). */
  protected readonly replaceColumns = signal<readonly ReplaceColumnOption[]>([]);

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
  protected readonly edit = new SignalEditState();
  private readonly drafts = new SignalDrafts();
  protected readonly gridContext: SignalGridContext = { edit: this.edit };
  /** The data column whose header was right-clicked, and that header, for focus to return to. */
  private menuColumn: string | null = null;
  private menuOrigin: HTMLElement | null = null;
  protected readonly headerMenuItems: MenuItem[] = [
    { label: 'Replace Value', command: () => this.openReplace() },
  ];
  protected readonly columnDefs = buildSignalColumnDefs(SIGNAL_GROUPS, SIGNAL_COLUMNS, {
    changeCountFor: (groupCode) => this.changeCount(groupCode),
    selectOptionsFor: columnOptions,
  });
  protected readonly modules = [
    AllCommunityModule,
    ServerSideRowModelModule,
    ServerSideRowModelApiModule,
  ];
  protected readonly datasource = createSignalDatasource(
    () => SIGNAL_ROWS,
    (row) => this.drafts.applyTo(row),
  );
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
    this.replaceColumns.set(
      (event.api.getColumns() ?? [])
        .filter((column) => DATA_COLUMN_CODES.has(column.getColId()))
        .map((column) => ({
          code: column.getColId(),
          name: column.getColDef().headerName ?? column.getColId(),
        })),
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

  protected toggleEditMode(): void {
    this.edit.setEditMode(!this.edit.editMode());
    if (!this.edit.editMode()) this.headerMenu().hide();
  }

  /**
   * Right-click, or the context-menu key / Shift+F10, on a data column's header in edit mode
   * opens the column menu; anywhere else the browser's own menu shows as usual. From the
   * keyboard the event has no pointer position, so the menu opens under the header instead.
   */
  protected openHeaderMenu(event: Event): void {
    if (!this.edit.editMode()) return;
    const header = (event.target as Element).closest<HTMLElement>(
      '.ag-header-cell[col-id]:not(.ag-floating-filter)',
    );
    const code = header?.getAttribute('col-id');
    if (!header || !code || !DATA_COLUMN_CODES.has(code)) {
      this.headerMenu().hide();
      return;
    }
    this.menuColumn = code;
    this.menuOrigin = header;
    // A pointer gives a position; the context-menu key gives (0, 0) or no pointer type.
    const fromPointer =
      event instanceof MouseEvent &&
      (event as PointerEvent).pointerType !== '' &&
      !(event.clientX === 0 && event.clientY === 0);
    if (!fromPointer) {
      const box = header.getBoundingClientRect();
      this.headerMenu().show({
        pageX: box.left + (this.document.defaultView?.scrollX ?? 0) + 8,
        pageY: box.bottom + (this.document.defaultView?.scrollY ?? 0),
        preventDefault: () => event.preventDefault(),
        stopPropagation: () => event.stopPropagation(),
      });
    } else {
      this.headerMenu().show(event);
    }
  }

  /**
   * Into the menu once it's on screen, so the arrow keys, Enter and Escape work at once. PrimeNG
   * tries this itself before its list exists the first time.
   */
  protected focusHeaderMenu(): void {
    this.document.defaultView?.requestAnimationFrame(() =>
      this.document.querySelector<HTMLElement>('.column-actions-menu [role="menu"]')?.focus(),
    );
  }

  /**
   * Back to the header the menu or popup was opened from, a frame later, once PrimeNG has taken
   * its overlay down (focus is still in it when the close events fire). After the popup, always;
   * after the menu, only if focus was lost: choosing Replace Value moves it to the popup.
   */
  protected restoreHeaderFocus(always: boolean): void {
    const origin = this.menuOrigin;
    this.document.defaultView?.requestAnimationFrame(() => {
      const active = this.document.activeElement;
      const lost = !active || active === this.document.body;
      // preventScroll: the header is sticky, and focusing it would scroll the table to the top.
      if (origin?.isConnected && (always || lost)) origin.focus({ preventScroll: true });
    });
  }

  /** Replace Value, starting with the right-clicked column and the ticked ones, in table order. */
  private openReplace(): void {
    const ticked = this.edit.checkedColumns();
    this.replaceDialog().open(
      this.replaceColumns()
        .map(({ code }) => code)
        .filter((code) => code === this.menuColumn || ticked.has(code)),
    );
  }

  /**
   * A draft: shown on the rows already loaded, in place (no reload, so the table keeps its
   * scroll position), and on every row loaded from now on (the datasource applies drafts).
   */
  protected applyReplace({ value, columnCodes }: ReplaceValueRequest): void {
    this.drafts.replace(columnCodes, value);
    this.gridApi?.forEachNode((node) => {
      if (node.data) node.setData(this.drafts.applyTo(node.data));
    });
  }

  private changeCount(groupCode: string): number {
    const codes = groupColumnCodes(groupCode);
    return SIGNAL_ROWS.reduce(
      (total, row) => total + codes.filter((code) => row.modifiedCodes.includes(code)).length,
      0,
    );
  }
}
