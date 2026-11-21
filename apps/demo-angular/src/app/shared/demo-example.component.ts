import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** A demo block: the live result next to the code used. */
@Component({
  selector: 'demo-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-example]': 'name()' },
  template: `
    <section class="example">
      <header>
        <h2>{{ heading() }}</h2>
        @if (description()) {
          <p>{{ description() }}</p>
        }
      </header>
      <div class="body">
        <div class="result"><ng-content /></div>
        <pre class="code"><code>{{ code() }}</code></pre>
      </div>
    </section>
  `,
  styles: `
    .example {
      border: 1px solid var(--demo-border);
      border-radius: 8px;
      padding: 16px;
      margin: 0 0 20px;
    }
    header p {
      margin: 0 0 12px;
      color: var(--demo-muted);
    }
    .body {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 16px;
    }
    @media (max-width: 1100px) {
      .body {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    .result {
      min-width: 0;
    }
    .code {
      margin: 0;
      padding: 12px;
      border-radius: 6px;
      background: var(--demo-code-bg);
      color: var(--demo-code-fg);
      font-size: 0.8rem;
      overflow: auto;
      max-height: 420px;
    }
  `,
})
export class DemoExampleComponent {
  readonly name = input.required<string>();
  readonly heading = input.required<string>();
  readonly description = input('');
  readonly code = input.required<string>();
}
