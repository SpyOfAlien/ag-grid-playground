import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ColumnLayoutStore } from './layout-api/column-layout-store';

/** What the fake API holds for the user, and the calls it answered. */
@Component({
  selector: 'app-layout-inspector',
  imports: [JsonPipe],
  template: `
    <section aria-labelledby="current-layout-title">
      <h2 id="current-layout-title">Saved layout: {{ layoutKey() }}</h2>
      @if (current(); as layout) {
        <pre class="json" tabindex="0" aria-label="Saved layout JSON">{{ layout | json }}</pre>
      } @else {
        <p class="empty">Nothing saved for this view yet.</p>
      }
    </section>

    <section aria-labelledby="store-title">
      <h2 id="store-title">Store for {{ user() }} ({{ keys().length }} layouts)</h2>
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
    .empty {
      color: #4f5b57;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LayoutInspector {
  protected readonly store = inject(ColumnLayoutStore);

  readonly user = input.required<string>();
  readonly layoutKey = input.required<string>();

  protected readonly layouts = computed(() => this.store.data()[this.user()] ?? {});
  protected readonly keys = computed(() => Object.keys(this.layouts()).sort());
  protected readonly current = computed(() => this.layouts()[this.layoutKey()]);
}
