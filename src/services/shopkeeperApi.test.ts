import { describe, expect, it } from 'vitest';
import type { ShopPrinter } from '@/types/shopkeeper';
import { shopkeeperApi } from './shopkeeperApi';
import { isDuplexPrint, normalizePrintSides } from '@/utils/printSides';

const monochromePrinter: ShopPrinter = {
  id: 'printer-1',
  shop_id: 'shop-1',
  name: 'HP LaserJet',
  model: 'HP LaserJet',
  connection_type: 'usb',
  status: 'online',
  is_online: true,
  usage_type: 'B&W Only',
  is_color: false,
  is_duplex: false,
  capabilities: {
    color: false,
    bw: true,
    single_side: true,
    double_side: false,
  },
  paper_sizes: ['A4'],
  paper_types: ['Standard 75 GSM'],
  is_default: true,
};

describe('shopkeeperApi.matchPrinterToPrintConfig', () => {
  it('matches legacy Standard paper orders to configured Standard 75 GSM paper', () => {
    const result = shopkeeperApi.matchPrinterToPrintConfig(monochromePrinter, {
      pageSize: 'A4',
      paperType: 'Standard',
      printType: 'Black & White',
      sides: 'Single Side',
    });

    expect(result).toEqual({ isCompatible: true, reasons: [] });
  });

  it('still rejects a paper type the printer does not support', () => {
    const result = shopkeeperApi.matchPrinterToPrintConfig(monochromePrinter, {
      pageSize: 'A4',
      paperType: 'Bond Paper',
      printType: 'Black & White',
      sides: 'Single Side',
    });

    expect(result.isCompatible).toBe(false);
    expect(result.reasons).toContain(
      'Requires Bond Paper paper type, which is unsupported by printer.'
    );
  });

  it('does not treat a single-side printer as compatible with a duplex document', () => {
    const result = shopkeeperApi.matchPrinterToPrintConfig(monochromePrinter, {
      pageSize: 'A4',
      paperType: 'Standard',
      printType: 'Black & White',
      sides: normalizePrintSides('Duplex'),
    });

    expect(result.isCompatible).toBe(false);
    expect(result.reasons).toContain(
      'Requires Back-to-Back (Duplex) printing, but printer only supports Single Side.'
    );
  });

  it('rejects a printer whose duplex capability is explicitly disabled even if its legacy flag is true', () => {
    const conflictingPrinter = {
      ...monochromePrinter,
      is_duplex: true,
      capabilities: {
        ...monochromePrinter.capabilities,
        double_side: false,
      },
    };

    const result = shopkeeperApi.matchPrinterToPrintConfig(conflictingPrinter, {
      pageSize: 'A4',
      paperType: 'Standard',
      printType: 'Black & White',
      sides: 'Back-to-Back',
    });

    expect(result.isCompatible).toBe(false);
  });
});

describe('print side normalization', () => {
  it.each(['Back-to-Back', 'Duplex', 'double-sided', 'Tumble', true])(
    'recognizes %s as duplex',
    (sides) => {
      expect(isDuplexPrint(sides)).toBe(true);
      expect(normalizePrintSides(sides)).toBe('Back-to-Back');
    }
  );

  it('keeps explicit single-side configurations simplex', () => {
    expect(isDuplexPrint('Single Side')).toBe(false);
    expect(normalizePrintSides('Single Side')).toBe('Single Side');
  });
});
