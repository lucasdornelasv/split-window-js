import {
  Directive,
  ElementRef,
  booleanAttribute,
  inject,
  input,
  type OnChanges,
  type OnDestroy,
  type OnInit,
  type SimpleChanges,
} from '@angular/core';
import { SplitContainerRegistry } from '../registry/split-container-registry';
import type { SplitContainerOptions } from '../types';

/**
 * Registers the host element as a container. Registers in `ngOnInit` (so an `open()` in the
 * `ngOnInit` of a later component already finds it) and unregisters on destroy, which
 * dismisses its tabs with `'container-removed'`.
 *
 * ```html
 * <div splitContainer="right" [splitContainerDefault]="true" [splitContainerOptions]="{ maxTabs: 5 }"></div>
 * ```
 */
@Directive({
  selector: '[splitContainer]',
  exportAs: 'splitContainer',
})
export class SplitContainerDirective implements OnInit, OnChanges, OnDestroy {
  private readonly registry = inject(SplitContainerRegistry);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Container key. Changing it unregisters the old key and registers the new one. */
  readonly splitContainer = input.required<string>();
  /** Makes this container the default one. */
  readonly splitContainerDefault = input(false, { transform: booleanAttribute });
  /** Options read on registration. */
  readonly splitContainerOptions = input<SplitContainerOptions | undefined>(undefined);

  private registeredKey: string | null = null;

  ngOnInit(): void {
    this.register();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.registeredKey === null) return;
    if (changes['splitContainer'] && this.splitContainer() !== this.registeredKey) {
      this.unregister();
      this.register();
    } else if (changes['splitContainerDefault']) {
      this.applyDefault();
    }
  }

  ngOnDestroy(): void {
    this.unregister();
  }

  private register(): void {
    const key = this.splitContainer();
    this.registry.registerContainer(key, this.element.nativeElement, this.splitContainerOptions());
    this.registeredKey = key;
    this.applyDefault();
  }

  private applyDefault(): void {
    const key = this.registeredKey;
    if (key === null) return;
    if (this.splitContainerDefault()) this.registry.setDefaultContainer(key);
    else if (this.registry.getDefaultContainer() === key) this.registry.setDefaultContainer(null);
  }

  private unregister(): void {
    if (this.registeredKey !== null && this.registry.hasContainer(this.registeredKey)) {
      this.registry.unregisterContainer(this.registeredKey);
    }
    this.registeredKey = null;
  }
}
