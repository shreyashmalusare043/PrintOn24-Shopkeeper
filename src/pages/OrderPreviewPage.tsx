import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useShopkeeper } from '@/contexts/ShopkeeperContext';
import { shopkeeperApi } from '@/services/shopkeeperApi';
import { getUnprintedSubRanges, computeDocumentPageStatuses } from '@/utils/printRangeUtils';
import {
  loadDocument,
  renderPdfPage,
  renderThumbnail,
  renderDocumentToPrintDataUrl,
  type PdfDocumentWrapper,
} from '@/services/pdfViewerService';
import { localPrintAgent } from '@/services/localPrintAgent';
import { isPhysicalPrinter, isAllowedVirtualPrinter } from '@/services/qzTrayService';
import type { PrintOrder, ShopPrinter } from '@/types/shopkeeper';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  RotateCw,
  Download,
  Printer,
  Menu,
  X,
  FileText,
  Sparkles,
  Layers,
  Copy,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  SlidersHorizontal,
} from 'lucide-react';
import { toast } from 'sonner';
import { QzPermissionModal } from '@/components/QzPermissionModal';
import { PartialPrintSummaryModal } from '@/components/PartialPrintSummaryModal';
import { ManualDuplexModal } from '@/components/ManualDuplexModal';
import { PrinterPropertiesDialog, type PrinterDriverSettings } from '@/components/modals/PrinterPropertiesDialog';
import type { PrintedSegment } from '@/types/shopkeeper';

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

export default function OrderPreviewPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { user } = useShopkeeper();

  // Core Data States
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [order, setOrder] = useState<PrintOrder | null>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [docWrappers, setDocWrappers] = useState<{ [docId: string]: PdfDocumentWrapper }>({});

  // View States
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  const [zoomScale, setZoomScale] = useState<number>(1.0);
  const [rotation, setRotation] = useState<number>(0);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [sidebarTab, setSidebarTab] = useState<'thumbnails' | 'details'>('thumbnails');
  const [printing, setPrinting] = useState<boolean>(false);
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
        (targetDoc?.print_config?.printType ||
         targetDoc?.print_config?.color_mode ||
         (targetDoc as any)?.print_type ||
         order?.config_print_type ||
         '')
          .toLowerCase()
          .includes('color')
          ? 'Color'
          : 'B&W';

      // Automatically detect and select orientation submitted/detected for this individual document
      const docSubmittedOrientationRaw = (
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

      const effectiveDuplex =
        specific?.duplex ||
        targetDoc?.print_config?.sides ||
        order?.config_sides ||
        'Single Side';

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
  const renderedCacheRef = useRef<Record<string, string>>({});
  const renderedThumbnailsRef = useRef<Record<string, string>>({});
  const inFlightRendersRef = useRef<Record<string, boolean>>({});

  // 1. Fetch Order and all linked documents in database sequence
  const loadOrderData = useCallback(async () => {
    if (!orderId || !user?.shop_id) {
      setErrorMsg('Missing order ID or shopkeeper session.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setErrorMsg(null);

      const result = await shopkeeperApi.getOrderForPreview(orderId, user.shop_id);

      if (!result) {
        setErrorMsg('Access Denied: Order not found or not assigned to your printing shop.');
        setLoading(false);
        return;
      }

      setOrder(result.order);
      setDocuments(result.documents);

      try {
        const configuredPrinters: ShopPrinter[] = await shopkeeperApi.getShopPrinters(user.shop_id);
        setAvailablePrinters(configuredPrinters);
        if (configuredPrinters.length > 0) {
          setMatchedShopPrinter(configuredPrinters[0]);
        }
      } catch (prnErr) {
        console.warn('Printer fetch warning:', prnErr);
      }

      const orderConfigOrientation = (result.order as any).config_orientation;
      const isLand = (orderConfigOrientation || '').toLowerCase() === 'landscape';
      setDriverSettings({
        paperSize: result.order.config_page_size || 'A4',
        orientation: isLand ? 'Landscape' : (orderConfigOrientation ? 'Portrait' : undefined),
        copies: result.order.config_copies || 1,
        colorMode: result.order.config_print_type?.toLowerCase().includes('color') ? 'Color' : 'B&W',
        duplex: result.order.config_sides?.toLowerCase().includes('back') ? 'Back-to-Back' : 'Single Side',
        mediaType: result.order.config_paper_type || 'Standard 75 GSM',
        scaling: 'fit',
      });

      // 1. Instantly load the first visible document wrapper so preview renders immediately
      const loadedMap: { [docId: string]: PdfDocumentWrapper } = {};
      const firstDoc = result.documents[0];
      if (firstDoc?.file_url) {
        try {
          const firstWrapper = await loadDocument(firstDoc.file_url);
          loadedMap[firstDoc.id] = firstWrapper;
          setDocWrappers({ ...loadedMap });
          setLoading(false); // Instantly ready to view first page!
        } catch (err) {
          console.warn(`Failed to parse wrapper for first doc ${firstDoc.file_name}:`, err);
        }
      } else {
        setLoading(false);
      }

      // 2. Background lazy load remaining document wrappers without blocking main thread
      if (result.documents.length > 1) {
        Promise.all(
          result.documents.slice(1).map(async (doc) => {
            if (doc.file_url) {
              try {
                const wrapper = await loadDocument(doc.file_url);
                return { id: doc.id, wrapper };
              } catch (err) {
                console.warn(`Failed to parse wrapper for doc ${doc.file_name}:`, err);
              }
            }
            return null;
          })
        ).then((res) => {
          let updated = false;
          res.forEach((r) => {
            if (r) {
              loadedMap[r.id] = r.wrapper;
              updated = true;
            }
          });
          if (updated) {
            setDocWrappers({ ...loadedMap });
          }
        });
      }
    } catch (err: any) {
      console.error('Failed to load order for preview:', err);
      setErrorMsg(err.message || 'Failed to retrieve order preview data.');
    } finally {
      setLoading(false);
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
      let customRangesList: any[] = Array.isArray(cfg.customRanges) ? [...cfg.customRanges] : [];
      const rangeSpec = String(
        cfg.selectedPageRange ||
        cfg.page_range ||
        cfg.pageRange ||
        (doc as any).page_range ||
        order?.page_range ||
        (order as any)?.config_page_range ||
        ''
      ).trim();

      if (customRangesList.length === 0 && rangeSpec && rangeSpec.toLowerCase() !== 'all' && rangeSpec.toLowerCase() !== 'all pages') {
        const parts = rangeSpec.split(',').map((p) => p.trim()).filter(Boolean);
        parts.forEach((part) => {
          if (part.includes('-')) {
            const [fromS, toS] = part.split('-');
            const fromP = Math.max(1, parseInt(fromS, 10) || 1);
            const toP = Math.min(docTotal, Math.max(fromP, parseInt(toS, 10) || fromP));
            customRangesList.push({
              fromPage: fromP,
              toPage: toP,
              printType: cfg.printType || 'Black & White',
              sides: cfg.sides || 'Single Side',
              pageSize: cfg.pageSize || 'A4',
            });
          } else {
            const p = Math.max(1, Math.min(docTotal, parseInt(part, 10) || 1));
            customRangesList.push({
              fromPage: p,
              toPage: p,
              printType: cfg.printType || 'Black & White',
              sides: cfg.sides || 'Single Side',
              pageSize: cfg.pageSize || 'A4',
            });
          }
        });
      }

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
                sides: r.sides || cfg.sides || 'Single Side',
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
            sides: cfg.sides || 'Single Side',
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
          (cfg.layout || '').toLowerCase() === 'landscape';

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
    const renderItem = async (item: UnifiedPreviewPage) => {
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

      const renderSignature = `${item.key}_${zoomScale}_${rotation}_${isBw}_${effOrientation}_${effScaling}_${effPaper}`;
      const thumbSignature = `${item.key}_${isBw}`;

      const mainCanvas = mainCanvasRefs.current[item.key];
      if (mainCanvas && renderedCacheRef.current[item.key] !== renderSignature && !inFlightRendersRef.current[item.key]) {
        inFlightRendersRef.current[item.key] = true;
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
          renderedCacheRef.current[item.key] = renderSignature;
        } catch (err) {
          console.warn(`Render error on ${item.key}:`, err);
        } finally {
          inFlightRendersRef.current[item.key] = false;
        }
      }

      const thumbCanvas = thumbnailCanvasRefs.current[item.key];
      if (thumbCanvas && renderedThumbnailsRef.current[item.key] !== thumbSignature) {
        try {
          if (item.pagesPerSheet && item.pagesPerSheet !== '1-in-1') {
            await renderPdfPage(item.pdfWrapper, item.pageNum, thumbCanvas, {
              scale: 130 / (effPaper.includes('A3') ? 842 : 595),
              rotation: 0,
              isBlackAndWhite: isBw,
              targetPaper: effPaper,
              orientation: (effOrientation as 'Portrait' | 'Landscape') || undefined,
              pagesPerSheet: item.pagesPerSheet,
              pageNums: item.pageNums,
            });
          } else {
            await renderThumbnail(item.pdfWrapper, item.pageNum, thumbCanvas, 130, isBw);
          }
          renderedThumbnailsRef.current[item.key] = thumbSignature;
        } catch (err) {
          console.warn(`Thumb error on ${item.key}:`, err);
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
          await renderItem(item);
        }
      }, 30);
    }
  }, [displayedPages, currentPageIndex, zoomScale, rotation, getEffectiveSettingsForDoc, order?.config_page_size]);

  useEffect(() => {
    renderAllCanvases();
  }, [renderAllCanvases]);

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
    if (targetIndex < 0 || targetIndex >= unifiedPages.length) return;
    setCurrentPageIndex(targetIndex);
    const targetKey = unifiedPages[targetIndex]?.key;
    const canvas = mainCanvasRefs.current[targetKey];
    if (canvas) {
      canvas.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Track active page on scroll
  const handleScroll = () => {
    if (!containerRef.current || unifiedPages.length === 0) return;
    const containerTop = containerRef.current.getBoundingClientRect().top;

    for (let i = 0; i < unifiedPages.length; i++) {
      const item = unifiedPages[i];
      const canvas = mainCanvasRefs.current[item.key];
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        if (rect.top <= containerTop + 200 && rect.bottom >= containerTop + 50) {
          setCurrentPageIndex(i);
          break;
        }
      }
    }
  };

  // Download all original customer documents
  const handleDownload = () => {
    if (!documents || documents.length === 0) return;
    documents.forEach((doc, idx) => {
      if (!doc.file_url) return;
      setTimeout(() => {
        const a = document.createElement('a');
        a.href = doc.file_url;
        a.download = doc.file_name || `Document_${idx + 1}.pdf`;
        a.target = '_blank';
        a.rel = 'noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }, idx * 300);
    });
    toast.success(`Download started for ${documents.length} document(s).`);
  };

  // Physical Direct Print via QZ Tray: Follows exact database configurations for all documents & custom ranges
  const handleDirectPrint = async () => {
    if (!order || documents.length === 0) return;
    setPrinting(true);
    const toastId = toast.loading(`Spooling hardware print jobs for Order #${order.token_number || order.id}...`);

    try {
      // 1. Retrieve configured physical/allowed virtual printers
      const configuredPrinters: ShopPrinter[] = await shopkeeperApi.getShopPrinters(order.shop_id);
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
        matchedPrinter: ShopPrinter;
        layout?: string;
        pagesPerSheet?: number;
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

      for (const doc of documents) {
        const cfg = doc.print_config || {};
        const sourceDocUrl = doc.file_url || order.file_url || '';

        const docTotal = Number(doc.total_pages) || Number(order.total_pages) || 1;
        let customRangesList: any[] = Array.isArray(cfg.customRanges) ? [...cfg.customRanges] : [];
        const rangeSpec = String(
          cfg.selectedPageRange ||
          cfg.page_range ||
          cfg.pageRange ||
          (doc as any).page_range ||
          order?.page_range ||
          (order as any)?.config_page_range ||
          ''
        ).trim();

        if (customRangesList.length === 0 && rangeSpec && rangeSpec.toLowerCase() !== 'all' && rangeSpec.toLowerCase() !== 'all pages') {
          const parts = rangeSpec.split(',').map((p) => p.trim()).filter(Boolean);
          parts.forEach((part) => {
            if (part.includes('-')) {
              const [fromS, toS] = part.split('-');
              const fromP = Math.max(1, parseInt(fromS, 10) || 1);
              const toP = Math.min(docTotal, Math.max(fromP, parseInt(toS, 10) || fromP));
              customRangesList.push({
                fromPage: fromP,
                toPage: toP,
                printType: cfg.printType || 'Black & White',
                sides: cfg.sides || 'Single Side',
                pageSize: cfg.pageSize || 'A4',
              });
            } else {
              const p = Math.max(1, Math.min(docTotal, parseInt(part, 10) || 1));
              customRangesList.push({
                fromPage: p,
                toPage: p,
                printType: cfg.printType || 'Black & White',
                sides: cfg.sides || 'Single Side',
                pageSize: cfg.pageSize || 'A4',
              });
            }
          });
        }

        const isCustomMode = (cfg.pageRangeType === 'Custom Range' || customRangesList.length > 0) && customRangesList.length > 0;

        if (isCustomMode) {
          for (const r of customRangesList) {
            const rFrom = Number(r.fromPage ?? r.from ?? 1);
            const rTo = Number(r.toPage ?? r.to ?? rFrom);
            
            // Extract ONLY unprinted sub-ranges within this range — zero reprint guarantee
            const unprintedSubRanges = getUnprintedSubRanges(
              rFrom,
              rTo,
              (p) => isPageCoveredByPrinted(doc.id, doc.file_name, p, alreadyPrinted)
            );

            if (unprintedSubRanges.length === 0) {
              continue; // All pages in this custom range already printed - NEVER reprint
            }

            for (const subR of unprintedSubRanges) {
              const rangeConfig = {
                pageSize: r.pageSize || cfg.pageSize || 'A4',
                printType: r.printType,
                color_mode: r.printType,
                sides: r.sides || 'Single Side',
                copies: Number(cfg.copies) || 1,
              };

              const matchResult = shopkeeperApi.findCompatiblePrinterForOrder(order, onlinePrinters, rangeConfig);
              const isColor = (r.printType || '').toLowerCase().includes('color');
              const isDuplex = (r.sides || '').toLowerCase().includes('back') || (r.sides || '').toLowerCase().includes('double');
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
                  duplex: isDuplex ? 'Back-to-Back' : 'Single Side',
                  pageSize: rangeConfig.pageSize,
                  paperType: cfg.paperType || 'Standard 75 GSM',
                  copies: Number(cfg.copies) || 1,
                  pageCount: Math.max(1, subR.toPage - subR.fromPage + 1),
                  matchedPrinter: matchResult.compatiblePrinter,
                  layout: cfg.layout || docWrappers[doc.id]?.detectedOrientation || 'Portrait',
                  pagesPerSheet: cfg.pagesPerSheet || cfg.pages_per_sheet || '1-in-1',
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
            (p) => isPageCoveredByPrinted(doc.id, doc.file_name, p, alreadyPrinted)
          );

          if (unprintedSubRanges.length === 0) {
            continue; // All pages already printed - zero reprint guarantee
          }

          const matchResult = shopkeeperApi.findCompatiblePrinterForOrder(order, onlinePrinters, cfg);
          const isColor = (cfg.printType || '').toLowerCase().includes('color');
          const isDuplex = (cfg.sides || '').toLowerCase().includes('back') || (cfg.sides || '').toLowerCase().includes('double');

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
                duplex: isDuplex ? 'Back-to-Back' : 'Single Side',
                pageSize: cfg.pageSize || 'A4',
                paperType: cfg.paperType || 'Standard 75 GSM',
                copies: Number(cfg.copies) || 1,
                pageCount: Math.max(1, subR.toPage - subR.fromPage + 1),
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
        const reasons = pendingSegments.map((p) => `${p.docName}: ${p.reason}`).join('; ');
        toast.error('No compatible printer found for remaining segments', {
          id: toastId,
          description: reasons || 'Please connect an appropriate printer or check paper size & color mode.',
        });
        setPrinting(false);
        return;
      }

      // 3. Dispatch jobs in sequence to physical printers via QZ Tray
      await shopkeeperApi.updateOrderStatus(order.id, 'Printing');

      const newlyPrinted: PrintedSegment[] = [];

      for (let i = 0; i < jobPlans.length; i++) {
        const plan = jobPlans[i];

        // Item 5: Manual Duplex confirmation if printer requires manual reinsertion
        const printerDriver = plan.matchedPrinter.driver_name?.toLowerCase() || '';
        const isManualDuplex = plan.duplex === 'Back-to-Back' && (printerDriver.includes('manual') || (plan.matchedPrinter as any).manual_duplex === true);

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

        const docSettings = getEffectiveSettingsForDoc(plan.docId);
        const docWrapper = docWrappers[plan.docId];
        const detectedDocOrientation = docWrapper?.detectedOrientation;
        const targetColorMode = docSettings.colorMode ? (docSettings.colorMode as any) : plan.colorMode;
        const targetOrientation: 'Portrait' | 'Landscape' =
          docSettings.orientation ||
          detectedDocOrientation ||
          (plan.layout === 'Landscape' ? 'Landscape' : 'Portrait');
        const targetScaling = docSettings.scaling || 'fit';
        const targetPaperSize = docSettings.paperSize || plan.pageSize;
        const targetMediaType = docSettings.mediaType || plan.paperType;
        const targetCopies = docSettings.copies || plan.copies;
        const targetDuplex = docSettings.duplex ? (docSettings.duplex === 'Back-to-Back' ? 'Back-to-Back' : 'Single Side') : plan.duplex;

        // Pre-render 300 DPI high-resolution sheets for 100% preview matching
        // (Horizontally centered, proportional Fit to Page, equal 2.5 mm margins, no driver double-rotation or bottom drift)
        let generatedPageImages: string[] | undefined = undefined;

        if (docWrapper) {
          const isImageFile = docWrapper.isImage || /\.(jpe?g|png|webp|bmp|gif)($|\?)/i.test(plan.docUrl);
          const totalDocPages = docWrapper.numPages || 1;

          // Helper to resolve sub-range page numbers
          const resolvePageNumbers = (rangeStr?: string, maxPages = 1): number[] => {
            if (!rangeStr || rangeStr.toLowerCase() === 'all pages' || rangeStr.toLowerCase() === 'all') {
              return Array.from({ length: maxPages }, (_, i) => i + 1);
            }
            const clean = rangeStr.trim();
            if (clean.includes('-')) {
              const [startStr, endStr] = clean.split('-');
              const s = Math.max(1, parseInt(startStr?.trim() || '1', 10));
              const e = Math.min(maxPages, parseInt(endStr?.trim() || String(maxPages), 10));
              if (s <= e) {
                const resList: number[] = [];
                for (let i = s; i <= e; i++) resList.push(i);
                return resList;
              }
            }
            const single = parseInt(clean, 10);
            if (!isNaN(single) && single >= 1 && single <= maxPages) {
              return [single];
            }
            return [1];
          };

          const targetPageNums = isImageFile ? [1] : resolvePageNumbers(plan.pageRange, totalDocPages);

          // For images or documents up to 20 pages, pre-render 300 DPI print-ready sheets
          if (isImageFile || targetPageNums.length <= 20) {
            try {
              const renderedSheets: string[] = [];
              const rawDocPps = String(plan.pagesPerSheet || (docSettings as any)?.pagesPerSheet || '1-in-1').toLowerCase();
              const docPps: '1-in-1' | '2-in-1' | '4-in-1' =
                rawDocPps.includes('4') ? '4-in-1' : rawDocPps.includes('2') ? '2-in-1' : '1-in-1';
              const nUpCount = docPps === '4-in-1' ? 4 : docPps === '2-in-1' ? 2 : 1;

              const chunks: number[][] = [];
              for (let cIdx = 0; cIdx < targetPageNums.length; cIdx += nUpCount) {
                chunks.push(targetPageNums.slice(cIdx, cIdx + nUpCount));
              }

              for (const chunk of chunks) {
                const sheetDataUrl = await renderDocumentToPrintDataUrl(docWrapper, chunk[0], {
                  targetPaper: targetPaperSize,
                  orientation: targetOrientation,
                  scaling: targetScaling as any,
                  isBlackAndWhite: targetColorMode === 'B&W',
                  equalMargins: true,
                  fitToPaper: targetScaling !== 'actual',
                  pagesPerSheet: docPps,
                  pageNums: chunk,
                }, docSettings.dpi || 300);
                renderedSheets.push(sheetDataUrl);
              }
              if (renderedSheets.length > 0) {
                generatedPageImages = renderedSheets;
              }
            } catch (renderErr) {
              console.warn('Pre-rendering print sheets failed, falling back to direct URL dispatch:', renderErr);
            }
          }
        }

        const res = await localPrintAgent.dispatchPrintJob({
          orderId: order.id,
          shopId: order.shop_id,
          pcId: plan.matchedPrinter.pc_id || order.target_pc_id || 'pc_01',
          printerId: plan.matchedPrinter.id,
          printerName: plan.matchedPrinter.name,
          fileName: plan.docName,
          fileUrl: plan.docUrl,
          pageImages: generatedPageImages,
          copies: targetCopies,
          colorMode: targetColorMode,
          duplex: targetDuplex,
          paperSize: targetPaperSize,
          paperType: targetMediaType,
          pageCount: plan.pageCount,
          pageRange: plan.pageRange,
          totalPrice: Number(order.grand_total) || 0,
          orientation: targetOrientation,
          mediaSource: docSettings.mediaSource,
          tray: docSettings.mediaSource,
          mediaType: targetMediaType,
          scaling: targetScaling,
          dpi: docSettings.dpi || 300,
          driverProperties: {
            ...docSettings,
            density: docSettings.dpi || 300,
            dpi: docSettings.dpi || 300,
          },
        });

        if (!res.success) {
          pendingSegments.push({
            docName: plan.docName,
            pageRange: plan.pageRange,
            reason: res.message || 'Printer physical dispatch error',
            pagesCount: plan.pageCount,
          });
        } else {
          newlyPrinted.push({
            id: `seg-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            doc_id: plan.docId,
            doc_name: plan.docName,
            page_range: plan.pageRange || 'All Pages',
            pages_count: plan.pageCount || 1,
            printer_name: plan.matchedPrinter.name,
            printed_at: new Date().toISOString(),
            status: 'printed',
            color_mode: plan.colorMode,
            duplex: plan.duplex,
            copies: plan.copies,
          });
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

  const activePageItem = unifiedPages[currentPageIndex];

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-[#1e1e1e] text-neutral-200 overflow-hidden select-none font-sans">
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
            onClick={handleDownload}
            className="h-8 w-8 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded"
            title="Download Customer Source Document(s)"
          >
            <Download className="w-4 h-4" />
          </Button>

          {/* Go For Print Button */}
          <Button
            size="sm"
            disabled={printing || unifiedPages.length === 0}
            onClick={handleDirectPrint}
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
                <span>Pages ({unifiedPages.length})</span>
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
                {unifiedPages.map((item, index) => {
                  const isActive = index === currentPageIndex;
                  return (
                    <div
                      key={item.key}
                      onClick={() => scrollToPage(index)}
                      className={`cursor-pointer group flex flex-col items-center transition-all ${
                        isActive ? 'scale-105' : 'hover:opacity-90'
                      }`}
                    >
                      {item.isFirstPageOfDoc && (
                        <div className="w-full text-[10px] font-mono text-primary font-bold mb-1.5 truncate border-b border-neutral-800 pb-0.5">
                          Doc #{item.docIndex + 1}: {item.docFileName}
                        </div>
                      )}
                      <div
                        className={`bg-white rounded overflow-hidden shadow-md transition-all p-0.5 ${
                          isActive
                            ? 'ring-2 ring-primary ring-offset-2 ring-offset-[#202124]'
                            : 'border border-neutral-700/60 group-hover:border-neutral-500'
                        }`}
                      >
                        <canvas
                          ref={(el) => {
                            thumbnailCanvasRefs.current[item.key] = el;
                          }}
                          className="block max-w-full h-auto bg-white"
                          style={{
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
                  const isCustom = cfg.pageRangeType === 'Custom Range' && cfg.customRanges?.length > 0;
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
                              Custom Ranges ({cfg.customRanges.length})
                            </span>
                            <span className="text-[9px] text-neutral-400 font-mono">
                              Global Cards Disabled
                            </span>
                          </div>
                          {cfg.customRanges.map((rng: any, rIdx: number) => (
                            <div
                              key={rIdx}
                              className="p-1.5 bg-neutral-800/80 rounded border border-neutral-700/50 text-[10px] flex items-center justify-between"
                            >
                              <span className="font-mono text-white font-bold">
                                Pages {rng.fromPage}–{rng.toPage}:
                              </span>
                              <span className="text-neutral-300">
                                {rng.printType || 'B&W'} • {rng.sides || 'Single Side'}
                              </span>
                            </div>
                          ))}
                          <p className="text-[9px] text-neutral-400 italic">
                            Print Type &amp; Sides cards disabled — custom per-range parameters active.
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
                        <span>Copies: <strong className="text-primary">{cfg.copies || 1}</strong></span>
                        <span>Total Pages: <strong className="text-neutral-200">{doc.total_pages || 1}</strong></span>
                      </div>

                      <div className="pt-1 text-[9px] font-mono text-neutral-400 text-center">
                        {isSelected ? '✓ Showing this document preview' : 'Click to isolate preview'}
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
            displayedPages.map((item) => (
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
                  filter: item.isBw ? 'grayscale(100%) contrast(105%)' : 'none',
                }}
              >
                <canvas
                  ref={(el) => {
                    mainCanvasRefs.current[item.key] = el;
                  }}
                  className="block bg-white max-w-full h-auto object-contain"
                />
              </div>
              {/* Page Number & Document Footer Under Sheet */}
              <div className="mt-2 text-center text-xs font-mono text-neutral-400">
                Doc #{item.docIndex + 1} • Page {item.pageNum} of {item.docTotalPages} ({item.docFileName})
              </div>
            </div>
          )))}
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
                onClick={handleDirectPrint}
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
          // Reset render caches to force re-render with new printer driver properties
          renderedCacheRef.current = {};
          renderedThumbnailsRef.current = {};
          toast.success(
            `Properties applied (${targetPropertyDocId === 'all' ? 'All Documents' : 'Selected Document'}): ${newProps.paperSize || 'Current Paper'}, ${newProps.orientation || 'Original Orientation'}, Scaling: ${newProps.scaling || 'fit'}.`
          );
          // Trigger canvas re-rendering
          renderAllCanvases();
        }}
      />
    </div>
  );
}
