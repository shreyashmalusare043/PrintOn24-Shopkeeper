import { type QzPrintPayload, type QzTrayStatus, qzTrayService } from '@/services/qzTrayService';
import type { DetectedPrinter } from '@/types/shopkeeper';

export type { DetectedPrinter };

export interface AgentStatus {
  connected: boolean;
  agent_version: string;
  hostname: string;
  os_info: string;
  ip_address: string;
  detected_printers_count: number;
  last_heartbeat: string;
  platform?: string;
  error?: string;
  pna_blocked?: boolean;
  linked_shop_id?: string;
  agent_id?: string;
}

export interface PrintJobPayload {
  orderId?: string;
  shopId: string;
  pcId: string;
  printerId: string;
  printerName: string;
  fileName: string;
  fileUrl?: string;
  pageImages?: string[]; // High-res 300 DPI sheet images matching preview 1:1
  copies: number;
  colorMode: 'B&W' | 'Color';
  duplex: 'Single Side' | 'Back-to-Back';
  paperSize: 'A4' | 'A3' | 'Legal' | 'Letter' | 'A5' | 'Tabloid' | 'Executive' | 'Glossy' | string;
  paperType: 'Standard 75 GSM' | 'Bond Paper' | 'Glossy' | 'Executive' | string;
  pageCount: number;
  pageRange?: string;
  totalPrice: number;
  orientation?: 'Portrait' | 'Landscape';
  mediaSource?: string;
  tray?: string;
  mediaType?: string;
  scaling?: 'fit' | 'shrink' | 'none' | string;
  dpi?: number;
  driverProperties?: Record<string, any>;
}

class QzPrintAdapter {
  constructor() {}

  public subscribeStatus(listener: (status: AgentStatus) => void): () => void {
    return qzTrayService.subscribeStatus((qzStatus: QzTrayStatus) => {
      listener({
        connected: qzStatus.connected,
        agent_version: qzStatus.version,
        hostname: 'Local-Workstation',
        os_info: 'QZ Tray Print Spooler',
        ip_address: 'localhost (ws://localhost:8182)',
        detected_printers_count: qzStatus.printerCount,
        last_heartbeat: qzStatus.lastChecked,
        error: qzStatus.error,
        pna_blocked: false,
      });
    });
  }

  public subscribePrinters(listener: (printers: DetectedPrinter[]) => void): () => void {
    return qzTrayService.subscribePrinters(listener);
  }

  public async enumeratePrinters(): Promise<DetectedPrinter[]> {
    return qzTrayService.findAllPrinters();
  }

  public async getConnectedPrinters(includeVirtual = false): Promise<DetectedPrinter[]> {
    return qzTrayService.findAllPrinters(includeVirtual);
  }

  public async scanUsbDevice(): Promise<DetectedPrinter | null> {
    const list = await qzTrayService.findAllPrinters();
    return list[0] || null;
  }

  public async sendPrintJob(payload: PrintJobPayload) {
    return this.dispatchPrintJob(payload);
  }

  public async dispatchPrintJob(payload: PrintJobPayload): Promise<{
    success: boolean;
    jobId: string;
    message: string;
  }> {
    const qzPayload: QzPrintPayload = {
      orderId: payload.orderId,
      printerName: payload.printerName,
      fileName: payload.fileName,
      fileUrl: payload.fileUrl || '',
      pageImages: payload.pageImages,
      copies: payload.copies,
      colorMode: payload.colorMode,
      duplex: payload.duplex,
      paperSize: payload.paperSize,
      paperType: payload.paperType,
      orientation: payload.orientation || 'Portrait',
      pageRange: payload.pageRange,
      mediaSource: payload.mediaSource || payload.tray,
      tray: payload.tray,
      mediaType: payload.mediaType || payload.paperType,
      scaling: payload.scaling,
      driverProperties: payload.driverProperties,
    };

    return qzTrayService.printPdf(qzPayload);
  }

  public getStatus(): AgentStatus {
    const qzStatus = qzTrayService.getStatus();
    return {
      connected: qzStatus.connected,
      agent_version: qzStatus.version,
      hostname: 'Local-Workstation',
      os_info: 'QZ Tray Print Spooler',
      ip_address: 'localhost',
      detected_printers_count: qzStatus.printerCount,
      last_heartbeat: qzStatus.lastChecked,
      error: qzStatus.error,
      pna_blocked: false,
    };
  }

  public isAgentConnected(): boolean {
    return qzTrayService.isConnected();
  }

  public isPnaBlocked(): boolean {
    return false;
  }

  public setShopCredentials(_shopId: string, _token?: string, _agentId?: string) {
    // QZ Tray is workstation-native; no legacy token needed
  }
}

export const localPrintAgent = new QzPrintAdapter();
