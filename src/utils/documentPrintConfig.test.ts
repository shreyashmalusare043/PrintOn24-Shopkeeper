import { describe, expect, it } from 'vitest';
import { getConfiguredCustomRanges } from './documentPrintConfig';

describe('getConfiguredCustomRanges', () => {
  it('uses saved custom ranges for both preview and printing', () => {
    expect(
      getConfiguredCustomRanges({
        customRanges: [{ fromPage: 2, toPage: 4, printType: 'Color' }],
      })
    ).toEqual([{ fromPage: 2, toPage: 4, printType: 'Color' }]);
  });

  it('reads legacy snake-case custom ranges when camel-case ranges are empty', () => {
    expect(
      getConfiguredCustomRanges({
        customRanges: [],
        custom_ranges: [{ from: 6, to: 8 }],
      })
    ).toEqual([{ from: 6, to: 8, fromPage: 6, toPage: 8 }]);
  });

  it('parses the edited page-range text when no saved range list exists', () => {
    expect(getConfiguredCustomRanges({ selectedPageRange: '1-3, 5' })).toEqual([
      { fromPage: 1, toPage: 3 },
      { fromPage: 5, toPage: 5 },
    ]);
  });

  it('treats an all-pages selection as no custom ranges', () => {
    expect(getConfiguredCustomRanges({ selectedPageRange: 'All Pages' })).toEqual([]);
  });
});
