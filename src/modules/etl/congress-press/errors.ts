import { basename } from 'node:path';

/** Short error for console — never includes SQL params or row content. */
export function formatEtlFileError(filePath: string, err: unknown): string {
  const file = basename(filePath);

  if (err && typeof err === 'object') {
    const cause = (err as { cause?: { message?: string; code?: string } }).cause;
    if (cause?.message) {
      const code = cause.code ? ` (${cause.code})` : '';
      return `${file}${code}: ${cause.message}`;
    }
  }

  if (err instanceof Error) {
    const head = (err.message.split('\n')[0] ?? err.message).trim();
    if (head.startsWith('Failed query:')) {
      return `${file}: database query failed`;
    }
    return `${file}: ${head}`;
  }

  return `${file}: ${String(err)}`;
}
