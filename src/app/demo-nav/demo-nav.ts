import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Route, Router, RouterLink, RouterLinkActive } from '@angular/router';

export interface DemoLink {
  readonly path: string;
  readonly title: string;
}

/** One link per route with a plain-text title, so a new demo shows up once it is routed. */
export function demoLinks(routes: readonly Route[]): DemoLink[] {
  return routes.flatMap(({ path, title }) =>
    path && typeof title === 'string' ? [{ path: `/${path}`, title }] : [],
  );
}

/**
 * Lists every demo in a thin strip at the left edge that opens over the page on hover or
 * keyboard focus. The strip starts below the top-left corner, so a pointer parked there
 * (as the e2e specs do with `mouse.move(0, 0)`) doesn't open it over the page.
 */
@Component({
  selector: 'app-demo-nav',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <span class="strip" aria-hidden="true"></span>
    <nav class="panel" aria-labelledby="demo-nav-label">
      <p class="label" id="demo-nav-label">Demos</p>
      <ul>
        @for (link of links; track link.path) {
          <li>
            <a [routerLink]="link.path" routerLinkActive="active" ariaCurrentWhenActive="page">
              {{ link.title }}
            </a>
          </li>
        }
      </ul>
    </nav>
  `,
  styles: `
    :host {
      position: fixed;
      top: 3rem;
      bottom: 0;
      left: 0;
      z-index: 900;
      width: 0.5rem;
    }

    .strip {
      position: absolute;
      inset: 0 auto 0 0;
      width: 4px;
      border-radius: 0 4px 4px 0;
      background: #8fb8b0;
    }

    .panel {
      position: fixed;
      inset: 0 auto 0 0;
      width: min(16rem, calc(100vw - 2rem));
      overflow-y: auto;
      padding: 1rem 0.75rem;
      border-right: 1px solid #cfdcd7;
      background: #fff;
      color: #24342f;
      transform: translateX(-100%);
      transition:
        transform 150ms ease,
        box-shadow 150ms ease;
    }

    /* Focus opens it only when it is visible, so a mouse click doesn't keep it open. */
    :host(:hover) .panel,
    :host(:has(:focus-visible)) .panel {
      transform: none;
      box-shadow: 4px 0 24px rgb(0 0 0 / 18%);
    }

    .label {
      margin: 0 0 0.5rem;
      padding: 0 0.75rem;
      color: #4d625b;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    ul {
      display: grid;
      gap: 2px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    a {
      display: block;
      padding: 0.5rem 0.75rem;
      border-radius: 6px;
      color: inherit;
      font-size: 14px;
      line-height: 1.3;
      text-decoration: none;
    }

    a:hover {
      background: #eef4f2;
    }

    a:focus-visible {
      outline: 2px solid #17675b;
      outline-offset: -2px;
    }

    a.active {
      background: #dcebe7;
      box-shadow: inset 3px 0 #17675b;
      color: #0f4f45;
      font-weight: 700;
    }

    @media (prefers-reduced-motion: reduce) {
      .panel {
        transition: none;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DemoNav {
  protected readonly links = demoLinks(inject(Router).config);
}
