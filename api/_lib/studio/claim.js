/* ============================================================================
   NEXORA Studio — claiming a guest workspace
   ----------------------------------------------------------------------------
   When a visitor links their guest session to a NEXORA account, every row the
   guest owns moves to that account in ONE transaction:

     projects · messages · revisions · runs · deployments · keys

   The guest id is written to studio_guest_claims, so a second account can
   never take over a workspace that was already linked, and the same account
   can safely retry (the transfer is idempotent).
   ============================================================================ */

import { studioTransaction, studioOne, nowIso, StudioError } from './db.js';

/* every owner-scoped table of the Studio, in the order they must move */
const TABLES = [
  { name: 'studio_projects', key: 'projects' },
  { name: 'studio_messages', key: 'messages' },
  { name: 'studio_revisions', key: 'revisions' },
  { name: 'studio_runs', key: 'runs' },
  { name: 'studio_deployments', key: 'deployments' },
];

/** Which account owns this guest workspace, if any. */
export async function guestClaimedBy(guestOwnerId) {
  const row = await studioOne('select account_id, claimed_at from studio_guest_claims where guest_id=$1', [String(guestOwnerId)]);
  if (!row) return null;
  return { accountId: String(row.account_id), claimedAt: row.claimed_at ? String(row.claimed_at) : '' };
}

/**
 * Move a guest workspace to an account.
 * Returns { moved: { projects, messages, revisions, runs, deployments, keys },
 *           keptKeys: [...], alreadyClaimed: bool }
 */
export async function claimGuestWorkspace(guestOwnerId, accountOwnerId) {
  const from = String(guestOwnerId || '');
  const to = String(accountOwnerId || '');
  if (!from || !to) throw new StudioError(400, 'invalid_claim', 'the guest workspace or the account is missing');
  if (from === to) throw new StudioError(400, 'invalid_claim', 'this workspace already belongs to that account');

  return await studioTransaction(async (tx) => {
    const prior = await tx.one('select account_id, claimed_at from studio_guest_claims where guest_id=$1', [from]);
    if (prior && String(prior.account_id) !== to) {
      throw new StudioError(409, 'guest_already_claimed', 'this guest workspace is already linked to another account');
    }

    const moved = { projects: 0, messages: 0, revisions: 0, runs: 0, deployments: 0, keys: 0 };
    for (const table of TABLES) {
      const rows = await tx.query(`select id from ${table.name} where owner_id=$1`, [from]);
      moved[table.key] = rows.length;
      if (!rows.length) continue;
      await tx.query(`update ${table.name} set owner_id=$2 where owner_id=$1`, [from, to]);
    }

    /* one key per (owner, provider): the account keeps its own key when it
       already has one for that provider, so linking never destroys a
       credential the account was already using. */
    const keptKeys = [];
    const keys = await tx.query('select id, provider from studio_keys where owner_id=$1', [from]);
    for (const key of keys) {
      const clash = await tx.one('select id from studio_keys where owner_id=$1 and provider=$2', [to, String(key.provider)]);
      if (clash) {
        await tx.query('delete from studio_keys where id=$1 and owner_id=$2', [Number(key.id), from]);
        keptKeys.push(String(key.provider));
        continue;
      }
      await tx.query('update studio_keys set owner_id=$2 where id=$1 and owner_id=$3', [Number(key.id), to, from]);
      moved.keys += 1;
    }

    if (!prior) {
      await tx.query('insert into studio_guest_claims (guest_id, account_id, claimed_at) values ($1,$2,$3)', [from, to, nowIso()]);
    }

    return {
      moved,
      keptKeys,
      alreadyClaimed: Boolean(prior),
      claimedAt: prior?.claimed_at ? String(prior.claimed_at) : nowIso(),
    };
  });
}
