import { XMLParser } from 'fast-xml-parser';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import type { LegislativeRecord } from '../../db/types.js';
import { normalizeHouseXml } from './normalize-house.js';

const XML_ARRAY_TAGS = new Set([
  'ali_info',
  'lobbyist',
  'ali_Code',
  'inactive_lobbyist',
  'inactive_ForeignEntity',
  'affiliatedOrg',
  'inactiveOrgName',
  'foreignEntity',
]);

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  trimValues: true,
  isArray: (name) => XML_ARRAY_TAGS.has(name),
  parseTagValue: true,
  allowBooleanAttributes: true,
});

export function ingestXmlFile(filePath: string): LegislativeRecord[] {
  const content = readFileSync(filePath, 'utf8');
  const parsed = xmlParser.parse(content);
  return normalizeHouseXml(parsed, basename(filePath));
}
