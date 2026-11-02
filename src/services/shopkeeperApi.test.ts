import { describe, expect, it } from 'vitest';
import type { PrintOrder, ShopPrinter } from '@/types/shopkeeper';
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

const colorA3Printer: ShopPrinter = {
  ...monochromePrinter,
  id: 'printer-color-a3',
  name: 'Color A3 Printer',
  usage_type: 'Color Only',
  is_color: true,
  paper_sizes: ['A3'],
  capabilities: {
    color: true,
    bw: false,
    single_side: true,
    double_side: false,
  },
};

const printOrder: PrintOrder = {
  id: 'order-1',
  order_number: '1',
  user_id: 'user-1',
  shop_id: 'shop-1',
  shop_name: 'Shop',
  token_number: '1',
  document_name: 'document.pdf',
  file_type: 'application/pdf',
  total_pages: 1,
  config_copies: 1,
  config_page_size: 'A3',
  config_paper_type: 'Standard',
  config_print_type: 'Colour',
  config_sides: 'Single Side',
  subtotal: 0,
  discount: 0,
  platform_fee: 0,
  grand_total: 0,
  payment_method: 'cash',
  payment_status: 'Completed',
  order_status: 'Pending',
  created_at: '2025-01-01T00:00:00.000Z',
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

  it('does not restrict paper types when none are selected for the printer', () => {
    const printerWithoutPaperTypeRestrictions = {
      ...monochromePrinter,
      paper_types: [],
    };

    const result = shopkeeperApi.matchPrinterToPrintConfig(printerWithoutPaperTypeRestrictions, {
      pageSize: 'A4',
      paperType: 'Glossy',
      printType: 'Black & White',
      sides: 'Single Side',
    });

    expect(result).toEqual({ isCompatible: true, reasons: [] });
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

  it('uses order settings for values omitted from a partial document configuration', () => {
    const result = shopkeeperApi.findCompatiblePrinterForOrder(
      printOrder,
      [colorA3Printer],
      { sides: 'Single Side' }
    );

    expect(result.compatiblePrinter).toEqual(colorA3Printer);
    expect(result.allEvaluations[0].reasons).toEqual([]);
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
