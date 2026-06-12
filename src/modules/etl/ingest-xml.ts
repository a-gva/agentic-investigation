import { readFileSync } from 'node:fs';
import type { NewDbRecord } from '../../db/schema.js';
import { toEtlFilePath } from './etl-file-path.js';
import { parseXmlContent } from './parse-xml-file.js';

/** Sync parse on the main thread (fallback). Requires `setDataDir` beforehand. */
export function ingestXmlFile(filePath: string): NewDbRecord[] {
  const content = readFileSync(filePath, 'utf8');
  return parseXmlContent(filePath, content, toEtlFilePath(filePath));
}
