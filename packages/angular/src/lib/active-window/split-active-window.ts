import { signal, type Signal } from '@angular/core';
import type { SplitCloseGuard, SplitWindowRef } from '@split-window/core';

/**
 * Injected in the component (or template context) opened as a tab: close it, rename it and
 * follow its current container, which can change after creation.
 */
export class SplitActiveWindow<T = unknown> {
  private readonly _containerKey = signal<string | null>(null);
  private readonly _title = signal('');
  private readonly _label = signal('');
  private readonly _active = signal(false);

  /** Current container. A signal, because the tab can move after it was created. */
  readonly containerKey: Signal<string | null> = this._containerKey.asReadonly();
  readonly title: Signal<string> = this._title.asReadonly();
  /** Title with the number, as in the strip. */
  readonly label: Signal<string> = this._label.asReadonly();
  readonly isActive: Signal<boolean> = this._active.asReadonly();

  /** @internal Created by the engine for each tab. */
  constructor(readonly ref: SplitWindowRef<T>) {
    this.sync();
    ref.containerChanged.subscribe(() => this.sync());
    ref.titleChanged.subscribe(() => this.sync());
    ref.activated.subscribe(() => this._active.set(true));
    ref.deactivated.subscribe(() => this._active.set(false));
    ref.hidden.subscribe(() => this.sync());
  }

  close(result?: any, options?: { force?: boolean }): Promise<boolean> {
    return this.ref.close(result, options);
  }

  dismiss(reason?: any, options?: { force?: boolean }): Promise<boolean> {
    return this.ref.dismiss(reason, options);
  }

  setTitle(title: string): void {
    this.ref.setTitle(title);
  }

  setClosable(closable: boolean): void {
    this.ref.setClosable(closable);
  }

  setCanClose(guard: SplitCloseGuard | null): void {
    this.ref.setCanClose(guard);
  }

  /** @internal */
  sync(): void {
    this._containerKey.set(this.ref.containerKey);
    this._title.set(this.ref.title);
    this._label.set(this.ref.label);
    this._active.set(this.ref.isActive);
  }
}
