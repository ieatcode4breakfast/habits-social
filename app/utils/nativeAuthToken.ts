/**
 * Native Android auth token management backed by Keystore-backed secure storage.
 * Web fallback: never call the plugin — its web fallback stores unencrypted in localStorage.
 *
 * ponytail: dynamic import guards WebView bundling from native-only plugin.
 * Token validation: non-empty string with exactly three dot-separated JWT segments.
 */

const SECURE_STORAGE_KEY = 'habits-social:auth-token:v1';

let _isNative: boolean | null = null;
let _capacitorModule: typeof import('@capacitor/core') | null = null;

const loadCapacitor = async (): Promise<typeof import('@capacitor/core')> => {
  if (_capacitorModule) return _capacitorModule;
  _capacitorModule = await import('@capacitor/core');
  return _capacitorModule;
};

/**
 * Returns true only when running inside the Capacitor Android WebView.
 * Cached after first check.
 */
export const isNativeAuthRuntime = async (): Promise<boolean> => {
  if (_isNative !== null) return _isNative;

  try {
    const Capacitor = await loadCapacitor();
    _isNative = Capacitor.Capacitor.isNativePlatform();
  } catch {
    _isNative = false;
  }

  return _isNative;
};

/**
 * Synchronous reset of the cached native-runtime check (for logout/cleanup).
 */
export const resetNativeAuthRuntimeCache = (): void => {
  _isNative = null;
  _capacitorModule = null;
};

/**
 * Validates that a token looks like a JWT: non-empty string with 3 dot-separated segments.
 */
const isJwtLike = (token: unknown): token is string => {
  if (typeof token !== 'string' || token.length === 0) return false;
  const segments = token.split('.');
  return segments.length === 3 && segments.every(s => s.length > 0);
};

/**
 * Retrieves the stored native auth token from Keystore-backed secure storage.
 * Returns null if not native, token missing, or token invalid.
 */
export const getNativeAuthToken = async (): Promise<string | null> => {
  if (!(await isNativeAuthRuntime())) return null;

  try {
    const SecureStorage = await import('@aparajita/capacitor-secure-storage');
    const result = await SecureStorage.SecureStorage.get(SECURE_STORAGE_KEY);
    const token = typeof result === 'string' ? result : null;
    if (!isJwtLike(token)) return null;
    return token;
  } catch {
    return null;
  }
};

/**
 * Stores the native auth token in Keystore-backed secure storage.
 * Validates the token as JWT-like before saving.
 * No-op on web (silently succeeds but does nothing).
 */
export const setNativeAuthToken = async (token: string): Promise<void> => {
  if (!isJwtLike(token)) return;

  if (!(await isNativeAuthRuntime())) return;

  try {
    const SecureStorage = await import('@aparajita/capacitor-secure-storage');
    await SecureStorage.SecureStorage.set(SECURE_STORAGE_KEY, token);
  } catch {
    // Secure storage write failure is non-recoverable at this level;
    // the next protected request will fail closed (no token found).
  }
};

/**
 * Clears the stored native auth token from secure storage.
 * No-op on web.
 */
export const clearNativeAuthToken = async (): Promise<void> => {
  if (!(await isNativeAuthRuntime())) return;

  try {
    const SecureStorage = await import('@aparajita/capacitor-secure-storage');
    await SecureStorage.SecureStorage.remove(SECURE_STORAGE_KEY);
  } catch {
    // Best-effort; key may already not exist.
  }
};
