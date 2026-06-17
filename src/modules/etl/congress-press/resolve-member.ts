import { eq } from 'drizzle-orm';
import type { DbOrTx } from './db.js';
import { loadMembers } from '../../../db/schema.js';
import type { EtlLog } from './etl-log.js';
import {
  detectUnknownMemberKeys,
  resolvePartyName,
  type RawMember,
} from './types.js';

export type PartyLookup = Map<string, number>;

export async function loadPartyLookup(db: DbOrTx): Promise<PartyLookup> {
  const { parties } = await import('../../../db/schema.js');
  const rows = await db.select({ id: parties.id, name: parties.name }).from(parties);
  const lookup = new Map<string, number>();
  for (const row of rows) {
    lookup.set(row.name.toLowerCase(), row.id);
  }
  return lookup;
}

/** Dedupes in-flight member resolution across parallel file workers. */
export type MemberCache = Map<string, Promise<string | null>>;

async function resolveLoadMember(
  db: DbOrTx,
  member: RawMember,
  partyLookup: PartyLookup,
  log: EtlLog,
): Promise<string | null> {
  if (member && typeof member === 'object') {
    for (const key of detectUnknownMemberKeys(member as Record<string, unknown>)) {
      log.recordUnknownKey(`member.${key}`);
    }
  }

  const bioguideId = member.bioguide_id?.trim();
  if (!bioguideId) {
    log.recordMissingOrDefaulted(
      'load_congress_press.member_id',
      'member.bioguide_id missing',
    );
    return null;
  }

  const name = member.name?.trim();
  const memberType = member.chamber?.trim();
  const memberState = member.state?.trim();

  if (!name || !memberType || !memberState) {
    log.recordSkipped('member', 0, `incomplete member for ${bioguideId}`);
    return null;
  }

  log.recordMissingOrDefaulted(
    'member.member_district',
    'not in source, defaulted to ""',
  );

  const existing = await db
    .select({ bioguideId: loadMembers.bioguideId })
    .from(loadMembers)
    .where(eq(loadMembers.bioguideId, bioguideId))
    .limit(1);

  if (existing[0]) {
    return bioguideId;
  }

  const partyName = resolvePartyName(member.party);
  let partyId: number | null = null;
  if (member.party) {
    if (partyName) {
      partyId = partyLookup.get(partyName.toLowerCase()) ?? null;
      if (partyId == null) {
        log.recordUnmappedValue('member.party', member.party);
      }
    } else {
      log.recordUnmappedValue('member.party', member.party);
    }
  } else {
    log.recordMissingOrDefaulted('member.party', 'not in source');
  }

  await db
    .insert(loadMembers)
    .values({
      bioguideId,
      name,
      memberType,
      memberState,
      memberDistrict: '',
      partyId,
    })
    .onConflictDoNothing({ target: loadMembers.bioguideId });

  const inserted = await db
    .select({ bioguideId: loadMembers.bioguideId })
    .from(loadMembers)
    .where(eq(loadMembers.bioguideId, bioguideId))
    .limit(1);

  if (!inserted[0]) return null;

  if (!existing[0]) {
    log.membersCreated += 1;
  }

  return bioguideId;
}

export async function getOrCreateLoadMember(
  db: DbOrTx,
  member: RawMember | null,
  partyLookup: PartyLookup,
  cache: MemberCache,
  log: EtlLog,
): Promise<string | null> {
  if (!member) {
    log.recordMissingOrDefaulted(
      'load_congress_press.member_id',
      'no member object in source',
    );
    return null;
  }

  const bioguideId = member.bioguide_id?.trim();
  if (!bioguideId) {
    log.recordMissingOrDefaulted(
      'load_congress_press.member_id',
      'member.bioguide_id missing',
    );
    return null;
  }

  const pending = cache.get(bioguideId);
  if (pending) return pending;

  const promise = resolveLoadMember(db, member, partyLookup, log);
  cache.set(bioguideId, promise);
  return promise;
}
