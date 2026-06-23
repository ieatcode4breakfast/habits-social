/**
 * Centralized API client wrapper.
 *
 * Web: relative `/api/...` paths with cookie auth.
 * Native (Android): absolute production URLs with `Authorization: Bearer` token
 * from Keystore-backed secure storage, plus `X-Habits-Client: android/1.7.0`.
 *
 * ponytail: runtimeConfig + Capacitor gate keeps native-only deps out of web bundles.
 * Timeout ceiling: 15s default on native; no hard ceiling on web (browser default). Upgrade path: per-endpoint timeout config.
 */

import { getNativeAuthToken } from './nativeAuthToken';

const ANDROID_CLIENT_HEADER = 'android/1.7.0';
const NATIVE_TIMEOUT_MS = 15_000;

export interface HabitsApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: unknown;
  query?: Record<string, unknown>;
  headers?: Record<string, string>;
  timeout?: number;
  credentials?: RequestCredentials;
  /** Whether the request requires authentication. Defaults to true. Set false for login/register/etc. */
  authRequired?: boolean;
}

const getRuntimeConfigPublic = (): { build?: string; apiBaseUrl?: string } => {
  // ponytail: globalThis.useRuntimeConfig is a test-environment hook (vi.stubGlobal);
  // in production, Nuxt auto-imports the bare useRuntimeConfig() below.
  // Old code read window.__NUXT__ directly — Nuxt deletes that post-hydration
  // on Android, so isNativeRuntime() always returned false and habitsApi()
  // used relative URLs that Capacitor served as index.html (200 OK, text/html).
  const maybeGetter = (globalThis as { useRuntimeConfig?: unknown }).useRuntimeConfig;
  if (typeof maybeGetter === 'function') {
    try {
      return (maybeGetter() as { public?: { build?: string; apiBaseUrl?: string } }).public ?? {};
    } catch {
      // fall through to bare auto-import
    }
  }

  try {
    return useRuntimeConfig().public as { build?: string; apiBaseUrl?: string };
  } catch {
    return {};
  }
};

let _nativeRuntimeCache: boolean | null = null;

/**
 * Determines if we're running in the Capacitor Android WebView.
 * Uses the build-time HABITS_BUILD flag only — a native build IS a native runtime.
 * No Capacitor dynamic import needed; that was causing silent failures in the WebView.
 *
 * ponytail: the plan wanted Capacitor.isNativePlatform() as a second gate, but the
 * dynamic import fails closed in the static SPA bundle. A native build never runs in
 * a regular browser usefully, so the build flag alone is sufficient. Ceiling: can't
 * distinguish between native build running on Android vs native build opened in Chrome
 * for testing. Upgrade path: if that becomes a real workflow, fix the dynamic import.
 */
const isNativeRuntime = (): boolean => {
  if (_nativeRuntimeCache !== null) return _nativeRuntimeCache;

  const config = getRuntimeConfigPublic();
  _nativeRuntimeCache = config.build === 'native';
  return _nativeRuntimeCache;
};

/** Reset cached native check (for logout/cleanup scenarios where the runtime context changes). */
export const resetApiClientRuntimeCache = (): void => {
  _nativeRuntimeCache = null;
};

/**
 * Builds a fetch-error-like object for pre-flight failures (e.g. missing token).
 * Callers that check `error.status` or `error.response?.status` will see the status code.
 */
const buildAuthError = (): Error & { status: number; statusMessage: string } => {
  const err = new Error('Authentication required') as Error & { status: number; statusMessage: string };
  err.status = 401;
  err.statusMessage = 'Authentication required';
  return err;
};

/**
 * Typed API call wrapper.
 *
 * @param path - Must start with `/api/`.
 * @param options.authRequired - Set to false for unauthenticated endpoints (login, register, etc.).
 *
 * On web: forwards to `$fetch` with the relative path, preserving cookie auth.
 * On native: uses the production absolute URL, attaches Bearer token (if authRequired)
 * and Android client header, and applies a fixed request timeout.
 */
export const habitsApi = async <T = unknown>(
  path: string,
  options: HabitsApiOptions = {},
): Promise<T> => {
  const { method, body, query, headers: extraHeaders, timeout, credentials, authRequired = true } = options;

  const native = await isNativeRuntime();

  if (native) {
    const apiBaseUrl = getRuntimeConfigPublic().apiBaseUrl ?? 'https://www.habitssocial.com';
    const url = `${apiBaseUrl}${path}`;

    const requestHeaders: Record<string, string> = {
      ...extraHeaders,
      'X-Habits-Client': ANDROID_CLIENT_HEADER,
    };

    if (authRequired) {
      const token = await getNativeAuthToken();
      if (!token) throw buildAuthError();
      requestHeaders['Authorization'] = `Bearer ${token}`;
    }

    return $fetch<T>(url, {
      method,
      body: body as BodyInit | undefined,
      query,
      headers: requestHeaders,
      timeout: timeout ?? NATIVE_TIMEOUT_MS,
      credentials: credentials ?? 'omit',
    });
  }

  // Web/PWA: relative URL with cookie auth
  return $fetch<T>(path, {
    method,
    body: body as BodyInit | undefined,
    query,
    headers: extraHeaders,
    timeout,
    credentials,
  });
};
