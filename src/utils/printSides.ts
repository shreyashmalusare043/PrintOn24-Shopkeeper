export function isDuplexPrint(sides: unknown): boolean {
  if (sides === true) return true;
  const normalized = String(sides ?? '').trim().toLowerCase();
  return normalized.includes('back') || normalized.includes('double') || normalized.includes('duplex') || normalized.includes('tumble');
}

export function normalizePrintSides(sides: unknown): 'Single Side' | 'Back-to-Back' {
  return isDuplexPrint(sides) ? 'Back-to-Back' : 'Single Side';
}
