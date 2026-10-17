import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { Entry } from '@cells';
import type { InventoryPersistence } from './inventory-persistence';
import type { Item } from './inventory.model';

/** Newest first: method, status and source cell of each session entry. */
@Component({
  selector: 'app-edit-history',
  template: `
    <h2 id="history-title">Edit history</h2>
    <ol aria-label="Edit history" class="history">
      @for (entry of recent(); track entry.id) {
        <li [class]="entry.status">
          {{ entry.method }} · {{ entry.status }}
          @if (entry.command?.source; as source) {
            · {{ source.rowId }} {{ source.columnId }}
          }
          @if (entry.error) {
            · {{ entry.error }}
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

  protected readonly recent = computed(() => [...this.entries()].reverse().slice(0, 20));
}
