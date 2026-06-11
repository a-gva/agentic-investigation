/** Coerce nullable ETL values to Postgres record column types. */

export function str(v: string | null | undefined): string {
  return v ?? '';
}

export function dateStr(v: string | null | undefined): string {
  return v?.slice(0, 10) || '1970-01-01';
}

export function fiscalYear(
  date: string | null | undefined,
  year?: number | null,
): number {
  if (year != null && year > 0) return year;
  const y = date?.slice(0, 4);
  return y ? Number(y) || 0 : 0;
}

export function cents(v: number | null | undefined): string {
  return String(v ?? 0);
}

export function tags(...items: (string | null | undefined)[]): string[] {
  return items.filter((x): x is string => Boolean(x));
}

export function meta(obj: Record<string, unknown>): Record<string, unknown> {
  return obj;
}
