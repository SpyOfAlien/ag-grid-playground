import {
  TableInteractionContext,
  EditorBinding,
} from '../../shared/table-system/interactions/editor-binding';
import { RowGroupingModule } from 'ag-grid-enterprise';
import { DetailsEditor } from './editors/details-editor';
import { createDetailsOperation, createTextOperation } from './domain/details-command';
import { TextEditor } from '../../shared/table-system/editors/text-editor';
import { ToggleNumberCell } from './cells/toggle-number-cell';
import { ChoiceCell } from './cells/choice-cell';
import { TextCell } from './cells/text-cell';
import { defineColumn } from '../../shared/table-system/ag-grid/typed-columns';
import { tableKeyboard } from '../../shared/table-system/ag-grid/keyboard';
import { computeNumber, computeText } from '../../shared/table-system/presentation/display';
import { Injector } from '@angular/core';
import { EditorSessions } from '../../shared/table-system/editors/editor-session';
import { TableEditorHost } from '../../shared/table-system/hosts/editor-host';
import { NumberEditor } from '../../shared/table-system/editors/number-editor';
import { AmountColumn } from './cells/amount-context';
import { OperationController } from '../../shared/table-system/operations/operation-controller';
import { SimulatedServer } from './persistence/simulated-server';
import {
  createReviewOperation,
  createAmountOperation,
  createCategoryOperation,
  categoryFromDraft,
  canEditAmount,
} from './domain/lab-operations';
import { ReviewCell } from './cells/review-cell';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  signal,
} from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';
import { AllCommunityModule, ColDef, ModuleRegistry, themeQuartz } from 'ag-grid-community';
import { CellAddress, TableModel } from '../../shared/table-system/model/table-model';
import { TableProjection } from '../../shared/table-system/ag-grid/table-projection';
import { NumberCell } from '../../shared/table-system/renderers/number-cell';
import { fixtures, LabRow, validateRow } from './domain/lab-row';
ModuleRegistry.registerModules([AllCommunityModule, RowGroupingModule]);
@Component({
  selector: 'tsys-lab',
  imports: [AgGridAngular],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<main class="tsys-app">
    <h1>Independent table system</h1>
    <button (click)="decimals.update(nextDecimals)">Change precision</button>
    <button (click)="editAmountDialog($event)">Amount dialog</button
    ><button (click)="editText('name')">Edit name</button
    ><button (click)="editText('note')">Edit notes</button
    ><button (click)="editCategory()">Edit category</button
    ><button (click)="editDetails()">Edit details</button
    ><button (click)="approval.update(toggle)">Toggle approval permission</button>
    <button (click)="projection.sort('amount')">Sort amount</button
    ><button (click)="filterName('Item 2')">Filter item 2</button
    ><button (click)="filterName('')">Clear filter</button
    ><button (click)="toggleGrouping()">Toggle grouping</button
    ><button (click)="gridVisible.update(toggle)">Toggle grid</button
    ><button (click)="removeFirst()">Remove first row</button
    ><button (click)="metadata()">Change metadata</button
    ><button (click)="replaceRow()">Replace first row</button
    ><button (click)="server.delay.set(2500)">Slow saves</button>
    <button (click)="muted.update(toggle)">Mute text</button
    ><button (click)="server.failNext.set(true)">Fail next save</button
    ><button (click)="reset()">Reset dataset</button
    ><output aria-live="polite">Requests: {{ server.submissions() }} {{ launchMessage() }}</output>
    @if (gridVisible()) {
      <ag-grid-angular
        class="tsys-grid"
        [theme]="theme"
        [defaultColDef]="defaultColDef"
        [columnDefs]="columns"
        [context]="context"
        [getRowId]="getRowId"
        (gridReady)="projection.connect($event.api)"
        (gridPreDestroyed)="projection.disconnect()"
        [groupDefaultExpanded]="-1"
        [autoGroupColumnDef]="autoGroupColumn"
      />
    }
    @if (controller.feedback(); as feedback) {
      <p class="tsys-error" role="alert">
        {{ feedback.target.entityId }}: {{ feedback.message }}
        <button (click)="controller.dismiss(feedback.target)">Dismiss feature error</button>
      </p>
    }
    <p class="tsys-error" role="alert">{{ projection.fault() }}</p>
    <p aria-live="polite">
      @if (controller.completion(); as completion) {
        Saved {{ completion.target.entityId }} {{ completion.target.operation }}.
      }
    </p>
  </main>`,
})
export class TableSystemLab {
  private readonly injector = inject(Injector);
  private readonly host = inject(TableEditorHost);
  private readonly destroy = inject(DestroyRef);
  readonly baseline = new URLSearchParams(location.search).has('baseline');
  readonly gridVisible = signal(true);
  readonly grouped = signal(false);
  readonly approval = signal(true);
  readonly muted = signal(false);
  readonly decimals = signal(2);
  readonly model = new TableModel('lab', fixtures(), validateRow);
  readonly server = new SimulatedServer();
  readonly controller = new OperationController(this.model);
  readonly sessions = new EditorSessions(this.controller);
  readonly detailsOperation = createDetailsOperation(this.server, () => this.approval());
  readonly textOperation = createTextOperation(this.server);
  readonly categoryOperation = createCategoryOperation(this.server);
  readonly amountOperation = createAmountOperation(this.server);
  readonly launchMessage = signal('');
  readonly review = createReviewOperation(this.server);
  readonly projection = new TableProjection(this.model);
  readonly theme = themeQuartz;
  readonly amountDefinition: AmountColumn = {
    id: 'amount',
    header: 'Amount',
    value: (row) => row.amount,
    display: (value) => computeNumber(value, this.context.display()),
    editor: { content: NumberEditor, presentation: 'popover' },
    width: 180,
    interaction: {
      operation: this.amountOperation,
      target: (row) => ({ entityId: row.id, operation: 'amount' }),
      command: (amount, row) => ({ id: row.id, amount, baseRevision: row.revision }),
      permission: (row) => !row.locked,
      label: (row) => `Edit amount ${row.id}`,
    },
  };
  readonly tableSystem: TableInteractionContext<LabRow> = {
    controller: this.controller,
    sessions: this.sessions,
    host: this.host,
    injector: this.injector,
    owner: this.destroy,
    focus: (address) => this.projection.focus(address.rowId, address.columnId),
    announceOpen: (outcome) => this.launchMessage.set(outcome),
  };
  readonly context = {
    tableSystem: this.tableSystem,
    muted: () => this.muted(),
    category: this.categoryOperation,
    editAmount: (id: string, trigger: HTMLElement, column?: AmountColumn, address?: CellAddress) =>
      this.editAmount(id, trigger, column, address),
    canEditAmount: (id: string) => canEditAmount(this.model, id),
    controller: this.controller,
    review: this.review,
    display: () => ({ decimals: this.decimals(), unit: 'kg' }),
  };
  readonly autoGroupColumn: ColDef<LabRow> = {
    headerName: 'Group',
    cellRendererParams: { innerRenderer: TextCell },
  };
  readonly defaultColDef: ColDef<LabRow> = {
    suppressKeyboardEvent: tableKeyboard,
    sortable: true,
    filter: true,
  };
  private readonly columnDefinitions: ColDef<LabRow>[] = [
    defineColumn<LabRow>()({
      id: 'name',
      header: 'Name',
      value: (row) => row.name,
      display: computeText,
      renderer: TextCell,
      width: 170,
    }),
    defineColumn<LabRow>()(this.amountDefinition),
    { field: 'reviewed', cellRenderer: ReviewCell, width: 160 },
    { colId: 'review-again', headerName: 'Same target', cellRenderer: ReviewCell, width: 160 },
    { field: 'category', cellRenderer: ChoiceCell, width: 150 },
    {
      colId: 'composite',
      headerName: 'Composite',
      valueGetter: (p) => p.data?.amount,
      cellRenderer: ToggleNumberCell,
      width: 290,
    },
    defineColumn<LabRow>()({
      id: 'read-only-amount',
      header: 'Read-only amount',
      value: (row) => row.amount,
      display: (value) => computeNumber(value, this.context.display()),
      width: 210,
    }),
  ];
  readonly columns: ColDef<LabRow>[] = this.baseline
    ? [{ field: 'name' }, { field: 'amount', cellRenderer: NumberCell }]
    : this.columnDefinitions.map((column) => ({ ...this.defaultColDef, ...column }));
  readonly getRowId = (params: { data: LabRow }) => params.data.id;
  readonly toggle = (value: boolean) => !value;
  readonly nextDecimals = (value: number) => (value === 2 ? 3 : 2);
  filterName(value: string): void {
    this.projection.filter(
      value ? { name: { filterType: 'text', type: 'contains', filter: value } } : null,
    );
  }
  toggleGrouping(): void {
    this.grouped.update(this.toggle);
    this.projection.group('category', this.grouped());
  }
  removeFirst(): void {
    this.model.commit({
      kind: 'replace',
      rows: this.model.rows().filter((row) => row.id !== 'item-0'),
    });
    if (this.sessions.active()?.address.rowId === 'item-0') this.sessions.reset();
  }
  metadata(): void {
    const row = this.model.lookup('item-0');
    if (row)
      this.model.commit({
        kind: 'patch',
        rows: [{ id: row.id, changes: { note: 'Metadata updated', revision: row.revision + 1 } }],
      });
  }
  replaceRow(): void {
    this.model.commit({
      kind: 'replace',
      rows: this.model
        .rows()
        .map((row) =>
          row.id === 'item-0'
            ? { ...row, name: 'Replacement', amount: 88, revision: row.revision + 1 }
            : row,
        ),
    });
  }

  reset(): void {
    this.model.reset('lab', fixtures());
    this.controller.reset();
    this.sessions.reset();
  }
  editAmount(
    id: string,
    trigger: HTMLElement,
    column?: AmountColumn,
    requestedAddress?: CellAddress,
  ): void {
    const row = this.model.lookup(id);
    if (!row || !canEditAmount(this.model, id)) return;
    const definition = column ?? this.amountDefinition;
    const binding = new EditorBinding(
      this.tableSystem,
      definition,
      requestedAddress ?? { rowId: id, columnId: definition.id },
    );
    try {
      binding.activate(trigger);
    } finally {
      binding.release();
    }
  }
  editAmountDialog(event: MouseEvent): void {
    this.editAmount('item-0', event.currentTarget as HTMLElement, {
      ...this.amountDefinition,
      editor: { content: NumberEditor, presentation: 'dialog' },
    });
  }
  editText(field: 'name' | 'note'): void {
    const row = this.model.lookup('item-0');
    if (!row) return;
    const opened = this.sessions.open(
      { rowId: row.id, columnId: 'name' },
      row[field],
      this.textOperation,
      { entityId: row.id, operation: 'text' },
      (value) => ({ id: row.id, field, value, baseRevision: row.revision }),
    );
    if (opened.kind === 'opened')
      this.host.openDialog(TextEditor, opened.session, this.injector, this.destroy, (component) => {
        component.setInput('session', opened.session);
        component.setInput('title', field === 'note' ? 'Edit notes' : 'Edit name');
        component.setInput('mode', field === 'note' ? 'multiline' : 'text');
        component.setInput('required', field === 'name');
      });
  }
  editCategory(): void {
    const row = this.model.lookup('item-0');
    if (!row) return;
    const opened = this.sessions.open(
      { rowId: row.id, columnId: 'category' },
      String(row.category),
      this.categoryOperation,
      { entityId: row.id, operation: 'category' },
      (value) => ({ id: row.id, category: categoryFromDraft(value), baseRevision: row.revision }),
    );
    if (opened.kind === 'opened')
      this.host.openDialog(TextEditor, opened.session, this.injector, this.destroy, (component) => {
        component.setInput('session', opened.session);
        component.setInput('title', 'Edit category');
        component.setInput('mode', 'choice');
        component.setInput('choices', [
          { value: 'parts', label: 'Parts' },
          { value: 'labor', label: 'Labor' },
          { value: 'other', label: 'Other', disabled: true },
        ]);
      });
  }

  editDetails(): void {
    const row = this.model.lookup('item-0');
    if (!row) return;
    const opened = this.sessions.open(
      { rowId: row.id, columnId: 'name' },
      { name: row.name, amount: row.amount, note: row.note },
      this.detailsOperation,
      { entityId: row.id, operation: 'details' },
      (draft, action) => ({
        id: row.id,
        draft,
        action: action === 'approve' ? ('approve' as const) : ('save' as const),
        baseRevision: row.revision,
      }),
    );
    if (opened.kind === 'opened')
      this.host.openDialog(
        DetailsEditor,
        opened.session,
        this.injector,
        this.destroy,
        (component) => {
          component.setInput('session', opened.session);
          component.setInput('mayApprove', () => this.approval());
        },
      );
  }

  constructor() {
    this.destroy.onDestroy(() => {
      this.sessions.destroy();
      this.controller.destroy();
    });
    effect(() => {
      this.model.rows();
      this.projection.sync();
    });
  }
}
