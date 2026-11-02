import { describe, expect, it } from 'vitest';
import { getQzDuplexOption, normalizeDuplexMode, normalizePrintSides } from './printSides';

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

  it.each([
    ['Back-to-Back', 'Portrait', 'duplex'],
    ['Tumble', 'Portrait', 'tumble'],
    ['Back-to-Back', 'Landscape', 'tumble'],
    ['Tumble', 'Landscape', 'duplex'],
    ['Single Side', 'Landscape', false],
  ] as const)('maps %s in %s orientation to QZ option %s', (mode, orientation, expected) => {
    expect(getQzDuplexOption(mode, orientation)).toBe(expected);
  });
});
