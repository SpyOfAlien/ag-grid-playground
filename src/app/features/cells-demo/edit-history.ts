import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { Entry } from '@cells';
import type { InventoryPersistence } from './inventory-persistence';
import type { Item } from './inventory.model';

/** Newest first: method, status, source cell and what each session entry changed. */
@Component({
  selector: 'app-edit-history',
  template: `
    <h2 id="history-title">Edit history</h2>
    <ol aria-label="Edit history" class="history">
      @for (item of recent(); track item.entry.id) {
        <li [class]="item.entry.status">
          {{ item.entry.command.method }} · {{ item.entry.status }}
          @if (item.entry.command.source; as source) {
            · {{ source.rowId }} {{ source.columnId }}
          }
          @if (item.entry.error) {
            · {{ item.entry.error }}
          }
          @if (item.changed) {
            · {{ item.changed }}
          }
        </li>
      }
    </ol>
  `,
  styles: `
    .history {
      margin: 0;
      padding-left: 20px;
      max-height: 200px;
      overflow: auto;
      font-size: 13px;
    }
    .failed {
      color: #b3261e;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditHistory {
  readonly entries = input.required<readonly Entry<Item, InventoryPersistence>[]>();

  protected readonly recent = computed(() =>
    [...this.entries()]
      .reverse()
      .slice(0, 20)
      .map((entry) => ({ entry, changed: describe(entry) })),
  );
}

/** The source row's changed values, or how many rows changed when there is no source row. */
function describe(entry: Entry<Item, InventoryPersistence>): string {
  const changes = entry.changes;
  if (!changes) return '';
  const source = entry.command.source;
  const own = source && changes.updated.find((row) => row.rowId === source.rowId);
  if (own)
    return Object.entries(own.fields)
      .map(([field, { before, after }]) => `${field} ${before} → ${after}`)
      .join(', ');
  const count = changes.updated.length + changes.added.length + changes.removed.length;
  return count ? `${count} ${count === 1 ? 'row' : 'rows'} changed` : '';
}
