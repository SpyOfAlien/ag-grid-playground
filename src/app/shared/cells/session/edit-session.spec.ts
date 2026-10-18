import {
  createEnvironmentInjector,
  EnvironmentInjector,
  runInInjectionContext,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { createEditSession } from './edit-session';
import type { Command, EditPersistence, Result, SaveCommand } from './persistence';

interface Item {
  readonly sku: string;
  readonly qty: number;
}

const A1: Item = { sku: 'A-1', qty: 5 };
const B2: Item = { sku: 'B-2', qty: 0 };

class FakePersistence implements EditPersistence<Item> {
  loadResult: Result<Item> = { replace: [A1, B2] };

  load(_command?: Command): Promise<Result<Item>> {
    return Promise.resolve(this.loadResult);
  }

  saveResult: () => Promise<Result<Item>> = () => Promise.reject(new Error('not configured'));

  save(_command: SaveCommand<Item>): Promise<Result<Item>> {
    return this.saveResult();
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => (resolve = done));
  return { promise, resolve };
}

function session(persistence = new FakePersistence()) {
  return TestBed.runInInjectionContext(() =>
    createEditSession(persistence, (item: Item) => item.sku),
  );
}

describe('EditSession', () => {
  it('makes a successful load the current rows', async () => {
    const edits = session();
    expect(edits.rows()).toEqual([]);

    await edits.run('load', {});

    expect(edits.rows()).toEqual([A1, B2]);
    expect(edits.current()?.status).toBe('saved');
  });

  it('merges an update into the current rows and keeps the rest in order', async () => {
    const persistence = new FakePersistence();
    const edits = session(persistence);
    await edits.run('load', {});
    const changed = { sku: 'A-1', qty: 9 };
    persistence.saveResult = () => Promise.resolve({ update: [changed] });

    await edits.run('save', { changes: [{ rowId: 'A-1', field: 'qty', value: 9 }] });

    expect(edits.rows()).toEqual([changed, B2]);
    expect(edits.rows()[1]).toBe(B2);
  });

  it('records which fields of which rows a result changed, against the last good rows', async () => {
    const persistence = new FakePersistence();
    const edits = session(persistence);
    await edits.run('load', {});
    persistence.saveResult = () => Promise.reject(new Error('Server rejected'));
    await edits.run('save', { changes: [] }).catch(() => undefined);
    persistence.saveResult = () =>
      Promise.resolve({
        update: [
          { sku: 'A-1', qty: 9 },
          { sku: 'B-2', qty: 0 },
        ],
      });

    await edits.run('save', { changes: [{ rowId: 'A-1', field: 'qty', value: 9 }] });

    expect(edits.entries()[1].changes).toBeUndefined();
    expect(edits.current()?.changes).toEqual({
      updated: [{ rowId: 'A-1', fields: { qty: { before: 5, after: 9 } } }],
      added: [],
      removed: [],
    });
  });

  it('records added and removed rows on a reload and skips rows whose fields are all equal', async () => {
    const persistence = new FakePersistence();
    const edits = session(persistence);
    await edits.run('load', {});
    persistence.loadResult = {
      replace: [
        { sku: 'B-2', qty: 0 },
        { sku: 'C-3', qty: 1 },
      ],
    };

    await edits.run('load', {});

    expect(edits.current()?.changes).toEqual({
      updated: [],
      added: [{ rowId: 'C-3', row: { sku: 'C-3', qty: 1 } }],
      removed: [{ rowId: 'A-1', row: A1 }],
    });
  });

  it('keeps the last good rows when a save fails and records why', async () => {
    const persistence = new FakePersistence();
    const edits = session(persistence);
    await edits.run('load', {});
    persistence.saveResult = () => Promise.reject(new Error('Server rejected'));

    await expect(
      edits.run('save', { changes: [{ rowId: 'A-1', field: 'qty', value: 9 }] }),
    ).rejects.toThrow('Server rejected');

    expect(edits.rows()).toEqual([A1, B2]);
    const last = edits.entries().at(-1);
    expect(last?.status).toBe('failed');
    expect(last?.error).toBe('Server rejected');
    expect(last?.changes).toBeUndefined();
  });

  it('links each entry to the one before it, failed or not', async () => {
    const persistence = new FakePersistence();
    const edits = session(persistence);
    await edits.run('load', {});
    persistence.saveResult = () => Promise.reject(new Error('Server rejected'));
    await edits.run('save', { changes: [] }).catch(() => undefined);
    persistence.saveResult = () => Promise.resolve({ update: [] });
    await edits.run('save', { changes: [] });

    const [load, failed, saved] = edits.entries();
    expect([load.previousId, failed.previousId, saved.previousId]).toEqual([
      null,
      load.id,
      failed.id,
    ]);
    expect(edits.current()).toBe(saved);
  });

  it('runs one command at a time and refuses another while busy', async () => {
    const persistence = new FakePersistence();
    const edits = session(persistence);
    await edits.run('load', {});
    const pending = deferred<Result<Item>>();
    let calls = 0;
    persistence.saveResult = () => {
      calls++;
      return pending.promise;
    };

    const first = edits.run('save', { changes: [] });
    expect(edits.busy()).toBe(true);
    expect(edits.disabledReason()).toBe('Saving…');
    await expect(edits.run('save', { changes: [] })).rejects.toThrow('Saving…');
    expect(calls).toBe(1);

    pending.resolve({ update: [] });
    await first;
    expect(edits.busy()).toBe(false);
    expect(edits.disabledReason()).toBeNull();
  });

  it('refuses commands while locked and reports the lock reason first', async () => {
    const persistence = new FakePersistence();
    const edits = session(persistence);
    const pending = deferred<Result<Item>>();
    persistence.loadResult = { replace: [A1] };
    const load = edits.run('load', {});

    edits.lock('Table is read-only');
    expect(edits.lockReason()).toBe('Table is read-only');
    expect(edits.disabledReason()).toBe('Table is read-only');
    await load;
    await expect(edits.run('load', {})).rejects.toThrow('Table is read-only');

    edits.unlock();
    expect(edits.lockReason()).toBeNull();
    persistence.saveResult = () => pending.promise;
    const save = edits.run('save', { changes: [] });
    expect(edits.disabledReason()).toBe('Saving…');
    pending.resolve({ update: [] });
    await save;
  });

  it('runs nothing once its owner is destroyed', async () => {
    const persistence = new FakePersistence();
    let calls = 0;
    persistence.load = () => {
      calls++;
      return Promise.resolve({ replace: [] });
    };
    const owner = createEnvironmentInjector([], TestBed.inject(EnvironmentInjector));
    const edits = runInInjectionContext(owner, () =>
      createEditSession(persistence, (item: Item) => item.sku),
    );

    owner.destroy();

    await expect(edits.run('load', {})).rejects.toThrow('The grid is gone.');
    expect(calls).toBe(0);
  });

  it('drops a result that arrives after its owner is destroyed', async () => {
    const persistence = new FakePersistence();
    const pending = deferred<Result<Item>>();
    persistence.load = () => pending.promise;
    const owner = createEnvironmentInjector([], TestBed.inject(EnvironmentInjector));
    const edits = runInInjectionContext(owner, () =>
      createEditSession(persistence, (item: Item) => item.sku),
    );

    const load = edits.run('load', {});
    owner.destroy();
    pending.resolve({ replace: [A1] });

    await expect(load).rejects.toThrow('The grid is gone.');
    expect(edits.rows()).toEqual([]);
  });

  it('routes a custom method with its own command', async () => {
    class ApprovingPersistence extends FakePersistence {
      received: readonly string[] = [];
      approve(command: Command & { readonly skus: readonly string[] }): Promise<Result<Item>> {
        this.received = command.skus;
        return Promise.resolve({ replace: [B2] });
      }
    }
    const persistence = new ApprovingPersistence();
    const edits = TestBed.runInInjectionContext(() =>
      createEditSession(persistence, (item: Item) => item.sku),
    );

    await edits.run('approve', { skus: ['B-2'], params: { source: 'toolbar' } });

    expect(persistence.received).toEqual(['B-2']);
    expect(edits.rows()).toEqual([B2]);
    expect(edits.current()?.method).toBe('approve');
  });
});
