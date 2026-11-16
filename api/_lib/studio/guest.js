/* ============================================================================
   NEXORA Studio — guest sessions
   ----------------------------------------------------------------------------
   A visitor opens the Studio without an account and starts building right
   away. The server mints a signed guest credential; every Studio row is owned
   by that guest id, so two browsers never see each other's projects, keys or
   deployments.

   The same credential can later be claimed by a NEXORA account: the claim moves
   every guest-owned row to the account owner in one transaction (see
   claim.js). Two different accounts can never claim the same guest workspace.

   The credential is an HMAC-signed token (not the account JWT), so it is
   recognized before the ordinary bearer authentication and can never be
   mistaken for an account session.
   ============================================================================ */

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { StudioError } from './db.js';

/* how long a guest workspace stays reachable without touching it */
export const GUEST_TTL_MS = 90 * 24 * 60 * 60 * 1000;   // 90 days
const OWNER_PREFIX = 'guest:';
const TOKEN_PREFIX = 'nxg1';

/**
 * The signing secret. In production it must be configured — otherwise anyone
 * could mint a guest token for a guessed owner id. Locally we fall back to a
 * fixed development secret so `npm run studio` works out of the box.
 */
function secret() {
  const material = process.env.STUDIO_SECRET || process.env.JWT_SECRET || process.env.NEXORA_SECRET || '';
  if (!material) {
    if (process.env.VERCEL) {
      throw new StudioError(500, 'guest_unavailable', 'STUDIO_SECRET is not configured on this deployment');
    }
    return 'nexora-studio-local-guest';
  }
  return material;
}

const sign = (body) => createHmac('sha256', secret())
  .update('nexora-studio-guest:' + body)
  .digest('base64url');

function sameSignature(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  if (x.length !== y.length || !x.length) return false;
  try { return timingSafeEqual(x, y); } catch { return false; }
}

/** A fresh, unguessable guest id (12 random bytes). */
export function newGuestId() {
  return randomBytes(12).toString('base64url');
}

/** The owner id used by every Studio table for this guest. */
export const guestOwner = (gid) => OWNER_PREFIX + String(gid || '');
export const isGuestOwner = (ownerId) => String(ownerId || '').startsWith(OWNER_PREFIX);
export const guestIdOf = (ownerId) => (isGuestOwner(ownerId) ? String(ownerId).slice(OWNER_PREFIX.length) : '');

/** Sign a guest credential. */
export function signGuestToken(gid, ttlMs = GUEST_TTL_MS) {
  const now = Date.now();
  const ttl = Number(ttlMs);
  const payload = { g: String(gid), e: now + (Number.isFinite(ttl) ? ttl : GUEST_TTL_MS), i: now };
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${TOKEN_PREFIX}.${body}.${sign(body)}`;
}

/**
 * Verify a guest credential.
 * Returns { gid, expiresAt } or null when the token is forged, malformed or
 * expired. It never throws — callers decide how to react.
 */
export function verifyGuestToken(token) {
  const raw = String(token || '').trim();
  if (!raw) return null;
  const parts = raw.split('.');
  if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX) return null;
  const [, body, sig] = parts;
  if (!sameSignature(sig, sign(body))) return null;
  let payload;
  try { payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch { return null; }
  if (!payload || typeof payload.g !== 'string' || !payload.g) return null;
  const expiresAt = Number(payload.e) || 0;
  if (!expiresAt || Date.now() > expiresAt) return null;
  return { gid: payload.g, expiresAt };
}

/** Mint a brand new guest workspace + credential. */
export function issueGuestSession(ttlMs = GUEST_TTL_MS) {
  const gid = newGuestId();
  const token = signGuestToken(gid, ttlMs);
  return {
    token,
    guestId: gid,
    owner: guestOwner(gid),
    expiresAt: Date.now() + ttlMs,
  };
}

/** The pseudo-user a guest request runs as. */
export function guestIdentity(gid, expiresAt = 0) {
  return {
    id: guestOwner(gid),
    username: 'guest',
    full_name: 'Guest',
    avatar_url: null,
    guest: true,
    guestId: gid,
    guestExpiresAt: expiresAt || 0,
  };
}
