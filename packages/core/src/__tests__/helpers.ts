import { SplitWindowController } from '../controller/split-window-controller.js';
import type { SplitWindowConfigInput, SplitWindowOptions } from '../model/types.js';
import { SplitContainerRegistry } from '../registry/split-container-registry.js';
import { FakeSplitEngine } from '../testing/fake-engine.js';

export interface Host {
  name: string;
}

export function host(name = 'host'): Host {
  return { name };
}

export function setup(config?: SplitWindowConfigInput) {
  const registry = new SplitContainerRegistry<Host>();
  const engine = new FakeSplitEngine<string, Host>();
  const controller = new SplitWindowController<string, Host>(registry, engine, config);
  const open = (options?: SplitWindowOptions, content = 'content') =>
    controller.open(content, options);
  const labels = (key: string) => controller.getTabs(key).map((ref) => ref.label);
  return { registry, engine, controller, open, labels };
}

/** Lets pending promises settle. */
export async function flush(): Promise<void> {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
