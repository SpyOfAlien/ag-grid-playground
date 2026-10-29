import { ChangeDetectionStrategy, Component, type OnDestroy, signal } from '@angular/core';
import type { IFloatingFilterAngularComp } from 'ag-grid-angular';
import type { IFloatingFilterParams, SortDirection, TextFilterModel } from 'ag-grid-community';

export type FilterRowCellKind = 'search-filter' | 'search-sort' | 'select';

export interface FilterRowCellParams extends IFloatingFilterParams {
  kind: FilterRowCellKind;
  /** The values to pick from, for kind 'select'. */
  options?: readonly string[];
}

/** Typing settles for this long before the rows are filtered. */
const SEARCH_DEBOUNCE_MS = 300;

const NEXT_SORT: Record<string, SortDirection> = { none: 'asc', asc: 'desc', desc: null };
const SORT_LABEL: Record<string, string> = {
  none: 'not sorted',
  asc: 'sorted ascending',
  desc: 'sorted descending',
};

/**
 * The filter row from the Figma frame, driving the column's text filter: the search box filters
 * by "contains", the select by "equals". The filter icon opens the column's full filter, and the
 * sort icon cycles ascending, descending and off. The rows are filtered and sorted by the
 * server-side datasource (signal-data.ts).
 */
@Component({
  selector: 'app-filter-row-cell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (kind() === 'select') {
      <span class="field">
        <select
          [attr.aria-label]="'Filter ' + columnName()"
          [class.has-value]="value() !== ''"
          (change)="onSelect($event)"
        >
          <option value="" [selected]="value() === ''">Select</option>
          @for (option of options(); track option) {
            <option [value]="option" [selected]="option === value()">{{ option }}</option>
          }
        </select>
        <svg class="chevron" viewBox="0 0 20 20" aria-hidden="true">
          <path d="m5 7.5 5 5 5-5" />
        </svg>
      </span>
    } @else {
      <span class="field">
        <svg class="search" viewBox="0 0 20 20" aria-hidden="true">
          <path
            d="m17.5 17.5-3.625-3.625m1.958-4.708a6.667 6.667 0 1 1-13.333 0 6.667 6.667 0 0 1 13.333 0Z"
          />
        </svg>
        <input
          type="search"
          placeholder="Search"
          [attr.aria-label]="'Search ' + columnName()"
          [value]="value()"
          (input)="onSearch($event)"
        />
      </span>
    }
    @if (kind() === 'search-sort') {
      <button
        type="button"
        class="icon-button"
        [class.active]="sort() !== 'none'"
        [attr.aria-label]="'Sort ' + columnName() + ', ' + sortLabel[sort()]"
        (click)="cycleSort()"
      >
        <svg viewBox="0 0 20 20" aria-hidden="true">
          @switch (sort()) {
            @case ('asc') {
              <path d="M10 15.833V4.167m0 0L4.167 10M10 4.167 15.833 10" />
            }
            @case ('desc') {
              <path d="M10 4.167v11.666m0 0L15.833 10M10 15.833 4.167 10" />
            }
            @default {
              <path
                d="M5.833 3.333v13.334m0 0L2.5 13.333m3.333 3.334 3.334-3.334m5-10v13.334m0-13.334L17.5 6.667m-3.333-3.334-3.334 3.334"
              />
            }
          }
        </svg>
      </button>
    } @else {
      <button
        type="button"
        class="icon-button"
        [class.active]="value() !== ''"
        [attr.aria-label]="'More filters for ' + columnName()"
        (click)="showParentFilter()"
      >
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M5 10h10M2.5 5h15m-10 10h5" />
        </svg>
      </button>
    }
  `,
  styles: `
    :host {
      display: flex;
      width: 100%;
      align-items: center;
      gap: 4px;
    }
    .field {
      position: relative;
      display: flex;
      flex: 1;
      min-width: 0;
      align-items: center;
    }
    input,
    select {
      width: 100%;
      min-width: 0;
      height: 36px;
      border: 1px solid var(--signal-border-strong);
      border-radius: 8px;
      background: var(--signal-surface);
      color: var(--signal-text);
      font: inherit;
      font-size: 14px;
    }
    input {
      padding: 0 8px 0 34px;
    }
    input::placeholder {
      color: var(--signal-text-placeholder);
    }
    select {
      appearance: none;
      padding: 0 32px 0 12px;
      color: var(--signal-text-placeholder);
    }
    select.has-value {
      color: var(--signal-text);
    }
    input:focus-visible,
    select:focus-visible,
    .icon-button:focus-visible {
      outline: 2px solid var(--signal-focus);
      outline-offset: 1px;
    }
    svg {
      width: 20px;
      height: 20px;
      flex-shrink: 0;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.67;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .search,
    .chevron {
      position: absolute;
      color: var(--signal-text-placeholder);
      pointer-events: none;
    }
    .search {
      left: 10px;
    }
    .chevron {
      right: 10px;
    }
    .icon-button {
      display: grid;
      flex-shrink: 0;
      place-content: center;
      width: 28px;
      height: 28px;
      padding: 0;
      border: 0;
      border-radius: 6px;
      background: transparent;
      color: var(--signal-icon);
      cursor: pointer;
    }
    .icon-button:hover {
      background: var(--signal-hover);
    }
    .icon-button.active {
      color: var(--signal-focus);
      background: var(--signal-inner-bg);
    }
  `,
})
export class FilterRowCell implements IFloatingFilterAngularComp, OnDestroy {
  protected readonly kind = signal<FilterRowCellKind>('search-filter');
  protected readonly columnName = signal('');
  protected readonly options = signal<readonly string[]>([]);
  protected readonly value = signal('');
  protected readonly sort = signal<'none' | 'asc' | 'desc'>('none');
  protected readonly sortLabel = SORT_LABEL;

  private params?: FilterRowCellParams;
  private debounce: ReturnType<typeof setTimeout> | undefined;

  agInit(params: FilterRowCellParams): void {
    this.params = params;
    this.kind.set(params.kind);
    this.options.set(params.options ?? []);
    this.columnName.set(params.column.getColDef().headerName ?? '');
    this.sort.set(params.column.getSort() ?? 'none');
    params.api.addEventListener('sortChanged', this.onSortChanged);
  }

  /** Mirrors a change made in the column's full filter (or a cleared one) into the row. */
  onParentModelChanged(model: TextFilterModel | null): void {
    this.value.set(model?.filter == null ? '' : String(model.filter));
  }

  protected onSearch(event: Event): void {
    const text = (event.target as HTMLInputElement).value;
    this.value.set(text);
    clearTimeout(this.debounce);
    this.debounce = setTimeout(() => this.applyFilter('contains', text), SEARCH_DEBOUNCE_MS);
  }

  protected onSelect(event: Event): void {
    const option = (event.target as HTMLSelectElement).value;
    this.value.set(option);
    this.applyFilter('equals', option);
  }

  protected showParentFilter(): void {
    this.params?.showParentFilter();
  }

  protected cycleSort(): void {
    const params = this.params;
    if (!params) return;
    params.api.applyColumnState({
      state: [{ colId: params.column.getColId(), sort: NEXT_SORT[this.sort()] }],
      defaultState: { sort: null },
    });
  }

  private applyFilter(type: 'contains' | 'equals', text: string): void {
    this.params?.parentFilterInstance((filter) => {
      const textFilter = filter as unknown as {
        onFloatingFilterChanged(type: string | null, value: string | null): void;
      };
      textFilter.onFloatingFilterChanged(type, text === '' ? null : text);
    });
  }

  private readonly onSortChanged = () => {
    this.sort.set(this.params?.column.getSort() ?? 'none');
  };

  ngOnDestroy(): void {
    clearTimeout(this.debounce);
    const api = this.params?.api;
    if (api && !api.isDestroyed()) api.removeEventListener('sortChanged', this.onSortChanged);
  }
}
