import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ColumnLayoutService } from './column-layout.service';
import { LAYOUT_API } from './layout-api/column-layout-api.interceptor';
import type { SavedColumn } from './tree-table.model';

const KEY = 'inbound:daysOnHand';
const URL = `${LAYOUT_API}/${encodeURIComponent(KEY)}`;
const layout = (hide: boolean): SavedColumn[] => [{ colId: 'safetyStock', hide }];

describe('ColumnLayoutService', () => {
  let service: ColumnLayoutService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ColumnLayoutService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    vi.useRealTimers();
    http.verify();
  });

  /** Loads a table and answers the GET with `body`, or with an error. */
  function load(body: Record<string, SavedColumn[]> | 'fail') {
    const loaded = vi.fn();
    service.load('inbound').subscribe(loaded);
    const request = http.expectOne(`${LAYOUT_API}/inbound`);
    if (body === 'fail') request.flush(null, { status: 503, statusText: 'Unavailable' });
    else request.flush(body);
    return loaded;
  }

  it('sends no user: the server takes it from the session', () => {
    service.load('inbound').subscribe();
    const request = http.expectOne(`${LAYOUT_API}/inbound`);
    expect(request.request.headers.keys()).toEqual([]);
    request.flush({});
  });

  it('loads a table once and caches its layouts', () => {
    expect(load({ [KEY]: layout(false) })).toHaveBeenCalledWith(true);
    expect(service.get(KEY)).toEqual(layout(false));

    const again = vi.fn();
    service.load('inbound').subscribe(again);
    expect(again).toHaveBeenCalledWith(true);
  });

  it('emits false when the load fails, leaves nothing cached and tries again next time', () => {
    expect(load('fail')).toHaveBeenCalledWith(false);
    expect(service.get(KEY)).toBeUndefined();

    expect(load({ [KEY]: layout(false) })).toHaveBeenCalledWith(true);
    expect(service.get(KEY)).toEqual(layout(false));
  });

  it('keeps a change still waiting to be sent over the server copy', () => {
    vi.useFakeTimers();
    service.queueSave(KEY, layout(true));
    load({ [KEY]: layout(false) });
    expect(service.get(KEY)).toEqual(layout(true));

    vi.advanceTimersByTime(500);
    http.expectOne({ method: 'PUT', url: URL }).flush(null);
  });

  it('sends a change once the user stops changing columns', () => {
    vi.useFakeTimers();
    service.queueSave(KEY, layout(true));
    service.queueSave(KEY, layout(false));
    vi.advanceTimersByTime(499);
    http.expectNone(URL);

    vi.advanceTimersByTime(1);
    const request = http.expectOne({ method: 'PUT', url: URL });
    expect(request.request.body).toEqual(layout(false));
    expect(request.request.keepalive).toBe(false);
    request.flush(null);
  });

  it('sends a waiting change with keepalive as the page closes, and only once', () => {
    vi.useFakeTimers();
    service.queueSave(KEY, layout(true));
    window.dispatchEvent(new Event('pagehide'));

    const request = http.expectOne({ method: 'PUT', url: URL });
    expect(request.request.body).toEqual(layout(true));
    expect(request.request.keepalive).toBe(true);
    request.flush(null);

    vi.advanceTimersByTime(500);
    http.expectNone(URL);
  });

  it('reset drops the cached layout and a waiting change, then deletes it', () => {
    vi.useFakeTimers();
    service.queueSave(KEY, layout(true));
    service.reset(KEY).subscribe();
    expect(service.get(KEY)).toBeUndefined();

    http.expectOne({ method: 'DELETE', url: URL }).flush(null);
    vi.advanceTimersByTime(500);
    http.expectNone({ method: 'PUT', url: URL });
  });
});
