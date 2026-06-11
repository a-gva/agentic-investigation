import { createHash } from 'node:crypto';
import type { NewDbRecord } from '../../db/schema.js';
import {
  cents,
  dateStr,
  fiscalYear as coerceFiscalYear,
  meta,
  str,
  tags,
} from './coerce.js';

function hash(...parts: (string | number | null | undefined)[]): string {
  return createHash('sha256')
    .update(parts.map((p) => String(p ?? '')).join('\x00'))
    .digest('hex')
    .slice(0, 32);
}

function parseCents(val: string | null | undefined): number | null {
  if (!val) return null;
  const n = parseFloat(String(val).replace(/,/g, ''));
  return isNaN(n) ? null : Math.round(n * 100);
}

function isoDate(dt: string | null | undefined): string | null {
  if (!dt) return null;
  return dt.slice(0, 10);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeFiling(filing: any): NewDbRecord[] {
  const out: NewDbRecord[] = [];
  const registrantName: string = filing.registrant?.name ?? '';
  const clientName: string = filing.client?.name ?? '';
  const filingUuid: string = filing.filing_uuid ?? '';
  const fiscalYear: number =
    Number(filing.filing_year) || new Date().getFullYear();
  const filingType: string = filing.filing_type ?? '';
  const postedDate = isoDate(filing.dt_posted);

  const activities: unknown[] = Array.isArray(filing.lobbying_activities)
    ? filing.lobbying_activities
    : [];

  if (activities.length === 0) {
    out.push({
      source: 'senate',
      subSource: 'filing',
      recordType: str(filingType),
      date: dateStr(postedDate),
      fiscalYear: coerceFiscalYear(postedDate, fiscalYear),
      entityName: str(registrantName),
      entityType: 'registrant',
      entityState: str(filing.registrant?.state),
      counterparty: str(clientName),
      amountCents: cents(
        parseCents(filing.income) ?? parseCents(filing.expenses),
      ),
      description: '',
      tags: tags(),
      rawHash: hash('senate', 'filing', filingUuid, '0'),
      metadata: meta({
        filing_uuid: filingUuid,
        filing_period: filing.filing_period,
        income: filing.income,
        expenses: filing.expenses,
        foreign_entities: filing.foreign_entities ?? [],
        registrant_id: filing.registrant?.id,
        client_id: filing.client?.id,
      }),
    });
    return out;
  }

  for (let i = 0; i < activities.length; i++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const act: any = activities[i];
    const issueCode: string = act.general_issue_code ?? '';
    const description: string = act.description ?? '';

    const coveredPositions: string[] = [];
    const lobbyists: string[] = [];
    if (Array.isArray(act.lobbyists)) {
      for (const l of act.lobbyists) {
        const name = [l.lobbyist?.first_name, l.lobbyist?.last_name]
          .filter(Boolean)
          .join(' ');
        if (name) lobbyists.push(name);
        if (l.covered_position) coveredPositions.push(l.covered_position);
      }
    }

    out.push({
      source: 'senate',
      subSource: 'filing',
      recordType: str(filingType),
      date: dateStr(postedDate),
      fiscalYear: coerceFiscalYear(postedDate, fiscalYear),
      entityName: str(registrantName),
      entityType: 'registrant',
      entityState: str(filing.registrant?.state),
      counterparty: str(clientName),
      amountCents: cents(
        i === 0
          ? (parseCents(filing.income) ?? parseCents(filing.expenses))
          : null,
      ),
      description: str(description),
      tags: tags(issueCode),
      rawHash: hash('senate', 'filing', filingUuid, String(i)),
      metadata: meta({
        filing_uuid: filingUuid,
        filing_period: filing.filing_period,
        income: filing.income,
        expenses: filing.expenses,
        general_issue_code: issueCode,
        covered_positions: coveredPositions,
        lobbyists,
        foreign_entity_issues: act.foreign_entity_issues ?? null,
        foreign_entities: filing.foreign_entities ?? [],
        registrant_id: filing.registrant?.id,
        client_id: filing.client?.id,
      }),
    });
  }

  return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeContribution(report: any): NewDbRecord[] {
  const out: NewDbRecord[] = [];
  const filingUuid: string = report.filing_uuid ?? '';
  const fiscalYear: number =
    Number(report.filing_year) || new Date().getFullYear();
  const filingType: string = report.filing_type ?? '';
  const postedDate = isoDate(report.dt_posted);
  const registrantName: string = report.registrant?.name ?? '';
  const lobbyistName = [report.lobbyist?.first_name, report.lobbyist?.last_name]
    .filter(Boolean)
    .join(' ');

  const items: unknown[] = Array.isArray(report.contribution_items)
    ? report.contribution_items
    : [];

  for (let i = 0; i < items.length; i++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const item: any = items[i];

    const itemDate = isoDate(item.date) ?? postedDate;
    out.push({
      source: 'senate',
      subSource: 'contribution',
      recordType: str(filingType),
      date: dateStr(itemDate),
      fiscalYear: coerceFiscalYear(itemDate, fiscalYear),
      entityName: str(registrantName),
      entityType: 'registrant',
      entityState: str(report.registrant?.state),
      counterparty: str(lobbyistName),
      amountCents: cents(parseCents(item.amount)),
      description: str(
        [
          item.contributor_name,
          '→',
          item.payee_name,
          item.honoree_name ? `(${item.honoree_name})` : null,
        ]
          .filter(Boolean)
          .join(' '),
      ),
      tags: tags(item.contribution_type),
      rawHash: hash('senate', 'contribution', filingUuid, String(i)),
      metadata: meta({
        filing_uuid: filingUuid,
        filing_period: report.filing_period,
        filer_type: report.filer_type,
        contribution_type: item.contribution_type,
        contributor_name: item.contributor_name,
        payee_name: item.payee_name,
        honoree_name: item.honoree_name,
        registrant_id: report.registrant?.id,
        lobbyist_id: report.lobbyist?.id,
      }),
    });
  }

  return out;
}
