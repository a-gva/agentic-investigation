import { createHash } from 'node:crypto';
import type { LegislativeRecord } from '../types.js';

function hash(...parts: (string | number | null | undefined)[]): string {
  return createHash('sha256').update(parts.map(p => String(p ?? '')).join('\x00')).digest('hex').slice(0, 32);
}

function parseCents(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = parseFloat(String(val).replace(/,/g, '').trim());
  return isNaN(n) ? null : Math.round(n * 100);
}

function trim(val: unknown): string | null {
  const s = String(val ?? '').trim();
  return s || null;
}

function forceArray<T>(val: T | T[] | null | undefined): T[] {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeHouseXml(parsed: any, fileName: string): LegislativeRecord[] {
  const out: LegislativeRecord[] = [];
  const doc = parsed.LOBBYINGDISCLOSURE2 ?? parsed;

  const orgName    = trim(doc.organizationName) ?? '';
  const clientName = trim(doc.clientName) ?? '';
  const senateId   = trim(doc.senateID);
  const houseId    = trim(doc.houseID);
  const reportYear = Number(trim(doc.reportYear)) || null;
  const reportType = trim(doc.reportType);
  const signedDate = trim(doc.signedDate);

  let isoDate: string | null = null;
  if (signedDate) {
    const [datePart] = signedDate.split(' ');
    if (datePart) {
      const parts = datePart.split('/');
      if (parts.length === 3) {
        const [m, d, y] = parts;
        isoDate = `${y}-${(m ?? '').padStart(2, '0')}-${(d ?? '').padStart(2, '0')}`;
      }
    }
  }

  const aliInfos = forceArray(doc.alis?.ali_info);

  if (aliInfos.length === 0) {
    out.push({
      source:      'house',
      subSource:   'filing',
      recordType:  reportType,
      date:        isoDate,
      fiscalYear:  reportYear,
      entityName:  orgName || null,
      entityType:  'registrant',
      entityState: null,
      counterparty: clientName || null,
      amountCents: parseCents(doc.income) ?? parseCents(doc.expenses),
      description: null,
      tags:        JSON.stringify([]),
      rawHash:     hash('house', 'filing', houseId ?? fileName, '0'),
      metadata:    JSON.stringify({
        senate_id: senateId,
        house_id: houseId,
        file: fileName,
        income: trim(doc.income),
        expenses: trim(doc.expenses),
        no_lobbying: trim(doc.noLobbying),
      }),
    });
    return out;
  }

  for (let i = 0; i < aliInfos.length; i++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ali: any = aliInfos[i];
    const issueCode   = trim(ali.issueAreaCode);
    const description = trim(ali.specific_issues?.description ?? ali.specific_issues);

    const coveredPositions: string[] = [];
    const lobbyists: string[] = [];
    for (const l of forceArray(ali.lobbyists?.lobbyist)) {
      const name = [trim(l.lobbyistFirstName), trim(l.lobbyistLastName)].filter(Boolean).join(' ');
      if (name) lobbyists.push(name);
      const cp = trim(l.coveredPosition);
      if (cp) coveredPositions.push(cp);
    }

    out.push({
      source:      'house',
      subSource:   'filing',
      recordType:  reportType,
      date:        isoDate,
      fiscalYear:  reportYear,
      entityName:  orgName || null,
      entityType:  'registrant',
      entityState: null,
      counterparty: clientName || null,
      amountCents: i === 0 ? (parseCents(doc.income) ?? parseCents(doc.expenses)) : null,
      description,
      tags:    JSON.stringify([issueCode].filter(Boolean)),
      rawHash: hash('house', 'filing', houseId ?? fileName, String(i)),
      metadata: JSON.stringify({
        senate_id: senateId,
        house_id: houseId,
        file: fileName,
        income: trim(doc.income),
        expenses: trim(doc.expenses),
        issue_area_code: issueCode,
        covered_positions: coveredPositions,
        lobbyists,
        foreign_entity_issues: trim(ali.foreign_entity_issues) ?? null,
      }),
    });
  }

  return out;
}
