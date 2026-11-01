export type CustomPageRange = Record<string, unknown> & {
  fromPage: number;
  toPage: number;
  printType?: string;
  color_mode?: string;
  sides?: string;
  side?: string;
  duplex?: string;
  pageSize?: string;
};

export function getConfiguredCustomRanges(
  config: Record<string, unknown>,
  fallbackRange?: unknown
): CustomPageRange[] {
  const camelCaseRanges = config.customRanges;
  const snakeCaseRanges = config.custom_ranges;
  const savedRanges = Array.isArray(camelCaseRanges) && camelCaseRanges.length > 0
    ? camelCaseRanges
    : Array.isArray(snakeCaseRanges) && snakeCaseRanges.length > 0
      ? snakeCaseRanges
      : null;

  if (savedRanges) {
    return savedRanges.flatMap((range): CustomPageRange[] => {
      if (!range || typeof range !== 'object') return [];
      const value = range as Record<string, unknown>;
      const fromPage = Number(value.fromPage ?? value.from);
      const toPage = Number(value.toPage ?? value.to ?? fromPage);
      if (!Number.isSafeInteger(fromPage) || !Number.isSafeInteger(toPage) || fromPage < 1 || toPage < fromPage) {
        return [];
      }
      return [{
        ...value,
        fromPage,
        toPage,
        printType: typeof value.printType === 'string' ? value.printType : undefined,
        color_mode: typeof value.color_mode === 'string' ? value.color_mode : undefined,
        sides: typeof value.sides === 'string' ? value.sides : undefined,
        side: typeof value.side === 'string' ? value.side : undefined,
        duplex: typeof value.duplex === 'string' ? value.duplex : undefined,
        pageSize: typeof value.pageSize === 'string' ? value.pageSize : undefined,
      }];
    });
  }

  const rangeText = String(
    config.selectedPageRange ||
    config.page_range ||
    config.pageRange ||
    fallbackRange ||
    ''
  ).trim();
  if (!rangeText || ['all', 'all pages'].includes(rangeText.toLowerCase())) return [];

  return rangeText.split(',').flatMap((part): CustomPageRange[] => {
    const match = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) return [];
    const fromPage = Number(match[1]);
    const toPage = Number(match[2] || match[1]);
    if (!Number.isSafeInteger(fromPage) || !Number.isSafeInteger(toPage) || fromPage < 1 || toPage < fromPage) {
      return [];
    }
    return [{ fromPage, toPage }];
  });
}
