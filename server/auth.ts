import { randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { getUserByOpenId, upsertUser } from './db.js';
import type { AdminUser } from './types.js';

const COOKIE = 'webdev_app_session';
const STATE_COOKIE = 'hs_oauth_state';
const SESSION_TTL_SECONDS = 60 * 60 * 8;

type SessionClaims = {
  openId: string;
  email: string;
  name: string;
  appId: string;
  origin?: string;
};

type PlatformClaims = {
  openId?: string;
  appId?: string;
  name?: string;
  exp?: number;
};

type OAuthUser = {
  openId: string;
  name?: string;
  email?: string | null;
};

function badRequest(message: string): Error & { status?: number } {
  const error = new Error(message) as Error & { status?: number };
  error.status = 400;
  return error;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function allowedEmails(): Set<string> {
  return new Set((process.env.ADMIN_EMAILS ?? '').split(',').map((email) => email.trim().toLowerCase()).filter(Boolean));
}

function isAllowed(email: string): boolean {
  return allowedEmails().has(email.toLowerCase());
}

async function syncRole(user: AdminUser): Promise<AdminUser> {
  const role = isAllowed(user.email) ? 'admin' : 'viewer';
  return role === user.role ? user : upsertUser({ openId: user.openId, email: user.email, name: user.name, role });
}

const cookieOptions = () => ({
  httpOnly: true,
  secure: true,
  sameSite: 'none' as const,
  path: '/',
});

function parseOrigin(request: Request): string {
  const input = request.body?.origin;
  if (typeof input !== 'string') throw badRequest('Use the private studio from its verified website origin.');
  let url: URL;
  try { url = new URL(input); } catch { throw badRequest('Use a valid website origin.'); }
  if (!['https:', 'http:'].includes(url.protocol)) throw badRequest('Use a valid website origin.');

  const accepted = new Set<string>();
  const addOrigin = (value: string | undefined) => {
    if (!value) return;
    try { accepted.add(new URL(value).origin); } catch { /* ignore malformed proxy metadata */ }
  };
  addOrigin(request.get('origin'));
  addOrigin(request.get('referer'));
  const forwardedHost = request.get('x-forwarded-host');
  if (forwardedHost) {
    addOrigin(`https://${forwardedHost}`);
    addOrigin(`http://${forwardedHost}`);
  } else if (request.get('host')) {
    addOrigin(`${request.get('x-forwarded-proto') || 'https'}://${request.get('host')}`);
  }
  if (accepted.size > 0 && !accepted.has(url.origin)) {
    throw badRequest('Use the private studio from its verified website origin.');
  }
  return url.origin;
}

function requestOrigins(request: Request): Set<string> {
  const origins = new Set<string>();
  const add = (value: string | undefined) => {
    if (!value) return;
    try { origins.add(new URL(value).origin); } catch { /* ignore malformed proxy metadata */ }
  };
  add(request.get('origin'));
  add(request.get('referer'));
  const forwardedHost = request.get('x-forwarded-host');
  const forwardedProto = request.get('x-forwarded-proto')?.split(',')[0]?.trim() || 'https';
  if (forwardedHost) {
    add(`${forwardedProto}://${forwardedHost}`);
    add(`https://${forwardedHost}`);
    add(`http://${forwardedHost}`);
  } else if (request.get('host')) {
    add(`${forwardedProto}://${request.get('host')}`);
  }
  return origins;
}

function decodeState(state: string): { redirectUri: string; nonce: string } {
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf8')) as { redirectUri?: string; nonce?: string };
    if (!decoded.redirectUri || !decoded.nonce) throw new Error();
    const redirect = new URL(decoded.redirectUri);
    if (redirect.pathname !== '/api/auth/callback') throw new Error();
    return { redirectUri: redirect.toString(), nonce: decoded.nonce };
  } catch {
    throw badRequest('The secure sign-in state is invalid. Please start sign-in again.');
  }
}

function signSession(user: AdminUser, origin: string): string {
  return jwt.sign(
    { openId: user.openId, email: user.email, name: user.name, appId: required('MANUS_PROJECT_ID'), origin } satisfies SessionClaims,
    required('APP_SESSION_SECRET'),
    { algorithm: 'HS256', expiresIn: SESSION_TTL_SECONDS },
  );
}

function verifyApplicationSession(token: string): SessionClaims | null {
  try {
    const payload = jwt.verify(token, required('APP_SESSION_SECRET'), { algorithms: ['HS256'] }) as SessionClaims;
    if (payload.appId !== required('MANUS_PROJECT_ID') || !payload.openId || !payload.email) return null;
    return payload;
  } catch {
    return null;
  }
}

function verifyPreviewSession(token: string): PlatformClaims | null {
  try {
    const payload = jwt.verify(token, required('MANUS_JWT_SECRET'), { algorithms: ['HS256'] }) as PlatformClaims;
    if (payload.appId !== required('MANUS_PROJECT_ID') || !payload.openId || payload.openId.startsWith('cron_')) return null;
    return payload;
  } catch {
    return null;
  }
}

async function userFromPreviewSession(token: string, claims: PlatformClaims): Promise<AdminUser | null> {
  let user = await getUserByOpenId(claims.openId!);
  if (user) return syncRole(user);
  const api = required('MANUS_OAUTH_API_URL').replace(/\/$/, '');
  const response = await fetch(`${api}/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jwtToken: token, projectId: required('MANUS_PROJECT_ID') }),
  });
  const identity = await response.json() as OAuthUser & { error?: { message?: string } };
  if (!response.ok || !identity.openId || !identity.email) return null;
  user = await upsertUser({
    openId: identity.openId,
    email: identity.email,
    name: identity.name || claims.name || identity.email,
    role: isAllowed(identity.email) ? 'admin' : 'viewer',
  });
  return syncRole(user);
}

function tokenFromRequest(request: Request): string | undefined {
  return request.cookies?.[COOKIE] ?? (request.headers.authorization?.startsWith('Bearer ') ? request.headers.authorization.slice(7) : undefined);
}

export async function resolveUser(request: Request): Promise<AdminUser | null> {
  const token = tokenFromRequest(request);
  if (!token) return null;
  const appClaims = verifyApplicationSession(token);
  if (appClaims) {
    const user = await getUserByOpenId(appClaims.openId);
    if (!user || user.email.toLowerCase() !== appClaims.email.toLowerCase()) return null;
    return syncRole(user);
  }
  const previewClaims = verifyPreviewSession(token);
  return previewClaims ? userFromPreviewSession(token, previewClaims) : null;
}

export function assertTrustedOrigin(request: Request): void {
  const origin = request.get('origin');
  if (!origin) return;
  const fetchSite = request.get('sec-fetch-site');
  if (fetchSite && !['same-origin', 'same-site', 'none'].includes(fetchSite)) {
    const error = new Error('Cross-site write requests are not accepted by the private studio.');
    (error as Error & { status?: number }).status = 403;
    throw error;
  }
  const token = tokenFromRequest(request);
  const claims = token ? verifyApplicationSession(token) : null;
  if (claims?.origin && !requestOrigins(request).has(claims.origin)) {
    const error = new Error('This session belongs to a different website origin.');
    (error as Error & { status?: number }).status = 403;
    throw error;
  }
}

export async function requireAdmin(request: Request): Promise<AdminUser> {
  const user = await resolveUser(request);
  if (!user) {
    const error = new Error('Sign in is required to access the private POST studio.');
    (error as Error & { status?: number }).status = 401;
    throw error;
  }
  if (user.role !== 'admin' || !isAllowed(user.email)) {
    const error = new Error('This Manus account is not authorized to use POST.');
    (error as Error & { status?: number }).status = 403;
    throw error;
  }
  return user;
}

export function beginLogin(request: Request, response: Response): void {
  const origin = parseOrigin(request);
  const nonce = randomBytes(32).toString('base64url');
  const redirectUri = `${origin}/api/auth/callback`;
  response.cookie(STATE_COOKIE, nonce, { ...cookieOptions(), maxAge: 10 * 60 * 1000 });
  const state = Buffer.from(JSON.stringify({ redirectUri, nonce }), 'utf8').toString('base64url');
  const portal = new URL('/app-auth', required('MANUS_OAUTH_PORTAL_URL'));
  portal.searchParams.set('appId', required('MANUS_PROJECT_ID'));
  portal.searchParams.set('redirectUri', redirectUri);
  portal.searchParams.set('state', state);
  portal.searchParams.set('responseType', 'code');
  response.json({ url: portal.toString() });
}

export async function finishLogin(request: Request, response: Response): Promise<void> {
  const code = typeof request.query.code === 'string' ? request.query.code : '';
  const state = typeof request.query.state === 'string' ? request.query.state : '';
  if (!code || !state) throw badRequest('The provider did not return a complete sign-in response.');
  const decoded = decodeState(state);
  if (!request.cookies?.[STATE_COOKIE] || request.cookies[STATE_COOKIE] !== decoded.nonce) throw badRequest('The secure sign-in state expired. Please return to POST and try again.');
  response.clearCookie(STATE_COOKIE, cookieOptions());
  const api = required('MANUS_OAUTH_API_URL').replace(/\/$/, '');
  const tokenResponse = await fetch(`${api}/webdev.v1.WebDevAuthPublicService/ExchangeToken`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ clientId: required('MANUS_PROJECT_ID'), grantType: 'authorization_code', code, redirectUri: decoded.redirectUri }),
  });
  const token = await tokenResponse.json() as { accessToken?: string; error?: { message?: string } };
  if (!tokenResponse.ok || !token.accessToken) throw new Error(token.error?.message || 'Manus OAuth could not complete sign-in.');
  const identityResponse = await fetch(`${api}/webdev.v1.WebDevAuthPublicService/GetUserInfo`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ accessToken: token.accessToken }),
  });
  const identity = await identityResponse.json() as OAuthUser & { error?: { message?: string } };
  if (!identityResponse.ok || !identity.openId || !identity.email) throw new Error(identity.error?.message || 'Manus did not provide a verified email address.');
  const email = identity.email.toLowerCase();
  const user = await upsertUser({ openId: identity.openId, email, name: identity.name || email, role: isAllowed(email) ? 'admin' : 'viewer' });
  const origin = new URL(decoded.redirectUri).origin;
  if (user.role !== 'admin') { response.redirect(302, `${origin}/post?access=denied`); return; }
  response.cookie(COOKIE, signSession(user, origin), { ...cookieOptions(), maxAge: SESSION_TTL_SECONDS * 1000 });
  response.redirect(302, `${origin}/post`);
}

export function logout(response: Response): void {
  response.clearCookie(COOKIE, cookieOptions());
  response.status(204).end();
}

export function sessionPublicView(user: AdminUser | null) {
  if (!user) return { authenticated: false, isAdmin: false, user: null };
  return { authenticated: true, isAdmin: user.role === 'admin' && isAllowed(user.email), user: { name: user.name, email: user.email, role: user.role } };
}
