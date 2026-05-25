interface RealtimeCspInput {
  realtimeEnabled?: boolean | string;
  partykitHost?: string;
}

const PARTYKIT_HOST_PATTERN = /^[a-z0-9.-]+\.partykit\.dev$/;
const LOCAL_PARTYKIT_HOST_PATTERN = /^(localhost|127\.0\.0\.1):([1-9]\d{0,4})$/;

const isLocalPartykitHostAllowed = (): boolean => process.env.NODE_ENV !== 'production';

const isValidLocalPartykitHost = (host: string): boolean => {
  const match = LOCAL_PARTYKIT_HOST_PATTERN.exec(host);
  if (!match) return false;

  const port = Number(match[2]);
  return Number.isInteger(port) && port <= 65535;
};

export const normalizePartykitHostForCsp = (host?: string): string => {
  const normalized = host
    ?.trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '') || '';

  if (PARTYKIT_HOST_PATTERN.test(normalized)) return normalized;
  if (isLocalPartykitHostAllowed() && isValidLocalPartykitHost(normalized)) return normalized;
  return '';
};

export const buildConnectSrc = ({ realtimeEnabled, partykitHost }: RealtimeCspInput): string => {
  const enabled = realtimeEnabled === true || realtimeEnabled === 'true';
  const normalizedHost = enabled ? normalizePartykitHostForCsp(partykitHost) : '';

  if (!normalizedHost) return "'self'";
  if (isValidLocalPartykitHost(normalizedHost)) return `'self' http://${normalizedHost} ws://${normalizedHost}`;

  return `'self' https://${normalizedHost} wss://${normalizedHost}`;
};

export const buildContentSecurityPolicy = (input: RealtimeCspInput): string =>
  `default-src 'self'; script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com https://accounts.google.com; style-src 'self' 'unsafe-inline' https://accounts.google.com; img-src 'self' data: https://api.dicebear.com https://lh3.googleusercontent.com; connect-src ${buildConnectSrc(input)} https://cloudflareinsights.com https://accounts.google.com; font-src 'self'; frame-src 'self' https://accounts.google.com;`;
