import type { PrintedSegment } from '@/types/shopkeeper';

/**
 * Calculate exact unprinted sub-ranges for any page interval [fromPage, toPage]
 * Guarantees zero reprint by omitting any page already confirmed printed.
 */
export function getUnprintedSubRanges(
  fromPage: number,
  toPage: number,
  isPagePrintedFn: (page: number) => boolean
): Array<{ fromPage: number; toPage: number }> {
  const unprintedPages: number[] = [];
  for (let p = fromPage; p <= toPage; p++) {
    if (!isPagePrintedFn(p)) {
      unprintedPages.push(p);
    }
  }

  if (unprintedPages.length === 0) return [];

  const subRanges: Array<{ fromPage: number; toPage: number }> = [];
  let currentStart = unprintedPages[0];
  let currentEnd = unprintedPages[0];

  for (let i = 1; i < unprintedPages.length; i++) {
    if (unprintedPages[i] === currentEnd + 1) {
      currentEnd = unprintedPages[i];
    } else {
      subRanges.push({ fromPage: currentStart, toPage: currentEnd });
      currentStart = unprintedPages[i];
      currentEnd = unprintedPages[i];
    }
  }
  subRanges.push({ fromPage: currentStart, toPage: currentEnd });
  return subRanges;
}

/**
 * Generate explicit page-level print status breakdown (Printed, Pending, Not Selected)
 * for saving persistently into database on "Keep Order" or partial print events.
 */
export function computeDocumentPageStatuses(
  doc: any,
  alreadyPrinted: PrintedSegment[],
  docTotalPages: number
): Array<{
  page: number;
  status: 'Printed' | 'Pending' | 'Not Selected';
  color_mode?: string;
  duplex?: string;
  page_size?: string;
}> {
  const cfg = doc.print_config || {};
  
  // Check both structured customRanges and string range specifications (e.g. "2-4", "3", "1, 3, 5-7")
  let customRanges = Array.isArray(cfg.customRanges) ? cfg.customRanges : [];
  const rangeStr = String(cfg.selectedPageRange || cfg.page_range || cfg.pageRange || doc.page_range || '').trim();
  
  if (customRanges.length === 0 && rangeStr && rangeStr.toLowerCase() !== 'all' && rangeStr.toLowerCase() !== 'all pages') {
    // Parse range string into subranges
    const parts = rangeStr.split(',').map((p: string) => p.trim()).filter(Boolean);
    customRanges = parts.map((part: string) => {
      if (part.includes('-')) {
        const [fromS, toS] = part.split('-');
        return {
          fromPage: Math.max(1, parseInt(fromS, 10) || 1),
          toPage: Math.min(docTotalPages, Math.max(1, parseInt(toS, 10) || 1)),
          printType: cfg.printType || 'B&W',
          sides: cfg.sides || 'Single Side',
          pageSize: cfg.pageSize || 'A4',
        };
      } else {
        const pNum = Math.max(1, Math.min(docTotalPages, parseInt(part, 10) || 1));
        return {
          fromPage: pNum,
          toPage: pNum,
          printType: cfg.printType || 'B&W',
          sides: cfg.sides || 'Single Side',
          pageSize: cfg.pageSize || 'A4',
        };
      }
    });
  }

  const isCustomRange = (cfg.pageRangeType === 'Custom Range' || customRanges.length > 0) && customRanges.length > 0;
  const result: Array<{
    page: number;
    status: 'Printed' | 'Pending' | 'Not Selected';
    color_mode?: string;
    duplex?: string;
    page_size?: string;
  }> = [];

  for (let p = 1; p <= docTotalPages; p++) {
    const isPrinted = alreadyPrinted.some((seg) => {
      const match = seg.doc_id === doc.id || seg.doc_name === doc.file_name;
      if (!match) return false;
      const range = String(seg.page_range || '').trim();
      if (range === 'All Pages' || range === 'all') return true;
      if (range.includes('-')) {
        const [fromStr, toStr] = range.split('-');
        const from = parseInt(fromStr, 10);
        const to = parseInt(toStr, 10);
        return !isNaN(from) && !isNaN(to) && p >= from && p <= to;
      }
      return parseInt(range, 10) === p;
    });

    if (isPrinted) {
      result.push({ page: p, status: 'Printed' });
      continue;
    }

    if (isCustomRange) {
      const matchingRange = customRanges.find((r: any) => {
        const rFrom = Number(r.fromPage ?? r.from ?? 1);
        const rTo = Number(r.toPage ?? r.to ?? rFrom);
        return p >= rFrom && p <= rTo;
      });

      if (matchingRange) {
        result.push({
          page: p,
          status: 'Pending',
          color_mode: matchingRange.printType || cfg.printType || 'B&W',
          duplex: matchingRange.sides || cfg.sides || 'Single Side',
          page_size: matchingRange.pageSize || cfg.pageSize || 'A4',
        });
      } else {
        result.push({
          page: p,
          status: 'Not Selected',
        });
      }
    } else {
      result.push({
        page: p,
        status: 'Pending',
        color_mode: cfg.printType || 'B&W',
        duplex: cfg.sides || 'Single Side',
        page_size: cfg.pageSize || 'A4',
      });
    }
  }

  return result;
}
