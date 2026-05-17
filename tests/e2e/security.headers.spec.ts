import { test, expect } from '@playwright/test';

test('Security Headers are present', async ({ page }) => {
  const response = await page.goto('/');
  expect(response).toBeTruthy();
  
  const headers = response!.headers();
  
  expect(headers['strict-transport-security']).toContain('max-age=63072000');
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(headers['content-security-policy']).toContain("script-src 'self' 'unsafe-inline'");
});
