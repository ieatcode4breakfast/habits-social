import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('help center page outlet', () => {
  it('keys nested article pages by full path so sidebar navigation remounts article content', () => {
    const source = readFileSync(resolve(process.cwd(), 'app/pages/help-center.vue'), 'utf8');

    expect(source).toContain('<NuxtPage :page-key="route => route.fullPath" />');
  });
});
