import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const readProjectFile = (path: string) =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

const extractUseSortableOptions = (source: string, listName: string) => {
  const start = source.indexOf(`useSortable(sortableContainer, ${listName}, {`);
  expect(start).toBeGreaterThanOrEqual(0);

  const end = source.indexOf('\n});', start);
  expect(end).toBeGreaterThan(start);

  return source.slice(start, end);
};

describe('page-level sortable configuration', () => {
  it('keeps My habits drag-and-drop attached after the conditional list renders', () => {
    const source = readProjectFile('app/pages/habits.vue');
    const options = extractUseSortableOptions(source, 'habits');

    expect(options).toContain('watchElement: true');
    expect(options).toContain('touchStartThreshold: 5');
  });

  it('keeps Buckets drag-and-drop attached after the conditional list renders', () => {
    const source = readProjectFile('app/pages/buckets.vue');
    const options = extractUseSortableOptions(source, 'buckets');

    expect(options).toContain('watchElement: true');
    expect(options).toContain('touchStartThreshold: 5');
  });
});
