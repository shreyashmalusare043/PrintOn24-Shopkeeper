import { describe, expect, it } from 'vitest';
import { buildCollatedPrintRuns } from './collatedPrintRuns';

describe('buildCollatedPrintRuns', () => {
  it('sends every complete plan in a copy set before starting the next set', () => {
    const plans = [
      { name: 'Page 1 color', copies: 2 },
      { name: 'Pages 2-4 duplex', copies: 2 },
    ];

    expect(buildCollatedPrintRuns(plans).map(({ plan, copyNumber }) => `${copyNumber}:${plan.name}`)).toEqual([
      '1:Page 1 color',
      '1:Pages 2-4 duplex',
      '2:Page 1 color',
      '2:Pages 2-4 duplex',
    ]);
  });

  it('supports different copy counts without sending extra copies', () => {
    const plans = [
      { name: 'Document A', copies: 3 },
      { name: 'Document B', copies: 1 },
    ];

    expect(buildCollatedPrintRuns(plans).map(({ plan, copyNumber }) => `${copyNumber}:${plan.name}`)).toEqual([
      '1:Document A',
      '1:Document B',
      '2:Document A',
      '3:Document A',
    ]);
  });
});
