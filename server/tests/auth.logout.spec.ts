import './setup';
import { describe, it, expect, vi } from 'vitest';
import logoutPost from '../api/auth/logout.post';

describe('API: POST /api/auth/logout', () => {
  it('should clear the auth_token cookie and return success', async () => {
    let cookieCleared = false;
    const event = {
      context: {}
    } as any;

    // Mock deleteCookie (H3 utility)
    (global as any).deleteCookie = (ev: any, name: string) => {
      if (name === 'auth_token') cookieCleared = true;
    };

    const res = await logoutPost(event);
    expect(res.data.success).toBe(true);
    expect(cookieCleared).toBe(true);
  });
});
