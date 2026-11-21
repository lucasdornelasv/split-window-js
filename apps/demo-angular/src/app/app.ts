import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { DEMO_PAGES } from './app.routes';

@Component({
  selector: 'demo-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="layout">
      <nav class="nav" aria-label="Telas de demonstração">
        <strong class="brand">SplitWindow</strong>
        @for (page of pages; track page.path) {
          <a
            [routerLink]="'/' + page.path"
            routerLinkActive="active"
            [attr.data-page]="page.path"
            >{{ page.title }}</a
          >
        }
      </nav>
      <main class="main">
        <router-outlet />
      </main>
    </div>
  `,
  styles: `
    .layout {
      display: grid;
      grid-template-columns: 200px 1fr;
      min-height: 100vh;
    }
    .nav {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 16px 8px;
      border-right: 1px solid var(--demo-border);
      background: var(--demo-surface);
    }
    .brand {
      padding: 0 8px 12px;
      font-size: 1.1rem;
    }
    .nav a {
      padding: 6px 8px;
      border-radius: 6px;
      color: var(--demo-fg);
      text-decoration: none;
    }
    .nav a.active {
      background: var(--demo-accent);
      color: #fff;
    }
    .main {
      padding: 24px;
      min-width: 0;
      /* keeps room for the body-right container */
      padding-right: 24px;
    }
  `,
})
export class App {
  readonly pages = DEMO_PAGES;
}
