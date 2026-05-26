import './setup';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestUser, deleteTestUser, createMockEvent, db } from './test.utils';
import { SignJWT } from 'jose';
import { eq } from 'drizzle-orm';
import { users } from '../db/schema';

describe('Google Authentication and Registration Flow', () => {
  let googleHandler: any;
  let registerGoogleHandler: any;
  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'mock-google-client-id';

  beforeAll(async () => {
    googleHandler = (await import('../api/auth/google.post')).default;
    registerGoogleHandler = (await import('../api/auth/register-google.post')).default;
    process.env.GOOGLE_CLIENT_ID = GOOGLE_CLIENT_ID;
  });

  const generateMockGoogleToken = async (email: string, sub: string = 'google-sub-123', aud: string = GOOGLE_CLIENT_ID) => {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'test-secret');
    return await new SignJWT({ 
      email, 
      sub, 
      iss: 'https://accounts.google.com', 
      aud,
      picture: 'https://example.com/photo.jpg'
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(secret);
  };

  it('should authenticate existing user with same email immediately', async () => {
    const uniqueId = crypto.randomUUID().slice(0, 8);
    const existingEmail = `exist_${uniqueId}@gmail.com`;
    const existingUser = await createTestUser(`existing_${uniqueId}`, existingEmail);

    const credentialToken = await generateMockGoogleToken(existingUser.email);
    const event = createMockEvent('', { credential: credentialToken });

    // Spy/mock functions inside event context
    let setCookieCalled = false;
    event.context.setAuthCookie = (evt: any, tok: string) => {
      setCookieCalled = true;
    };

    const response = (await googleHandler(event)) as any;

    expect(response.data).toBeDefined();
    expect(response.data.signupRequired).toBe(false);
    expect(response.data.email).toBe(existingUser.email);
    expect(response.data.username).toBe(existingUser.username);
    expect(setCookieCalled).toBe(true);

    // Verify database emailVerifiedAt is set
    const dbUser = await db.select().from(users).where(eq(users.id, existingUser.id)).limit(1);
    expect(dbUser[0]?.emailVerifiedAt).not.toBeNull();

    // Cleanup
    await deleteTestUser(existingUser.id);
  });

  it('should return signupRequired and signupToken for unregistered Google email', async () => {
    const uniqueId = crypto.randomUUID().slice(0, 8);
    const freshEmail = `fresh_${uniqueId}@gmail.com`;
    
    const credentialToken = await generateMockGoogleToken(freshEmail);
    const event = createMockEvent('', { credential: credentialToken });

    const response = (await googleHandler(event)) as any;

    expect(response.data).toBeDefined();
    expect(response.data.signupRequired).toBe(true);
    expect(response.data.signupToken).toBeDefined();
    expect(response.data.email).toBe(freshEmail);
    expect(response.data.photoUrl).toBe('https://example.com/photo.jpg');
  });

  it('should successfully complete registration for new Google user with a valid signupToken', async () => {
    const uniqueId = crypto.randomUUID().slice(0, 8);
    const freshEmail = `register_${uniqueId}@gmail.com`;

    // 1. Initiate Google sign-in to get signupToken
    const credentialToken = await generateMockGoogleToken(freshEmail);
    const loginEvent = createMockEvent('', { credential: credentialToken });
    const loginResponse = (await googleHandler(loginEvent)) as any;
    const signupToken = loginResponse.data.signupToken;

    // 2. Submit username/password to complete registration
    const username = `u_greg_${uniqueId}`;
    const registerEvent = createMockEvent('', {
      signupToken,
      username,
      password: 'SecurePassword123!'
    });

    let setCookieCalled = false;
    registerEvent.context.setAuthCookie = (evt: any, tok: string) => {
      setCookieCalled = true;
    };

    const registerResponse = (await registerGoogleHandler(registerEvent)) as any;

    expect(registerResponse.data).toBeDefined();
    expect(registerResponse.data.email).toBe(freshEmail);
    expect(registerResponse.data.username).toBe(username);
    expect(registerResponse.data.photoUrl).toBe('https://example.com/photo.jpg');
    expect(setCookieCalled).toBe(true);

    // Verify database emailVerifiedAt is set for new signup
    const dbUser = await db.select().from(users).where(eq(users.id, registerResponse.data.id)).limit(1);
    expect(dbUser[0]?.emailVerifiedAt).not.toBeNull();

    // Cleanup
    await deleteTestUser(registerResponse.data.id);
  });

  it('should reject registration if the username is already taken', async () => {
    const uniqueId = crypto.randomUUID().slice(0, 8);
    const existingUser = await createTestUser(`taken_${uniqueId}`, `taken_${uniqueId}@gmail.com`);

    const freshEmail = `another_${uniqueId}@gmail.com`;
    const credentialToken = await generateMockGoogleToken(freshEmail);
    const loginEvent = createMockEvent('', { credential: credentialToken });
    const loginResponse = (await googleHandler(loginEvent)) as any;
    const signupToken = loginResponse.data.signupToken;

    const registerEvent = createMockEvent('', {
      signupToken,
      username: existingUser.username, // duplicate username
      password: 'SecurePassword123!'
    });

    await expect(registerGoogleHandler(registerEvent)).rejects.toThrow(/already taken/i);

    // Cleanup
    await deleteTestUser(existingUser.id);
  });

  it('should reject registration if the signupToken is invalid or tampered with', async () => {
    const registerEvent = createMockEvent('', {
      signupToken: 'invalid-signup-token-signature',
      username: `rand_${Date.now() % 10000}`,
      password: 'SecurePassword123!'
    });

    await expect(registerGoogleHandler(registerEvent)).rejects.toThrow(/signup token has expired or is invalid/i);
  });
});

describe('Google Client ID Endpoint', () => {
  let clientIdHandler: any;

  beforeAll(async () => {
    clientIdHandler = (await import('../api/auth/google-client-id.get')).default;
  });

  it('should return the configured Google client ID from server runtime', async () => {
    const event = createMockEvent('');
    const response = await clientIdHandler(event);
    expect(response).toHaveProperty('clientId');
    expect(response.clientId).toBe(
      process.env.GOOGLE_CLIENT_ID || 'mock-google-client-id'
    );
  });
});
