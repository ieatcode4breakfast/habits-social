import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const appRoot = join(process.cwd(), 'app');
const mainCssPath = join(appRoot, 'assets', 'css', 'main.css');

const readText = (path: string): string => readFileSync(path, 'utf8');

const collectFiles = (directory: string, extensions: readonly string[]): string[] => {
  const files: string[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath, extensions));
      continue;
    }

    if (entry.isFile() && extensions.some((extension) => fullPath.endsWith(extension))) {
      files.push(fullPath);
    }
  }

  return files;
};

const getLightBlock = (css: string): string => {
  const match = css.match(/html\.light\s*\{([\s\S]*?)\n\}/);
  return match?.[1] ?? '';
};

describe('theme CSS contract', () => {
  it('does not hijack Tailwind built-in color tokens in light mode', () => {
    const lightBlock = getLightBlock(readText(mainCssPath));

    expect(lightBlock).not.toMatch(/--color-(?:white|black|zinc-[\w-]+)/);
  });

  it('does not patch raw Tailwind utilities from html.light', () => {
    const css = readText(mainCssPath);

    expect(css).not.toMatch(/html\.light\s+\.(?:bg|text|border)-/);
    expect(css).not.toMatch(/html\.light\s+\.[a-z]+\\\\:/);
  });

  it('does not define or use dark variants', () => {
    const files = collectFiles(appRoot, ['.vue', '.css']);

    for (const file of files) {
      const text = readText(file);
      expect(text, relative(process.cwd(), file)).not.toContain('@custom-variant dark');
      expect(text, relative(process.cwd(), file)).not.toContain('dark:');
      expect(text, relative(process.cwd(), file)).not.toMatch(/@apply\s+[^;]*dark:/);
    }
  });

  it('defines the required semantic theme tokens', () => {
    const css = readText(mainCssPath);
    const requiredTokens = [
      '--color-app',
      '--color-surface-muted',
      '--color-surface-raised',
      '--color-surface-solid',
      '--color-surface-inset',
      '--color-surface-hover',
      '--color-fg',
      '--color-fg-muted',
      '--color-fg-subtle',
      '--color-fg-inverted',
      '--color-border-theme',
      '--color-border-muted',
      '--color-action-primary',
      '--color-action-primary-hover',
      '--color-action-primary-fg',
      '--color-msg-own',
      '--color-msg-own-fg',
      '--color-cell-markable-border',
      '--color-cell-inactive-bg',
      '--nav-link-bg-hover: #000000',
      '--nav-link-bg-active: #000000',
    ] as const;

    for (const token of requiredTokens) {
      expect(css).toContain(token);
    }
  });

  it('migrates dangerous neutral surface utilities to semantic tokens', () => {
    const files = collectFiles(appRoot, ['.vue']);
    const dangerousUtility = /(?:^|[\s'":])(?:bg-black(?!\/)|md:bg-black(?!\/)|bg-zinc-100|bg-zinc-800|bg-zinc-900|bg-zinc-925|bg-zinc-950|border-zinc-800|border-zinc-925|text-black)(?=$|[\s/'"`:])/;

    for (const file of files) {
      expect(readText(file), relative(process.cwd(), file)).not.toMatch(dangerousUtility);
    }
  });
});
