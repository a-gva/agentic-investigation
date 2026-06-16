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
 *
 * Throws if `filePath` resolves outside `dataDir` — this would cause
 * `relative()` to return a `..`-prefixed string, and using `posix.join` on
 * such a value would silently normalise `/data/../foo` → `/foo`, breaking the
 * invariant that every stored key starts with `/data/`.
 */
export function toEtlFilePath(filePath: string): string {
  const rel = relative(dataDir, resolve(filePath)).split(sep).join(posix.sep);
  if (rel.startsWith('..')) {
    throw new Error(`toEtlFilePath: filePath is outside dataDir.\n  filePath: ${filePath}\n  dataDir:  ${dataDir}`);
  }
  return `/data/${rel}`;
}
