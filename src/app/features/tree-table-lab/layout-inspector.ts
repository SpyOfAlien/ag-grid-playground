import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { SESSION_USER } from './layout-api/column-layout-api.interceptor';
import { ColumnLayoutStore } from './layout-api/column-layout-store';

/** What the fake API holds for the signed-in user, and the calls it answered. */
@Component({
  selector: 'app-layout-inspector',
  imports: [JsonPipe],
  template: `
    <label class="fail">
      <input
        #fail
        type="checkbox"
        [checked]="store.failLoads()"
        (change)="store.failLoads.set(fail.checked)"
      />
      Fail layout loads
    </label>
    <p class="hint">
      Each table loads its layouts once, the first time its tab opens. A failed load shows the
      defaults and is tried again on the next view switch.
    </p>

    <section aria-labelledby="current-layout-title">
      <h2 id="current-layout-title">Saved layout: {{ layoutKey() }}</h2>
      @if (current(); as layout) {
        <pre class="json" tabindex="0" aria-label="Saved layout JSON">{{ layout | json }}</pre>
      } @else {
        <p class="empty">Nothing saved for this view yet.</p>
      }
    </section>

    <section aria-labelledby="store-title">
      <h2 id="store-title">Store for {{ user }} ({{ keys().length }} layouts)</h2>
      <ul class="keys">
        @for (key of keys(); track key) {
          <li [class.active]="key === layoutKey()">{{ key }}</li>
        } @empty {
          <li class="empty">Empty</li>
        }
      </ul>
    </section>

    <section aria-labelledby="calls-title">
      <h2 id="calls-title">API calls</h2>
      <ol class="calls">
        @for (call of store.calls(); track call.id) {
          <li>
            <span class="method">{{ call.method }}</span> {{ call.url }}
            <span class="user">({{ call.user }})</span>
          </li>
        } @empty {
          <li class="empty">None yet</li>
        }
      </ol>
    </section>
  `,
  styles: `
    :host {
      display: grid;
      gap: 16px;
      align-content: start;
      font-size: 13px;
    }
    h2 {
      margin: 0 0 6px;
      font-size: 14px;
    }
    .json {
      max-height: 260px;
      margin: 0;
      overflow: auto;
      padding: 8px;
      border-radius: 4px;
      background: #fff;
      border: 1px solid #c9d3cf;
      font-size: 12px;
    }
    .keys,
    .calls {
      margin: 0;
      padding-left: 18px;
      max-height: 220px;
      overflow: auto;
    }
    .active {
      font-weight: 700;
    }
    .method {
      font-weight: 700;
    }
    .user,
    .empty,
    .hint {
      color: #4f5b57;
    }
    .fail {
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 600;
    }
    .hint {
      margin: -12px 0 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LayoutInspector {
  protected readonly store = inject(ColumnLayoutStore);

  readonly layoutKey = input.required<string>();

  protected readonly layouts = computed(() => this.store.data()[SESSION_USER] ?? {});
  protected readonly keys = computed(() => Object.keys(this.layouts()).sort());
  protected readonly current = computed(() => this.layouts()[this.layoutKey()]);

  protected readonly user = SESSION_USER;
}
