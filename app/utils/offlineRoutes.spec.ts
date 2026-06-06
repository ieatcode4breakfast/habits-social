import { describe, expect, it } from 'vitest';
import { isOfflineAccessibleRoute, buildOfflineRedirect, shouldShowOfflineUnavailableContent } from './offlineRoutes';

describe('offlineRoutes', () => {
  describe('isOfflineAccessibleRoute', () => {
    it('allows permitted routes', () => {
      expect(isOfflineAccessibleRoute('/')).toBe(true);
      expect(isOfflineAccessibleRoute('/habits')).toBe(true);
      expect(isOfflineAccessibleRoute('/buckets')).toBe(true);
      expect(isOfflineAccessibleRoute('/offline')).toBe(true);
    });

    it('blocks other routes', () => {
      expect(isOfflineAccessibleRoute('/social')).toBe(false);
      expect(isOfflineAccessibleRoute('/inbox')).toBe(false);
      expect(isOfflineAccessibleRoute('/friends/abc')).toBe(false);
      expect(isOfflineAccessibleRoute('/login')).toBe(false);
      expect(isOfflineAccessibleRoute('/forgot-password')).toBe(false);
      expect(isOfflineAccessibleRoute('/reset-password')).toBe(false);
    });

    it('strips query parameters and hash before checking', () => {
      expect(isOfflineAccessibleRoute('/habits?foo=bar#hash')).toBe(true);
      expect(isOfflineAccessibleRoute('/social?foo=bar')).toBe(false);
    });
  });

  describe('buildOfflineRedirect', () => {
    it('returns session redirect when offline and has no cached user', () => {
      expect(buildOfflineRedirect('/habits', false)).toBe('/offline?reason=session');
      expect(buildOfflineRedirect('/social', false)).toBe('/offline?reason=session');
    });

    it('does not redirect if route is /offline even without session', () => {
      expect(buildOfflineRedirect('/offline', false)).toBeNull();
      expect(buildOfflineRedirect('/offline?reason=session', false)).toBeNull();
    });

    it('returns null if route is allowlisted and user has session', () => {
      expect(buildOfflineRedirect('/', true)).toBeNull();
      expect(buildOfflineRedirect('/habits', true)).toBeNull();
      expect(buildOfflineRedirect('/buckets', true)).toBeNull();
      expect(buildOfflineRedirect('/offline', true)).toBeNull();
    });

    it('returns null if route is blocked and user has session so the app shell can show offline content in place', () => {
      expect(buildOfflineRedirect('/social', true)).toBeNull();
      expect(buildOfflineRedirect('/inbox?foo=bar', true)).toBeNull();
    });
  });

  describe('shouldShowOfflineUnavailableContent', () => {
    it('shows unavailable content for blocked offline routes with an authenticated user', () => {
      expect(shouldShowOfflineUnavailableContent('/social', false, true)).toBe(true);
      expect(shouldShowOfflineUnavailableContent('/inbox', false, true)).toBe(true);
      expect(shouldShowOfflineUnavailableContent('/friends/abc?from=friends', false, true)).toBe(true);
    });

    it('does not show unavailable content for offline allowed routes', () => {
      expect(shouldShowOfflineUnavailableContent('/habits', false, true)).toBe(false);
      expect(shouldShowOfflineUnavailableContent('/buckets', false, true)).toBe(false);
      expect(shouldShowOfflineUnavailableContent('/offline?reason=session', false, true)).toBe(false);
    });

    it('does not show unavailable content online or without a local user', () => {
      expect(shouldShowOfflineUnavailableContent('/social', true, true)).toBe(false);
      expect(shouldShowOfflineUnavailableContent('/social', false, false)).toBe(false);
    });
  });
});
