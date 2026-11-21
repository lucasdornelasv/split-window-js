#!/usr/bin/env node
/**
 * Lockstep versioning: sets the same version on every package of the monorepo and on the
 * dependency of @split-window/angular on @split-window/core.
 *
 *   npm run version:set -- 0.2.0
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) {
  console.error('Uso: npm run version:set -- <versão semver>, ex.: 0.2.0');
  process.exit(1);
}

const root = resolve(import.meta.dirname, '..');
const files = [
  'package.json',
  'packages/core/package.json',
  'packages/css-animation/package.json',
  'packages/keyframes-animation/package.json',
  'packages/angular/package.json',
  'e2e/package.json',
];

for (const file of files) {
  const path = resolve(root, file);
  const pkg = JSON.parse(readFileSync(path, 'utf8'));
  pkg.version = version;
  if (pkg.dependencies?.['@split-window/core']) pkg.dependencies['@split-window/core'] = version;
  writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`);
  console.log(`${file}: ${version}`);
}
console.log('Atualize o CHANGELOG.md e rode "npm install" para sincronizar o package-lock.json.');
