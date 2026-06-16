import { posix, relative, resolve, sep } from 'node:path';

let dataDir = resolve('./data');

export function setDataDir(dir: string): void {
  dataDir = resolve(dir);
}

/**
 * Canonical project-root-relative path (e.g. /data/senate/2022/...).
 * Built with POSIX separators so a record's `file_path` is identical on
 * Windows, macOS, and Linux. Splitting on the platform `sep` (rather than a
 * `\` regex) avoids mangling paths that legitimately contain a backslash on
 * non-Windows filesystems.
 */
export function toEtlFilePath(filePath: string): string {
  const rel = relative(dataDir, resolve(filePath)).split(sep).join(posix.sep);
  return posix.join('/data', rel);
}
