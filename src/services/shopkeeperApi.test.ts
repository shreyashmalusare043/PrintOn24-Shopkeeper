import { describe, expect, it } from 'vitest';
import type { ShopPrinter } from '@/types/shopkeeper';
import { shopkeeperApi } from './shopkeeperApi';

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
});
