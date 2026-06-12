import { relative, resolve } from 'node:path';

let dataDir = resolve('./data');

export function setDataDir(dir: string): void {
  dataDir = resolve(dir);
}

/** Project-root-relative path (e.g. /data/senate/2022/...). */
export function toEtlFilePath(filePath: string): string {
  const rel = relative(dataDir, resolve(filePath)).replace(/\\/g, '/');
  return `/data/${rel}`;
}
