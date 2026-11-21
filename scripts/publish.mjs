#!/usr/bin/env node
/**
 * Publishes every package of the monorepo to npm, in dependency order (core first).
 * Expects the packages to be built (`npm run build:core && npm run build:engines &&
 * npm run build:angular`). The Angular package is published from its ng-packagr output.
 * Versions already on npm are skipped, so a failed release can be run again.
 *
 *   npm run release -- --dry-run
 *   npm run release -- --provenance      (in CI, with npm trusted publishing)
 *   npm run release -- --tag next        (prerelease)
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dirs = [
  'packages/core',
  'packages/css-animation',
  'packages/keyframes-animation',
  'packages/angular/dist',
];
const args = process.argv.slice(2);
const npm = (argv, options = {}) =>
  execFileSync('npm', argv, { encoding: 'utf8', shell: process.platform === 'win32', ...options });

const published = (name, version) => {
  try {
    return npm(['view', `${name}@${version}`, 'version'], { stdio: 'pipe' }).trim() === version;
  } catch {
    return false; // E404: package or version not on npm yet
  }
};

const versions = new Set();
for (const dir of dirs) {
  const cwd = resolve(root, dir);
  const manifest = resolve(cwd, 'package.json');
  if (!existsSync(manifest)) {
    console.error(`${dir} não existe. Rode os builds antes (npm run build:angular).`);
    process.exit(1);
  }
  const { name, version } = JSON.parse(readFileSync(manifest, 'utf8'));
  versions.add(version);
  if (versions.size > 1) {
    console.error(
      `Versões diferentes entre os pacotes (${[...versions]}). Use npm run version:set.`,
    );
    process.exit(1);
  }
  if (published(name, version)) {
    console.log(`${name}@${version} já está no npm, pulando.`);
    continue;
  }
  console.log(`Publicando ${name}@${version}...`);
  npm(['publish', '--access', 'public', ...args], { cwd, stdio: 'inherit' });
}
