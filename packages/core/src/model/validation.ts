import { validateAnimation } from '../animation/animation-engine.js';
import { SplitInvalidOptionError } from '../errors/errors.js';
import {
  SPLIT_BODY_SIDES,
  type SplitBodyContainerOptions,
  type SplitContainerOptions,
  type SplitExpandOptions,
  type SplitWindowOptions,
} from './types.js';

const OVERFLOW = ['reject', 'replace-oldest', 'replace-lru', 'replace-same-label'];
const REJECT = ['throw', 'redirect-default', 'cancel'];
const ALIGN = ['center', 'start', 'end'];
const LENGTH = /^\s*\d+(\.\d+)?\s*(px|vw|vh|%)\s*$/;

function fail(option: string, value: unknown, expected: string): never {
  throw new SplitInvalidOptionError(option, value, expected);
}

function optionalString(option: string, value: unknown, allowEmpty = true): void {
  if (value === undefined) return;
  if (typeof value !== 'string' || (!allowEmpty && value.trim() === '')) {
    fail(option, value, allowEmpty ? 'texto' : 'texto não vazio');
  }
}

function optionalBoolean(option: string, value: unknown): void {
  if (value !== undefined && typeof value !== 'boolean') fail(option, value, 'boolean');
}

function optionalFunction(option: string, value: unknown): void {
  if (value !== undefined && typeof value !== 'function') fail(option, value, 'função');
}

function optionalNonNegative(option: string, value: unknown): void {
  if (value === undefined) return;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    fail(option, value, 'número maior ou igual a zero');
  }
}

/** Validates a container key. */
export function validateContainerKey(key: unknown, option = 'containerKey'): asserts key is string {
  if (typeof key !== 'string' || key.trim() === '') fail(option, key, 'texto não vazio');
}

/** Validates a length (`maxWidth`, `maxHeight`). */
export function validateLength(option: string, value: unknown): void {
  if (value === undefined) return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) fail(option, value, 'número maior que zero');
    return;
  }
  if (typeof value !== 'string' || !LENGTH.test(value)) {
    fail(option, value, "número ou texto em px, vw, vh ou % (ex.: '90vw')");
  }
}

export function validateWindowOptions(options: SplitWindowOptions | undefined): void {
  if (options === undefined) return;
  if (options === null || typeof options !== 'object') fail('options', options, 'objeto');
  if (options.containerKey !== undefined) validateContainerKey(options.containerKey);
  optionalString('title', options.title);
  optionalString('groupKey', options.groupKey);
  optionalBoolean('activate', options.activate);
  optionalBoolean('closable', options.closable);
  optionalFunction('canClose', options.canClose);
  optionalFunction('canMove', options.canMove);
}

export function validateExpandOptions(
  value: SplitExpandOptions<unknown> | false | undefined,
): void {
  if (value === undefined || value === false) return;
  if (value === null || typeof value !== 'object') fail('expand', value, 'objeto ou false');
  validateLength('expand.maxWidth', value.maxWidth);
  validateLength('expand.maxHeight', value.maxHeight);
  optionalNonNegative('expand.margin', value.margin);
  if (value.align !== undefined && !ALIGN.includes(value.align)) {
    fail('expand.align', value.align, ALIGN.join(' | '));
  }
  optionalBoolean('expand.restoreOnEscape', value.restoreOnEscape);
  if (typeof value.bounds === 'string' && value.bounds.trim() === '') {
    fail('expand.bounds', value.bounds, "'viewport', elemento, seletor CSS ou função");
  }
}

/**
 * Validates container options. `kind` tells custom containers from body containers, which
 * take their `side` from the key.
 */
export function validateContainerOptions(
  options: SplitContainerOptions<unknown> | SplitBodyContainerOptions<unknown> | undefined,
  prefix = '',
  kind: 'custom' | 'body' = 'custom',
): void {
  if (options === undefined) return;
  if (options === null || typeof options !== 'object') fail(`${prefix}options`, options, 'objeto');
  const p = (name: string) => `${prefix}${name}`;
  const { maxTabs, onFull, onReject, closedDropZone } = options;
  if (maxTabs !== undefined && typeof maxTabs !== 'function') {
    if (typeof maxTabs !== 'number' || !Number.isInteger(maxTabs) || maxTabs < 1) {
      fail(p('maxTabs'), maxTabs, 'inteiro maior que zero ou função');
    }
  }
  if (onFull !== undefined && typeof onFull !== 'function' && !OVERFLOW.includes(onFull)) {
    fail(p('onFull'), onFull, `${OVERFLOW.join(' | ')} ou função`);
  }
  if (onReject !== undefined && typeof onReject !== 'function' && !REJECT.includes(onReject)) {
    fail(p('onReject'), onReject, `${REJECT.join(' | ')} ou função`);
  }
  optionalBoolean(p('closeWhenEmpty'), options.closeWhenEmpty);
  optionalString(p('label'), options.label);
  if (closedDropZone !== undefined) {
    if (closedDropZone === null || typeof closedDropZone !== 'object') {
      fail(p('closedDropZone'), closedDropZone, 'objeto');
    }
    optionalNonNegative(p('closedDropZone.width'), closedDropZone.width);
    optionalNonNegative(p('closedDropZone.height'), closedDropZone.height);
  }
  validateExpandOptions(options.expand);
  const all = options as SplitContainerOptions<unknown> & SplitBodyContainerOptions<unknown>;
  optionalString(p('size'), all.size, false);
  if (all.side !== undefined) {
    if (kind === 'body') {
      fail(p('side'), all.side, 'ausente: o lado de um container do body vem da chave');
    }
    if (!SPLIT_BODY_SIDES.includes(all.side))
      fail(p('side'), all.side, SPLIT_BODY_SIDES.join(' | '));
  }
  if (typeof all.pushTarget === 'string' && all.pushTarget.trim() === '') {
    fail(p('pushTarget'), all.pushTarget, 'elemento ou seletor CSS não vazio');
  }
  const { mode, animation } = all;
  if (mode !== undefined) {
    const ok =
      (typeof mode === 'string' && mode.trim() !== '') ||
      typeof mode === 'function' ||
      (typeof mode === 'object' && mode !== null);
    if (!ok) fail(p('mode'), mode, 'nome de modo, objeto, classe ou função');
  }
  validateAnimation(p('animation'), animation);
  optionalBoolean(p('backdrop'), all.backdrop);
}
