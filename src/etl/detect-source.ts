type Source = 'senate' | 'house' | 'congress_press';

export function detectSource(filePath: string): Source {
  const lower = filePath.toLowerCase();
  if (lower.includes('congress_press')) return 'congress_press';
  if (lower.includes('senate') || lower.includes('sen_')) return 'senate';
  if (lower.includes('house') || lower.includes('hse_')) return 'house';
  throw new Error(`Cannot detect source for path: ${filePath}`);
}

export function detectSubSource(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.includes('contribution')) return 'contribution';
  if (lower.includes('congress_press')) return 'press';
  if (lower.endsWith('.xml')) return 'filing';
  return 'filing';
}
