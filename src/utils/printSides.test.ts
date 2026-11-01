import { describe, expect, it } from 'vitest';
import { normalizeDuplexMode, normalizePrintSides } from './printSides';

describe('print duplex modes', () => {
  it.each([
    ['Single Side', 'Single Side'],
    ['Back-to-Back', 'Back-to-Back'],
    ['Tumble', 'Tumble'],
    ['Two-Sided Short Edge', 'Tumble'],
    ['Two-Sided Long Edge', 'Back-to-Back'],
  ] as const)('normalizes %s to %s', (input, expected) => {
    expect(normalizeDuplexMode(input)).toBe(expected);
  });

  it('keeps short-edge duplex eligible as a duplex print', () => {
    expect(normalizePrintSides('Tumble')).toBe('Back-to-Back');
  });
});
