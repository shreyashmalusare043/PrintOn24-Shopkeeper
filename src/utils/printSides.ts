export type DuplexMode = 'Single Side' | 'Back-to-Back' | 'Tumble';

export function isDuplexPrint(sides: unknown): boolean {
  if (sides === true) return true;
  const normalized = String(sides ?? '').trim().toLowerCase();
  return (
    normalized.includes('back') ||
    normalized.includes('double') ||
    normalized.includes('duplex') ||
    normalized.includes('tumble') ||
    normalized.includes('two-sided') ||
    normalized.includes('long edge') ||
    normalized.includes('short edge')
  );
}

export function normalizeDuplexMode(sides: unknown): DuplexMode {
  if (!isDuplexPrint(sides)) return 'Single Side';

  const normalized = String(sides ?? '').trim().toLowerCase();
  return normalized.includes('short') || normalized.includes('tumble') ? 'Tumble' : 'Back-to-Back';
}

export function getQzDuplexOption(
  sides: unknown,
  orientation: 'Portrait' | 'Landscape' | string | undefined
): false | 'duplex' | 'tumble' {
  const mode = normalizeDuplexMode(sides);
  if (mode === 'Single Side') return false;

  const isLandscape = orientation?.toLowerCase() === 'landscape';
  const useTumble = (mode === 'Tumble') !== isLandscape;
  return useTumble ? 'tumble' : 'duplex';
}

export function normalizePrintSides(sides: unknown): 'Single Side' | 'Back-to-Back' {
  return isDuplexPrint(sides) ? 'Back-to-Back' : 'Single Side';
}
