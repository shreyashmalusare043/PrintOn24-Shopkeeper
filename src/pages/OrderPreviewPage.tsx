import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  FileText,
  Layers,
  Maximize2,
  Menu,
  Minimize2,
  Pencil,
  Printer,
  RefreshCw,
  RotateCw,
  SlidersHorizontal,
  Sparkles,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ManualDuplexModal } from '@/components/ManualDuplexModal';
import { type PrinterDriverSettings, PrinterPropertiesDialog } from '@/components/modals/PrinterPropertiesDialog';
import { PartialPrintSummaryModal } from '@/components/PartialPrintSummaryModal';
import {
  PrintDocumentSelectionDialog,
} from '@/components/PrintDocumentSelectionDialog';
import { PrintProgressControls } from '@/components/PrintProgressControls';
import { QzPermissionModal } from '@/components/QzPermissionModal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useShopkeeper } from '@/contexts/ShopkeeperContext';
import { usePrintQueueControl } from '@/hooks/usePrintQueueControl';
import { localPrintAgent } from '@/services/localPrintAgent';
import {
  clearDocumentCache,
  loadDocument,
  loadDocumentFromBlob,
  type PdfDocumentWrapper,
  renderDocumentToPrintDataUrl,
  renderPdfPage,
} from '@/services/pdfViewerService';
import { isAllowedVirtualPrinter, isPhysicalPrinter } from '@/services/qzTrayService';
import { shopkeeperApi } from '@/services/shopkeeperApi';
import { supabase } from '@/services/supabase';
import type { PrintedSegment, PrintOrder, ShopPrinter } from '@/types/shopkeeper';
import { buildCollatedPrintRuns } from '@/utils/collatedPrintRuns';
import { getConfiguredCustomRanges } from '@/utils/documentPrintConfig';
import { computeDocumentPageStatuses, getUnprintedSubRanges } from '@/utils/printRangeUtils';
import { isDuplexPrint, normalizeDuplexMode, normalizePrintSides } from '@/utils/printSides';

interface UnifiedPreviewPage {
  key: string;
  docId: string;
  docIndex: number; // 0, 1, 2...
  docFileName: string;
  docTotalPages: number;
  docPrintConfig: any;
  pageNum: number; // primary page
  pageNums: number[]; // All pages on this sheet
  sheetIndex: number;
  totalSheetsInDoc: number;
  pagesPerSheet: string;
  globalIndex: number; // 0, 1, 2...
  isFirstPageOfDoc: boolean;
  docVisiblePagesCount: number;
  printType: string;
  sides: string;
  pageSize: string;
  paperType: string;
  layout: string;
  copies: number;
  isBw: boolean;
  isCustomRange: boolean;
  rangeLabel: string;
  pdfWrapper: PdfDocumentWrapper;
  docPaperSize?: string;
  detectedOrientation?: 'Portrait' | 'Landscape';
}

interface EditableCustomRange {
  pageRange: string;
  printType: 'Color' | 'Black & White';
  sides: 'Single Side' | 'Back-to-Back';
}

const parseSelectedPageRange = (
  input: string,
  totalPages: number
): { pageNumbers: Set<number>; error: string | null } => {
  const pageNumbers = new Set<number>();
  const parts = input.split(',').map((part) => part.trim());

  for (const part of parts) {
    const match = part.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) {
      return {
        pageNumbers,
        error: `Invalid page range "${part}". Use a number or range such as 2-6.`,
      };
    }

    const fromPage = Number(match[1]);
    const toPage = Number(match[2] || match[1]);
    if (!Number.isSafeInteger(fromPage) || !Number.isSafeInteger(toPage) || fromPage < 1 || toPage < fromPage) {
      return {
        pageNumbers,
        error: `Invalid page range "${part}". The start page must be less than or equal to the end page.`,
      };
    }
    if (toPage > totalPages) {
      return {
        pageNumbers,
        error: `Page ${toPage} is invalid. This document has only ${totalPages} page${totalPages === 1 ? '' : 's'}.`,
      };
    }

    for (let pageNumber = fromPage; pageNumber <= toPage; pageNumber += 1) {
      pageNumbers.add(pageNumber);
    }
  }

  return { pageNumbers, error: null };
};

export default function OrderPreviewPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { user, realPrinters } = useShopkeeper();

  // Core Data States
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [order, setOrder] = useState<PrintOrder | null>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [downloadingDocuments, setDownloadingDocuments] = useState(false);
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
  const [selectedDownloadDocumentIds, setSelectedDownloadDocumentIds] = useState<Set<string>>(new Set());
  const [docWrappers, setDocWrappers] = useState<{ [docId: string]: PdfDocumentWrapper }>({});
  const [previewErrors, setPreviewErrors] = useState<Record<string, string>>({});

  // View States
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  const [zoomScale, setZoomScale] = useState<number>(1.0);
  const [rotation, setRotation] = useState<number>(0);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [sidebarTab, setSidebarTab] = useState<'thumbnails' | 'details'>('thumbnails');
  const [, setRenderRevision] = useState(0);
  const [printing, setPrinting] = useState<boolean>(false);
  const printQueue = usePrintQueueControl();
  const [printSelectionOpen, setPrintSelectionOpen] = useState(false);
  const [selectedPrintDocumentIds, setSelectedPrintDocumentIds] = useState<Set<string>>(new Set());
  const [editingConfigDocumentId, setEditingConfigDocumentId] = useState<string | null>(null);
  const [editingCustomRanges, setEditingCustomRanges] = useState(false);
  const [editConfigRangeRules, setEditConfigRangeRules] = useState<EditableCustomRange[]>([]);
  const [savingDocumentConfig, setSavingDocumentConfig] = useState(false);
  const [editConfigCopies, setEditConfigCopies] = useState(1);
  const [editConfigPrintType, setEditConfigPrintType] = useState<'Color' | 'Black & White'>('Black & White');
  const [editConfigSides, setEditConfigSides] = useState<'Single Side' | 'Back-to-Back'>('Single Side');
  const [editConfigPageSize, setEditConfigPageSize] = useState('A4');
  const [editConfigPaperType, setEditConfigPaperType] = useState('Standard 75 GSM');
  const [editConfigOrientation, setEditConfigOrientation] = useState<'Portrait' | 'Landscape'>('Portrait');
  const [editConfigPagesPerSheet, setEditConfigPagesPerSheet] = useState('1-in-1');
  const [editConfigPageRange, setEditConfigPageRange] = useState('');
  const [editConfigPageRangeError, setEditConfigPageRangeError] = useState<string | null>(null);
  const [summaryOpen, setSummaryOpen] = useState<boolean>(false);
  const [selectedConfigDocId, setSelectedConfigDocId] = useState<string | null>(null);

  // Partial Print Summary Modal state (Item 3)
  const [partialSummaryOpen, setPartialSummaryOpen] = useState<boolean>(false);
  const [summaryPrintedSegments, setSummaryPrintedSegments] = useState<PrintedSegment[]>([]);
  const [summaryPendingSegments, setSummaryPendingSegments] = useState<Array<{
    docName: string;
    pageRange?: string;
    reason: string;
    pagesCount: number;
  }>>([]);

  // Manual Duplex Modal state (Item 5)
  const [manualDuplexOpen, setManualDuplexOpen] = useState<boolean>(false);
  const [manualDuplexPrinter, setManualDuplexPrinter] = useState<string>('');
  const [manualDuplexDocName, setManualDuplexDocName] = useState<string>('');
  const [manualDuplexResolver, setManualDuplexResolver] = useState<((val: boolean) => void) | null>(null);

  // Printer Properties Modal state (Item 3 & Multi-Doc Selection)
  const [propertiesDialogOpen, setPropertiesDialogOpen] = useState(false);
  const [docSelectorOpen, setDocSelectorOpen] = useState(false);
  const [targetPropertyDocId, setTargetPropertyDocId] = useState<string>('all');
  const [docDriverSettings, setDocDriverSettings] = useState<Record<string, Partial<PrinterDriverSettings>>>({});
  const [availablePrinters, setAvailablePrinters] = useState<ShopPrinter[]>([]);
  const [matchedShopPrinter, setMatchedShopPrinter] = useState<ShopPrinter | null>(null);
  const [driverSettings, setDriverSettings] = useState<Partial<PrinterDriverSettings>>({
    paperSize: 'A4',
    orientation: undefined,
    colorMode: undefined,
    scaling: 'fit',
  });

  // Retrieves effective driver properties for a specific document or common defaults
  const getEffectiveSettingsForDoc = useCallback(
    (docId?: string): Partial<PrinterDriverSettings> => {
      const targetDoc = docId && docId !== 'all' ? documents.find((d) => d.id === docId) : undefined;
      const targetWrapper = docId && docId !== 'all' ? docWrappers[docId] : undefined;

      // Automatically select color mode submitted for this individual document
      const docSubmittedColorMode: 'B&W' | 'Color' =
        String(
          targetDoc?.print_config?.printType ||
            targetDoc?.print_config?.color_mode ||
            (targetDoc as any)?.print_type ||
            order?.config_print_type ||
            ''
        )
          .toLowerCase()
          .includes('color')
          ? 'Color'
          : 'B&W';

      // Automatically detect and select orientation submitted/detected for this individual document
      const docSubmittedOrientationRaw = String(
        targetDoc?.print_config?.orientation ||
          targetDoc?.print_config?.layout ||
          (targetDoc as any)?.orientation ||
          (order as any)?.config_orientation ||
          ''
      ).toLowerCase();

      const docAutoOrientation: 'Portrait' | 'Landscape' =
        docSubmittedOrientationRaw === 'landscape'
          ? 'Landscape'
          : docSubmittedOrientationRaw === 'portrait'
          ? 'Portrait'
          : targetWrapper?.detectedOrientation || 'Portrait';

      const common = docDriverSettings['all'] || driverSettings;
      const specific = docId && docId !== 'all' ? docDriverSettings[docId] : undefined;

      // Independent document properties: ensure document config is NEVER overwritten by global settings or other documents
      const effectiveCopies =
        specific?.copies !== undefined
          ? Number(specific.copies)
          : targetDoc?.print_config?.copies !== undefined
          ? Number(targetDoc.print_config.copies)
          : (order?.config_copies ? Number(order.config_copies) : 1);

      const effectivePaper =
        specific?.paperSize ||
        targetDoc?.print_config?.pageSize ||
        targetDoc?.print_config?.page_size ||
        order?.config_page_size ||
        'A4';

      const effectiveColor =
        specific?.colorMode ??
        (targetDoc ? docSubmittedColorMode : (common.colorMode || 'B&W'));

      const effectiveOrientation =
        specific?.orientation ??
        (targetDoc ? docAutoOrientation : (common.orientation || 'Portrait'));

      const explicitlyConfiguredDuplex = specific?.duplex ?? common.duplex;
      const inheritedDuplex =
        explicitlyConfiguredDuplex ??
        targetDoc?.print_config?.sides ??
        targetDoc?.print_config?.duplex ??
        order?.config_sides;
      const normalizedDuplex = normalizeDuplexMode(inheritedDuplex);
      const effectiveDuplex =
        explicitlyConfiguredDuplex === undefined &&
        effectiveOrientation === 'Landscape' &&
        isDuplexPrint(normalizedDuplex)
          ? 'Tumble'
          : normalizedDuplex;

      return {
        ...common,
        ...(specific || {}),
        copies: effectiveCopies,
        paperSize: effectivePaper,
        colorMode: effectiveColor,
        orientation: effectiveOrientation,
        duplex: effectiveDuplex,
      };
    },
    [docDriverSettings, driverSettings, documents, docWrappers, order]
  );

  // 4.1 PRINTER DISAMBIGUATION (when multiple printers match the same config)
  const [disambiguationPlan, setDisambiguationPlan] = useState<{
    segmentName: string;
    matchingPrinters: ShopPrinter[];
    resolve: (selected: ShopPrinter) => void;
  } | null>(null);

  // Canvas Refs & High-Performance Render Caches
  const mainCanvasRefs = useRef<{ [pageKey: string]: HTMLCanvasElement | null }>({});
  const thumbnailCanvasRefs = useRef<{ [pageKey: string]: HTMLCanvasElement | null }>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const renderedCacheRef = useRef<Record<string, { canvas: HTMLCanvasElement; signature: string }>>({});
  const renderedThumbnailsRef = useRef<Record<string, { canvas: HTMLCanvasElement; signature: string }>>({});
  const inFlightRendersRef = useRef<Record<string, HTMLCanvasElement>>({});
  const inFlightThumbnailRendersRef = useRef<Record<string, HTMLCanvasElement>>({});
  const orderLoadIdRef = useRef(0);

  const getRenderSignature = (item: UnifiedPreviewPage) => {
    const docSettings = getEffectiveSettingsForDoc(item.docId);
    const isBw =
      docSettings.colorMode === 'B&W'
        ? true
        : docSettings.colorMode === 'Color'
        ? false
        : item.isBw;
    const orientationValue =
      docSettings.orientation ||
      item.detectedOrientation ||
      item.pdfWrapper?.detectedOrientation ||
      (item.layout === 'Landscape' ? 'Landscape' : 'Portrait');
    const effOrientation = String(orientationValue).toLowerCase() === 'landscape' ? 'Landscape' : 'Portrait';
    const effScaling = String(docSettings.scaling || 'fit');
    const effPaper = String(docSettings.paperSize || item.docPaperSize || order?.config_page_size || 'A4');
    const thumbnailSignature = `${item.key}_${isBw}_${rotation}_${effOrientation}_${effScaling}_${effPaper}_${item.pagesPerSheet}_${item.pageNums.join(',')}`;
    const paperName = String(effPaper).toUpperCase();
    const portraitPaperWidth = paperName.includes('A3')
      ? 841.89
      : paperName.includes('A5')
      ? 419.53
      : paperName.includes('LETTER') || paperName.includes('LEGAL')
      ? 612
      : paperName.includes('TABLOID')
      ? 792
      : 595.28;
    const portraitPaperHeight = paperName.includes('A3')
      ? 1190.55
      : paperName.includes('A5')
      ? 595.28
      : paperName.includes('LETTER')
      ? 792
      : paperName.includes('LEGAL')
      ? 1008
      : paperName.includes('TABLOID')
      ? 1224
      : 841.89;
    const paperWidth = effOrientation === 'Landscape' ? portraitPaperHeight : portraitPaperWidth;
    const paperHeight = effOrientation === 'Landscape' ? portraitPaperWidth : portraitPaperHeight;

    return {
      signature: `${item.key}_${zoomScale}_${rotation}_${isBw}_${effOrientation}_${effScaling}_${effPaper}`,
      thumbnailSignature,
      thumbnailScale: 130 / paperWidth,
      paperAspectRatio: paperWidth / paperHeight,
      paperWidth,
      paperHeight,
    };
  };

  // 1. Fetch Order and all linked documents in database sequence
  const loadOrderData = useCallback(async () => {
    const loadId = ++orderLoadIdRef.current;
    if (!orderId || !user?.shop_id) {
      setErrorMsg('Missing order ID or shopkeeper session.');
      setLoading(false);
      return;
    }

    clearDocumentCache();
    setLoading(true);
    setOrder(null);
    setDocuments([]);
    setDocWrappers({});
    setPreviewErrors({});
    setSelectedConfigDocId(null);
    setCurrentPageIndex(0);
    mainCanvasRefs.current = {};
    thumbnailCanvasRefs.current = {};
    renderedCacheRef.current = {};
    renderedThumbnailsRef.current = {};
    inFlightRendersRef.current = {};
    inFlightThumbnailRendersRef.current = {};

    try {
      setErrorMsg(null);

      const result = await shopkeeperApi.getOrderForPreview(orderId, user.shop_id);
      if (loadId !== orderLoadIdRef.current) return;

      if (!result) {
        setErrorMsg('Access Denied: Order not found or not assigned to your printing shop.');
        setLoading(false);
        return;
      }

      setOrder(result.order);
      setDocuments(result.documents);

      void shopkeeperApi
        .getShopPrinters(user.shop_id)
        .then((configuredPrinters: ShopPrinter[]) => {
          if (loadId !== orderLoadIdRef.current) return;
          setAvailablePrinters(configuredPrinters);
          if (configuredPrinters.length > 0) {
            setMatchedShopPrinter(configuredPrinters[0]);
          }
        })
        .catch((prnErr) => {
          console.warn('Printer fetch warning:', prnErr);
        });

      const orderConfigOrientation = (result.order as any).config_orientation;
      const orientationValue = String(orderConfigOrientation || '');
      const isLand = orientationValue.toLowerCase() === 'landscape';
      setDriverSettings({
        paperSize: result.order.config_page_size || 'A4',
        orientation: isLand ? 'Landscape' : (orientationValue ? 'Portrait' : undefined),
        copies: result.order.config_copies || 1,
        colorMode: String(result.order.config_print_type || '').toLowerCase().includes('color') ? 'Color' : 'B&W',
        duplex: normalizePrintSides(result.order.config_sides),
        mediaType: result.order.config_paper_type || 'Standard 75 GSM',
        scaling: 'fit',
      });

      // Show order details immediately; load the document streams after the preview shell is visible.
      setLoading(false);
      const firstDoc = result.documents[0];
      const loadPreviewDocument = async (doc: (typeof result.documents)[number]) => {
        const imageEditing = doc.image_editing || {};
        const storagePath =
          typeof imageEditing.edited_storage_path === 'string' && imageEditing.edited_storage_path
            ? imageEditing.edited_storage_path
            : doc.storage_path;
        const sources = Array.from(new Set([...(doc.preview_urls || []), doc.file_url].filter(Boolean)));
        const sourceErrors: string[] = [];

        const loadStorageFile = async (bucket: string, path: string, label: string) => {
          const { data, error } = await supabase.storage.from(bucket).download(path);
          if (!data) {
            throw new Error(`${label}: ${error?.message || 'Storage download failed.'}`);
          }
          return loadDocumentFromBlob(data, doc.file_name);
        };

        if (storagePath && imageEditing.edited_storage_path) {
          try {
            return await loadStorageFile(
              doc.storage_bucket || 'print_documents',
              storagePath,
              'Edited document'
            );
          } catch (error) {
            sourceErrors.push(error instanceof Error ? error.message : String(error));
          }
        }

        for (const source of sources) {
          let storageReference: { bucket: string; path: string } | null = null;
          try {
            const pathname = new URL(source).pathname;
            const match = pathname.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/);
            if (match) {
              storageReference = {
                bucket: decodeURIComponent(match[1]),
                path: match[2].split('/').map((part) => decodeURIComponent(part)).join('/'),
              };
            }
          } catch {
            storageReference = null;
          }

          if (storageReference) {
            try {
              return await loadStorageFile(storageReference.bucket, storageReference.path, 'Document file');
            } catch (error) {
              sourceErrors.push(error instanceof Error ? error.message : String(error));
            }
          }

          try {
            const response = await fetch(source);
            if (!response.ok) throw new Error(`Preview URL returned HTTP ${response.status}.`);
            return await loadDocumentFromBlob(await response.blob(), doc.file_name);
          } catch (error) {
            sourceErrors.push(error instanceof Error ? error.message : String(error));
          }
        }

        if (storagePath) {
          try {
            return await loadStorageFile(
              doc.storage_bucket || 'print_documents',
              storagePath,
              'Original document'
            );
          } catch (error) {
            sourceErrors.push(error instanceof Error ? error.message : String(error));
          }
        }

        throw new Error(sourceErrors.join(' | ') || `No preview file is available for ${doc.file_name}.`);
      };
      const firstDocLoad = firstDoc ? loadPreviewDocument(firstDoc) : Promise.resolve(null);

      if (firstDoc) {
        void firstDocLoad
          .then((wrapper) => {
            if (wrapper && loadId === orderLoadIdRef.current) {
              setDocWrappers((current) => ({ ...current, [firstDoc.id]: wrapper }));
              setPreviewErrors((current) => {
                const next = { ...current };
                delete next[firstDoc.id];
                return next;
              });
            }
          })
          .catch((err) => {
            console.warn(`Failed to parse wrapper for first doc ${firstDoc.file_name}:`, err);
            if (loadId === orderLoadIdRef.current) {
              setPreviewErrors((current) => ({
                ...current,
                [firstDoc.id]: err instanceof Error ? err.message : 'Document preview could not be loaded.',
              }));
            }
          });
      }

      // Give the first document priority so other files don't compete for bandwidth.
      void firstDocLoad
        .catch(() => null)
        .then(async () => {
          const remainingWrappers = await Promise.all(
            result.documents.slice(1).map(async (doc) => {
              try {
                const wrapper = await loadPreviewDocument(doc);
                if (loadId === orderLoadIdRef.current) {
                  setPreviewErrors((current) => {
                    const next = { ...current };
                    delete next[doc.id];
                    return next;
                  });
                }
                return { id: doc.id, wrapper };
              } catch (err) {
                console.warn(`Failed to parse wrapper for doc ${doc.file_name}:`, err);
                if (loadId === orderLoadIdRef.current) {
                  setPreviewErrors((current) => ({
                    ...current,
                    [doc.id]: err instanceof Error ? err.message : 'Document preview could not be loaded.',
                  }));
                }
                return null;
              }
            })
          );
          const loadedWrappers = remainingWrappers.filter(
            (loaded): loaded is { id: string; wrapper: PdfDocumentWrapper } => loaded !== null
          );
          if (loadedWrappers.length > 0 && loadId === orderLoadIdRef.current) {
            setDocWrappers((current) => ({
              ...current,
              ...Object.fromEntries(loadedWrappers.map(({ id, wrapper }) => [id, wrapper])),
            }));
          }
        });
    } catch (err: any) {
      if (loadId !== orderLoadIdRef.current) return;
      console.error('Failed to load order for preview:', err);
      setErrorMsg(err.message || 'Failed to retrieve order preview data.');
    } finally {
      if (loadId === orderLoadIdRef.current) {
        setLoading(false);
      }
    }
  }, [orderId, user?.shop_id]);

  useEffect(() => {
    loadOrderData();
  }, [loadOrderData]);

  // Helper to test if a page range or single page is already printed
  const isPageCoveredByPrinted = (docId: string, docName: string, pageNum: number, printed: PrintedSegment[]) => {
    return printed.some((seg) => {
      const isDocMatch = seg.doc_id === docId || seg.doc_name === docName;
      if (!isDocMatch) return false;
      const range = String(seg.page_range || '').trim();
      if (range === 'All Pages' || range === 'all') return true;
      if (range.includes('-')) {
        const parts = range.split('-');
        const from = parseInt(parts[0], 10);
        const to = parseInt(parts[1], 10);
        if (!isNaN(from) && !isNaN(to) && pageNum >= from && pageNum <= to) {
          return true;
        }
      } else {
        const p = parseInt(range, 10);
        if (!isNaN(p) && pageNum === p) return true;
      }
      return false;
    });
  };

  // 2. Build Unified Pages List strictly filtering pages by database configuration
  // Rule 1: All documents under same Order ID rendered in database sequence
  // Rule 2: Each document uses its own saved configuration independently
  // Rule 3: If pageRangeType = "Custom Range", ONLY customRanges pages are shown/printed
  // Rule 4: If pageRangeType = "All Pages", all pages 1..N of that document are shown
  // Rule 5: Pages already in printed_segments MUST NOT be printed again, and after "Keep Order",
  // preview displays ONLY remaining Pending pages.
  const unifiedPages = useMemo<UnifiedPreviewPage[]>(() => {
    if (!documents || documents.length === 0) return [];

    const pagesList: UnifiedPreviewPage[] = [];
    const alreadyPrinted: PrintedSegment[] = Array.isArray(order?.printed_segments) ? order.printed_segments : [];

    documents.forEach((doc, docIdx) => {
      const wrapper = docWrappers[doc.id];
      const cfg = doc.print_config || {};
      const docTotal = wrapper?.numPages || doc.total_pages || 1;

      // Extract qualifying pages based on saved configuration and custom ranges
      interface PageMeta {
        pageNum: number;
        printType: string;
        sides: string;
        pageSize: string;
        paperType: string;
        layout: string;
        copies: number;
        isCustomRange: boolean;
        rangeLabel: string;
      }

      const qualifying: PageMeta[] = [];

      // Extract custom ranges or string specifications (e.g. "2-4", "3", "1, 3, 5-7")
      const customRangesList = getConfiguredCustomRanges(cfg, (doc as any).page_range || order?.page_range || (order as any)?.config_page_range);

      const isCustomMode = (cfg.pageRangeType === 'Custom Range' || customRangesList.length > 0) && customRangesList.length > 0;

      if (isCustomMode) {
        // Strictly include ONLY pages within user's custom ranges
        for (const r of customRangesList) {
          const fromP = Math.max(1, Math.min(docTotal, Number(r.fromPage ?? r.from ?? 1)));
          const toP = Math.max(fromP, Math.min(docTotal, Number(r.toPage ?? r.to ?? fromP)));
          for (let p = fromP; p <= toP; p++) {
            // Check if this page is already printed
            const isPrinted = isPageCoveredByPrinted(doc.id, doc.file_name, p, alreadyPrinted);
            // If already printed, exclude from pending preview so preview shows ONLY remaining Pending pages
            if (isPrinted) {
              continue;
            }

            if (!qualifying.some((existing) => existing.pageNum === p)) {
              qualifying.push({
                pageNum: p,
                printType: r.printType || cfg.printType || 'Black & White',
                sides: normalizePrintSides(r.sides || r.side || cfg.sides || cfg.duplex || order?.config_sides),
                pageSize: r.pageSize || cfg.pageSize || 'A4',
                paperType: cfg.paperType || 'Normal',
                layout: cfg.layout || 'Portrait',
                copies: Number(cfg.copies) || 1,
                isCustomRange: true,
                rangeLabel: `Pages ${r.fromPage}–${r.toPage}`,
              });
            }
          }
        }
        qualifying.sort((a, b) => a.pageNum - b.pageNum);
      } else {
        // All Pages
        for (let p = 1; p <= docTotal; p++) {
          const isPrinted = isPageCoveredByPrinted(doc.id, doc.file_name, p, alreadyPrinted);
          if (isPrinted) {
            continue;
          }
          qualifying.push({
            pageNum: p,
            printType: cfg.printType || 'Black & White',
            sides: normalizePrintSides(cfg.sides || cfg.duplex || order?.config_sides),
            pageSize: cfg.pageSize || 'A4',
            paperType: cfg.paperType || 'Normal',
            layout: cfg.layout || 'Portrait',
            copies: Number(cfg.copies) || 1,
            isCustomRange: false,
            rangeLabel: 'All Pages',
          });
        }
      }

      // Determine N-up layout: 1-in-1, 2-in-1, or 4-in-1
      const rawPps = String(cfg.pagesPerSheet || cfg.pages_per_sheet || cfg.nUp || '1-in-1').toLowerCase();
      const pagesPerSheet: '1-in-1' | '2-in-1' | '4-in-1' =
        rawPps.includes('4') ? '4-in-1' : rawPps.includes('2') ? '2-in-1' : '1-in-1';
      const nUpCount = pagesPerSheet === '4-in-1' ? 4 : pagesPerSheet === '2-in-1' ? 2 : 1;

      // Group qualifying pages into sheets
      const sheetChunks: (typeof qualifying)[] = [];
      for (let i = 0; i < qualifying.length; i += nUpCount) {
        sheetChunks.push(qualifying.slice(i, i + nUpCount));
      }

      sheetChunks.forEach((chunk, sheetIdx) => {
        const primaryPage = chunk[0];
        const pageNums = chunk.map((c) => c.pageNum);
        const lowerPrintType = String(primaryPage.printType || '').toLowerCase();
        const isBw =
          lowerPrintType.includes('black') ||
          lowerPrintType.includes('b&w') ||
          lowerPrintType.includes('mono') ||
          (!lowerPrintType.includes('color') && !lowerPrintType.includes('colour'));

        const isDocLandscape =
          wrapper?.detectedOrientation === 'Landscape' ||
          primaryPage.layout === 'Landscape' ||
          String(cfg.layout || '').toLowerCase() === 'landscape';

        const rangeLabel =
          pagesPerSheet !== '1-in-1'
            ? `Pages ${pageNums.join(', ')} (${pagesPerSheet})`
            : primaryPage.rangeLabel;

        pagesList.push({
          key: `${doc.id}_sheet_${sheetIdx}_p${primaryPage.pageNum}`,
          docId: doc.id,
          docIndex: docIdx,
          docFileName: doc.file_name,
          docTotalPages: docTotal,
          docPrintConfig: cfg,
          pageNum: primaryPage.pageNum,
          pageNums,
          sheetIndex: sheetIdx,
          totalSheetsInDoc: sheetChunks.length,
          pagesPerSheet,
          globalIndex: pagesList.length,
          isFirstPageOfDoc: sheetIdx === 0,
          docVisiblePagesCount: sheetChunks.length,
          printType: primaryPage.printType,
          sides: primaryPage.sides,
          pageSize: primaryPage.pageSize,
          paperType: primaryPage.paperType,
          layout: isDocLandscape ? 'Landscape' : 'Portrait',
          copies: primaryPage.copies,
          isBw,
          isCustomRange: primaryPage.isCustomRange,
          rangeLabel,
          pdfWrapper: wrapper,
          docPaperSize: primaryPage.pageSize || cfg.pageSize || order?.config_page_size || 'A4',
          detectedOrientation: wrapper?.detectedOrientation || (isDocLandscape ? 'Landscape' : 'Portrait'),
        });
      });
    });

    return pagesList;
  }, [documents, docWrappers, order?.printed_segments]);

  // Filter displayed pages if the shopkeeper clicked a specific configuration card
  const displayedPages = useMemo(() => {
    if (!selectedConfigDocId) return unifiedPages;
    return unifiedPages.filter((p) => p.docId === selectedConfigDocId);
  }, [unifiedPages, selectedConfigDocId]);

  // 3. Render visible pages onto canvases (Main View & Thumbnails) with priority for active page and smart render cache
  const renderAllCanvases = useCallback(async () => {
    if (displayedPages.length === 0) return;

    // Helper to render an item with signature-based caching
    const renderItem = async (item: UnifiedPreviewPage, renderMainPage = true) => {
      if (!item.pdfWrapper) return;

      const docSettings = getEffectiveSettingsForDoc(item.docId);
      const isBw =
        docSettings.colorMode === 'B&W'
          ? true
          : docSettings.colorMode === 'Color'
          ? false
          : item.isBw;
      const effOrientation =
        docSettings.orientation ||
        item.detectedOrientation ||
        item.pdfWrapper?.detectedOrientation ||
        (item.layout === 'Landscape' ? 'Landscape' : 'Portrait');
      const effScaling = docSettings.scaling || 'fit';
      const effPaper = docSettings.paperSize || item.docPaperSize || order?.config_page_size || 'A4';
      const { signature: renderSignature, thumbnailSignature, thumbnailScale } = getRenderSignature(item);

      const thumbCanvas = thumbnailCanvasRefs.current[item.key];
      const cachedThumbnailRender = renderedThumbnailsRef.current[item.key];
      if (
        thumbCanvas &&
        (cachedThumbnailRender?.canvas !== thumbCanvas || cachedThumbnailRender.signature !== thumbnailSignature) &&
        inFlightThumbnailRendersRef.current[item.key] !== thumbCanvas
      ) {
        inFlightThumbnailRendersRef.current[item.key] = thumbCanvas;
        try {
          await renderPdfPage(item.pdfWrapper, item.pageNum, thumbCanvas, {
            scale: thumbnailScale,
            rotation,
            isBlackAndWhite: isBw,
            fitToPaper: effScaling !== 'actual',
            scaling: effScaling as any,
            equalMargins: true,
            targetPaper: effPaper,
            orientation: (effOrientation as 'Portrait' | 'Landscape') || undefined,
            pagesPerSheet: item.pagesPerSheet,
            pageNums: item.pageNums,
          });
          renderedThumbnailsRef.current[item.key] = { canvas: thumbCanvas, signature: thumbnailSignature };
          setRenderRevision((revision) => revision + 1);
        } catch (err) {
          console.warn(`Thumb error on ${item.key}:`, err);
          setPreviewErrors((current) => ({
            ...current,
            [item.docId]: err instanceof Error ? err.message : 'Thumbnail rendering failed.',
          }));
        } finally {
          if (inFlightThumbnailRendersRef.current[item.key] === thumbCanvas) {
            delete inFlightThumbnailRendersRef.current[item.key];
          }
        }
      }

      const mainCanvas = mainCanvasRefs.current[item.key];
      const cachedMainRender = renderedCacheRef.current[item.key];
      if (
        renderMainPage &&
        mainCanvas &&
        (cachedMainRender?.canvas !== mainCanvas || cachedMainRender.signature !== renderSignature) &&
        inFlightRendersRef.current[item.key] !== mainCanvas
      ) {
        inFlightRendersRef.current[item.key] = mainCanvas;
        try {
          await renderPdfPage(item.pdfWrapper, item.pageNum, mainCanvas, {
            scale: zoomScale,
            rotation,
            isBlackAndWhite: isBw,
            fitToPaper: effScaling !== 'actual',
            scaling: effScaling as any,
            equalMargins: true,
            targetPaper: effPaper,
            orientation: (effOrientation as 'Portrait' | 'Landscape') || undefined,
            pagesPerSheet: item.pagesPerSheet,
            pageNums: item.pageNums,
          });
          renderedCacheRef.current[item.key] = { canvas: mainCanvas, signature: renderSignature };
          setRenderRevision((revision) => revision + 1);
        } catch (err) {
          console.warn(`Render error on ${item.key}:`, err);
          setPreviewErrors((current) => ({
            ...current,
            [item.docId]: err instanceof Error ? err.message : 'Page rendering failed.',
          }));
        } finally {
          if (inFlightRendersRef.current[item.key] === mainCanvas) {
            delete inFlightRendersRef.current[item.key];
          }
        }
      }
    };

    // Priority 1: Render currently active page immediately
    const activeItem = displayedPages[currentPageIndex] || displayedPages[0];
    if (activeItem) {
      await renderItem(activeItem);
    }

    // Priority 2: Lazily render remaining pages without freezing the main thread
    const remainingItems = displayedPages.filter((p) => p.key !== activeItem?.key);
    if (remainingItems.length > 0) {
      setTimeout(async () => {
        for (const item of remainingItems) {
          await renderItem(item, false);
        }
      }, 30);
    }
  }, [displayedPages, currentPageIndex, zoomScale, rotation, getEffectiveSettingsForDoc, order?.config_page_size, sidebarTab]);

  useEffect(() => {
    renderAllCanvases();
  }, [renderAllCanvases]);

  useEffect(() => {
    setCurrentPageIndex(0);
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [selectedConfigDocId]);

  // Handle Zoom In / Out / Fit
  const handleZoomIn = () => {
    setZoomScale((prev) => Math.min(2.5, +(prev + 0.15).toFixed(2)));
  };

  const handleZoomOut = () => {
    setZoomScale((prev) => Math.max(0.4, +(prev - 0.15).toFixed(2)));
  };

  const handleFitWidth = () => {
    if (containerRef.current) {
      const containerWidth = containerRef.current.clientWidth - 80;
      const newScale = Math.max(0.5, Math.min(2.0, +(containerWidth / 620).toFixed(2)));
      setZoomScale(newScale);
    } else {
      setZoomScale(1.0);
    }
  };

  const handleFitPage = () => {
    setZoomScale(0.85);
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  // Scroll smoothly to a specific global page index
  const scrollToPage = (targetIndex: number) => {
    if (targetIndex < 0 || targetIndex >= displayedPages.length) return;
    setCurrentPageIndex(targetIndex);
    const targetKey = displayedPages[targetIndex]?.key;
    const canvas = mainCanvasRefs.current[targetKey];
    const container = containerRef.current;
    if (canvas && container) {
      const containerTop = container.getBoundingClientRect().top;
      const canvasTop = canvas.getBoundingClientRect().top;
      container.scrollTo({
        top: container.scrollTop + canvasTop - containerTop - 24,
        behavior: 'smooth',
      });
    }
  };

  // Track active page on scroll
  const handleScroll = () => {
    if (!containerRef.current || displayedPages.length === 0) return;
    const containerTop = containerRef.current.getBoundingClientRect().top;
    const activeAnchor = containerTop + 160;
    let nearestPageIndex = -1;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (let i = 0; i < displayedPages.length; i++) {
      const item = displayedPages[i];
      const canvas = mainCanvasRefs.current[item.key];
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        if (rect.bottom > activeAnchor) {
          const distance = Math.abs(rect.top - activeAnchor);
          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestPageIndex = i;
          }
        }
      }
    }
    if (nearestPageIndex >= 0) {
      setCurrentPageIndex((currentIndex) => (currentIndex === nearestPageIndex ? currentIndex : nearestPageIndex));
    }
  };

  // Download one original directly, or package multiple source files into one ZIP.
  const handleDownload = async (downloadAll: boolean) => {
    if (!documents || documents.length === 0) return;
    const targetDocuments = downloadAll
      ? documents
      : documents.filter((doc) => selectedDownloadDocumentIds.has(String(doc.id)));

    if (targetDocuments.length === 0) {
      toast.error('Select at least one document to download.');
      return;
    }

    setDownloadDialogOpen(false);
    setDownloadingDocuments(true);
    const toastId = toast.loading(
      targetDocuments.length > 1 ? 'Preparing documents ZIP...' : 'Preparing document download.'
    );
    let objectUrl: string | null = null;

    try {
      const { default: JSZip } = targetDocuments.length > 1 ? await import('jszip') : { default: null };
      const zip = JSZip ? new JSZip() : null;
      const usedNames = new Set<string>();

      const downloadFile = async (doc: (typeof documents)[number], index: number) => {
        const imageEditing = doc.image_editing || {};
        const originalPath =
          typeof imageEditing.original_storage_path === 'string' && imageEditing.original_storage_path
            ? imageEditing.original_storage_path
            : doc.storage_path;
        let content: Blob | null = null;
        let storageError: string | null = null;

        if (originalPath) {
          const { data, error } = await supabase.storage
            .from(doc.storage_bucket || 'print_documents')
            .download(originalPath);
          if (data) {
            content = data;
          } else {
            storageError = error?.message || 'Storage download failed.';
          }
        }

        if (!content && doc.file_url) {
          const response = await fetch(doc.file_url);
          if (response.ok) {
            content = await response.blob();
          } else {
            throw new Error(
              `Failed to download ${doc.file_name || `document ${index + 1}`} (HTTP ${response.status})${
                storageError ? `: ${storageError}` : ''
              }.`
            );
          }
        }

        if (!content) {
          throw new Error(
            `Could not download ${doc.file_name || `document ${index + 1}`}: ${
              storageError || 'no file URL or storage path is available.'
            }`
          );
        }

        return content;
      };

      if (targetDocuments.length === 1) {
        const doc = targetDocuments[0];
        const content = await downloadFile(doc, 0);
        objectUrl = URL.createObjectURL(content);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = doc.file_name || 'Document_1';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Document download started.', { id: toastId });
        return;
      }

      if (!zip) throw new Error('ZIP support is unavailable.');

      for (let index = 0; index < targetDocuments.length; index += 1) {
        const doc = targetDocuments[index];
        const originalName = String(doc.file_name || `Document_${index + 1}`);
        const safeName =
          originalName.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').trim() || `Document_${index + 1}`;
        const dotIndex = safeName.lastIndexOf('.');
        const baseName = dotIndex > 0 ? safeName.slice(0, dotIndex) : safeName;
        const extension = dotIndex > 0 ? safeName.slice(dotIndex) : '';
        let uniqueName = safeName;
        let suffix = 2;
        while (usedNames.has(uniqueName.toLowerCase())) {
          uniqueName = `${baseName} (${suffix})${extension}`;
          suffix += 1;
        }
        usedNames.add(uniqueName.toLowerCase());
        zip.file(uniqueName, await downloadFile(doc, index));
      }

      const archive = await zip.generateAsync({ type: 'blob' });
      objectUrl = URL.createObjectURL(archive);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `Order_${order?.token_number || order?.id || 'Documents'}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success(`${targetDocuments.length} files downloaded as a ZIP.`, { id: toastId });
    } catch (error) {
      console.error('Failed to download order documents:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to download order documents.', { id: toastId });
    } finally {
      if (objectUrl) {
        const downloadUrl = objectUrl;
        window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
      }
      setDownloadingDocuments(false);
    }
  };

  // Physical Direct Print via QZ Tray: Follows exact database configurations for all documents & custom ranges
  const handleDirectPrint = async (selectedDocumentIds?: Set<string>) => {
    if (!order || documents.length === 0) return;
    const selectedIds = selectedDocumentIds || new Set(documents.map((doc) => doc.id));
    if (selectedIds.size === 0) {
      toast.error('Select at least one document to print.');
      return;
    }
    setPrinting(true);
    printQueue.begin(`#${order.token_number || order.id}`, unifiedPages.length);
    const toastId = toast.loading(`Spooling hardware print jobs for Order #${order.token_number || order.id}...`);

    try {
      printQueue.setMessage('Finding a compatible printer...');
      // 1. Retrieve configured physical/allowed virtual printers
      const configuredPrinters: ShopPrinter[] =
        realPrinters.length > 0 ? realPrinters : await shopkeeperApi.getShopPrinters(order.shop_id);
      const onlinePrinters = configuredPrinters.filter(
        (p) => p.is_online !== false && (isPhysicalPrinter(p.name) || isAllowedVirtualPrinter(p.name))
      );

      if (onlinePrinters.length === 0) {
        toast.error('No physical printer is currently online or connected via QZ Tray.', { id: toastId });
        setPrinting(false);
        return;
      }

      // 2. Build print jobs per document / custom range with smart condition matching
      interface PrintJobPlan {
        docId: string;
        docName: string;
        docUrl: string;
        pageRange?: string;
        colorMode: 'B&W' | 'Color';
        duplex: 'Single Side' | 'Back-to-Back';
        pageSize: any;
        paperType: any;
        copies: number;
        pageCount: number;
        pageNumbers: number[];
        matchedPrinter: ShopPrinter;
        layout?: string;
        pagesPerSheet?: number;
        isCustomRange?: boolean;
      }

      const jobPlans: PrintJobPlan[] = [];
      const pendingSegments: Array<{
        docName: string;
        pageRange?: string;
        reason: string;
        pagesCount: number;
      }> = [];

      // Check already completed segments to never re-print them
      const alreadyPrinted: PrintedSegment[] = Array.isArray(order.printed_segments) ? order.printed_segments : [];
      const printedKeys = new Set(alreadyPrinted.map((s) => `${s.doc_id || s.doc_name}_${s.page_range || 'all'}`));

      documents
        .filter((doc) => !selectedIds.has(doc.id))
        .forEach((doc) => {
          const totalPages = Math.max(1, Number(doc.total_pages) || Number(order.total_pages) || 1);
          const pendingPages = Array.from({ length: totalPages }, (_, index) => index + 1).filter(
            (pageNum) => !isPageCoveredByPrinted(doc.id, doc.file_name, pageNum, alreadyPrinted)
          );
          if (pendingPages.length > 0) {
            pendingSegments.push({
              docName: doc.file_name || 'Untitled document',
              pageRange: pendingPages.join(','),
              reason: 'Not selected for printing',
              pagesCount: pendingPages.length,
            });
          }
        });

      for (const doc of documents.filter((document) => selectedIds.has(document.id))) {
        const cfg = doc.print_config || {};
        const sourceDocUrl = doc.file_url || order.file_url || '';

        const docTotal = Number(doc.total_pages) || Number(order.total_pages) || 1;
        const customRangesList = getConfiguredCustomRanges(cfg, (doc as any).page_range || order?.page_range || (order as any)?.config_page_range);

        const isCustomMode = (cfg.pageRangeType === 'Custom Range' || customRangesList.length > 0) && customRangesList.length > 0;
        if (isCustomMode) {
          for (const r of customRangesList) {
            const rFrom = Number(r.fromPage ?? r.from ?? 1);
            const rTo = Number(r.toPage ?? r.to ?? rFrom);
            
            // Extract ONLY unprinted sub-ranges within this range — zero reprint guarantee
            const unprintedSubRanges = getUnprintedSubRanges(
              rFrom,
              rTo,
              (pageNum) => isPageCoveredByPrinted(doc.id, doc.file_name, pageNum, alreadyPrinted)
            );

            if (unprintedSubRanges.length === 0) {
              continue; // All pages in this custom range already printed - NEVER reprint
            }

            for (const subR of unprintedSubRanges) {
              const rangeConfig = {
                pageSize: r.pageSize || cfg.pageSize || 'A4',
                printType: r.printType,
                color_mode: r.printType,
                sides: normalizePrintSides(r.sides || r.side || cfg.sides || cfg.duplex || order?.config_sides),
                copies: Number(cfg.copies) || 1,
              };

              const matchResult = shopkeeperApi.findCompatiblePrinterForOrder(order, onlinePrinters, rangeConfig);
              const isColor = (r.printType || '').toLowerCase().includes('color');
              const rangeSides = normalizePrintSides(r.sides || r.side || cfg.sides || cfg.duplex || order.config_sides);
              const isDuplex = isDuplexPrint(rangeSides);
              const pageRangeStr = `${subR.fromPage}-${subR.toPage}`;

              if (!matchResult.compatiblePrinter) {
                pendingSegments.push({
                  docName: `${doc.file_name} (Pages ${pageRangeStr})`,
                  pageRange: pageRangeStr,
                  reason: matchResult.reasonIfNotCompatible || `No printer available for ${isColor ? 'Color' : 'B&W'} ${isDuplex ? 'Duplex' : 'Single Side'}`,
                  pagesCount: Math.max(1, subR.toPage - subR.fromPage + 1),
                });
              } else {
                jobPlans.push({
                  docId: doc.id,
                  docName: `${doc.file_name} (Pages ${pageRangeStr})`,
                  docUrl: sourceDocUrl,
                  pageRange: pageRangeStr,
                  colorMode: isColor ? 'Color' : 'B&W',
                  duplex: rangeSides,
                  pageSize: rangeConfig.pageSize,
                  paperType: cfg.paperType || 'Standard 75 GSM',
                  copies: Number(cfg.copies) || 1,
                  pageCount: Math.max(1, subR.toPage - subR.fromPage + 1),
                  pageNumbers: Array.from(
                    { length: Math.max(1, subR.toPage - subR.fromPage + 1) },
                    (_, index) => subR.fromPage + index
                  ),
                  matchedPrinter: matchResult.compatiblePrinter,
                  layout: cfg.layout || docWrappers[doc.id]?.detectedOrientation || 'Portrait',
                  pagesPerSheet: cfg.pagesPerSheet || cfg.pages_per_sheet || '1-in-1',
                  isCustomRange: true,
                });
              }
            }
          }
        } else {
          // All pages of the document
          const docTotal = Number(doc.total_pages) || Number(order.total_pages) || 1;
          const unprintedSubRanges = getUnprintedSubRanges(
            1,
            docTotal,
            (pageNum) => isPageCoveredByPrinted(doc.id, doc.file_name, pageNum, alreadyPrinted)
          );

          if (unprintedSubRanges.length === 0) {
            continue; // All pages already printed - zero reprint guarantee
          }

          const effectiveSides = normalizePrintSides(cfg.sides || cfg.duplex || order.config_sides);
          const matchResult = shopkeeperApi.findCompatiblePrinterForOrder(order, onlinePrinters, {
            ...cfg,
            sides: effectiveSides,
          });
          const isColor = (cfg.printType || '').toLowerCase().includes('color');
          const isDuplex = isDuplexPrint(effectiveSides);

          for (const subR of unprintedSubRanges) {
            const isFullDoc = subR.fromPage === 1 && subR.toPage === docTotal;
            const pageRangeStr = isFullDoc ? undefined : `${subR.fromPage}-${subR.toPage}`;
            const label = isFullDoc ? 'All Pages' : `Pages ${subR.fromPage}-${subR.toPage}`;

            if (!matchResult.compatiblePrinter) {
              pendingSegments.push({
                docName: `${doc.file_name || order.document_name} (${label})`,
                pageRange: pageRangeStr || 'All Pages',
                reason: matchResult.reasonIfNotCompatible || `No printer satisfies ${isColor ? 'Color' : 'B&W'} ${isDuplex ? 'Duplex' : 'Single Side'}`,
                pagesCount: Math.max(1, subR.toPage - subR.fromPage + 1),
              });
            } else {
              let chosenPrinter = matchResult.compatiblePrinter;
              if (matchResult.compatiblePrinters && matchResult.compatiblePrinters.length > 1) {
                chosenPrinter = await new Promise<ShopPrinter>((resolve) => {
                  setDisambiguationPlan({
                    segmentName: `${doc.file_name || order.document_name} (${label})`,
                    matchingPrinters: matchResult.compatiblePrinters!,
                    resolve: (sel) => {
                      setDisambiguationPlan(null);
                      resolve(sel);
                    },
                  });
                });
              }

              jobPlans.push({
                docId: doc.id,
                docName: `${doc.file_name || order.document_name} (${label})`,
                docUrl: sourceDocUrl,
                pageRange: pageRangeStr,
                colorMode: isColor ? 'Color' : 'B&W',
                duplex: effectiveSides,
                pageSize: cfg.pageSize || 'A4',
                paperType: cfg.paperType || 'Standard 75 GSM',
                copies: Number(cfg.copies) || 1,
                pageCount: Math.max(1, subR.toPage - subR.fromPage + 1),
                pageNumbers: Array.from(
                  { length: Math.max(1, subR.toPage - subR.fromPage + 1) },
                  (_, index) => subR.fromPage + index
                ),
                matchedPrinter: chosenPrinter,
                layout: cfg.layout || docWrappers[doc.id]?.detectedOrientation || 'Portrait',
                pagesPerSheet: cfg.pagesPerSheet || cfg.pages_per_sheet || '1-in-1',
              });
            }
          }
        }
      }

      if (jobPlans.length === 0) {
        await shopkeeperApi.updateOrderStatus(order.id, 'No Compatible Printer');
        toast.error('No compatible printer found.', {
          id: toastId,
          description: 'Check printer paper, color, and duplex settings.',
        });
        setPrinting(false);
        return;
      }

      // 3. Dispatch jobs in sequence to physical printers via QZ Tray
      await shopkeeperApi.updateOrderStatus(order.id, 'Printing');

      const newlyPrinted: PrintedSegment[] = [];
      const plansWithCopies = jobPlans.map((plan) => ({
        ...plan,
        copies: plan.isCustomRange
          ? plan.copies
          : getEffectiveSettingsForDoc(plan.docId).copies || plan.copies,
      }));
      const dispatchRuns = buildCollatedPrintRuns(plansWithCopies);
      const totalPagesToPrint = dispatchRuns.reduce((total, run) => total + run.plan.pageCount, 0);
      printQueue.setTotalPages(totalPagesToPrint);
      printQueue.setMessage('Preparing the first print sheet...');
      let cancelled = false;

      for (let i = 0; i < dispatchRuns.length; i++) {
        const plan = dispatchRuns[i].plan;

        const docSettings = getEffectiveSettingsForDoc(plan.docId);
        const docWrapper = docWrappers[plan.docId];
        const detectedDocOrientation = docWrapper?.detectedOrientation;
        const targetColorMode = plan.isCustomRange
          ? plan.colorMode
          : docSettings.colorMode
            ? (docSettings.colorMode as any)
            : plan.colorMode;
        const targetOrientation: 'Portrait' | 'Landscape' =
          docSettings.orientation ||
          detectedDocOrientation ||
          (plan.layout === 'Landscape' ? 'Landscape' : 'Portrait');
        const targetScaling = docSettings.scaling || 'fit';
        const targetPaperSize = plan.isCustomRange ? plan.pageSize : docSettings.paperSize || plan.pageSize;
        const targetMediaType = docSettings.mediaType || plan.paperType;
        const explicitlyConfiguredDuplex =
          docDriverSettings[plan.docId]?.duplex ??
          docDriverSettings.all?.duplex ??
          driverSettings.duplex;
        const normalizedDuplex = normalizeDuplexMode(explicitlyConfiguredDuplex ?? plan.duplex);
        const targetDuplex = plan.isCustomRange
          ? normalizeDuplexMode(plan.duplex)
          : explicitlyConfiguredDuplex === undefined &&
              targetOrientation === 'Landscape' &&
              isDuplexPrint(normalizedDuplex)
            ? 'Tumble'
            : normalizedDuplex;

        // Item 5: Manual Duplex confirmation if printer requires manual reinsertion
        const printerDriver = plan.matchedPrinter.driver_name?.toLowerCase() || '';
        const isManualDuplex = isDuplexPrint(targetDuplex) && (printerDriver.includes('manual') || (plan.matchedPrinter as any).manual_duplex === true);

        if (isManualDuplex) {
          const userConfirmed = await new Promise<boolean>((resolve) => {
            setManualDuplexPrinter(plan.matchedPrinter.name);
            setManualDuplexDocName(plan.docName);
            setManualDuplexResolver(() => resolve);
            setManualDuplexOpen(true);
          });

          if (!userConfirmed) {
            toast.info(`Manual duplex skipped for ${plan.docName}. Segment kept pending.`);
            pendingSegments.push({
              docName: plan.docName,
              pageRange: plan.pageRange,
              reason: 'Manual duplex paper reinsertion skipped by user',
              pagesCount: plan.pageCount,
            });
            continue;
          }
        }
        const targetPageNums = plan.pageNumbers;
        const rawDocPps = String(plan.pagesPerSheet || (docSettings as any)?.pagesPerSheet || '1-in-1').toLowerCase();
        const docPps: '1-in-1' | '2-in-1' | '4-in-1' =
          rawDocPps.includes('4') ? '4-in-1' : rawDocPps.includes('2') ? '2-in-1' : '1-in-1';
        const pagesPerSheet = docPps === '4-in-1' ? 4 : docPps === '2-in-1' ? 2 : 1;
        const pagesPerJob = pagesPerSheet * (isDuplexPrint(targetDuplex) ? 2 : 1);
        const pageChunks: number[][] = [];
        for (let pageIndex = 0; pageIndex < targetPageNums.length; pageIndex += pagesPerJob) {
          pageChunks.push(targetPageNums.slice(pageIndex, pageIndex + pagesPerJob));
        }

        let nextChunkIndex = 0;
        for (let chunkIndex = 0; chunkIndex < pageChunks.length; chunkIndex++) {
          if (!(await printQueue.waitUntilReady())) {
            cancelled = true;
            break;
          }
          const pageNums = pageChunks[chunkIndex];
          const pageImages: string[] = [];
          if (docWrapper && docPps !== '1-in-1') {
            for (let pageIndex = 0; pageIndex < pageNums.length; pageIndex += pagesPerSheet) {
              const sheetPages = pageNums.slice(pageIndex, pageIndex + pagesPerSheet);
              pageImages.push(
                await renderDocumentToPrintDataUrl(
                  docWrapper,
                  sheetPages[0],
                  {
                    targetPaper: targetPaperSize,
                    orientation: targetOrientation,
                    scaling: targetScaling as any,
                    isBlackAndWhite: targetColorMode === 'B&W',
                    equalMargins: true,
                    fitToPaper: targetScaling !== 'actual',
                    pagesPerSheet: docPps,
                    pageNums: sheetPages,
                  },
                  docSettings.dpi || 300
                )
              );
            }
          }

          if (!(await printQueue.waitUntilReady())) {
            cancelled = true;
            break;
          }
          printQueue.update(
            plan.docName,
            pageNums[0],
            `Sending page ${pageNums[0]} to ${plan.matchedPrinter.name}...`
          );
          const res = await localPrintAgent.dispatchPrintJob({
            orderId: order.id,
            shopId: order.shop_id,
            pcId: plan.matchedPrinter.pc_id || order.target_pc_id || 'pc_01',
            printerId: plan.matchedPrinter.id,
            printerName: plan.matchedPrinter.name,
            fileName: plan.docName,
            fileUrl: plan.docUrl,
            pageImages: pageImages.length > 0 ? pageImages : undefined,
            copies: 1,
            colorMode: targetColorMode,
            duplex: targetDuplex,
            paperSize: targetPaperSize,
            paperType: targetMediaType,
            pageCount: pageNums.length,
            pageRange: pageImages.length > 0 ? undefined : pageNums.join(','),
            totalPrice: Number(order.grand_total) || 0,
            orientation: targetOrientation,
            mediaSource: docSettings.mediaSource,
            tray: docSettings.mediaSource,
            mediaType: targetMediaType,
            scaling: targetScaling,
            dpi: docSettings.dpi || 300,
            driverProperties: {
              ...docSettings,
              duplex: targetDuplex,
              density: docSettings.dpi || 300,
              dpi: docSettings.dpi || 300,
            },
          });

          if (!res.success) {
            pendingSegments.push({
              docName: plan.docName,
              pageRange: pageNums.join(','),
              reason: res.message || 'Printer physical dispatch error',
              pagesCount: pageNums.length,
            });
          } else if (printQueue.isCancelled()) {
            pendingSegments.push({
              docName: plan.docName,
              pageRange: pageNums.join(','),
              reason: 'Print stopped while the printer job was in progress; output needs verification',
              pagesCount: pageNums.length,
            });
          } else {
            const printedAt = new Date().toISOString();
            pageNums.forEach((pageNum) => {
              newlyPrinted.push({
                id: `seg-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
                doc_id: plan.docId,
                doc_name: plan.docName,
                page_range: String(pageNum),
                pages_count: 1,
                printer_name: plan.matchedPrinter.name,
                printed_at: printedAt,
                status: 'printed',
                color_mode: plan.colorMode,
                duplex: targetDuplex,
                copies: 1,
              });
            });
            printQueue.completePages(pageNums.length);
          }
          nextChunkIndex = chunkIndex + 1;
        }

        if (cancelled || nextChunkIndex < pageChunks.length) {
          const remainingPages = pageChunks.slice(nextChunkIndex).flat();
          if (remainingPages.length > 0) {
            pendingSegments.push({
              docName: plan.docName,
              pageRange: remainingPages.join(','),
              reason: 'Print cancelled by user',
              pagesCount: remainingPages.length,
            });
          }
          for (const { plan: unstartedPlan } of dispatchRuns.slice(i + 1)) {
            pendingSegments.push({
              docName: unstartedPlan.docName,
              pageRange: unstartedPlan.pageRange || 'All Pages',
              reason: 'Print cancelled by user',
              pagesCount: unstartedPlan.pageCount,
            });
          }
          break;
        }
      }

      const allPrinted = [...alreadyPrinted, ...newlyPrinted];

      // Compute persistent page-level statuses (Printed, Pending, Not Selected)
      const detailedPageStatuses = (documents || []).flatMap((d) => {
        const dTotal = Number(d.total_pages) || Number(order.total_pages) || 1;
        return computeDocumentPageStatuses(d, allPrinted, dTotal).map((s) => ({
          doc_id: d.id,
          doc_name: d.file_name,
          ...s,
        }));
      });

      // Item 3: Partial Printing and Order Status handling
      if (pendingSegments.length > 0) {
        const remainingPayload = pendingSegments.map((seg) => ({
          ...seg,
          status: 'Pending',
          all_page_statuses: detailedPageStatuses,
        }));

        await shopkeeperApi.saveOrderPrintedSegments(order.id, allPrinted, remainingPayload, 'Partially Printed');
        setOrder({
          ...order,
          order_status: 'Partially Printed',
          printed_segments: allPrinted,
          remaining_pages_info: remainingPayload,
        });
        toast.dismiss(toastId);

        setSummaryPrintedSegments(newlyPrinted);
        setSummaryPendingSegments(pendingSegments);
        setPartialSummaryOpen(true);
      } else {
        await shopkeeperApi.saveOrderPrintedSegments(order.id, allPrinted, [], 'Completed');
        toast.success(
          `Order #${order.token_number || order.id} printed completely! (${jobPlans.length} segment${jobPlans.length > 1 ? 's' : ''})`,
          { id: toastId }
        );
        setTimeout(() => navigate('/orders'), 1200);
      }
    } catch (err: any) {
      console.error('Print execution error:', err);
      toast.error(err.message || 'Hardware print failed.', { id: toastId });
    } finally {
      setPrinting(false);
      printQueue.finish();
    }
  };

  const requestDirectPrint = () => {
    if (documents.length > 1) {
      setSelectedPrintDocumentIds(new Set(documents.map((doc) => doc.id)));
      setPrintSelectionOpen(true);
      return;
    }
    void handleDirectPrint();
  };

  const handlePrintSelection = (printAll: boolean) => {
    const documentIds = printAll
      ? new Set(documents.map((doc) => doc.id))
      : new Set(selectedPrintDocumentIds);
    if (documentIds.size === 0) {
      toast.error('Select at least one document to print.');
      return;
    }
    setPrintSelectionOpen(false);
    void handleDirectPrint(documentIds);
  };

  const openEditConfig = (doc: (typeof documents)[number]) => {
    const config = doc.print_config || {};
    const printType = String(config.printType || config.color_mode || config.print_type || '').toLowerCase();
    const sides = String(config.sides || config.duplex || '').toLowerCase();
    const pageRanges = getConfiguredCustomRanges(config, (doc as any).page_range);
    const isCustomConfig =
      (config.pageRangeType === 'Custom Range' || pageRanges.length > 0) && pageRanges.length > 0;
    setEditingCustomRanges(isCustomConfig);
    setEditConfigRangeRules(
      pageRanges.map((range) => {
        const rangePrintType = String(range.printType || range.color_mode || config.printType || '').toLowerCase();
        const rangeSides = String(range.sides || range.side || range.duplex || config.sides || config.duplex || '').toLowerCase();
        return {
          pageRange: range.fromPage === range.toPage
            ? String(range.fromPage)
            : `${range.fromPage}-${range.toPage}`,
          printType: rangePrintType.includes('color') || rangePrintType.includes('colour') ? 'Color' : 'Black & White',
          sides: rangeSides.includes('back') || rangeSides.includes('double') || rangeSides.includes('duplex') || rangeSides.includes('tumble')
            ? 'Back-to-Back'
            : 'Single Side',
        };
      })
    );
    const pageRange = pageRanges
      .map((range: any) => {
        const fromPage = Number(range.fromPage ?? range.from ?? 1);
        const toPage = Number(range.toPage ?? range.to ?? fromPage);
        return fromPage === toPage ? String(fromPage) : `${fromPage}-${toPage}`;
      })
      .join(', ');
    const savedPageRange =
      pageRange ||
      String(config.selectedPageRange || config.page_range || config.pageRange || doc.page_range || '');

    setEditConfigCopies(Math.max(1, Number(config.copies) || Number(order?.config_copies) || 1));
    setEditConfigPrintType(printType.includes('color') || printType.includes('colour') ? 'Color' : 'Black & White');
    setEditConfigSides(sides.includes('back') || sides.includes('double') ? 'Back-to-Back' : 'Single Side');
    setEditConfigPageSize(config.pageSize || config.page_size || order?.config_page_size || 'A4');
    setEditConfigPaperType(config.paperType || config.paper_type || order?.config_paper_type || 'Standard 75 GSM');
    setEditConfigOrientation(
      String(config.orientation || config.layout || '').toLowerCase() === 'landscape' ? 'Landscape' : 'Portrait'
    );
    setEditConfigPagesPerSheet(
      String(config.pagesPerSheet || config.pages_per_sheet || config.nUp || '1-in-1')
    );
    setEditConfigPageRange(
      ['all', 'all pages'].includes(savedPageRange.trim().toLowerCase()) ? '' : savedPageRange
    );
    setEditConfigPageRangeError(null);
    setEditingConfigDocumentId(doc.id);
  };

  const saveEditedDocumentConfig = async () => {
    if (!order || !editingConfigDocumentId) return;
    const doc = documents.find((document) => document.id === editingConfigDocumentId);
    if (!doc) {
      toast.error('The selected document is no longer available.');
      return;
    }

    const totalPages = Math.max(
      1,
      Number(docWrappers[doc.id]?.numPages) || Number(doc.total_pages) || 1
    );
    const rangeText = editConfigPageRange.trim();
    let configRanges: Array<Record<string, string | number>> = [];
    if (editingCustomRanges) {
      if (editConfigRangeRules.length === 0) {
        setEditConfigPageRangeError('Add at least one custom range before saving.');
        return;
      }

      const occupiedPages = new Set<number>();
      for (let ruleIndex = 0; ruleIndex < editConfigRangeRules.length; ruleIndex += 1) {
        const rule = editConfigRangeRules[ruleIndex];
        const ruleRange = rule.pageRange.trim();
        if (!ruleRange) {
          setEditConfigPageRangeError(`Enter pages for Rule ${ruleIndex + 1}.`);
          return;
        }
        const parsedRule = parseSelectedPageRange(ruleRange, totalPages);
        if (parsedRule.error) {
          setEditConfigPageRangeError(`Rule ${ruleIndex + 1}: ${parsedRule.error}`);
          return;
        }
        for (const pageNumber of parsedRule.pageNumbers) {
          if (occupiedPages.has(pageNumber)) {
            setEditConfigPageRangeError(`Page ${pageNumber} is included in more than one rule.`);
            return;
          }
          occupiedPages.add(pageNumber);
        }

        const pageNumbers = [...parsedRule.pageNumbers].sort((a, b) => a - b);
        const ruleRanges: Array<{ fromPage: number; toPage: number }> = [];
        for (const pageNumber of pageNumbers) {
          const lastRange = ruleRanges[ruleRanges.length - 1];
          if (lastRange && lastRange.toPage === pageNumber - 1) lastRange.toPage = pageNumber;
          else ruleRanges.push({ fromPage: pageNumber, toPage: pageNumber });
        }
        configRanges.push(
          ...ruleRanges.map((range) => ({
            ...range,
            printType: rule.printType,
            color_mode: rule.printType,
            sides: rule.sides,
            duplex: rule.sides,
            pageSize: doc.print_config?.pageSize || 'A4',
          }))
        );
      }
    } else {
      const parsedRange = rangeText ? parseSelectedPageRange(rangeText, totalPages) : null;
      if (parsedRange?.error) {
        setEditConfigPageRangeError(parsedRange.error);
        return;
      }
      const selectedPages = [...(parsedRange?.pageNumbers || [])].sort((a, b) => a - b);
      for (const pageNumber of selectedPages) {
        const lastRange = configRanges[configRanges.length - 1];
        if (lastRange && lastRange.toPage === pageNumber - 1) {
          lastRange.toPage = pageNumber;
        } else {
          configRanges.push({ fromPage: pageNumber, toPage: pageNumber });
        }
      }
      configRanges = configRanges.map((range) => ({
        ...range,
        printType: editConfigPrintType,
        color_mode: editConfigPrintType,
        sides: editConfigSides,
        duplex: editConfigSides,
        pageSize: editConfigPageSize,
      }));
    }

    configRanges.sort((left, right) => Number(left.fromPage) - Number(right.fromPage));
    const savedRangeText = configRanges
      .map(({ fromPage, toPage }) =>
        fromPage === toPage ? String(fromPage) : `${fromPage}-${toPage}`
      )
      .join(', ');
    const nextConfig = editingCustomRanges
      ? {
          ...(doc.print_config || {}),
          pageRangeType: 'Custom Range',
          pageRange: savedRangeText,
          selectedPageRange: savedRangeText,
          customRanges: configRanges,
          custom_ranges: configRanges,
        }
      : {
          ...(doc.print_config || {}),
            copies: Math.max(1, Number(editConfigCopies) || 1),
            printType: editConfigPrintType,
            color_mode: editConfigPrintType,
            sides: editConfigSides,
            duplex: editConfigSides,
            pageSize: editConfigPageSize,
            page_size: editConfigPageSize,
            paperType: editConfigPaperType,
            paper_type: editConfigPaperType,
            orientation: editConfigOrientation,
            layout: editConfigOrientation,
            pagesPerSheet: editConfigPagesPerSheet,
            pages_per_sheet: editConfigPagesPerSheet,
            pageRangeType: configRanges.length > 0 ? 'Custom Range' : 'All Pages',
            pageRange: rangeText || 'All Pages',
            selectedPageRange: rangeText || 'All Pages',
            customRanges: configRanges,
            custom_ranges: configRanges,
        };

    setSavingDocumentConfig(true);
    try {
      const { error: documentError } = await supabase
        .from('uploaded_documents')
        .update({ print_config: nextConfig })
        .eq('id', doc.id);
      if (documentError) throw documentError;

      const updatedDocumentsConfig = Array.isArray(order.documents_config)
        ? order.documents_config.map((config: any) =>
            config.id === doc.id || config.document_id === doc.id
              ? { ...config, ...nextConfig }
              : config
          )
        : order.documents_config;
      if (Array.isArray(updatedDocumentsConfig)) {
        const { error: orderError } = await supabase
          .from('print_orders')
          .update({ documents_config: updatedDocumentsConfig })
          .eq('id', order.id);
        if (orderError) throw orderError;
      }

      setDocuments((currentDocuments) =>
        currentDocuments.map((currentDoc) =>
          currentDoc.id === doc.id ? { ...currentDoc, print_config: nextConfig } : currentDoc
        )
      );
      setOrder((currentOrder) =>
        currentOrder
          ? {
              ...currentOrder,
              documents_config: updatedDocumentsConfig,
            }
          : currentOrder
      );
      setEditingConfigDocumentId(null);
      setEditingCustomRanges(false);
      toast.success(`Configuration updated for ${doc.file_name || 'document'}.`);
    } catch (error) {
      console.error('Failed to update document print configuration:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update document configuration.');
    } finally {
      setSavingDocumentConfig(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[85vh] bg-[#1e1e1e] text-white">
        <RefreshCw className="w-8 h-8 animate-spin text-primary mb-3" />
        <p className="font-heading font-medium text-sm text-neutral-300">
          Loading order documents preview...
        </p>
        <p className="text-xs text-neutral-500 mt-1">
          Fetching database configurations & rendering PDF streams
        </p>
      </div>
    );
  }

  if (errorMsg || !order) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[85vh] bg-background p-6">
        <div className="max-w-md w-full bg-card border border-border p-6 rounded-xl shadow-lg text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
          <h2 className="text-lg font-heading font-bold text-foreground mb-1">Preview Unavailable</h2>
          <p className="text-xs text-muted-foreground mb-4">
            {errorMsg || 'Order details could not be retrieved.'}
          </p>
          <Button
            onClick={() => navigate('/orders')}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-heading"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Orders List
          </Button>
        </div>
      </div>
    );
  }

  const activePageItem = displayedPages[currentPageIndex];

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-[#1e1e1e] text-neutral-200 overflow-hidden select-none font-sans">
      <PrintProgressControls
        progress={printQueue.progress}
        onPause={printQueue.pause}
        onResume={printQueue.resume}
        onCancel={printQueue.cancel}
      />
      <PrintDocumentSelectionDialog
        open={printSelectionOpen}
        documents={documents.map((doc) => ({
          id: doc.id,
          name: doc.file_name || 'Untitled document',
          totalPages: Math.max(1, Number(doc.total_pages) || 1),
        }))}
        selectedDocumentIds={selectedPrintDocumentIds}
        onOpenChange={setPrintSelectionOpen}
        onSelectionChange={(documentId, selected) => {
          setSelectedPrintDocumentIds((current) => {
            const next = new Set(current);
            if (selected) next.add(documentId);
            else next.delete(documentId);
            return next;
          });
        }}
        onPrintAll={() => handlePrintSelection(true)}
        onPrintSelected={() => handlePrintSelection(false)}
      />
      <Dialog
        open={editingConfigDocumentId !== null}
        onOpenChange={(open) => {
          if (!open && !savingDocumentConfig) setEditingConfigDocumentId(null);
        }}
      >
        <DialogContent className="flex max-h-[90vh] max-w-[calc(100%-2rem)] flex-col overflow-hidden rounded-xl border-border bg-card font-sans md:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-heading font-bold uppercase text-foreground">
              <Pencil className="h-4 w-4 text-primary" />
              {editingCustomRanges ? 'Edit Custom Range Rules' : 'Edit Print Configuration'}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {editingCustomRanges
                ? `Add or edit page, color, and print-side rules for ${documents.find((doc) => doc.id === editingConfigDocumentId)?.file_name || 'this document'}.`
                : `Modify print parameters for ${documents.find((doc) => doc.id === editingConfigDocumentId)?.file_name || 'this document'}.`}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-2 text-xs">
            {editingCustomRanges ? (
              <>
                {editConfigRangeRules.map((rule, index) => (
                  <div key={index} className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">Rule {index + 1}</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={editConfigRangeRules.length <= 1}
                        onClick={() => {
                          setEditConfigRangeRules((current) => current.filter((_, ruleIndex) => ruleIndex !== index));
                          setEditConfigPageRangeError(null);
                        }}
                        className="h-7 px-2 text-[10px]"
                      >
                        Remove
                      </Button>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`custom-range-pages-${index}`} className="text-xs font-semibold text-foreground">
                        Pages
                      </Label>
                      <input
                        id={`custom-range-pages-${index}`}
                        type="text"
                        value={rule.pageRange}
                        onChange={(event) => {
                          const pageRange = event.target.value;
                          setEditConfigRangeRules((current) =>
                            current.map((item, ruleIndex) => ruleIndex === index ? { ...item, pageRange } : item)
                          );
                          setEditConfigPageRangeError(null);
                        }}
                        placeholder="e.g. 1 or 2-4"
                        className="h-9 w-full rounded-lg border border-border bg-background px-3 text-xs font-mono text-foreground"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor={`custom-range-color-${index}`} className="text-xs font-semibold text-foreground">
                          Color Type
                        </Label>
                        <select
                          id={`custom-range-color-${index}`}
                          value={rule.printType}
                          onChange={(event) =>
                            setEditConfigRangeRules((current) =>
                              current.map((item, ruleIndex) =>
                                ruleIndex === index
                                  ? { ...item, printType: event.target.value as EditableCustomRange['printType'] }
                                  : item
                              )
                            )
                          }
                          className="h-9 w-full rounded-lg border border-border bg-background px-2 text-xs text-foreground"
                        >
                          <option value="Color">Color</option>
                          <option value="Black & White">Black &amp; White</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`custom-range-sides-${index}`} className="text-xs font-semibold text-foreground">
                          Print Side
                        </Label>
                        <select
                          id={`custom-range-sides-${index}`}
                          value={rule.sides}
                          onChange={(event) =>
                            setEditConfigRangeRules((current) =>
                              current.map((item, ruleIndex) =>
                                ruleIndex === index
                                  ? { ...item, sides: event.target.value as EditableCustomRange['sides'] }
                                  : item
                              )
                            )
                          }
                          className="h-9 w-full rounded-lg border border-border bg-background px-2 text-xs text-foreground"
                        >
                          <option value="Single Side">Single Side</option>
                          <option value="Back-to-Back">Back-to-Back</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  disabled={savingDocumentConfig}
                  onClick={() => {
                    setEditConfigRangeRules((current) => [
                      ...current,
                      { pageRange: '', printType: 'Black & White', sides: 'Single Side' },
                    ]);
                    setEditConfigPageRangeError(null);
                  }}
                  className="w-full"
                >
                  + Add Rule
                </Button>
              </>
            ) : (
              <>
                <div className="space-y-1">
                  <Label htmlFor="edit-document-copies" className="text-xs font-semibold text-foreground">
                    Number of Copies
                  </Label>
                  <input
                    id="edit-document-copies"
                    type="number"
                    min={1}
                    max={100}
                    value={editConfigCopies}
                    onChange={(event) => setEditConfigCopies(Math.max(1, Number(event.target.value) || 1))}
                    className="h-9 w-full rounded-lg border border-border bg-background px-3 text-xs font-mono text-foreground"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-document-page-range" className="text-xs font-semibold text-foreground">
                    Select Pages to Print
                  </Label>
                  <input
                    id="edit-document-page-range"
                    type="text"
                    value={editConfigPageRange}
                    onChange={(event) => {
                      const range = event.target.value;
                      setEditConfigPageRange(range);
                      const doc = documents.find((document) => document.id === editingConfigDocumentId);
                      const pageCount = Math.max(
                        1,
                        Number(docWrappers[editingConfigDocumentId || '']?.numPages) ||
                          Number(doc?.total_pages) ||
                          1
                      );
                      setEditConfigPageRangeError(
                        range.trim() ? parseSelectedPageRange(range, pageCount).error : null
                      );
                    }}
                    placeholder="All pages or e.g. 2-6, 8"
                    aria-invalid={Boolean(editConfigPageRangeError)}
                    className={`h-9 w-full rounded-lg border bg-background px-3 text-xs font-mono text-foreground placeholder:text-muted-foreground ${
                      editConfigPageRangeError ? 'border-destructive' : 'border-border'
                    }`}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Leave blank to print all pages. Total pages: {Math.max(
                      1,
                      Number(docWrappers[editingConfigDocumentId || '']?.numPages) ||
                        Number(documents.find((doc) => doc.id === editingConfigDocumentId)?.total_pages) ||
                        1
                    )}
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="edit-document-color" className="text-xs font-semibold text-foreground">
                      Color Mode (Print Type)
                    </Label>
                    <select
                      id="edit-document-color"
                      value={editConfigPrintType}
                      onChange={(event) => setEditConfigPrintType(event.target.value as EditableCustomRange['printType'])}
                      className="h-9 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground"
                    >
                      <option value="Black & White">Black &amp; White (B&amp;W)</option>
                      <option value="Color">Full Colour</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="edit-document-sides" className="text-xs font-semibold text-foreground">
                      Print Sides
                    </Label>
                    <select
                      id="edit-document-sides"
                      value={editConfigSides}
                      onChange={(event) => setEditConfigSides(event.target.value as EditableCustomRange['sides'])}
                      className="h-9 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground"
                    >
                      <option value="Single Side">Single Sided (Simplex)</option>
                      <option value="Back-to-Back">Back-to-Back (Duplex)</option>
                    </select>
                  </div>
                </div>
              </>
            )}
            {editConfigPageRangeError && (
              <p role="alert" className="text-[11px] font-medium text-destructive">
                {editConfigPageRangeError}
              </p>
            )}
          </div>

          <DialogFooter className="!flex !flex-row shrink-0 gap-2 border-t border-border pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={savingDocumentConfig}
              onClick={() => setEditingConfigDocumentId(null)}
              className="h-9 min-w-24 flex-1 border-neutral-500 text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={savingDocumentConfig || Boolean(editConfigPageRangeError)}
              onClick={() => void saveEditedDocumentConfig()}
              className="h-9 flex-1 whitespace-normal text-xs font-semibold bg-primary text-primary-foreground"
            >
              {savingDocumentConfig
                ? 'Saving...'
                : editingCustomRanges
                  ? 'Save Range Rules'
                  : 'Save Configuration'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* ================= TOP TOOLBAR (Single preview header for all documents) ================= */}
      <header className="h-12 bg-[#202124] border-b border-neutral-800 flex items-center justify-between px-3 shrink-0 z-20 text-neutral-300 text-xs shadow-md">
        {/* Left: Sidebar Toggle, Back Button, Order Identifier */}
        <div className="flex items-center gap-2 min-w-0 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen((prev) => !prev)}
            className="h-8 w-8 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded shrink-0"
            title={sidebarOpen ? 'Hide Page Thumbnails' : 'Show Page Thumbnails'}
          >
            <Menu className="w-4 h-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/orders')}
            className="h-8 w-8 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded shrink-0"
            title="Return to Orders Queue"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>

          <div className="flex items-center gap-2 min-w-0 pr-2 border-r border-neutral-700/60 max-w-[200px] md:max-w-[320px]">
            <FileText className="w-4 h-4 text-primary shrink-0" />
            <span
              className="font-bold text-white truncate text-xs font-mono"
              title={`Token #${order.token_number || order.id} • ${documents.length} Document(s)`}
            >
              Token #{order.token_number || order.id} • {documents.length} {documents.length === 1 ? 'Doc' : 'Docs'}
            </span>
          </div>
        </div>

        {/* Center: Global Page Navigation across all documents, Zoom Controls, Rotate */}
        <div className="flex items-center gap-1 md:gap-2">
          {/* Page Counter & Controls */}
          <div className="flex items-center bg-neutral-900 border border-neutral-700/60 rounded px-1 py-0.5">
            <button
              disabled={currentPageIndex <= 0}
              onClick={() => scrollToPage(currentPageIndex - 1)}
              className="p-1 hover:text-white disabled:opacity-30 disabled:hover:text-neutral-400 transition-colors"
              title="Previous Page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="px-1.5 font-mono text-xs font-semibold text-white">
              {displayedPages.length > 0 ? currentPageIndex + 1 : 0} / {displayedPages.length}
            </span>
            <button
              disabled={currentPageIndex >= displayedPages.length - 1}
              onClick={() => scrollToPage(currentPageIndex + 1)}
              className="p-1 hover:text-white disabled:opacity-30 disabled:hover:text-neutral-400 transition-colors"
              title="Next Page"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-4 w-px bg-neutral-700/60 mx-1 hidden sm:block" />

          {/* Zoom Controls */}
          <div className="flex items-center bg-neutral-900 border border-neutral-700/60 rounded px-1 py-0.5">
            <button
              onClick={handleZoomOut}
              className="p-1 hover:text-white transition-colors"
              title="Zoom Out (-)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-1.5 font-mono text-xs text-neutral-200 min-w-[42px] text-center font-semibold">
              {Math.round(zoomScale * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              className="p-1 hover:text-white transition-colors"
              title="Zoom In (+)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Fit to Width & Fit to Page & Rotate */}
          <div className="hidden md:flex items-center gap-0.5">

          </div>

          {/* Summarize Drawer Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSummaryOpen((p) => !p)}
            className="h-7 px-2 text-[11px] gap-1 text-neutral-300 hover:text-white hover:bg-neutral-800 rounded hidden xl:flex"
            title="Inspect Order Information & Configuration"
          >
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>Order Info</span>
          </Button>
        </div>

        {/* Right: Active Page Config Badge, Download, Physical Print */}
        <div className="flex items-center gap-2">
          {activePageItem && (
            <></>
          )}

          {/* Printer Properties Button (Item 3 & Multi-Doc Selection) */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (documents && documents.length > 1) {
                setDocSelectorOpen(true);
              } else {
                setTargetPropertyDocId(documents[0]?.id || 'all');
                setPropertiesDialogOpen(true);
              }
            }}
            className="h-8 px-2.5 text-xs text-neutral-300 hover:text-white border-neutral-700 bg-neutral-800/80 rounded gap-1.5 font-medium shadow-sm"
            title="Inspect & Adjust Driver Properties (Paper Size, Tray, Media Type, Margins, Duplex)"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
            <span>Properties</span>
          </Button>

          {/* Download Original File(s) */}
          <Button
            variant="ghost"
            size="icon"
            disabled={downloadingDocuments || documents.length === 0}
            onClick={() => {
              setSelectedDownloadDocumentIds(new Set());
              setDownloadDialogOpen(true);
            }}
            className="h-8 w-8 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded"
            title="Choose documents to download"
          >
            <Download className={`w-4 h-4 ${downloadingDocuments ? 'animate-pulse' : ''}`} />
          </Button>

          {/* Go For Print Button */}
          <Button
            size="sm"
            disabled={printing || unifiedPages.length === 0}
            onClick={requestDirectPrint}
            className="h-8 px-3 text-xs font-heading font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded gap-1.5 shadow-sm active:scale-95 transition-transform"
            title="Dispatch all documents strictly following database configurations via QZ Tray"
          >
            <Printer className={`w-3.5 h-3.5 ${printing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Go For Print</span>
          </Button>
        </div>
      </header>
      {/* ================= WORKSPACE (Sidebar + Continuous Document Stream) ================= */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Sidebar: Page Thumbnails & Config Details */}
        {sidebarOpen && (
          <aside className="w-64 bg-[#202124] border-r border-neutral-800 flex flex-col shrink-0 z-10 select-none">
            {/* Sidebar Tabs */}
            <div className="flex border-b border-neutral-800 bg-[#18191c] text-xs">
              <button
                onClick={() => setSidebarTab('thumbnails')}
                className={`flex-1 py-2 font-mono flex items-center justify-center gap-1.5 transition-colors ${
                  sidebarTab === 'thumbnails'
                    ? 'text-white border-b-2 border-primary font-bold bg-[#202124]'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-primary" />
                <span>Pages ({displayedPages.length})</span>
              </button>
              <button
                onClick={() => setSidebarTab('details')}
                className={`flex-1 py-2 font-mono flex items-center justify-center gap-1.5 transition-colors ${
                  sidebarTab === 'details'
                    ? 'text-white border-b-2 border-primary font-bold bg-[#202124]'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-primary" />
                <span>Configs ({documents.length})</span>
              </button>
            </div>

            {/* Sidebar Content */}
            {sidebarTab === 'thumbnails' ? (
              <div className="flex-1 overflow-y-auto p-3 space-y-4">
                {displayedPages.map((item, index) => {
                  const isActive = index === currentPageIndex;
                  const thumbnailCache = renderedThumbnailsRef.current[item.key];
                  const expectedThumbnailSignature = getRenderSignature(item).thumbnailSignature;
                  const isThumbnailRendered =
                    Boolean(
                      thumbnailCache &&
                        thumbnailCanvasRefs.current[item.key] &&
                        thumbnailCache.canvas === thumbnailCanvasRefs.current[item.key] &&
                        thumbnailCache.signature === expectedThumbnailSignature
                    );
                  return (
                    <div
                      key={item.key}
                      onClick={() => scrollToPage(index)}
                      className={`cursor-pointer group flex flex-col items-center transition-all ${
                        isActive ? 'scale-105' : 'hover:opacity-90'
                      }`}
                    >
                      {item.isFirstPageOfDoc && (
                        <div className="w-full text-[11px] font-mono text-white font-bold mb-1.5 truncate border-b border-neutral-800 pb-0.5">
                          Doc #{item.docIndex + 1}: {item.docFileName}
                        </div>
                      )}
                      <div
                        className={`relative w-[130px] bg-white rounded overflow-hidden shadow-md transition-all p-0.5 ${
                          isActive
                            ? 'ring-2 ring-primary ring-offset-2 ring-offset-[#202124]'
                            : 'border border-neutral-700/60 group-hover:border-neutral-500'
                        }`}
                        style={{ aspectRatio: `${getRenderSignature(item).paperAspectRatio}` }}
                      >
                        {(!item.pdfWrapper || !isThumbnailRendered) && (
                          <div className="absolute inset-0 z-10 bg-neutral-200" />
                        )}
                        <canvas
                          ref={(el) => {
                            thumbnailCanvasRefs.current[item.key] = el;
                          }}
                          className="block max-w-full h-auto bg-white"
                          style={{
                            opacity: isThumbnailRendered ? 1 : 0,
                            filter: item.isBw ? 'grayscale(100%) contrast(105%)' : 'none',
                          }}
                        />
                      </div>
                      <div className="flex items-center gap-1 mt-1 font-mono text-[10px]">
                        <span
                          className={`font-bold ${
                            isActive ? 'text-primary' : 'text-neutral-400 group-hover:text-neutral-200'
                          }`}
                        >
                          Doc #{item.docIndex + 1} • p.{item.pageNum}
                        </span>
                        <span className="text-neutral-600">•</span>
                        <span className={item.isBw ? 'text-neutral-400' : 'text-emerald-400 font-semibold'}>
                          {item.isBw ? 'B&W' : 'Color'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Config Details Tab: Database settings for each document as separate cards */
              (<div className="flex-1 overflow-y-auto p-3 text-xs space-y-3 font-sans">
                <div className="flex items-center justify-between pb-1 border-b border-neutral-800">
                  <span className="text-[10px] uppercase font-mono text-neutral-400 font-semibold">
                    Config Cards ({documents.length})
                  </span>
                  {selectedConfigDocId && (
                    <button
                      onClick={() => setSelectedConfigDocId(null)}
                      className="text-[10px] text-primary hover:underline font-mono"
                    >
                      Show All
                    </button>
                  )}
                </div>

                {documents.map((doc, idx) => {
                  const cfg = doc.print_config || {};
                  const customRanges = getConfiguredCustomRanges(
                    cfg,
                    (doc as any).page_range || order?.page_range || (order as any)?.config_page_range
                  );
                  const isCustom =
                    (cfg.pageRangeType === 'Custom Range' || customRanges.length > 0) &&
                    customRanges.length > 0;
                  const isSelected = selectedConfigDocId === doc.id;
                  return (
                    <div
                      key={doc.id}
                      onClick={() => setSelectedConfigDocId(isSelected ? null : doc.id)}
                      className={`p-3 bg-neutral-900 border rounded-lg space-y-2 cursor-pointer transition-all ${
                        isSelected
                          ? 'border-primary ring-2 ring-primary/40 bg-neutral-900/90 shadow-md'
                          : 'border-neutral-800 hover:border-neutral-700 hover:bg-neutral-850'
                      }`}
                      title={isSelected ? 'Click to show all documents' : 'Click to preview only this document'}
                    >
                      <div className="flex items-center justify-between border-b border-neutral-800 pb-1.5">
                        <span className="font-mono text-white font-bold truncate text-[11px]">
                          Doc #{idx + 1}: {doc.file_name}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 ${
                          isSelected
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-primary/10 text-primary border border-primary/30'
                        }`}>
                          {isSelected ? 'Active Preview' : (isCustom ? 'Custom Range' : 'All Pages')}
                        </span>
                      </div>

                      {isCustom ? (
                        <div className="space-y-1.5 pt-0.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-amber-400 font-semibold uppercase tracking-wide">
                              Custom Ranges ({customRanges.length})
                            </span>
                            <span className="text-[9px] text-neutral-400 font-mono">
                              Edit rules with the pencil below
                            </span>
                          </div>
                          {customRanges.map((rng, rIdx) => (
                                        <div
                                          key={rIdx}
                                          className="p-1.5 bg-neutral-800/80 rounded border border-neutral-700/50 text-[10px]"
                                        >
                                          <span className="font-mono text-white font-bold">
                                            Pages {rng.fromPage}–{rng.toPage}:
                                          </span>
                                          <span className="ml-1 text-neutral-300">
                                            {rng.printType || rng.color_mode || 'B&W'} • {rng.sides || rng.side || rng.duplex || 'Single Side'}
                                          </span>
                                        </div>
                                      ))}
                                      <p className="text-[9px] text-neutral-400 italic">
                                        Per-range page, color, and print-side rules.
                          </p>
                        </div>
                      ) : (
                        <div className="text-[11px] text-neutral-300 space-y-0.5">
                          <p>
                            <span className="text-neutral-500">Mode:</span>{' '}
                            <span className="font-semibold text-white">{cfg.printType || 'Black & White'}</span>
                          </p>
                          <p>
                            <span className="text-neutral-500">Sides:</span>{' '}
                            <span className="font-semibold text-white">{cfg.sides || 'Single Side'}</span>
                          </p>
                          <p>
                            <span className="text-neutral-500">Size:</span>{' '}
                            <span className="font-semibold text-white">{cfg.pageSize || 'A4'}</span>
                          </p>
                          {cfg.layout && cfg.layout !== '1-in-1' && (
                            <p>
                              <span className="text-neutral-500">Layout:</span>{' '}
                              <span className="font-semibold text-primary">{cfg.layout}</span>
                            </p>
                          )}
                        </div>
                      )}

                      <div className="text-[10px] text-neutral-400 border-t border-neutral-800/80 pt-1.5 flex items-center justify-between">
                        <span>Copies: <strong className="text-[12px] text-white">{cfg.copies || 1}</strong></span>
                        <span>Total Pages: <strong className="text-[12px] text-white">{doc.total_pages || 1}</strong></span>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1">
                        <span className="min-w-0 truncate text-[9px] font-mono text-neutral-400">
                          {isSelected ? '✓ Showing this document preview' : 'Click to isolate preview'}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          disabled={printing}
                          onClick={(event) => {
                            event.stopPropagation();
                            openEditConfig(doc);
                          }}
                          className="h-8 w-8 shrink-0 border-neutral-500 bg-neutral-800 p-0 text-white hover:bg-neutral-700"
                          title={isCustom ? 'Edit custom range rules' : 'Edit document print configuration'}
                          aria-label={`Edit ${isCustom ? 'custom range rules' : 'print configuration'} for ${doc.file_name || `document ${idx + 1}`}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>)
            )}
          </aside>
        )}

        {/* ================= MAIN CONTINUOUS CANVAS STREAM ================= */}
        {/* All documents and their qualifying pages are rendered in continuous sequence */}
        <main
          ref={containerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto overflow-x-auto p-4 sm:p-8 flex flex-col items-center gap-8 bg-[#1e1e1e]"
        >
          {/* Active Document Filter Notification Banner */}
          {selectedConfigDocId && (
            <div className="w-full max-w-3xl flex items-center justify-between px-4 py-2.5 bg-primary/10 border border-primary/40 rounded-lg text-xs font-sans text-neutral-200 shadow-sm">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary shrink-0" />
                <span>
                  Showing isolated preview for <strong>{documents.find((d) => d.id === selectedConfigDocId)?.file_name || 'Selected Document'}</strong> ({displayedPages.length} pages)
                </span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedConfigDocId(null)}
                className="h-7 px-2 text-[11px] text-primary hover:text-primary hover:bg-primary/20 rounded font-mono"
              >
                Show All Documents
              </Button>
            </div>
          )}

          {/* Purged Document (8-Hour Retention Policy) Attractive Placeholder */}
          {order?.notes?.includes('8-hour') || (!order?.file_url && documents.every((d) => !d.file_url)) ? (
            <div className="flex flex-col items-center justify-center p-8 md:p-12 bg-neutral-900 border border-neutral-800 rounded-2xl max-w-lg text-center shadow-2xl m-auto">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center mb-4 text-primary">
                <FileText className="w-8 h-8" />
              </div>
              <div className="font-heading font-extrabold text-xl text-white tracking-tight mb-1">
                Print<span className="text-primary">On24</span>
              </div>
              <div className="text-sm font-semibold text-neutral-200 mb-2">
                File removed after 8 hours
              </div>
              <p className="text-xs text-neutral-400 max-w-sm leading-relaxed mb-6">
                Under the 8-hour privacy and security retention policy, customer document storage files are automatically purged. Order receipts, total amounts, and transaction records remain permanently intact.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/orders')}
                className="text-xs font-heading font-bold"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Back to Orders Queue
              </Button>
            </div>
          ) : displayedPages.length === 0 ? (
            <div className="flex flex-col items-center justify-center m-auto p-8 max-w-md text-center bg-neutral-900 border border-neutral-800 rounded-xl shadow-xl">
              <CheckCircle2 className="w-14 h-14 text-emerald-500 mb-3 animate-pulse" />
              <h3 className="text-base font-bold text-white mb-1">All Selected Pages Printed</h3>
              <p className="text-xs text-neutral-400 mb-4">
                There are no remaining pending pages to print for this order. Already printed pages are preserved and will never be reprinted.
              </p>
              <Button
                onClick={async () => {
                  await shopkeeperApi.updateOrderStatus(order.id, 'Completed');
                  toast.success(`Order #${order.token_number || order.id} marked as Completed!`);
                  navigate('/orders');
                }}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs"
              >
                Complete Order & Return to Queue
              </Button>
            </div>
          ) : (
            displayedPages.map((item) => {
              const cachedRender = renderedCacheRef.current[item.key];
              const mainCanvas = mainCanvasRefs.current[item.key];
              const { signature: expectedRenderSignature, paperAspectRatio, paperWidth } = getRenderSignature(item);
              const isRendered =
                Boolean(item.pdfWrapper) &&
                Boolean(
                  cachedRender &&
                    mainCanvas &&
                    cachedRender.canvas === mainCanvas &&
                    cachedRender.signature === expectedRenderSignature
                );

              return (
              <div key={item.key} className="relative flex flex-col items-center group w-full max-w-3xl">
              {/* Document Header Separator (Appears on the first page of each document) */}
              {item.isFirstPageOfDoc && (
                <div className="w-full flex items-center justify-between px-3.5 py-2.5 bg-neutral-900/90 border border-neutral-700/80 rounded-md text-xs font-mono text-neutral-300 shadow mb-4 mt-6 first:mt-0">
                  <div className="flex items-center gap-2 truncate">
                    <FileText className="w-4 h-4 text-primary shrink-0" />
                    <span className="font-bold text-white truncate">
                      Document #{item.docIndex + 1}: {item.docFileName}
                    </span>
                    <span className="text-neutral-500">•</span>
                    <span className="text-neutral-400">
                      {item.isCustomRange
                        ? `Custom Range (${item.docVisiblePagesCount} pages shown)`
                        : `All Pages (${item.docTotalPages} pages)`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-primary font-semibold">{item.pageSize}</span>
                    <span className="text-neutral-600">•</span>
                    <span className="text-neutral-400">{item.sides}</span>
                    <span className="text-neutral-600">•</span>
                    <span className="text-amber-400 font-bold">{item.copies} {item.copies > 1 ? 'Copies' : 'Copy'}</span>
                  </div>
                </div>
              )}
              {/* Per-Page Configuration Indicator Header */}

              {/* Paper Canvas Container matching realistic physical sheet */}
              <div
                className="bg-white rounded-sm shadow-[0_10px_35px_rgba(0,0,0,0.6)] border border-neutral-400/20 overflow-hidden transition-all duration-150"
                style={{
                  ...(isRendered
                    ? {}
                    : {
                        width: `min(100%, ${paperWidth * zoomScale}px)`,
                        aspectRatio: `${paperAspectRatio}`,
                        position: 'relative' as const,
                      }),
                  filter: item.isBw ? 'grayscale(100%) contrast(105%)' : 'none',
                }}
              >
                <canvas
                  ref={(el) => {
                    mainCanvasRefs.current[item.key] = el;
                  }}
                  className="block bg-white max-w-full h-auto object-contain"
                  style={{ opacity: isRendered ? 1 : 0 }}
                />
                {!isRendered && (
                  <div className="absolute inset-0 flex items-center justify-center bg-neutral-200 p-6 text-center">
                    {previewErrors[item.docId] ? (
                      <p className="max-w-md break-words text-xs text-red-700">{previewErrors[item.docId]}</p>
                    ) : (
                      <span className="text-sm text-neutral-500">Loading document preview...</span>
                    )}
                  </div>
                )}
              </div>
              {/* Page Number & Document Footer Under Sheet */}
              <div className="mt-2 text-center text-xs font-mono text-neutral-400">
                Doc #{item.docIndex + 1} • Page {item.pageNum} of {item.docTotalPages} ({item.docFileName})
              </div>
              </div>
              );
            })
          )}
        </main>

        {/* ================= SUMMARY DRAWER (When Order Info is clicked) ================= */}
        {summaryOpen && (
          <div className="absolute right-0 top-0 bottom-0 w-80 bg-[#202124] border-l border-neutral-800 shadow-2xl p-4 z-30 flex flex-col font-sans overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-700">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <h3 className="font-heading font-bold text-sm text-white">Order Details</h3>
              </div>
              <button
                onClick={() => setSummaryOpen(false)}
                className="p-1 hover:text-white text-neutral-400 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="p-2.5 bg-neutral-900 border border-neutral-800 rounded">
                <span className="text-[10px] text-neutral-500 uppercase tracking-wider block font-semibold mb-1">
                  Customer
                </span>
                <p className="font-semibold text-neutral-200">{order.customer_name || order.user_name}</p>
                {order.user_phone && (
                  <p className="text-[11px] text-neutral-400 font-mono mt-0.5">{order.user_phone}</p>
                )}
              </div>

              <div className="p-2.5 bg-neutral-900 border border-neutral-800 rounded">
                <span className="text-[10px] text-neutral-500 uppercase tracking-wider block font-semibold mb-1">
                  Order Summary
                </span>
                <p className="text-neutral-300">
                  Total Documents: <strong className="text-white">{documents.length}</strong>
                </p>
                <p className="text-neutral-300">
                  Printable Pages: <strong className="text-white">{unifiedPages.length}</strong>
                </p>
                <p className="text-neutral-300 mt-1">
                  Grand Total: <strong className="text-primary font-mono text-sm">₹{order.grand_total}</strong>
                </p>
              </div>

              <div className="p-2.5 bg-neutral-900 border border-neutral-800 rounded">
                <span className="text-[10px] text-neutral-500 uppercase tracking-wider block font-semibold mb-1">
                  Target Workstation
                </span>
                <p className="font-mono text-neutral-300">
                  {order.target_pc_name || order.target_pc_id || 'PC Counter 1'}
                </p>
              </div>
            </div>

            <div className="mt-auto pt-4 border-t border-neutral-800">
              <Button
                disabled={printing || unifiedPages.length === 0}
                onClick={requestDirectPrint}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-heading font-bold"
              >
                <Printer className="w-4 h-4 mr-2" />
                Go For Print
              </Button>
            </div>
          </div>
        )}
      </div>
      {/* QZ Tray Custom Permission Modal */}
      <QzPermissionModal />
      {/* Partial Print Summary Modal */}
      <PartialPrintSummaryModal
        open={partialSummaryOpen}
        tokenNumber={order.token_number}
        orderNumber={order.order_number}
        printedSegments={summaryPrintedSegments}
        pendingSegments={summaryPendingSegments}
        onKeepOrder={() => {
          setPartialSummaryOpen(false);
          toast.info(`Order #${order.token_number} retained in active queue with unprinted remaining pages.`);
          loadOrderData();
        }}
        onMarkCompleted={async () => {
          if (summaryPendingSegments.length > 0) {
            toast.info('Print all pending segments before completing this order.');
            return;
          }
          try {
            await shopkeeperApi.updateOrderStatus(order.id, 'Completed');
            setPartialSummaryOpen(false);
            toast.success(`Order #${order.token_number} marked as Completed and moved to Recent History.`);
            navigate('/orders');
          } catch {
            toast.error('Failed to update order status');
          }
        }}
      />
      {/* Manual Duplex Confirmation Modal */}
      <ManualDuplexModal
        open={manualDuplexOpen}
        printerName={manualDuplexPrinter}
        docName={manualDuplexDocName}
        onConfirmReinserted={() => {
          setManualDuplexOpen(false);
          if (manualDuplexResolver) {
            manualDuplexResolver(true);
            setManualDuplexResolver(null);
          }
        }}
        onCancel={() => {
          setManualDuplexOpen(false);
          if (manualDuplexResolver) {
            manualDuplexResolver(false);
            setManualDuplexResolver(null);
          }
        }}
      />

      {/* 4.1 PRINTER DISAMBIGUATION MODAL (When multiple printers match the same config) */}
      <Dialog
        open={Boolean(disambiguationPlan)}
        onOpenChange={(open: boolean) => {
          if (!open && disambiguationPlan) {
            disambiguationPlan.resolve(disambiguationPlan.matchingPrinters[0]);
          }
        }}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg rounded-2xl bg-card border border-border p-6 font-sans">
          <DialogHeader>
            <DialogTitle className="text-base font-heading font-bold uppercase text-foreground flex items-center gap-2">
              <Printer className="w-5 h-5 text-primary" />
              <span>Select Target Printer</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Multiple configured printers match this document segment ({disambiguationPlan?.segmentName}). Choose which printer to use:
            </DialogDescription>
          </DialogHeader>

          {disambiguationPlan && (
            <div className="space-y-2 py-2">
              {disambiguationPlan.matchingPrinters.map((prn) => (
                <div
                  key={prn.id}
                  className="p-3.5 rounded-xl border border-border bg-card hover:border-primary/50 transition-colors flex items-center justify-between gap-3"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold font-mono text-foreground">{prn.name}</span>
                      {prn.is_default && (
                        <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                          Default
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {prn.model} • via {prn.connection_type.toUpperCase()} • {prn.is_color ? 'Color & B&W' : 'B&W Only'}
                    </p>
                  </div>

                  <Button
                    size="sm"
                    onClick={() => disambiguationPlan.resolve(prn)}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-lg px-3.5 shrink-0"
                  >
                    Select &amp; Print
                  </Button>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Multi-Document Selection Dialog for Properties (Requirement 3) */}
      <Dialog open={docSelectorOpen} onOpenChange={setDocSelectorOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md bg-[#18191c] border-neutral-800 text-white p-5 rounded-2xl">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-sm font-heading font-bold text-white flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-amber-400" />
              Configure Document Properties
            </DialogTitle>
            <DialogDescription className="text-xs text-neutral-400 font-sans">
              This order contains multiple documents. Select which document&apos;s properties to customize or choose &quot;All Above&quot; to apply common properties.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-neutral-300">
                Target Document Selection
              </Label>
              <select
                value={targetPropertyDocId}
                onChange={(e) => setTargetPropertyDocId(e.target.value)}
                className="w-full bg-[#121316] border border-neutral-700 rounded-lg px-3 py-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary font-mono"
              >
                <option value="all">
                  ★ All Above (Apply common properties to all {documents.length} documents)
                </option>
                {documents.map((doc, idx) => (
                  <option key={doc.id} value={doc.id}>
                    Doc #{idx + 1}: {doc.file_name || doc.name || `Document ${idx + 1}`} ({doc.total_pages || 1} pages)
                  </option>
                ))}
              </select>
            </div>

            <p className="text-[11px] text-neutral-400 font-mono">
              {targetPropertyDocId === 'all'
                ? `• Selected properties will apply to all ${documents.length} documents in this order.`
                : `• Properties will apply specifically to: ${documents.find((d) => d.id === targetPropertyDocId)?.file_name || 'Selected Document'}.`}
            </p>
          </div>

          <DialogFooter className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-800">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDocSelectorOpen(false)}
              className="text-xs border-neutral-700 text-neutral-300 hover:bg-neutral-800"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setDocSelectorOpen(false);
                setPropertiesDialogOpen(true);
              }}
              className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow"
            >
              Configure Properties
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={downloadDialogOpen} onOpenChange={setDownloadDialogOpen}>
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] max-w-[calc(100%-2rem)] flex-col overflow-hidden bg-[#18191c] border-neutral-800 text-white p-5 rounded-2xl md:max-w-lg">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-sm font-heading font-bold text-white flex items-center gap-2">
              <Download className="w-4 h-4 text-primary" />
              Download order documents
            </DialogTitle>
            <DialogDescription className="text-xs text-neutral-400">
              Tick the documents you want, or download every document in this order.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto space-y-1 py-2">
            {documents.map((doc, index) => {
              const documentId = String(doc.id);
              const isSelected = selectedDownloadDocumentIds.has(documentId);

              return (
                <label
                  key={documentId}
                  className="flex items-center gap-3 rounded-lg border border-neutral-800 px-3 py-2.5 hover:bg-neutral-800/70 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(event) => {
                      setSelectedDownloadDocumentIds((current) => {
                        const next = new Set(current);
                        if (event.target.checked) {
                          next.add(documentId);
                        } else {
                          next.delete(documentId);
                        }
                        return next;
                      });
                    }}
                    className="h-4 w-4 shrink-0 accent-primary"
                  />
                  <FileText className="h-4 w-4 shrink-0 text-neutral-400" />
                  <span className="min-w-0 flex-1 truncate text-xs text-neutral-200">
                    {doc.file_name || doc.name || `Document ${index + 1}`}
                  </span>
                </label>
              );
            })}
          </div>

          <DialogFooter className="grid shrink-0 grid-cols-2 gap-2 pt-3 border-t border-neutral-800 sm:grid-cols-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDownloadDialogOpen(false)}
              className="w-full whitespace-normal px-2 text-xs border-neutral-700 text-neutral-800 hover:bg-neutral-800"
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={selectedDownloadDocumentIds.size === 0 || downloadingDocuments}
              onClick={() => void handleDownload(false)}
              className="w-full whitespace-normal px-2 text-xs border-neutral-700 text-neutral-800 hover:bg-neutral-800"
            >
              Download selected ({selectedDownloadDocumentIds.size})
            </Button>
            <Button
              size="sm"
              disabled={downloadingDocuments}
              onClick={() => void handleDownload(true)}
              className="col-span-2 w-full whitespace-normal px-2 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-bold sm:col-span-1"
            >
              Download all
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Printer Driver Properties Dialog (Item 3, 4 & 5) */}
      <PrinterPropertiesDialog
        open={propertiesDialogOpen}
        onOpenChange={setPropertiesDialogOpen}
        printers={availablePrinters}
        selectedPrinter={
          availablePrinters.find((p) => p.id === (targetPropertyDocId === 'all' ? driverSettings.printerId : getEffectiveSettingsForDoc(targetPropertyDocId).printerId)) ||
          matchedShopPrinter
        }
        currentSettings={getEffectiveSettingsForDoc(targetPropertyDocId === 'all' ? undefined : targetPropertyDocId)}
        documentScopeLabel={
          targetPropertyDocId === 'all'
            ? `All Above (${documents.length} Docs)`
            : documents.find((d) => d.id === targetPropertyDocId)?.file_name || 'Selected Document'
        }
        onApplySettings={(newProps) => {
          if (newProps.printerId) {
            const chosenPrinter = availablePrinters.find((p) => p.id === newProps.printerId);
            if (chosenPrinter) {
              setMatchedShopPrinter(chosenPrinter);
            }
          }
          if (targetPropertyDocId === 'all') {
            setDriverSettings(newProps);
            const updatedMap: Record<string, Partial<PrinterDriverSettings>> = { all: newProps };
            documents.forEach((d) => {
              updatedMap[d.id] = newProps;
            });
            setDocDriverSettings(updatedMap);
          } else {
            setDocDriverSettings((prev) => ({
              ...prev,
              [targetPropertyDocId]: newProps,
            }));
          }
          toast.success(
            `Properties applied (${targetPropertyDocId === 'all' ? 'All Documents' : 'Selected Document'}): ${newProps.paperSize || 'Current Paper'}, ${newProps.orientation || 'Original Orientation'}, Scaling: ${newProps.scaling || 'fit'}.`
          );
        }}
      />
    </div>
  );
}
