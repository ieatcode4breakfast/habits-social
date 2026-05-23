import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type PackageJson = {
  version: string;
};

type PackageLock = {
  version: string;
  packages: Record<string, { version: string }>;
};

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const readJson = <T>(relativePath: string): T => {
  return JSON.parse(readFileSync(resolve(repoRoot, relativePath), 'utf8')) as T;
};

describe('release version metadata', () => {
  it('keeps package.json and package-lock.json on the same version', () => {
    const packageJson = readJson<PackageJson>('package.json');
    const packageLock = readJson<PackageLock>('package-lock.json');

    expect(packageLock.version).toBe(packageJson.version);
    expect(packageLock.packages[''].version).toBe(packageJson.version);
  });
});
