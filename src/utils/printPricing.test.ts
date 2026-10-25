import { describe, expect, it } from 'vitest';
import {
  getBillablePrintUnits,
  getBillablePrintUnitsForDocuments,
  getDocumentPageCounts,
  getShortDocumentRate,
  isPrintModeEligible,
} from './printPricing';

describe('getBillablePrintUnits', () => {
  it('counts physical sheets for duplex jobs in page pricing mode', () => {
    expect(getBillablePrintUnits(3, 1, true, 'page')).toBe(2);
    expect(getBillablePrintUnits(4, 2, true, 'page')).toBe(4);
  });

  describe('getShortDocumentRate', () => {
    it('uses the special rate through the configured page limit', () => {
      expect(getShortDocumentRate(2, 4, 5)).toBe(5);
      expect(getShortDocumentRate(4, 4, 5)).toBe(5);
    });

    it('uses the regular rate above the limit or when disabled', () => {
      expect(getShortDocumentRate(5, 4, 5)).toBeUndefined();
      expect(getShortDocumentRate(1, 0, 5)).toBeUndefined();
    });
  });

  describe('isPrintModeEligible', () => {
    const allModes = {
      eligible_bw_single: true,
      eligible_bw_back_to_back: true,
      eligible_color_single: true,
      eligible_color_back_to_back: true,
    };

    it('requires both global and selected-paper eligibility', () => {
      expect(isPrintModeEligible(allModes, { ...allModes, eligible_color_back_to_back: false }, true, true)).toBe(false);
      expect(isPrintModeEligible({ ...allModes, eligible_color_back_to_back: false }, allModes, true, true)).toBe(false);
      expect(isPrintModeEligible(allModes, allModes, true, false)).toBe(true);
    });

    it('keeps existing paper types eligible when no paper settings exist', () => {
      expect(isPrintModeEligible(allModes, undefined, false, true)).toBe(true);
    });
  });

  it('counts every document page in print pricing mode', () => {
    expect(getBillablePrintUnits(3, 2, true, 'print')).toBe(6);
  });

  it('counts each page for single-sided jobs in either mode', () => {
    expect(getBillablePrintUnits(3, 2, false, 'page')).toBe(6);
    expect(getBillablePrintUnits(3, 2, false, 'print')).toBe(6);
  });

  it('keeps page-limit checks independent for each document', () => {
    const documentPages = getDocumentPageCounts(6, [2, 3, 6]);
    const rates = documentPages.map((pages) => getShortDocumentRate(pages, 5, 2));

    expect(rates).toEqual([2, 2, undefined]);
  });

  it('counts billable units separately for each document', () => {
    expect(getBillablePrintUnitsForDocuments([3, 3], 1, true, 'page')).toBe(4);
    expect(getBillablePrintUnitsForDocuments([2, 3, 6], 1, false, 'print')).toBe(11);
  });

  it('falls back to the total page count when no document breakdown is available', () => {
    expect(getDocumentPageCounts(6)).toEqual([6]);
    expect(getDocumentPageCounts(6, [])).toEqual([6]);
  });
});
