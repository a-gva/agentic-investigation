export const KNOWN_PRESS_KEYS = new Set([
  'url',
  'title',
  'date',
  'date_source',
  'source',
  'domain',
  'scraper',
  'member',
  'text',
  'collected_at',
  'updated_at',
]);

export const KNOWN_MEMBER_KEYS = new Set([
  'bioguide_id',
  'name',
  'party',
  'state',
  'chamber',
]);

export type RawMember = {
  bioguide_id?: string;
  name?: string;
  party?: string;
  state?: string;
  chamber?: string;
};

export type RawCongressPressRow = {
  url?: string;
  title?: string;
  date?: string;
  date_source?: string;
  source?: string;
  domain?: string;
  scraper?: string;
  member?: RawMember;
  text?: string;
  collected_at?: string;
  updated_at?: string;
};

export type ParsedPressRow = {
  url: string;
  title: string | null;
  date: string | null;
  dateSource: string | null;
  source: string;
  domain: string;
  scraper: string;
  text: string | null;
  collectedAt: Date | null;
  updatedAt: Date | null;
  member: RawMember | null;
};

const REQUIRED_PRESS_FIELDS = [
  'url',
  'source',
  'domain',
  'scraper',
] as const;

function optionalString(value: unknown): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed === '' ? null : trimmed;
}

function optionalDate(value: unknown): string | null {
  const raw = optionalString(value);
  return raw ? raw.slice(0, 10) : null;
}

export function detectUnknownKeys(obj: Record<string, unknown>): string[] {
  return Object.keys(obj).filter((k) => !KNOWN_PRESS_KEYS.has(k));
}

export function detectUnknownMemberKeys(
  member: Record<string, unknown>,
): string[] {
  return Object.keys(member).filter((k) => !KNOWN_MEMBER_KEYS.has(k));
}

export function parseTimestamp(
  value: string | undefined,
): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function parseCongressPressRow(
  obj: Record<string, unknown>,
): { row: ParsedPressRow | null; missingFields: string[] } {
  const missingFields: string[] = [];

  for (const field of REQUIRED_PRESS_FIELDS) {
    const val = obj[field];
    if (val == null || String(val).trim() === '') {
      missingFields.push(field);
    }
  }

  if (missingFields.length > 0) {
    return { row: null, missingFields };
  }

  const memberRaw = obj.member;
  const member =
    memberRaw != null && typeof memberRaw === 'object' && !Array.isArray(memberRaw)
      ? (memberRaw as RawMember)
      : null;

  const collectedAt = parseTimestamp(
    obj.collected_at != null ? String(obj.collected_at) : undefined,
  );
  const updatedAt = parseTimestamp(
    obj.updated_at != null ? String(obj.updated_at) : undefined,
  );

  return {
    row: {
      url: String(obj.url).trim(),
      title: optionalString(obj.title),
      date: optionalDate(obj.date),
      dateSource: optionalString(obj.date_source),
      source: String(obj.source).trim(),
      domain: String(obj.domain).trim(),
      scraper: String(obj.scraper).trim(),
      text: optionalString(obj.text),
      collectedAt,
      updatedAt,
      member,
    },
    missingFields: [],
  };
}

const PARTY_ALIASES: Record<string, string> = {
  republican: 'Republican',
  democrat: 'Democratic',
  democratic: 'Democratic',
  independent: 'Independent',
};

export function resolvePartyName(party: string | undefined): string | null {
  if (!party) return null;
  return PARTY_ALIASES[party.trim().toLowerCase()] ?? null;
}

/** Normalizes member.chamber to lowercase for congress_types.name FK. */
export function resolveCongressTypeName(
  chamber: string | undefined,
): string | null {
  if (!chamber?.trim()) return null;
  return chamber.trim().toLowerCase();
}
