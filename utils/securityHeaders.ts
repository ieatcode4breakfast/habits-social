interface RealtimeCspInput {
  realtimeEnabled?: boolean | string;
  partykitHost?: string;
}

const PARTYKIT_HOST_PATTERN = /^[a-z0-9.-]+\.partykit\.dev$/;

export const normalizePartykitHostForCsp = (host?: string): string => {
  const normalized = host
    ?.trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '') || '';

  return PARTYKIT_HOST_PATTERN.test(normalized) ? normalized : '';
};

export const buildConnectSrc = ({ realtimeEnabled, partykitHost }: RealtimeCspInput): string => {
  const enabled = realtimeEnabled === true || realtimeEnabled === 'true';
  const normalizedHost = enabled ? normalizePartykitHostForCsp(partykitHost) : '';

  return normalizedHost
    ? `'self' https://${normalizedHost} wss://${normalizedHost}`
    : "'self'";
};

export const buildContentSecurityPolicy = (input: RealtimeCspInput): string =>
  `default-src 'self'; script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://api.dicebear.com; connect-src ${buildConnectSrc(input)} https://cloudflareinsights.com; font-src 'self';`;
