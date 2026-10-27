import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DOCUMENT,
  ElementRef,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';

/** One column group as the menu lists it: outline order, nesting depth and open state. */
export interface EquipmentGroupSwitch {
  code: string;
  name: string;
  depth: number;
  open: boolean;
}

/** One leaf column as the menu lists it, in grid order, with the group it sits in. */
export interface EquipmentColumnCheckbox {
  code: string;
  name: string;
  groupName: string | null;
  visible: boolean;
}

// Tailwind classes, written out in full so Tailwind can find them when scanning.
// Tokens (--color-*, --radius-*) come from equipment-column-groups.css.
const TRIGGER =
  'inline-flex min-h-8 items-center gap-1.5 whitespace-nowrap rounded-[var(--radius-md)] border-1 border-solid border-[var(--color-border-primary)] bg-[var(--color-bg-primary)] px-3 py-1 [font-family:inherit] text-[12px] leading-[18px] font-semibold text-[var(--color-gray-800)] cursor-pointer hover:bg-[var(--color-gray-50)] aria-expanded:bg-[var(--color-gray-50)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600';
const SECTION =
  'flex flex-col gap-0.5 border-0 border-t-1 border-solid border-[var(--color-border-secondary)] p-1 first:border-t-0';
const SECTION_TITLE =
  'flex min-h-7 items-center justify-between gap-3 px-2 text-[12px] leading-[18px] font-semibold text-[var(--color-gray-700)]';
const ITEM =
  'flex min-h-8 w-full items-center gap-2 rounded-[var(--radius-sm)] border-0 bg-transparent px-2 py-1 text-left [font-family:inherit] text-[13px] leading-[18px] text-[var(--color-gray-800)] cursor-pointer enabled:hover:bg-[var(--color-gray-50)] disabled:cursor-not-allowed disabled:text-[var(--color-gray-400)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-600';
const ROW = `${ITEM} hover:bg-[var(--color-gray-50)]`;
const SWITCH =
  'peer m-0 h-4 w-7 cursor-pointer appearance-none rounded-full bg-[var(--color-gray-500)] transition-colors checked:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600';
const KNOB =
  'pointer-events-none absolute top-0.5 left-0.5 size-3 rounded-full bg-[var(--color-bg-primary)] transition-transform peer-checked:translate-x-3';
const CHECKBOX =
  'm-0 size-4 flex-none cursor-pointer accent-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600';
const SEARCH =
  'box-border h-8 w-full rounded-[var(--radius-sm)] border-1 border-solid border-[var(--color-border-primary)] bg-[var(--color-bg-primary)] px-2 [font-family:inherit] text-[13px] text-[var(--color-gray-800)] placeholder:text-[var(--color-gray-700)] focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-brand-600';
const SEGMENTS =
  'mx-1 mb-1 flex overflow-hidden rounded-[var(--radius-sm)] border-1 border-solid border-[var(--color-border-primary)]';
const SEGMENT =
  'relative flex min-h-8 min-w-0 flex-1 basis-0 cursor-pointer items-center justify-center gap-1 border-0 border-solid border-[var(--color-border-primary)] px-1 text-[12px] leading-[18px] font-semibold whitespace-nowrap text-[var(--color-gray-800)] not-first:border-l-1 hover:bg-[var(--color-gray-50)] has-checked:bg-brand-primary-alt has-checked:text-brand-700 has-focus-visible:outline-2 has-focus-visible:-outline-offset-2 has-focus-visible:outline-brand-600';
// Invisible but still focusable, clickable across the segment, and announced; the label
// shows its state and focus ring.
const SEGMENT_RADIO = 'absolute inset-0 m-0 cursor-pointer opacity-0';
const ICON =
  'size-4 flex-none fill-none stroke-current stroke-2 [stroke-linecap:round] [stroke-linejoin:round]';

/** Column group views: every group open, every group collapsed, or groups set one at a time. */
export type EquipmentGroupMode = 'expanded' | 'collapsed' | 'custom';

const GROUP_MODES: readonly { mode: EquipmentGroupMode; label: string; icon: string }[] = [
  { mode: 'expanded', label: 'Expand all', icon: 'M9 7l-5 5 5 5M15 7l5 5-5 5' },
  {
    mode: 'collapsed',
    label: 'Collapse all',
    icon: 'M4 7l5 5-5 5M20 7l-5 5 5 5',
  },
  { mode: 'custom', label: 'Custom', icon: 'M4 6h16M4 12h16M4 18h16M8 4v4M16 10v4M10 16v4' },
];

// Element ids carry an instance number, so ids stay unique if the menu renders more than once.
let nextMenuId = 0;

/**
 * "Columns" disclosure in the equipment toolbar, holding every column control by category:
 * managing columns and the filter row, column groups (adding one, then Expand all, Collapse
 * all, or Custom with one switch per group, indented by nesting) and showing and hiding
 * columns (searchable checkboxes). A nested group keeps its own state while its parent is
 * collapsed and shows it again when the parent opens. Setting column, Add Column and Add
 * Column Group are placeholders until those features exist.
 */
@Component({
  selector: 'app-equipment-columns-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'relative inline-flex',
    '(keydown.escape)': 'close(true)',
    '(focusout)': 'closeWhenFocusLeaves($event)',
    '(document:pointerdown)': 'closeOnOutsidePointer($event)',
  },
  template: `
    <button
      #trigger
      type="button"
      class="${TRIGGER}"
      [attr.aria-controls]="id"
      [attr.aria-expanded]="open()"
      (click)="toggle()"
    >
      <svg class="${ICON}" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 5h16v14H4zM10 5v14M15 5v14" />
      </svg>
      Columns
      <svg class="${ICON}" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
    </button>
    @if (open()) {
      <div
        role="group"
        aria-label="Columns"
        class="absolute right-0 z-20 flex max-h-[min(36rem,75vh)] w-80 flex-col overflow-y-auto rounded-[var(--radius-md)] border-1 border-solid border-[var(--color-border-secondary)] bg-[var(--color-bg-primary)] shadow-lg"
        [class.top-full]="placement() === 'below'"
        [class.mt-1]="placement() === 'below'"
        [class.bottom-full]="placement() === 'above'"
        [class.mb-1]="placement() === 'above'"
        [id]="id"
      >
        <div role="group" class="${SECTION}" [attr.aria-labelledby]="id + '-manage'">
          <span class="${SECTION_TITLE}" [id]="id + '-manage'">Manage</span>
          <button type="button" class="${ITEM}" disabled>
            <svg class="${ICON}" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" />
              <circle cx="15" cy="6" r="2" />
              <circle cx="9" cy="12" r="2" />
              <circle cx="17" cy="18" r="2" />
            </svg>
            Setting column
          </button>
          <button type="button" class="${ITEM}" disabled>
            <svg class="${ICON}" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add Column
          </button>
          <label class="${ROW} justify-between">
            <span class="flex items-center gap-2">
              <svg class="${ICON}" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 5h16l-6 7v6l-4 2v-8z" />
              </svg>
              Hide Filter/Search
            </span>
            <span class="relative inline-flex flex-none">
              <input
                #filterSwitch
                type="checkbox"
                role="switch"
                class="${SWITCH}"
                [checked]="filtersHidden()"
                (change)="filtersHidden.set(filterSwitch.checked)"
              />
              <span class="${KNOB}" aria-hidden="true"></span>
            </span>
          </label>
        </div>
        <div role="group" class="${SECTION}" [attr.aria-labelledby]="id + '-groups'">
          <span class="${SECTION_TITLE}" [id]="id + '-groups'">Column groups</span>
          <div role="radiogroup" aria-label="Column group view" class="${SEGMENTS}">
            @for (option of groupModes; track option.mode) {
              <label class="${SEGMENT}">
                <input
                  type="radio"
                  class="${SEGMENT_RADIO}"
                  [name]="id + '-mode'"
                  [checked]="groupMode() === option.mode"
                  (change)="groupModeSet.emit(option.mode)"
                />
                <svg class="${ICON}" viewBox="0 0 24 24" aria-hidden="true">
                  <path [attr.d]="option.icon" />
                </svg>
                {{ option.label }}
              </label>
            }
          </div>
          <button type="button" class="${ITEM}" disabled>
            <svg class="${ICON}" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 5h11v14H3zM8.5 5v14M18 9v6M15 12h6" />
            </svg>
            Add Column Group
          </button>
          <!-- Custom opens groups one at a time; the other views set every group at once. -->
          @if (groupMode() === 'custom') {
            <ul class="m-0 list-none p-0">
              @for (group of groups(); track group.code) {
                <li>
                  <!-- Indent by margin: Tailwind utilities are !important and would beat padding. -->
                  <label class="${ROW} justify-between">
                    <span class="min-w-0 truncate" [style.margin-left.px]="group.depth * 16">
                      {{ group.name }}
                    </span>
                    <span class="relative inline-flex flex-none">
                      <input
                        type="checkbox"
                        role="switch"
                        class="${SWITCH}"
                        [checked]="group.open"
                        (change)="groupSet.emit({ code: group.code, open: !group.open })"
                      />
                      <span class="${KNOB}" aria-hidden="true"></span>
                    </span>
                  </label>
                </li>
              }
            </ul>
          }
        </div>
        <div role="group" class="${SECTION}" [attr.aria-labelledby]="id + '-columns'">
          <div class="${SECTION_TITLE}">
            <span [id]="id + '-columns'">Show columns</span>
            <span class="font-normal">{{ visibleCount() }} of {{ columns().length }} shown</span>
          </div>
          <div class="px-1 pb-1">
            <input
              #search
              type="search"
              class="${SEARCH}"
              aria-label="Search columns"
              placeholder="Search columns"
              [value]="query()"
              (input)="query.set(search.value)"
            />
          </div>
          <ul class="m-0 max-h-60 list-none overflow-y-auto p-0">
            @for (column of matchingColumns(); track column.code) {
              <li>
                <label class="${ROW}">
                  <input
                    type="checkbox"
                    class="${CHECKBOX}"
                    [checked]="column.visible"
                    (change)="columnSet.emit({ code: column.code, visible: !column.visible })"
                  />
                  <span class="min-w-0 flex-1 truncate">{{ column.name }}</span>
                  @if (column.groupName) {
                    <span
                      class="max-w-[45%] flex-none truncate text-[12px] text-[var(--color-gray-700)]"
                    >
                      {{ column.groupName }}
                    </span>
                  }
                </label>
              </li>
            } @empty {
              <li class="px-2 py-1.5 text-[13px] text-[var(--color-gray-700)]">
                No columns match "{{ query() }}".
              </li>
            }
          </ul>
        </div>
      </div>
    }
  `,
})
export class EquipmentColumnsMenu {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly document = inject(DOCUMENT);

  readonly groups = input.required<readonly EquipmentGroupSwitch[]>();
  readonly columns = input.required<readonly EquipmentColumnCheckbox[]>();
  readonly groupMode = input.required<EquipmentGroupMode>();
  readonly filtersHidden = model(false);
  readonly groupModeSet = output<EquipmentGroupMode>();
  readonly groupSet = output<{ code: string; open: boolean }>();
  readonly columnSet = output<{ code: string; visible: boolean }>();

  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');

  protected readonly open = signal(false);
  /** Side of the button the panel opens on, picked each time it opens. */
  protected readonly placement = signal<'below' | 'above'>('below');
  protected readonly query = signal('');

  protected readonly visibleCount = computed(
    () => this.columns().filter((column) => column.visible).length,
  );
  /** Columns whose name or group contains the search text, ignoring case. */
  protected readonly matchingColumns = computed(() => {
    const query = this.query().trim().toLowerCase();
    return query
      ? this.columns().filter((column) =>
          `${column.name} ${column.groupName ?? ''}`.toLowerCase().includes(query),
        )
      : this.columns();
  });

  protected readonly id = `equipment-columns-menu-${nextMenuId++}`;
  protected readonly groupModes = GROUP_MODES;

  /**
   * Opens below the button unless the panel would not fit there (its max height is
   * min(36rem, 75vh)) and there is more room above, as for the toolbar far below the table.
   */
  protected toggle(): void {
    if (this.open()) {
      this.close();
      return;
    }
    const viewportHeight = this.document.defaultView?.innerHeight ?? 0;
    const { top, bottom } = this.trigger().nativeElement.getBoundingClientRect();
    const spaceBelow = viewportHeight - bottom;
    const panelHeight = Math.min(576, viewportHeight * 0.75);
    this.placement.set(spaceBelow < panelHeight && top > spaceBelow ? 'above' : 'below');
    this.open.set(true);
  }

  protected close(returnFocus = false): void {
    if (!this.open()) {
      return;
    }
    this.open.set(false);
    if (returnFocus) {
      this.trigger().nativeElement.focus();
    }
  }

  protected closeWhenFocusLeaves(event: FocusEvent): void {
    const next = event.relatedTarget;
    if (next instanceof Node && !this.host.nativeElement.contains(next)) {
      this.close();
    }
  }

  protected closeOnOutsidePointer(event: PointerEvent): void {
    if (event.target instanceof Node && !this.host.nativeElement.contains(event.target)) {
      this.close();
    }
  }
}
