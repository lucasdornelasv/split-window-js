import { describe, expect, it } from 'vitest';
import {
  SplitContainerNotFoundError,
  SplitDuplicateContainerError,
  SplitInvalidOptionError,
  SplitNoDefaultContainerError,
  SplitReservedContainerKeyError,
} from '../errors/errors.js';
import { SplitContainerRegistry } from '../registry/split-container-registry.js';
import { host, setup, type Host } from './helpers.js';

describe('SplitContainerRegistry', () => {
  it('has no container and no default by default', () => {
    const r = new SplitContainerRegistry<Host>();
    expect(r.getContainerKeys()).toEqual([]);
    expect(r.getDefaultContainer()).toBeNull();
    expect(() => r.resolveKey()).toThrow(SplitNoDefaultContainerError);
  });

  it('registers and unregisters containers', () => {
    const r = new SplitContainerRegistry<Host>();
    r.registerContainer('a', host());
    expect(r.hasContainer('a')).toBe(true);
    expect(r.isContainerOpen('a')).toBe(false);
    r.unregisterContainer('a');
    expect(r.hasContainer('a')).toBe(false);
    r.unregisterContainer('missing'); // no-op
  });

  it('rejects reserved, duplicate, empty keys and missing hosts', () => {
    const r = new SplitContainerRegistry<Host>();
    expect(() => r.registerContainer('body-left', host())).toThrow(SplitReservedContainerKeyError);
    r.registerContainer('a', host());
    expect(() => r.registerContainer('a', host())).toThrow(SplitDuplicateContainerError);
    expect(() => r.registerContainer('', host())).toThrow(SplitInvalidOptionError);
    expect(() => r.registerContainer('b', null as unknown as Host)).toThrow(
      SplitInvalidOptionError,
    );
  });

  it('cannot unregister a body container directly', () => {
    const r = new SplitContainerRegistry<Host>();
    r.useBodyContainers();
    expect(() => r.unregisterContainer('body-right')).toThrow(SplitReservedContainerKeyError);
  });

  it('validates container options', () => {
    const r = new SplitContainerRegistry<Host>();
    expect(() => r.registerContainer('a', host(), { maxTabs: 0 })).toThrow(/maxTabs/);
    expect(() => r.registerContainer('a', host(), { maxTabs: 1.5 })).toThrow(/maxTabs/);
    expect(() => r.registerContainer('a', host(), { onFull: 'x' as never })).toThrow(/onFull/);
    expect(() => r.registerContainer('a', host(), { onReject: 'x' as never })).toThrow(/onReject/);
    expect(() => r.registerContainer('a', host(), { closedDropZone: { width: -1 } })).toThrow(
      /closedDropZone.width/,
    );
    expect(() => r.registerContainer('a', host(), { expand: { align: 'x' as never } })).toThrow(
      /expand.align/,
    );
    expect(() => r.registerContainer('a', host(), { expand: { maxWidth: '90em' } })).toThrow(
      /expand.maxWidth/,
    );
    expect(() => r.useBodyContainers({ right: { size: '' } })).toThrow(/right.size/);
    expect(() => r.useBodyContainers({ right: 5 as never })).toThrow(/right/);
    expect(() => r.useBodyContainers({ defaults: { maxTabs: -1 } })).toThrow(/defaults.maxTabs/);
  });

  describe('default container', () => {
    it('setDefaultContainer requires an existing key; null clears it', () => {
      const r = new SplitContainerRegistry<Host>();
      expect(() => r.setDefaultContainer('a')).toThrow(SplitContainerNotFoundError);
      r.registerContainer('a', host());
      r.setDefaultContainer('a');
      expect(r.resolveKey()).toBe('a');
      r.setDefaultContainer(null);
      expect(r.getDefaultContainer()).toBeNull();
    });

    it('a disabled body side cannot be the default', () => {
      const r = new SplitContainerRegistry<Host>();
      try {
        r.setDefaultContainer('body-left');
        expect.unreachable();
      } catch (e) {
        expect(e).toBeInstanceOf(SplitContainerNotFoundError);
        expect((e as Error).message).toContain('useBodyContainers()');
      }
    });

    it('unregistering the default leaves the app without a default', () => {
      const r = new SplitContainerRegistry<Host>();
      r.registerContainer('a', host());
      r.setDefaultContainer('a');
      r.unregisterContainer('a');
      expect(r.getDefaultContainer()).toBeNull();
    });
  });

  describe('resolution errors', () => {
    it('unknown key lists the available keys', () => {
      const r = new SplitContainerRegistry<Host>();
      r.useBodyContainers();
      r.registerContainer('painel-esquerdo', host());
      try {
        r.resolveKey('contratos');
        expect.unreachable();
      } catch (e) {
        const err = e as SplitContainerNotFoundError;
        expect(err).toBeInstanceOf(SplitContainerNotFoundError);
        expect(err.containerKey).toBe('contratos');
        expect(err.availableKeys).toEqual(['body-right', 'painel-esquerdo']);
        expect(err.message).toBe(
          "Nenhum container configurado com a chave 'contratos'. Containers disponíveis: body-right, painel-esquerdo.",
        );
      }
    });

    it('unknown key with nothing configured', () => {
      const r = new SplitContainerRegistry<Host>();
      expect(() => r.resolveKey('x')).toThrow('Nenhum container configurado.');
    });

    it('disabled body side', () => {
      const r = new SplitContainerRegistry<Host>();
      expect(() => r.resolveKey('body-left')).toThrow(
        "O container 'body-left' não está habilitado. Habilite-o com useBodyContainers().",
      );
    });

    it('no default', () => {
      const r = new SplitContainerRegistry<Host>();
      r.registerContainer('a', host());
      try {
        r.resolveKey();
        expect.unreachable();
      } catch (e) {
        expect(e).toBeInstanceOf(SplitNoDefaultContainerError);
        expect((e as SplitNoDefaultContainerError).availableKeys).toEqual(['a']);
        expect((e as Error).message).toContain('setDefaultContainer()');
      }
    });
  });

  describe('useBodyContainers', () => {
    it('without arguments enables only body-right as default, with no limit', () => {
      const r = new SplitContainerRegistry<Host>();
      r.useBodyContainers();
      expect(r.getContainerKeys()).toEqual(['body-right']);
      expect(r.getDefaultContainer()).toBe('body-right');
      expect(r._get('body-right')!.options.maxTabs).toBeUndefined();
      expect(r._get('body-right')!.closeWhenEmpty).toBe(true);
    });

    it('with an object enables only the given sides, applying defaults and overrides', () => {
      const r = new SplitContainerRegistry<Host>();
      r.useBodyContainers({
        defaults: { maxTabs: 8, onFull: 'replace-lru' },
        left: { size: '360px' },
        right: true,
        bottom: { size: '35vh', maxTabs: 4, onFull: 'reject', onReject: 'redirect-default' },
        default: 'left',
      });
      expect(r.getContainerKeys()).toEqual(['body-left', 'body-right', 'body-bottom']);
      expect(r.getDefaultContainer()).toBe('body-left');
      expect(r._get('body-left')!.options).toMatchObject({
        maxTabs: 8,
        onFull: 'replace-lru',
        size: '360px',
      });
      expect(r._get('body-right')!.options).toMatchObject({ maxTabs: 8, onFull: 'replace-lru' });
      expect(r._get('body-bottom')!.options).toMatchObject({
        maxTabs: 4,
        onFull: 'reject',
        size: '35vh',
      });
      expect(r._get('body-left')!.side).toBe('left');
      expect(r._get('body-left')!.kind).toBe('body');
      expect(r._get('body-left')!.host).toBeNull();
    });

    it('an object without default keeps the current default', () => {
      const r = new SplitContainerRegistry<Host>();
      r.registerContainer('a', host());
      r.setDefaultContainer('a');
      r.useBodyContainers({ right: true });
      expect(r.getDefaultContainer()).toBe('a');
    });

    it('default must be an enabled side', () => {
      const r = new SplitContainerRegistry<Host>();
      expect(() => r.useBodyContainers({ right: true, default: 'left' })).toThrow(
        SplitContainerNotFoundError,
      );
      expect(() => r.useBodyContainers({ right: true, default: 'x' as never })).toThrow(
        SplitInvalidOptionError,
      );
      expect(() => r.useBodyContainers(5 as never)).toThrow(SplitInvalidOptionError);
    });

    it('reconfiguration disables missing sides, dismissing their tabs, and keeps the others', async () => {
      const { registry, open, controller } = setup();
      registry.useBodyContainers({ left: true, right: true, default: 'right' });
      const onLeft = open({ containerKey: 'body-left' });
      const onRight = open();
      const reasons: unknown[] = [];
      onLeft.result.catch((r) => reasons.push(r));
      registry.useBodyContainers({ right: { maxTabs: 1 } });
      await Promise.resolve();
      expect(onLeft.isOpen).toBe(false);
      expect(reasons).toEqual(['container-removed']);
      expect(onRight.isOpen).toBe(true);
      expect(registry.hasContainer('body-left')).toBe(false);
      expect(registry.getDefaultContainer()).toBe('body-right');
      // A lower limit only applies to the next arrivals.
      expect(controller.getTabs('body-right')).toHaveLength(1);
    });

    it('disabling the default side leaves the app without a default', () => {
      const r = new SplitContainerRegistry<Host>();
      r.useBodyContainers();
      r.useBodyContainers({ left: true });
      expect(r.getDefaultContainer()).toBeNull();
    });
  });

  describe('expansion and state', () => {
    it('expands only open containers that allow it, one at a time', () => {
      const { registry, open } = setup();
      registry.registerContainer('a', host());
      registry.registerContainer('b', host());
      registry.registerContainer('c', host(), { expand: false });
      const states: unknown[] = [];
      registry.containerStateChanged.subscribe((s) => states.push(s));

      registry.expandContainer('a'); // closed: ignored
      expect(registry.isContainerExpanded('a')).toBe(false);

      open({ containerKey: 'a' });
      open({ containerKey: 'b' });
      open({ containerKey: 'c' });
      registry.expandContainer('c'); // expand: false
      expect(registry.isContainerExpanded('c')).toBe(false);

      registry.expandContainer('a');
      registry.expandContainer('a'); // already expanded
      registry.expandContainer('b');
      expect(registry.isContainerExpanded('a')).toBe(false);
      expect(registry.getExpandedContainer()).toBe('b');
      registry.restoreContainer('b');
      registry.restoreContainer('b');
      expect(registry.getExpandedContainer()).toBeNull();
      expect(states).toEqual([
        { key: 'a', open: true, expanded: false },
        { key: 'b', open: true, expanded: false },
        { key: 'c', open: true, expanded: false },
        { key: 'a', open: true, expanded: true },
        { key: 'a', open: true, expanded: false },
        { key: 'b', open: true, expanded: true },
        { key: 'b', open: true, expanded: false },
      ]);
    });

    it('unknown keys throw on expand/restore', () => {
      const r = new SplitContainerRegistry<Host>();
      expect(() => r.expandContainer('x')).toThrow(SplitContainerNotFoundError);
      expect(() => r.restoreContainer('x')).toThrow(SplitContainerNotFoundError);
      expect(r.isContainerExpanded('x')).toBe(false);
      expect(r.isContainerOpen('x')).toBe(false);
    });

    it('unregistering an open expanded container emits a final state', () => {
      const { registry, open } = setup();
      registry.registerContainer('a', host());
      open({ containerKey: 'a' });
      registry.expandContainer('a');
      const states: unknown[] = [];
      registry.containerStateChanged.subscribe((s) => states.push(s));
      registry.unregisterContainer('a');
      expect(states.at(-1)).toEqual({ key: 'a', open: false, expanded: false });
    });

    it('destroy completes the observables', () => {
      const r = new SplitContainerRegistry<Host>();
      let completed = false;
      r.containerStateChanged.subscribe({ complete: () => (completed = true) });
      r.destroy();
      expect(completed).toBe(true);
    });
  });
});
