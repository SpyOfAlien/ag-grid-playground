import { LiveAnnouncer } from '@angular/cdk/a11y';
import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  ElementRef,
  inject,
  signal,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';
import {
  AllCommunityModule,
  themeQuartz,
  type ColDef,
  type GridApi,
  type GridOptions,
  type GridReadyEvent,
} from 'ag-grid-community';
import { buildEquipmentColumnDefs } from './equipment-backend-columns';
import {
  EQUIPMENT_COLUMN_PAYLOAD,
  EQUIPMENT_ROWS,
  type EquipmentGroupDto,
  type EquipmentRow,
} from './equipment-data';
import type {
  EquipmentColumnCheckbox,
  EquipmentGroupMode,
  EquipmentGroupSwitch,
} from './equipment-columns-menu';
import { EquipmentToolbar } from './equipment-toolbar';

const CHANGE_COUNT = EQUIPMENT_ROWS.filter((row) => row.changed).length;

/** Groups in header order (parents before children, siblings by orderNo), with nesting depth. */
function groupOutline(
  groups: readonly EquipmentGroupDto[],
  parentCode: string | null = null,
  depth = 0,
): Omit<EquipmentGroupSwitch, 'open'>[] {
  return groups
    .filter((group) => group.parentCode === parentCode)
    .sort((a, b) => a.orderNo - b.orderNo)
    .flatMap(({ code, name }) => [{ code, name, depth }, ...groupOutline(groups, code, depth + 1)]);
}

const GROUP_OUTLINE = groupOutline(EQUIPMENT_COLUMN_PAYLOAD.groups);

/** Column code to the name of the group it sits in directly. */
const COLUMN_GROUP_NAMES = new Map(
  EQUIPMENT_COLUMN_PAYLOAD.columns.flatMap(({ code, groupCode }) => {
    const group = EQUIPMENT_COLUMN_PAYLOAD.groups.find((candidate) => candidate.code === groupCode);
    return group ? [[code, group.name] as const] : [];
  }),
);

/** The row number and each group's rail, which the Columns menu does not offer to hide. */
const UNLISTED_COLUMN_IDS = new Set([
  'id',
  ...EQUIPMENT_COLUMN_PAYLOAD.groups.map(({ code }) => `${code}-rail`),
]);

const DEFAULT_COL_DEF: ColDef<EquipmentRow> = {
  minWidth: 90,
  sortable: true,
  resizable: true,
  filter: 'agTextColumnFilter',
  floatingFilter: true,
  suppressHeaderMenuButton: true,
  wrapHeaderText: true,
  suppressMovable: true,
};

/** Row added by Add Row: every text field empty and no revision history. */
function blankEquipmentRow(id: number): EquipmentRow {
  const blank = Object.fromEntries(
    Object.entries(EQUIPMENT_ROWS[0]).map(([key, value]) => [
      key,
      typeof value === 'string' ? '' : value,
    ]),
  ) as unknown as EquipmentRow;
  return { ...blank, id, changed: false, previousWard: null, previousWardCode: null };
}

@Component({
  selector: 'app-equipment-column-groups',
  imports: [AgGridAngular, EquipmentToolbar, NgTemplateOutlet],
  template: `
    <!-- The same controls sit above the table and again in the middle of the page below it. -->
    <ng-template #toolbar let-label>
      <app-equipment-toolbar
        [label]="label"
        [groups]="groups()"
        [columns]="columns()"
        [fullScreen]="fullScreen()"
        [filtersHidden]="filtersHidden()"
        (filtersHiddenChange)="setFiltersHidden($event)"
        [groupMode]="groupMode()"
        (groupModeSet)="setGroupMode($event)"
        (groupSet)="setGroupExpanded($event.code, $event.open)"
        (columnSet)="setColumnVisible($event.code, $event.visible)"
        (fullScreenToggle)="toggleFullScreen()"
        (rowAdd)="addRow()"
      />
    </ng-template>
    <main #demo class="equipment-demo">
      <!-- Title, controls and table fill the first screen; the page scrolls on to the second
           toolbar, which has a screen's height of space above and below it. -->
      <div class="equipment-screen">
        <header class="equipment-toolbar">
          <h1 class="equipment-title">Hospital equipment</h1>
          <ng-container
            [ngTemplateOutlet]="toolbar"
            [ngTemplateOutletContext]="{ $implicit: 'Top table controls' }"
          />
        </header>
        <!-- Header row above the filter row, so rail headers can paint the filter-row slot.
             Pinned filter cells go above both, so a rail scrolled under them stays hidden. -->
        <ag-grid-angular
          class="equipment-grid [&_.ag-header-row-column]:z-3 [&_.ag-header-row-filter_:is(.ag-grid-pinned-left-cells,.ag-grid-pinned-right-cells)]:z-4"
          [modules]="modules"
          [gridOptions]="options"
          [rowData]="rowData"
          (gridReady)="onGridReady($event)"
        />
      </div>
      <div class="equipment-toolbar equipment-lower-toolbar">
        <ng-container
          [ngTemplateOutlet]="toolbar"
          [ngTemplateOutletContext]="{ $implicit: 'Bottom table controls' }"
        />
      </div>
    </main>
  `,
  // Group headers and rails are styled with Tailwind classes (equipment-group-classes.ts).
  styleUrls: ['./equipment-column-groups.css', './equipment-table.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: { '(document:fullscreenchange)': 'syncFullScreen()' },
})
export class EquipmentColumnGroups {
  private readonly liveAnnouncer = inject(LiveAnnouncer);
  private readonly document = inject(DOCUMENT);

  private readonly demo = viewChild.required<ElementRef<HTMLElement>>('demo');

  protected readonly groups = signal<readonly EquipmentGroupSwitch[]>([]);
  /** Starts as Collapse all, matching the column defs; turns Custom once groups differ. */
  protected readonly groupMode = signal<EquipmentGroupMode>('collapsed');
  protected readonly columns = signal<readonly EquipmentColumnCheckbox[]>([]);
  protected readonly filtersHidden = signal(false);
  protected readonly fullScreen = signal(false);

  private gridApi: GridApi<EquipmentRow> | undefined;
  private nextRowId = Math.max(...EQUIPMENT_ROWS.map(({ id }) => id)) + 1;
  protected readonly modules = [AllCommunityModule];
  protected readonly rowData = EQUIPMENT_ROWS;
  protected readonly options: GridOptions<EquipmentRow> = {
    columnDefs: buildEquipmentColumnDefs(
      // The table opens with every group collapsed, whatever the payload's open flags say.
      EQUIPMENT_COLUMN_PAYLOAD.groups.map((group) => ({ ...group, open: false })),
      EQUIPMENT_COLUMN_PAYLOAD.columns,
      { changeCountFor: () => CHANGE_COUNT },
    ),
    defaultColDef: DEFAULT_COL_DEF,
    // Values follow the tokens in docs/equipment-table-design-spec.md.
    theme: themeQuartz.withParams({
      accentColor: '#b93815',
      foregroundColor: '#181d27',
      backgroundColor: '#ffffff',
      headerBackgroundColor: '#ffffff',
      headerTextColor: '#414651',
      borderColor: '#e9eaeb',
      rowBorder: false,
      columnBorder: false,
      headerColumnBorder: { color: '#e9eaeb' },
      headerColumnBorderHeight: '100%',
      headerRowBorder: false,
      wrapperBorderRadius: 0,
      fontFamily: ['Inter', 'sans-serif'],
      fontSize: 14,
      headerFontSize: 14,
      headerFontWeight: 500,
      cellHorizontalPadding: 12,
      iconSize: 16,
      inputBorder: { color: '#e9eaeb' },
      inputBorderRadius: 8,
      inputFocusBorder: { color: '#b93815' },
      browserColorScheme: 'light',
    }),
    rowHeight: 44,
    headerHeight: 44,
    groupHeaderHeight: 36,
    floatingFiltersHeight: 44,
    animateRows: false,
    hidePaddedHeaderRows: true,
    // Keep offscreen group headers in the accessibility tree on narrow screens.
    suppressColumnVirtualisation: true,
    ensureDomOrder: true,
    getRowId: ({ data }) => String(data.id),
    // Group resize handles are created from the currently displayed children.
    // Recreate them when fixed-width rails are swapped for resizable columns.
    // Fires for header clicks and API calls alike.
    onColumnGroupOpened: ({ api }) => {
      api.refreshHeader();
      this.syncGroups();
    },
    onColumnVisible: () => this.syncColumns(),
  };

  protected onGridReady(event: GridReadyEvent<EquipmentRow>): void {
    this.gridApi = event.api;
    event.api.setGridAriaProperty('label', 'Hospital equipment');
    this.syncGroups();
    this.syncColumns();
  }

  /** Expand all and Collapse all set every group; Custom keeps them as they are. */
  protected setGroupMode(mode: EquipmentGroupMode): void {
    this.groupMode.set(mode);
    if (mode === 'custom') {
      return;
    }
    const open = mode === 'expanded';
    this.gridApi?.setColumnGroupState(
      EQUIPMENT_COLUMN_PAYLOAD.groups.map(({ code }) => ({ groupId: code, open })),
    );
    void this.liveAnnouncer.announce(
      open ? 'All column groups expanded.' : 'All column groups collapsed.',
    );
  }

  protected setGroupExpanded(code: string, open: boolean): void {
    this.gridApi?.setColumnGroupOpened(code, open);
  }

  protected setColumnVisible(code: string, visible: boolean): void {
    this.gridApi?.setColumnsVisible([code], visible);
  }

  /** Hides the filter row only; filters already typed keep applying. */
  protected setFiltersHidden(hidden: boolean): void {
    this.filtersHidden.set(hidden);
    this.gridApi?.setGridOption('defaultColDef', { ...DEFAULT_COL_DEF, floatingFilter: !hidden });
  }

  protected toggleFullScreen(): void {
    if (this.document.fullscreenElement) {
      void this.document.exitFullscreen();
      return;
    }
    this.demo()
      .nativeElement.requestFullscreen()
      .catch(() => this.liveAnnouncer.announce('Full screen is not available.'));
  }

  protected syncFullScreen(): void {
    this.fullScreen.set(this.document.fullscreenElement === this.demo().nativeElement);
  }

  protected addRow(): void {
    const api = this.gridApi;
    if (!api) {
      return;
    }
    const row = blankEquipmentRow(this.nextRowId++);
    const [node] = api.applyTransaction({ add: [row] })?.add ?? [];
    if (node?.rowIndex != null) {
      api.ensureIndexVisible(node.rowIndex, 'bottom');
    }
    void this.liveAnnouncer.announce(`Row ${row.id} added.`);
  }

  // Reads the payload groups only: getColumnGroupState() also lists AG Grid's padding groups.
  // Groups without columns are not in the grid and are left out of the menu.
  private syncGroups(): void {
    const api = this.gridApi;
    if (!api) {
      return;
    }
    this.groups.set(
      GROUP_OUTLINE.flatMap((group) => {
        const column = api.getProvidedColumnGroup(group.code);
        return column ? [{ ...group, open: column.isExpanded() }] : [];
      }),
    );
    // A group opened or closed on its own (header or switch) no longer matches Expand all
    // or Collapse all, so the view becomes Custom.
    const mode = this.groupMode();
    const expected = mode === 'expanded';
    if (mode !== 'custom' && this.groups().some(({ open }) => open !== expected)) {
      this.groupMode.set('custom');
    }
  }

  // Grid order. Rails stand in for collapsed groups and the row number always shows,
  // so neither is listed.
  private syncColumns(): void {
    const api = this.gridApi;
    if (!api) {
      return;
    }
    this.columns.set(
      (api.getColumns() ?? [])
        .filter((column) => !UNLISTED_COLUMN_IDS.has(column.getColId()))
        .map((column) => ({
          code: column.getColId(),
          name: column.getColDef().headerName ?? column.getColId(),
          groupName: COLUMN_GROUP_NAMES.get(column.getColId()) ?? null,
          visible: column.isVisible(),
        })),
    );
  }
}
