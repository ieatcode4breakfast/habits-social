import { describe, expect, it } from 'vitest';
import {
  buildConnectSrc,
  buildContentSecurityPolicy,
  normalizePartykitHostForCsp,
} from './securityHeaders';

describe('security header CSP helpers', () => {
  it('allows only the configured PartyKit host when realtime is enabled', () => {
    const connectSrc = buildConnectSrc({
      realtimeEnabled: 'true',
      partykitHost: 'habits-social-realtime-staging.ieatcode4breakfast.partykit.dev',
    });

    expect(connectSrc).toBe(
      "'self' https://habits-social-realtime-staging.ieatcode4breakfast.partykit.dev wss://habits-social-realtime-staging.ieatcode4breakfast.partykit.dev"
    );
  });

  it('allows the configured production PartyKit host when realtime is enabled', () => {
    const connectSrc = buildConnectSrc({
      realtimeEnabled: 'true',
      partykitHost: 'habits-social-realtime-production.ieatcode4breakfast.partykit.dev',
    });

    expect(connectSrc).toBe(
      "'self' https://habits-social-realtime-production.ieatcode4breakfast.partykit.dev wss://habits-social-realtime-production.ieatcode4breakfast.partykit.dev"
    );
  });

  it('normalizes harmless host formatting before validation', () => {
    expect(normalizePartykitHostForCsp(' HTTPS://Habits-Social-Realtime-Staging.IeatCode4Breakfast.PartyKit.Dev/ '))
      .toBe('habits-social-realtime-staging.ieatcode4breakfast.partykit.dev');
  });

  it('fails closed when realtime is disabled', () => {
    expect(buildConnectSrc({
      realtimeEnabled: 'false',
      partykitHost: 'habits-social-realtime-staging.ieatcode4breakfast.partykit.dev',
    })).toBe("'self'");
  });

  it('fails closed when the host is not a PartyKit hostname', () => {
    expect(buildConnectSrc({
      realtimeEnabled: true,
      partykitHost: 'evil.example.com',
    })).toBe("'self'");
  });

  it('builds the final CSP with the validated connect-src value', () => {
    const csp = buildContentSecurityPolicy({
      realtimeEnabled: true,
      partykitHost: 'habits-social-realtime-staging.ieatcode4breakfast.partykit.dev',
    });

    expect(csp).toContain(
      "connect-src 'self' https://habits-social-realtime-staging.ieatcode4breakfast.partykit.dev wss://habits-social-realtime-staging.ieatcode4breakfast.partykit.dev;"
    );
  });
});
