/** Base class of every error thrown by SplitWindow. */
export class SplitWindowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

function formatKeys(keys: readonly string[]): string {
  return keys.length
    ? `Containers disponíveis: ${keys.join(', ')}.`
    : 'Nenhum container configurado.';
}

/** A `containerKey` was given, but no container is configured with it. */
export class SplitContainerNotFoundError extends SplitWindowError {
  constructor(
    readonly containerKey: string,
    readonly availableKeys: readonly string[],
    readonly bodySideDisabled = false,
  ) {
    super(
      bodySideDisabled
        ? `O container '${containerKey}' não está habilitado. Habilite-o com useBodyContainers().`
        : `Nenhum container configurado com a chave '${containerKey}'. ${formatKeys(availableKeys)}`,
    );
  }
}

/**
 * No `containerKey` was given and there is no default container. Since the first configured
 * container is the automatic default, this only happens while no container is configured.
 */
export class SplitNoDefaultContainerError extends SplitWindowError {
  constructor(readonly availableKeys: readonly string[]) {
    super(
      'Nenhum container padrão configurado. Registre um container (registerContainer() ou a ' +
        'diretiva splitContainer) ou habilite os containers do body com useBodyContainers() ' +
        'antes do open().',
    );
  }
}

/** The tab was rejected by the tab limit and `onReject` resolved to `throw`, or the redirect chain ran out. */
export class SplitContainerFullError extends SplitWindowError {
  constructor(
    readonly containerKey: string,
    readonly triedKeys: readonly string[],
  ) {
    super(
      `O container '${containerKey}' está cheio. Containers tentados: ${triedKeys.join(', ')}.`,
    );
  }
}

/** `registerContainer` was called with a reserved `body-*` key. */
export class SplitReservedContainerKeyError extends SplitWindowError {
  constructor(readonly containerKey: string) {
    super(
      `A chave '${containerKey}' é reservada para os containers do body. Use useBodyContainers() ` +
        'ou escolha outra chave.',
    );
  }
}

/** `registerContainer` was called with a key that is already registered. */
export class SplitDuplicateContainerError extends SplitWindowError {
  constructor(readonly containerKey: string) {
    super(
      `Já existe um container registrado com a chave '${containerKey}'. Para trocar o host, ` +
        'desregistre o container antes.',
    );
  }
}

/** An option received an invalid value. */
export class SplitInvalidOptionError extends SplitWindowError {
  constructor(
    readonly option: string,
    readonly value: unknown,
    expected: string,
  ) {
    super(`Valor inválido para '${option}': ${describe(value)}. Esperado: ${expected}.`);
  }
}

function describe(value: unknown): string {
  if (typeof value === 'string') return `'${value}'`;
  if (typeof value === 'function') return 'função';
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}
