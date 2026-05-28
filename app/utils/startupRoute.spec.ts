import { describe, expect, it } from 'vitest';
import { resolveStartupRoute } from './startupRoute';

describe('resolveStartupRoute', () => {
  it('defaults online app opens to Social', () => {
    expect(resolveStartupRoute(true)).toBe('/social');
  });

  it('defaults offline app opens to My habits', () => {
    expect(resolveStartupRoute(false)).toBe('/habits');
  });
});
