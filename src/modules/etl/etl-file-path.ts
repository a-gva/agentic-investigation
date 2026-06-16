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
 * Throws if `filePath` resolves outside `dataDir`. Containment is validated
 * by checking that the resolved absolute path starts with `dataDir + sep`,
 * which correctly rejects cross-drive/UNC paths on Windows (where
 * `relative()` would return an absolute path rather than a `..`-prefixed
 * string) and avoids false positives for directory names that begin with `..`
 * (e.g. `..foo`). A case-insensitive comparison is used on Windows to handle
 * NTFS case folding.
 */
export function toEtlFilePath(filePath: string): string {
  const resolvedFile = resolve(filePath);
  const prefix = dataDir.endsWith(sep) ? dataDir : dataDir + sep;
  const contained =
    process.platform === 'win32'
      ? resolvedFile.toLowerCase().startsWith(prefix.toLowerCase())
      : resolvedFile.startsWith(prefix);
  if (!contained) {
    throw new Error(`toEtlFilePath: filePath is outside dataDir.\n  filePath: ${filePath}\n  dataDir:  ${dataDir}`);
  }
  const rel = relative(dataDir, resolvedFile).split(sep).join(posix.sep);
  return `/data/${rel}`;
}
