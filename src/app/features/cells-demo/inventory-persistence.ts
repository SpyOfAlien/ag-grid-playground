import { Injectable, signal } from '@angular/core';
import type { EditPersistence, Result, SavePayload } from '@cells';
import { applyInventoryChanges, approveItems } from './inventory-rules';
import { seedItems, type Item } from './inventory.model';

export type PersistenceMode = 'client' | 'server';

export interface ApprovePayload {
  readonly skus: readonly string[];
}

/**
 * Client mode computes results locally; server mode stands in for an API with a delay, a
 * "fail next" switch and authoritative responses (approve reloads the full table).
 */
@Injectable()
export class InventoryPersistence implements EditPersistence<Item> {
  readonly mode = signal<PersistenceMode>('client');
  readonly delay = signal(600);
  readonly failNext = signal(false);

  private client = seedItems();
  private server = seedItems();

  async load(): Promise<Result<Item>> {
    if (this.mode() === 'client') return { replace: this.client };
    await this.respond(false);
    return { replace: this.server };
  }

  async save(payload: SavePayload<Item>): Promise<Result<Item>> {
    if (this.mode() === 'client') {
      const update = applyInventoryChanges(this.client, payload.changes);
      this.client = merge(this.client, update);
      return { update };
    }
    await this.respond();
    const update = applyInventoryChanges(this.server, payload.changes);
    this.server = merge(this.server, update);
    return { update };
  }

  async approve(payload: ApprovePayload): Promise<Result<Item>> {
    if (this.mode() === 'client') {
      this.client = approveItems(this.client, payload.skus);
      return { replace: this.client };
    }
    await this.respond();
    this.server = approveItems(this.server, payload.skus);
    return { replace: this.server };
  }

  /** Puts both data sets back to the seed. */
  reset(): void {
    this.client = seedItems();
    this.server = seedItems();
  }

  /** Waits like a network call; "fail next" only affects changes, not loads. */
  private async respond(change = true): Promise<void> {
    await new Promise((done) => setTimeout(done, this.delay()));
    if (change && this.failNext()) {
      this.failNext.set(false);
      throw new Error('The server rejected this change.');
    }
  }
}

function merge(rows: readonly Item[], update: readonly Item[]): Item[] {
  const changed = new Map(update.map((item) => [item.sku, item]));
  return rows.map((item) => changed.get(item.sku) ?? item);
}
