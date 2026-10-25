export type PrintPricingMode = 'page' | 'print';
type PrintModeEligibility = {
  eligible_bw_single?: boolean;
  eligible_bw_back_to_back?: boolean;
  eligible_color_single?: boolean;
  eligible_color_back_to_back?: boolean;
};

export function isPrintModeEligible(
  pricing: PrintModeEligibility,
  paper: PrintModeEligibility | undefined,
  isColor: boolean,
  isDuplex: boolean
): boolean {
  const key = `eligible_${isColor ? 'color' : 'bw'}_${isDuplex ? 'back_to_back' : 'single'}` as const;
  return pricing[key] !== false && (paper?.[key] ?? true);
}

export function getShortDocumentRate(
  totalPages: number,
  pageLimit: number,
  shortPageRate: number
): number | undefined {
  if (pageLimit < 1 || totalPages > pageLimit || shortPageRate <= 0) {
    return undefined;
  }

  return shortPageRate;
}

export function getDocumentPageCounts(totalPages: number, documentPageCounts?: number[]): number[] {
  if (
    documentPageCounts?.length &&
    documentPageCounts.every((pages) => Number.isInteger(pages) && pages > 0)
  ) {
    return documentPageCounts;
  }

  return [Math.max(1, totalPages || 1)];
}

export function getBillablePrintUnits(
  totalPages: number,
  copies: number,
  isDuplex: boolean,
  mode: PrintPricingMode
): number {
  const pages = Math.max(1, totalPages || 1);
  const copyCount = Math.max(1, copies || 1);
  const unitsPerCopy = mode === 'page' && isDuplex ? Math.ceil(pages / 2) : pages;

  return unitsPerCopy * copyCount;
}

export function getBillablePrintUnitsForDocuments(
  documentPageCounts: number[],
  copies: number,
  isDuplex: boolean,
  mode: PrintPricingMode
): number {
  return documentPageCounts.reduce(
    (total, pages) => total + getBillablePrintUnits(pages, copies, isDuplex, mode),
    0
  );
}
