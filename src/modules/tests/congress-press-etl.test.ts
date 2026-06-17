import { eq, sql } from 'drizzle-orm';
import { readFileSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openPool } from '../../db/index.js';
import {
  congressTypes,
  etlRuns,
  loadCongressPress,
  loadMembers,
  parties,
} from '../../db/schema.js';
import { EtlLog } from '../etl/congress-press/etl-log.js';
import { ingestCongressPressFile } from '../etl/congress-press/ingest-file.js';
import { runCongressPressETL } from '../etl/congress-press/run.js';
import {
  loadCongressTypeLookup,
  loadPartyLookup,
} from '../etl/congress-press/resolve-member.js';
import {
  detectUnknownKeys,
  parseCongressPressRow,
  resolveCongressTypeName,
  resolvePartyName,
} from '../etl/congress-press/types.js';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const MOCK_FILE = resolve(TEST_DIR, 'mock/congress_press/2022-01.jsonl');
const MOCK_DATA_DIR = resolve(TEST_DIR, 'mock');
const TEST_LOG = resolve(TEST_DIR, 'congress-press-etl-test.log');

describe('congress-press types', () => {
  it('resolvePartyName maps Democrat to Democratic', () => {
    expect(resolvePartyName('Democrat')).toBe('Democratic');
    expect(resolvePartyName('Republican')).toBe('Republican');
    expect(resolvePartyName('Unknown')).toBeNull();
  });

  it('resolveCongressTypeName normalizes chamber to lowercase', () => {
    expect(resolveCongressTypeName('House')).toBe('house');
    expect(resolveCongressTypeName('Senate')).toBe('senate');
    expect(resolveCongressTypeName('')).toBeNull();
  });

  it('detectUnknownKeys flags extra top-level fields', () => {
    expect(detectUnknownKeys({ url: 'x', extra_field: 1 })).toEqual([
      'extra_field',
    ]);
  });

  it('parseCongressPressRow rejects missing required fields', () => {
    const result = parseCongressPressRow({ url: 'https://example.com' });
    expect(result.row).toBeNull();
    expect(result.missingFields.length).toBeGreaterThan(0);
  });

  it('parseCongressPressRow allows missing title, text, date, and date_source', () => {
    const { row, missingFields } = parseCongressPressRow({
      url: 'https://example.com/release',
      source: 'https://example.com/press',
      domain: 'example.com',
      scraper: 'example',
      title: null,
      text: null,
      date: null,
      date_source: null,
    });
    expect(missingFields).toEqual([]);
    expect(row?.title).toBeNull();
    expect(row?.text).toBeNull();
    expect(row?.date).toBeNull();
    expect(row?.dateSource).toBeNull();
  });

  it('parseCongressPressRow maps a valid row', () => {
    const raw = JSON.parse(readFileSync(MOCK_FILE, 'utf8').split('\n')[0]!);
    const { row, missingFields } = parseCongressPressRow(raw);
    expect(missingFields).toEqual([]);
    expect(row?.url).toContain('bice.house.gov');
    expect(row?.member?.bioguide_id).toBe('B000740');
  });
});

describe('EtlLog', () => {
  it('formats sections for missing and skipped fields', () => {
    const log = new EtlLog();
    log.recordMissingOrDefaulted(
      'member.member_district',
      'not in source, defaulted to ""',
    );
    log.recordSkipped('file.jsonl', 3, 'invalid JSON');
    const text = log.format();
    expect(text).toContain('member.member_district');
    expect(text).toContain('file.jsonl:3');
  });
});

describe('congress-press ETL integration', () => {
  const { db, close } = openPool(1);
  let dbAvailable = true;

  beforeAll(async () => {
    try {
      await db.execute(sql`SELECT 1`);
      await db
        .insert(parties)
        .values({ name: 'Democratic', acronym: 'D' })
        .onConflictDoNothing({ target: parties.name });
      await db
        .insert(parties)
        .values({ name: 'Republican', acronym: 'R' })
        .onConflictDoNothing({ target: parties.name });
      await db
        .insert(congressTypes)
        .values([{ name: 'house' }, { name: 'senate' }])
        .onConflictDoNothing({ target: congressTypes.name });
      await db.delete(etlRuns);
    } catch {
      dbAvailable = false;
    }
  });

  afterAll(async () => {
    if (!dbAvailable) {
      await close();
      return;
    }
    try {
      await db.delete(loadCongressPress);
      await db.delete(loadMembers);
      await db.delete(etlRuns);
      rmSync(TEST_LOG, { force: true });
    } finally {
      await close();
    }
  });

  it('ingests mock JSONL into load tables', async ({ skip }) => {
    if (!dbAvailable) skip();

    const log = new EtlLog();
    const partyLookup = await loadPartyLookup(db);
    const congressTypeLookup = await loadCongressTypeLookup(db);
    const memberCache = new Map<string, Promise<string | null>>();

    const { rowsParsed, rowsInserted } = await ingestCongressPressFile(
      db,
      db,
      MOCK_FILE,
      partyLookup,
      congressTypeLookup,
      memberCache,
      log,
    );

    expect(rowsParsed).toBe(10);
    expect(rowsInserted).toBeGreaterThanOrEqual(10);

    const pressCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(loadCongressPress);
    expect(pressCount[0]?.count).toBeGreaterThanOrEqual(10);

    const members = await db.select().from(loadMembers);
    expect(members.length).toBeGreaterThan(0);
    expect(members.every((m) => m.memberDistrict === '')).toBe(true);
    expect(members.every((m) => m.memberType === 'house')).toBe(true);

    const withMember = await db
      .select()
      .from(loadCongressPress)
      .where(eq(loadCongressPress.url, JSON.parse(readFileSync(MOCK_FILE, 'utf8').split('\n')[0]!).url))
      .limit(1);
    expect(withMember[0]?.memberId).toBe('B000740');

    const formatted = log.format();
    expect(formatted).toContain('member.member_district');
  });

  it('runCongressPressETL writes log.txt', async ({ skip }) => {
    if (!dbAvailable) skip();

    await db.delete(loadCongressPress);
    await db.delete(loadMembers);

    const { rowsInserted, etlLog } = await runCongressPressETL(db, {
      dataDir: MOCK_DATA_DIR,
      logPath: TEST_LOG,
    });

    expect(rowsInserted).toBe(10);
    expect(etlLog.rowsInserted).toBe(10);

    const logText = readFileSync(TEST_LOG, 'utf8');
    expect(logText).toContain('member.member_district');
    expect(logText).toContain('Rows inserted: 10');
  });
});
