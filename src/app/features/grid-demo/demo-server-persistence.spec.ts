import { ChangeDetectionStrategy, Component, DestroyRef, inject, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { OverlayContainer } from '@angular/cdk/overlay';
import {
  EditorHostService,
  type HostedEditor,
} from '../../shared/grid-cells/editing/editor-host/public-api';
import { provideDemoServerEditing } from './demo-editing-providers';
import { DemoServerPersistence } from './demo-server-persistence';
import { DemoTableState } from './demo-table-state';
import { DEMO_TABLE_PERSISTENCE } from './demo-persistence.model';
import { createDemoRows } from './demo-fixtures';
import { isDemoPayload, normalizeDemoResponse } from './api/demo-api.model';
import { DEMO_DATASET } from './api/demo-api-scenarios';

@Component({
  selector: 'test-persistence-editor',
  template: '<p>{{ data().label }}</p>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class DraftEditor implements HostedEditor<{ readonly label: string }> {
  readonly data = input.required<{ readonly label: string }>();
}

@Component({
  selector: 'test-persistence-owner',
  template: '<div class="owner"><button>Open editor</button></div>',
  providers: provideDemoServerEditing(),
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Owner {
  readonly persistence = inject(DEMO_TABLE_PERSISTENCE);
  readonly server = inject(DemoServerPersistence);
  readonly table = inject(DemoTableState);
  readonly host = inject(EditorHostService);
  readonly lifetime = inject(DestroyRef);
}

describe('DemoServerPersistence', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }),
  );
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  async function setup() {
    const fixture = TestBed.createComponent(Owner);
    await fixture.whenStable();
    const owner = fixture.componentInstance;
    const root = fixture.nativeElement.querySelector('.owner') as HTMLElement;
    document.body.append(root);
    owner.lifetime.onDestroy(() => root.remove());
    owner.table.reset(
      createDemoRows(2).map((row) => ({
        ...row,
        metadata: { ...row.metadata, reviewed: true },
      })),
    );
    const origin = { rowId: owner.table.rows()[0].id, columnId: 'name' };
    const http = TestBed.inject(HttpTestingController);
    const request = (endpoint = 'fields') =>
      vi.waitFor(() => http.expectOne((req) => req.url.endsWith(`/${endpoint}`)));
    const flush = (req: TestRequest, approve = false) => {
      const body: unknown = req.request.body;
      if (!isDemoPayload(body)) throw new Error('Invalid test payload.');
      req.flush(normalizeDemoResponse(body, approve, req.request.context.get(DEMO_DATASET)));
    };
    return { fixture, owner, origin, request, flush, http, trigger: root.querySelector('button')! };
  }

  it('maps scalar intent and query arrays, then commits the complete recalculated dataset', async () => {
    const { owner, origin, request, flush } = await setup();
    expect(owner.persistence).toBe(owner.server);
    const saved = owner.persistence.saveAmount({
      cell: { ...origin, columnId: 'metric-2' },
      data: { value: 12.345 },
      queryParams: { include: ['totals', 'status'], enabled: true },
    });
    expect(owner.persistence.pending()).toBe(1);
    const req = await request();
    expect(req.request.method).toBe('PATCH');
    expect(req.request.params.getAll('include')).toEqual(['totals', 'status']);
    expect(req.request.params.get('enabled')).toBe('true');
    flush(req);
    expect(await saved).toBeUndefined();
    expect(owner.table.rows()[0].metrics[2]).toBe(12.35);
    expect(owner.table.rows()[1].metrics.at(-1)).toBe(12.35);
    expect(owner.persistence.pending()).toBe(0);
    expect(owner.persistence.completion()).toEqual({
      kind: 'success',
      action: 'saveAmount',
      cell: { ...origin, columnId: 'metric-2' },
    });
  });

  it('maps a composite measurement to its own metric and recalculates its dependent row', async () => {
    const { owner, origin, request, flush } = await setup();
    const ordinaryAmount = owner.table.rows()[0].metrics[2];
    const saved = owner.persistence.saveAmount({
      cell: { ...origin, columnId: 'toggle-number' },
      data: { value: 42.125 },
    });
    const req = await request();
    flush(req);
    await saved;
    expect(owner.table.rows()[0].metrics[7]).toBe(42.13);
    expect(owner.table.rows()[0].metrics[2]).toBe(ordinaryAmount);
    expect(owner.table.rows()[1].metrics.at(-1)).toBe(42.13);
  });

  it('preserves zero and nullable amounts', async () => {
    const { owner, origin, request, flush } = await setup();
    for (const value of [0, null]) {
      const saved = owner.persistence.saveAmount({
        cell: { ...origin, columnId: 'metric-2' },
        data: { value },
      });
      flush(await request());
      await saved;
      expect(owner.table.rows()[0].metrics[2]).toBe(value);
    }
  });

  it('keeps details and approval payloads, methods, and revision parameters explicit', async () => {
    const { owner, origin, request, flush } = await setup();
    for (const approve of [false, true]) {
      const command = {
        cell: { ...origin, columnId: 'details' },
        data: { name: ' Updated ', notes: ' Notes ', amount: 20, revision: approve ? 1 : 0 },
        queryParams: { source: 'details', revision: 999 },
      };
      const saved = approve
        ? owner.persistence.approveDetails(command)
        : owner.persistence.saveDetails(command);
      const req = await request(approve ? 'approve' : 'details');
      expect(req.request.method).toBe(approve ? 'POST' : 'PATCH');
      expect(req.request.params.get('revision')).toBe(String(command.data.revision));
      expect(req.request.body.details).toEqual({ name: ' Updated ', notes: ' Notes ', amount: 20 });
      flush(req, approve);
      await saved;
      expect(owner.table.rows()[0].name).toBe('Updated');
      expect(owner.table.rows()[0].metadata.revision).toBe(approve ? 2 : 1);
    }
    expect(owner.table.rows()[0].metadata.unit).toBe('t');
  });

  it('serializes different actions and builds the next payload from newly committed row state', async () => {
    const { owner, origin, request, flush, http } = await setup();
    const name = owner.persistence.saveName({ cell: origin, data: { value: 'First commit' } });
    const amount = owner.persistence.saveAmount({
      cell: { ...origin, columnId: 'metric-2' },
      data: { value: 20 },
    });
    const first = await request();
    http.expectNone((req) => req.url.endsWith('/fields'));
    expect(owner.persistence.pending()).toBe(2);
    flush(first);
    await name;
    const second = await request();
    expect(second.request.body.row.name).toBe('First commit');
    expect(second.request.body.row.metadata.revision).toBe(1);
    flush(second);
    await amount;
    expect(owner.table.rows()[0].name).toBe('First commit');
    expect(owner.table.rows()[0].metrics[2]).toBe(20);
  });

  it('serializes edits across rows so each full response includes prior commits', async () => {
    const { owner, origin, request, flush, http } = await setup();
    const secondId = owner.table.rows()[1].id;
    const first = owner.persistence.saveName({ cell: origin, data: { value: 'First row' } });
    const second = owner.persistence.saveName({
      cell: { ...origin, rowId: secondId },
      data: { value: 'Second row' },
    });
    const req = await request();
    http.expectNone((req) => req.url.endsWith('/fields'));
    flush(req);
    await first;
    const next = await request();
    expect(next.request.context.get(DEMO_DATASET)[0].name).toBe('First row');
    flush(next);
    await second;
    expect(owner.table.rows().map((row) => row.name)).toEqual(['First row', 'Second row']);
  });

  for (const action of ['notes', 'unit'] as const) {
    it(`commits ${action} edits while preserving unrelated current fields`, async () => {
      const { owner, origin, request, flush } = await setup();
      const before = owner.table.rows()[0];
      const saved =
        action === 'notes'
          ? owner.persistence.saveNotes({
              cell: { ...origin, columnId: 'notes' },
              data: { value: ' Notes ' },
            })
          : owner.persistence.saveUnit({
              cell: { ...origin, columnId: 'unit-dropdown' },
              data: { value: 't' },
            });
      flush(await request());
      await saved;
      const updated = owner.table.rows()[0];
      expect(updated.name).toBe(before.name);
      expect(updated.metadata.revision).toBe(before.metadata.revision + 1);
      if (action === 'notes') expect(updated.notes).toBe('Notes');
      else expect(updated.metadata).toMatchObject({ unit: 't', reviewed: true });
    });
  }

  it('snapshots command identity, draft data, and query arrays at submission', async () => {
    const { owner, origin, request, flush } = await setup();
    const command = {
      cell: { ...origin },
      data: { value: 'Captured' },
      queryParams: { tag: ['one'] },
    };
    const saved = owner.persistence.saveName(command);
    command.cell.rowId = 'different';
    command.cell.columnId = 'invalid';
    command.data.value = 'Changed';
    command.queryParams.tag.push('two');
    const req = await request();
    expect(req.request.url).toContain(origin.rowId);
    expect(req.request.body.changes.name).toBe('Captured');
    expect(req.request.params.getAll('tag')).toEqual(['one']);
    flush(req);
    await saved;
  });

  it('authorizes queued actions against the current review state', async () => {
    const { owner, origin, request, flush, http } = await setup();
    const review = owner.persistence.saveReview({
      cell: { ...origin, columnId: 'review-toggle' },
      data: { value: false },
    });
    const name = owner.persistence.saveName({
      cell: origin,
      data: { value: 'Denied after review' },
    });
    const rejected = expect(name).rejects.toMatchObject({ code: 'denied' });
    flush(await request());
    await review;
    await rejected;
    http.expectNone((req) => req.url.endsWith('/fields'));
    expect(owner.table.rows()[0].metadata.reviewed).toBe(false);
    expect(owner.table.rows()[0].name).toBe('Material 00001');
  });

  it('rejects invalid identity, unavailable columns, stale revisions and invalid values without HTTP', async () => {
    const { owner, origin, http } = await setup();
    await expect(
      owner.persistence.saveName({ cell: { ...origin, rowId: '' }, data: { value: 'Name' } }),
    ).rejects.toMatchObject({ code: 'invalid-command' });
    await expect(
      owner.persistence.saveName({
        cell: { ...origin, rowId: 'missing' },
        data: { value: 'Name' },
      }),
    ).rejects.toMatchObject({ code: 'missing-row' });
    await expect(
      owner.persistence.saveName({
        cell: { ...origin, columnId: 'notes' },
        data: { value: 'Name' },
      }),
    ).rejects.toMatchObject({ code: 'denied' });
    await expect(
      owner.persistence.saveAmount({
        cell: { ...origin, columnId: 'metric-2' },
        data: { value: Infinity },
      }),
    ).rejects.toMatchObject({ code: 'invalid-command' });
    await expect(
      owner.persistence.saveDetails({
        cell: { ...origin, columnId: 'details' },
        data: { name: 'Details', notes: '', amount: 1, revision: 99 },
      }),
    ).rejects.toMatchObject({ code: 'revision-conflict' });
    http.expectNone((req) => req.url.startsWith('/api/cell-kit-demo/'));
    expect(owner.persistence.pending()).toBe(0);
  });

  it('preserves state on server failure, retains feedback, and permits the queued retry', async () => {
    const { owner, origin, request, flush } = await setup();
    const before = owner.table.rows();
    const failed = owner.persistence.saveName({ cell: origin, data: { value: 'Rejected' } });
    const rejected = expect(failed).rejects.toMatchObject({
      code: 'server-error',
      message: 'Denied by backend',
    });
    const retry = owner.persistence.saveName({ cell: origin, data: { value: 'Retry' } });
    (await request()).flush(
      { message: 'Denied by backend' },
      { status: 422, statusText: 'Unprocessable' },
    );
    await rejected;
    expect(owner.table.rows()).toBe(before);
    expect(owner.persistence.completion()).toMatchObject({ kind: 'failure', action: 'saveName' });
    flush(await request());
    await retry;
    expect(owner.table.rows()[0].name).toBe('Retry');
    expect(owner.persistence.completion()).toMatchObject({ kind: 'success' });
  });

  it('rejects obsolete in-flight and queued saves after reset without overwriting reused IDs', async () => {
    const { owner, origin, request, flush, http } = await setup();
    const first = owner.persistence.saveName({ cell: origin, data: { value: 'Old dataset' } });
    const queued = owner.persistence.saveName({
      cell: origin,
      data: { value: 'Queued old dataset' },
    });
    const firstRejected = expect(first).rejects.toMatchObject({ code: 'stale-dataset' });
    const queuedRejected = expect(queued).rejects.toMatchObject({ code: 'stale-dataset' });
    const req = await request();
    owner.table.reset(owner.table.rows().map((row) => ({ ...row, name: 'Reloaded dataset' })));
    flush(req);
    await firstRejected;
    await queuedRejected;
    http.expectNone((req) => req.url.endsWith('/fields'));
    expect(owner.table.rows().every((row) => row.name === 'Reloaded dataset')).toBe(true);
  });

  it('settles callers on feature destruction and ignores a later transport response', async () => {
    const { fixture, owner, origin, request, flush, http } = await setup();
    const before = owner.table.rows();
    const first = owner.persistence.saveName({ cell: origin, data: { value: 'Late response' } });
    const queued = owner.persistence.saveName({ cell: origin, data: { value: 'Queued response' } });
    const firstRejected = expect(first).rejects.toMatchObject({ code: 'feature-destroyed' });
    const queuedRejected = expect(queued).rejects.toMatchObject({ code: 'feature-destroyed' });
    const req = await request();
    fixture.destroy();
    await firstRejected;
    await queuedRejected;
    expect(owner.persistence.pending()).toBe(0);
    flush(req);
    await Promise.resolve();
    http.expectNone((req) => req.url.endsWith('/fields'));
    expect(owner.table.rows()).toBe(before);
    await expect(
      owner.persistence.saveName({ cell: origin, data: { value: 'Destroyed' } }),
    ).rejects.toMatchObject({ code: 'feature-destroyed' });
  });

  it('accepts replacement responses that delete the origin and empty the dataset', async () => {
    const { owner, origin, request } = await setup();
    const remaining = owner.table.rows()[1];
    const deleted = owner.persistence.saveName({ cell: origin, data: { value: 'Deleted origin' } });
    (await request()).flush({ update: { kind: 'replace-rows', rows: [remaining] } });
    await deleted;
    expect(owner.table.getRow(origin.rowId)).toBeUndefined();
    const emptied = owner.persistence.saveName({
      cell: { ...origin, rowId: remaining.id },
      data: { value: 'Empty' },
    });
    (await request()).flush({ update: { kind: 'replace-rows', rows: [] } });
    await emptied;
    expect(owner.table.rows()).toEqual([]);
  });

  it('accepts partial row sets and rejects duplicate IDs atomically', async () => {
    const { owner, origin, request } = await setup();
    const other = owner.table.rows()[1];
    const updated = { ...owner.table.rows()[0], name: 'Upserted' };
    const saved = owner.persistence.saveName({ cell: origin, data: { value: 'Upserted' } });
    (await request()).flush({ update: { kind: 'upsert-rows', rows: [updated] } });
    await saved;
    expect(owner.table.rows()).toEqual([updated, other]);
    const before = owner.table.rows();
    const invalid = owner.persistence.saveName({ cell: origin, data: { value: 'Duplicate' } });
    const rejected = expect(invalid).rejects.toMatchObject({ code: 'invalid-response' });
    (await request()).flush({ update: { kind: 'replace-rows', rows: [updated, updated] } });
    await rejected;
    expect(owner.table.rows()).toBe(before);
  });

  it('closes an unsubmitted draft on unrelated dataset reset', async () => {
    const { fixture, owner, trigger } = await setup();
    owner.host.open(
      { component: DraftEditor, data: { label: 'Old draft' } },
      { kind: 'popover' },
      { trigger },
    );
    const container = TestBed.inject(OverlayContainer).getContainerElement();
    expect(container.querySelector('.cdk-overlay-pane')).not.toBeNull();
    owner.table.reset(owner.table.rows());
    await fixture.whenStable();
    expect(container.querySelector('.cdk-overlay-pane')).toBeNull();
  });

  it('rejects single-row patch responses for authoritative server actions', async () => {
    const { owner, origin, request } = await setup();
    const before = owner.table.rows();
    const saved = owner.persistence.saveName({ cell: origin, data: { value: 'Wrong response' } });
    const rejected = expect(saved).rejects.toMatchObject({ code: 'invalid-response' });
    (await request()).flush({
      update: { kind: 'patch-row', rowId: origin.rowId, changes: { name: 'Wrong response' } },
    });
    await rejected;
    expect(owner.table.rows()).toBe(before);
  });

  it('keeps state and request queues independent between feature providers', async () => {
    const one = await setup();
    const two = await setup();
    expect(one.owner.persistence).not.toBe(two.owner.persistence);
    const first = one.owner.persistence.saveName({
      cell: one.origin,
      data: { value: 'Owner one' },
      queryParams: { owner: 'one' },
    });
    const second = two.owner.persistence.saveName({
      cell: two.origin,
      data: { value: 'Owner two' },
      queryParams: { owner: 'two' },
    });
    const reqOne = await vi.waitFor(() =>
      one.http.expectOne((req) => req.params.get('owner') === 'one'),
    );
    const reqTwo = await vi.waitFor(() =>
      two.http.expectOne((req) => req.params.get('owner') === 'two'),
    );
    one.flush(reqOne);
    await first;
    expect(two.owner.table.rows()[0].name).toBe('Material 00001');
    two.flush(reqTwo);
    await second;
    expect(one.owner.table.rows()[0].name).toBe('Owner one');
    expect(two.owner.table.rows()[0].name).toBe('Owner two');
  });

  it('commits a submitted save after its popup is dismissed', async () => {
    const { fixture, owner, origin, request, flush, trigger } = await setup();
    const ref = owner.host.open(
      { component: DraftEditor, data: { label: 'Draft' } },
      { kind: 'popover' },
      { trigger },
    )!;
    const saved = owner.persistence.saveName({
      cell: origin,
      data: { value: 'Saved after dismissal' },
    });
    const req = await request();
    ref.close();
    await fixture.whenStable();
    flush(req);
    await saved;
    expect(owner.table.rows()[0].name).toBe('Saved after dismissal');
    expect(owner.persistence.completion()).toMatchObject({ kind: 'success' });
  });

  it('keeps failure feedback after its popup is dismissed', async () => {
    const { fixture, owner, origin, request, trigger } = await setup();
    const ref = owner.host.open(
      { component: DraftEditor, data: { label: 'Draft' } },
      { kind: 'dialog' },
      { trigger },
    )!;
    const saved = owner.persistence.saveName({
      cell: origin,
      data: { value: 'Rejected after dismissal' },
    });
    const rejected = expect(saved).rejects.toThrow('Late failure');
    const req = await request();
    ref.close();
    await fixture.whenStable();
    req.flush({ message: 'Late failure' }, { status: 422, statusText: 'Unprocessable' });
    await rejected;
    expect(owner.persistence.completion()).toMatchObject({
      kind: 'failure',
      error: { message: 'Late failure' },
    });
  });
});
