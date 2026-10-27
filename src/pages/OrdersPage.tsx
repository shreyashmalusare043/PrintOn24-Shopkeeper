import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShopkeeper } from '@/contexts/ShopkeeperContext';
import { localPrintAgent } from '@/services/localPrintAgent';
import { loadDocument, parsePageRange, renderDocumentToPrintDataUrl } from '@/services/pdfViewerService';
import { shopkeeperApi } from '@/services/shopkeeperApi';
import { supabase } from '@/services/supabase';
import type { DynamicPaperType, OrderStatus, PrintOrder, ShopPricing, ShopPrinter } from '@/types/shopkeeper';

const isPhysicalPrinter = (name: string): boolean => {
  const lower = name.toLowerCase();
  const virtualKeywords = [
    'pdf',
    'xps',
    'onenote',
    'fax',
    'anydesk',
    'virtual',
    'document writer',
    'print to',
    'send to',
    'root print queue',
  ];
  return !virtualKeywords.some((v) => lower.includes(v));
};

const isAllowedVirtualPrinter = (name: string): boolean => {
  const lower = (name || '').toLowerCase();
  return lower.includes('microsoft print to pdf') || lower.includes('normal pdf printer');
};

const normalizePagesPerSheet = (value: unknown): '1-in-1' | '2-in-1' | '4-in-1' => {
  const normalized = String(value || '').toLowerCase();
  return normalized.includes('4') ? '4-in-1' : normalized.includes('2') ? '2-in-1' : '1-in-1';
};

import {
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Crown,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Filter,
  History,
  MoreVertical,
  Pencil,
  Pin,
  Printer,
  RotateCcw,
  RotateCw,
  Search,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { ManualDuplexModal } from '@/components/ManualDuplexModal';
import { PartialPrintSummaryModal } from '@/components/PartialPrintSummaryModal';
import {
  type PrintDocumentOption,
  PrintDocumentSelectionDialog,
} from '@/components/PrintDocumentSelectionDialog';
import { PrintProgressControls } from '@/components/PrintProgressControls';
import { QzPermissionModal } from '@/components/QzPermissionModal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { usePrintQueueControl } from '@/hooks/usePrintQueueControl';
import type { PrintedSegment } from '@/types/shopkeeper';
import { computeDocumentPageStatuses, getUnprintedSubRanges } from '@/utils/printRangeUtils';
import { isDuplexPrint, normalizePrintSides } from '@/utils/printSides';

type OrderPreviewData = NonNullable<Awaited<ReturnType<typeof shopkeeperApi.getOrderForPreview>>>;

export const OrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, selectedPcId, setSelectedPcId, pcs, t, realPrinters } = useShopkeeper();

  const [orders, setOrders] = useState<PrintOrder[]>([]);
  const [recentHistoryOrders, setRecentHistoryOrders] = useState<PrintOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Completed' | 'Cancelled'>('Active');
  const [vipFilterActive, setVipFilterActive] = useState(false);
  const [isVipEnabled, setIsVipEnabled] = useState(false);
  const [printingOrderId, setPrintingOrderId] = useState<string | null>(null);
  const printQueue = usePrintQueueControl();
  const [printSelection, setPrintSelection] = useState<{
    order: PrintOrder;
    previewData: OrderPreviewData;
    documents: PrintDocumentOption[];
    printers: ShopPrinter[];
  } | null>(null);
  const [selectedPrintDocumentIds, setSelectedPrintDocumentIds] = useState<Set<string>>(new Set());

  // Shop-specific VIP User IDs mapping
  const [activeShopVipUserIds, setActiveShopVipUserIds] = useState<Set<string>>(new Set());

  // Date and Print Type Filter states
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'yesterday' | 'last7days' | 'last1month' | 'custom'>('all');
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');
  const [printTypeFilter, setPrintTypeFilter] = useState<'all' | 'Color' | 'Black & White' | 'Single Side' | 'Back-to-Back'>('all');

  // Recent History Toggle state
  const [showAllHistory, setShowAllHistory] = useState(false);

  // Modals state
  const [selectedOrder, setSelectedOrder] = useState<PrintOrder | null>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<PrintOrder | null>(null);
  const [orderDocsList, setOrderDocsList] = useState<any[]>([]);
  const [selectedEditDocId, setSelectedEditDocId] = useState<string>('all');

  // Specialized Paper Colors mapping (Item 15)
  const [specializedPaperColors, setSpecializedPaperColors] = useState<Record<string, string>>({});

  // Partial Print Summary Modal state (Item 3)
  const [partialSummaryOpen, setPartialSummaryOpen] = useState(false);
  const [summaryPrintedSegments, setSummaryPrintedSegments] = useState<PrintedSegment[]>([]);
  const [summaryPendingSegments, setSummaryPendingSegments] = useState<Array<{
    docName: string;
    pageRange?: string;
    reason: string;
    pagesCount: number;
  }>>([]);
  const [summaryActiveOrder, setSummaryActiveOrder] = useState<PrintOrder | null>(null);

  // Manual Duplex Modal state (Item 5)
  const [manualDuplexOpen, setManualDuplexOpen] = useState(false);
  const [manualDuplexPrinter, setManualDuplexPrinter] = useState('');
  const [manualDuplexDocName, setManualDuplexDocName] = useState('');
  const [manualDuplexResolver, setManualDuplexResolver] = useState<((val: boolean) => void) | null>(null);

  // Edit config form state
  const [editCopies, setEditCopies] = useState<number>(1);
  const [editPrintType, setEditPrintType] = useState<string>('B&W');
  const [editSides, setEditSides] = useState<string>('Single Side');
  const [editPageSize, setEditPageSize] = useState<string>('A4');
  const [editPaperType, setEditPaperType] = useState<string>('Standard 75 GSM');
  const [editOrientation, setEditOrientation] = useState<'Portrait' | 'Landscape'>('Portrait');
  const [editPagesPerSheet, setEditPagesPerSheet] = useState<'1-in-1' | '2-in-1' | '4-in-1'>('1-in-1');
  const [savingEdit, setSavingEdit] = useState(false);
  const [clearAllPrintsOpen, setClearAllPrintsOpen] = useState(false);
  const [clearingAllPrints, setClearingAllPrints] = useState(false);
  const [dynamicPaperTypes, setDynamicPaperTypes] = useState<DynamicPaperType[]>([]);
  const [pinnedOrderIds, setPinnedOrderIds] = useState<string[]>([]);

  // Fetch shop settings & pricing and active VIP member IDs for this specific shop
  const fetchSettings = async () => {
    if (!user?.shop_id) return;
    try {
      const [pricing, vipIds, paperColors, paperTypes, pinnedIds] = await Promise.all([
        shopkeeperApi.getShopPricing(user.shop_id),
        shopkeeperApi.getShopActiveVipUserIds(user.shop_id),
        shopkeeperApi.getSpecializedPaperColors(user.shop_id),
        shopkeeperApi.getDynamicPaperTypes(user.shop_id),
        shopkeeperApi.getPinnedOrderIds(user.shop_id),
      ]);

      if (pricing) {
        setIsVipEnabled(!!pricing.membership_enabled);
      }
      setActiveShopVipUserIds(vipIds);
      if (paperColors) {
        setSpecializedPaperColors(paperColors);
      }
      if (paperTypes && paperTypes.length > 0) {
        setDynamicPaperTypes(paperTypes);
      }
      if (pinnedIds && Array.isArray(pinnedIds)) {
        setPinnedOrderIds(pinnedIds);
      }

      // Enforce 8-hour file retention policy cleanup
      shopkeeperApi.purgeExpiredRetentionFiles(user.shop_id);
    } catch (e) {
      console.warn('Error loading VIP settings:', e);
    }
  };

  const handleTogglePin = async (orderId: string) => {
    if (!user?.shop_id) return;
    const isPinned = pinnedOrderIds.includes(orderId);
    const nextPinned = isPinned
      ? pinnedOrderIds.filter((id) => id !== orderId)
      : [orderId, ...pinnedOrderIds];

    setPinnedOrderIds(nextPinned);
    await shopkeeperApi.savePinnedOrderIds(user.shop_id, nextPinned);
    toast.success(isPinned ? 'Order unpinned' : 'Order pinned to top of queue');
  };

  const fetchOrders = async () => {
    if (!user?.shop_id) return;
    setLoading(true);
    try {
      const data = await shopkeeperApi.getLiveOrders(user.shop_id, selectedPcId);
      setOrders(data);
    } catch {
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentHistoryOrders = async () => {
    if (!user?.shop_id) return;
    try {
      const data = await shopkeeperApi.getRecentHistoryOrders(user.shop_id);
      setRecentHistoryOrders(data);
    } catch (err) {
      console.error('Failed to load recent order history:', err);
      toast.error('Failed to load recent order history');
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchOrders();
    fetchRecentHistoryOrders();

    if (!user?.shop_id) return;
    const sub = shopkeeperApi.subscribeToOrders(user.shop_id, () => {
      fetchOrders();
      fetchRecentHistoryOrders();
    });

    return () => {
      if (sub && typeof sub.unsubscribe === 'function') {
        sub.unsubscribe();
      }
    };
  }, [user?.shop_id, selectedPcId]);

  // Strict Shop-Specific VIP order check (Must belong to current shop and have valid membership)
  const isVipOrder = (ord: PrintOrder): boolean => {
    if (ord.shop_id && ord.shop_id !== user?.shop_id) return false;
    const isDirectShopVip =
      (ord.user_id && activeShopVipUserIds.has(ord.user_id)) ||
      (ord.user_phone && activeShopVipUserIds.has(ord.user_phone));
    const isVipUser = ord.user_membership === 'VIP' || (ord as any).is_vip === true;
    return Boolean(isDirectShopVip || (ord.shop_id === user?.shop_id && isVipUser));
  };

  // Real-time count of pending VIP print jobs
  const vipOrdersCount = useMemo(() => {
    return orders.filter(
      (ord) => isVipOrder(ord) && ord.order_status !== 'Completed' && ord.order_status !== 'Cancelled'
    ).length;
  }, [orders]);

  // Direct 1-Click Print Execution (Exact Physical Printer Routing, Capability Validation & Document Flow)
  const handleDirectPrint = async (
    ord: PrintOrder,
    selectedDocumentIds?: Set<string>,
    preparedPreviewData?: OrderPreviewData,
    preparedPrinters?: ShopPrinter[]
  ) => {
    let previewDataForPrint: OrderPreviewData | undefined = preparedPreviewData;
    let printersForPrint = preparedPrinters;
    if (!previewDataForPrint) {
      setPrintingOrderId(ord.id);
      try {
        const [loadedPreviewData, loadedPrinters] = await Promise.all([
          shopkeeperApi.getOrderForPreview(ord.id, ord.shop_id),
          realPrinters.length > 0 ? Promise.resolve(realPrinters) : shopkeeperApi.getShopPrinters(ord.shop_id),
        ]);
        previewDataForPrint = loadedPreviewData || undefined;
        printersForPrint = loadedPrinters;
        const availableDocuments = loadedPreviewData?.documents || [];
        if (loadedPreviewData && availableDocuments.length > 1) {
          const options = availableDocuments.map((doc) => ({
            id: doc.id,
            name: doc.file_name || 'Untitled document',
            totalPages: Math.max(1, Number(doc.total_pages) || 1),
          }));
          setPrintSelection({
            order: ord,
            previewData: loadedPreviewData,
            documents: options,
            printers: loadedPrinters,
          });
          setSelectedPrintDocumentIds(new Set(options.map((document) => document.id)));
          setPrintingOrderId(null);
          return;
        }
      } catch (err: any) {
        console.error('Unable to load documents for print selection:', err);
        toast.error(err?.message || 'Unable to load order documents for printing.');
        setPrintingOrderId(null);
        return;
      }
    }

    setPrintingOrderId(ord.id);
    printQueue.begin(`#${ord.token_number}`, Math.max(1, Number(ord.total_pages) || 1));
    const toastId = toast.loading(`Validating Order #${ord.token_number} for physical printer...`);

    try {
      printQueue.setMessage('Finding a compatible printer and loading documents...');
      const [, configuredPrinters, previewData] = await Promise.all([
        shopkeeperApi.updateOrderStatus(ord.id, 'Validating'),
        printersForPrint
          ? Promise.resolve(printersForPrint)
          : realPrinters.length > 0
            ? Promise.resolve(realPrinters)
            : shopkeeperApi.getShopPrinters(ord.shop_id),
        Promise.resolve(previewDataForPrint),
      ]);
      
      const eligibleConfigured = configuredPrinters.filter(
        (p) => p.is_online !== false && (isPhysicalPrinter(p.name) || isAllowedVirtualPrinter(p.name))
      );

      if (eligibleConfigured.length === 0) {
        await shopkeeperApi.updateOrderStatus(ord.id, 'Printer Offline');
        throw new Error(
          'No online printer configured for this shop. Please connect and configure your printer in Printer Configuration.'
        );
      }

      // Step 4: Resolve ALL documents belonging to this Order ID (supporting multi-document orders)
      const docsToPrint = previewData?.documents && previewData.documents.length > 0
        ? previewData.documents
        : [
            {
              id: ord.id,
              order_id: ord.id,
              file_name: ord.document_name,
              file_url: ord.file_url,
              total_pages: ord.total_pages || 1,
              print_config: {
                pageRangeType: 'All Pages',
                pageSize: ord.config_page_size,
                printType: ord.config_print_type,
                sides: ord.config_sides,
                copies: ord.config_copies,
                paperType: ord.config_paper_type,
                layout: ord.config_layout || 'Portrait',
                pagesPerSheet:
                  ord.documents_config?.[0]?.pagesPerSheet ||
                  ord.documents_config?.[0]?.pages_per_sheet ||
                  '1-in-1',
              },
            },
          ];
      const selectedIds = selectedDocumentIds || new Set(docsToPrint.map((doc: any) => doc.id));
      const docsSelectedForPrint = docsToPrint.filter((doc: any) => selectedIds.has(doc.id));
      if (docsSelectedForPrint.length === 0) {
          throw new Error('Select at least one document to print.');
      }

      const docsNeedingUrl = docsToPrint.filter(
        (doc: any) => !doc.file_url || doc.file_url.startsWith('blob:')
      );
      const sourceUrlByDocId = new Map<string, string>();
      if (docsNeedingUrl.length > 0) {
        const { data: sourceRecords, error: sourceRecordsError } = await supabase
          .from('uploaded_documents')
          .select('id, preview_url, storage_path, storage_bucket')
          .in('id', docsNeedingUrl.map((doc: any) => doc.id));
        if (sourceRecordsError) throw sourceRecordsError;
        (sourceRecords || []).forEach((record: any) => {
          const url =
            record.preview_url && !record.preview_url.startsWith('blob:')
              ? record.preview_url
              : record.storage_path
                ? `https://qogdzcgvkwdnpkeejpef.supabase.co/storage/v1/object/public/${record.storage_bucket || 'print_documents'}/${record.storage_path}`
                : '';
          if (url) sourceUrlByDocId.set(record.id, url);
        });
      }

      // Validate all documents and custom ranges against configured printer capability matrix (Item 2 & 3)
      interface SegmentPlan {
        doc: (typeof docsToPrint)[0];
        docId: string;
        docName: string;
        sourceDocUrl: string;
        pageRange?: string;
        colorMode: 'B&W' | 'Color';
        duplex: 'Single Side' | 'Back-to-Back';
        pageSize: any;
        paperType: any;
        copies: number;
        pageCount: number;
        printer: ShopPrinter;
        layout: string;
        pagesPerSheet: '1-in-1' | '2-in-1' | '4-in-1';
      }

      const segmentPlans: SegmentPlan[] = [];
      const pendingSegments: Array<{
        docName: string;
        pageRange?: string;
        reason: string;
        pagesCount: number;
      }> = [];

      // Check already completed segments to NEVER reprint them
      const alreadyPrinted: PrintedSegment[] = Array.isArray(ord.printed_segments) ? ord.printed_segments : [];
      const printedKeys = new Set(alreadyPrinted.map((s) => `${s.doc_id || s.doc_name}_${s.page_range || 'all'}`));

      const isPageCoveredByPrinted = (docId: string, docName: string, pageNum: number) => {
        return alreadyPrinted.some((seg) => {
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

      docsToPrint
        .filter((doc: any) => !selectedIds.has(doc.id))
        .forEach((doc: any) => {
          const totalPages = Math.max(1, Number(doc.total_pages) || Number(ord.total_pages) || 1);
          const pendingPages = Array.from({ length: totalPages }, (_, index) => index + 1).filter(
            (pageNum) => !isPageCoveredByPrinted(doc.id, doc.file_name, pageNum)
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

      for (const doc of docsSelectedForPrint) {
        const cfg = doc.print_config || {};
        let sourceDocUrl =
          doc.file_url && !doc.file_url.startsWith('blob:')
            ? doc.file_url
            : sourceUrlByDocId.get(doc.id) || '';
        if (!sourceDocUrl) {
          sourceDocUrl = ord.file_url || '';
        }

        const docTotal = Number(doc.total_pages) || Number(ord.total_pages) || 1;
        let customRangesList: any[] = Array.isArray(cfg.customRanges) ? [...cfg.customRanges] : [];
        const rangeSpec = String(
          cfg.selectedPageRange ||
          cfg.page_range ||
          cfg.pageRange ||
          (doc as any).page_range ||
          ord?.page_range ||
          (ord as any)?.config_page_range ||
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
                printType: cfg.printType || 'B&W',
                sides: normalizePrintSides(cfg.sides || cfg.duplex || ord.config_sides),
                pageSize: cfg.pageSize || 'A4',
              });
            } else {
              const p = Math.max(1, Math.min(docTotal, parseInt(part, 10) || 1));
              customRangesList.push({
                fromPage: p,
                toPage: p,
                printType: cfg.printType || 'B&W',
                sides: normalizePrintSides(cfg.sides || cfg.duplex || ord.config_sides),
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

            // Extract ONLY unprinted sub-ranges within this custom range — zero reprint guarantee
            const unprintedSubRanges = getUnprintedSubRanges(
              rFrom,
              rTo,
              (p) => isPageCoveredByPrinted(doc.id, doc.file_name, p)
            );

            if (unprintedSubRanges.length === 0) {
              continue; // Skip already printed segment - zero reprint guarantee
            }

            for (const subR of unprintedSubRanges) {
              const rangeConfig = {
                pageSize: r.pageSize || cfg.pageSize || 'A4',
                printType: r.printType,
                color_mode: r.printType,
                sides: normalizePrintSides(r.sides || r.side || cfg.sides || cfg.duplex || ord.config_sides),
                copies: Number(cfg.copies) || 1,
              };

              const matchResult = shopkeeperApi.findCompatiblePrinterForOrder(ord, eligibleConfigured, rangeConfig);
              const isColor = (r.printType || '').toLowerCase().includes('color');
              const rangeSides = normalizePrintSides(r.sides || r.side || cfg.sides || cfg.duplex || ord.config_sides);
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
                segmentPlans.push({
                  doc,
                  docId: doc.id,
                  docName: `${doc.file_name} (Pages ${pageRangeStr})`,
                  sourceDocUrl: sourceDocUrl || ord.file_url || '',
                  pageRange: pageRangeStr,
                  colorMode: isColor ? 'Color' : 'B&W',
                  duplex: rangeSides,
                  pageSize: rangeConfig.pageSize,
                  paperType: cfg.paperType || 'Standard 75 GSM',
                  copies: Number(cfg.copies) || 1,
                  pageCount: Math.max(1, subR.toPage - subR.fromPage + 1),
                  printer: matchResult.compatiblePrinter,
                  layout: cfg.layout || cfg.orientation || 'Portrait',
                  pagesPerSheet: normalizePagesPerSheet(cfg.pagesPerSheet || cfg.pages_per_sheet || cfg.nUp),
                });
              }
            }
          }
        } else {
          // All pages of document
          const docTotal = Number(doc.total_pages) || Number(ord.total_pages) || 1;
          const unprintedSubRanges = getUnprintedSubRanges(
            1,
            docTotal,
            (p) => isPageCoveredByPrinted(doc.id, doc.file_name, p)
          );

          if (unprintedSubRanges.length === 0) {
            continue; // Skip already printed - zero reprint guarantee
          }

          const effectiveSides = normalizePrintSides(cfg.sides || cfg.duplex || ord.config_sides);
          const matchResult = shopkeeperApi.findCompatiblePrinterForOrder(ord, eligibleConfigured, {
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
                docName: `${doc.file_name || ord.document_name} (${label})`,
                pageRange: pageRangeStr || 'All Pages',
                reason: matchResult.reasonIfNotCompatible || `No printer satisfies ${isColor ? 'Color' : 'B&W'} ${isDuplex ? 'Duplex' : 'Single Side'}`,
                pagesCount: Math.max(1, subR.toPage - subR.fromPage + 1),
              });
            } else {
              segmentPlans.push({
                doc,
                docId: doc.id,
                docName: `${doc.file_name || ord.document_name} (${label})`,
                sourceDocUrl: sourceDocUrl || ord.file_url || '',
                pageRange: pageRangeStr,
                colorMode: isColor ? 'Color' : 'B&W',
                duplex: effectiveSides,
                pageSize: (cfg.pageSize as any) || (ord.config_page_size as any) || 'A4',
                paperType: (cfg.paperType as any) || (ord.config_paper_type as any) || 'Standard 75 GSM',
                copies: Number(cfg.copies) || Number(ord.config_copies) || 1,
                pageCount: Math.max(1, subR.toPage - subR.fromPage + 1),
                printer: matchResult.compatiblePrinter,
                layout: cfg.layout || cfg.orientation || 'Portrait',
                pagesPerSheet: normalizePagesPerSheet(cfg.pagesPerSheet || cfg.pages_per_sheet || cfg.nUp),
              });
            }
          }
        }
      }

      if (segmentPlans.length === 0) {
        await shopkeeperApi.updateOrderStatus(ord.id, 'No Compatible Printer');
        toast.error('No compatible printer found.', {
          id: toastId,
          description: 'Check printer paper, color, and duplex settings.',
        });
        setPrintingOrderId(null);
        return;
      }

      // Step 5: Transition to Ready to Print and Printing
      await shopkeeperApi.updateOrderStatus(ord.id, 'Printing');
      toast.loading(`Printing ${segmentPlans.length} compatible segment(s)...`, { id: toastId });

      const newlyPrinted: PrintedSegment[] = [];

      // Confirm manual duplex jobs first so dialog state is never shared by concurrent tasks.
      const plansToDispatch: typeof segmentPlans = [];
      for (const plan of segmentPlans) {
        // Item 5: Manual Duplex confirmation if printer requires manual reinsertion
        const printerDriver = plan.printer.driver_name?.toLowerCase() || '';
        const isManualDuplex = plan.duplex === 'Back-to-Back' && (printerDriver.includes('manual') || (plan.printer as any).manual_duplex === true);

        if (isManualDuplex) {
          const userConfirmed = await new Promise<boolean>((resolve) => {
            setManualDuplexPrinter(plan.printer.name);
            setManualDuplexDocName(plan.docName);
            setManualDuplexResolver(() => resolve);
            setManualDuplexOpen(true);
          });

          if (!userConfirmed) {
            toast.info(`Manual duplex canceled for ${plan.docName}. Segment kept pending.`);
            pendingSegments.push({
              docName: plan.docName,
              pageRange: plan.pageRange,
              reason: 'Manual duplex paper reinsertion skipped by user',
              pagesCount: plan.pageCount,
            });
            continue;
          }
        }

        plansToDispatch.push(plan);
      }

      const totalPagesToPrint = plansToDispatch.reduce((total, plan) => total + plan.pageCount, 0);
      printQueue.setTotalPages(totalPagesToPrint);
      printQueue.setMessage('Preparing the first print sheet...');
      let cancelled = false;

      for (let planIndex = 0; planIndex < plansToDispatch.length; planIndex++) {
        const plan = plansToDispatch[planIndex];
        const totalDocumentPages = Math.max(1, Number(plan.doc.total_pages) || Number(ord.total_pages) || 1);
        const pageNumbers = parsePageRange(plan.pageRange, totalDocumentPages);
        const pagesPerSheet = plan.pagesPerSheet === '4-in-1' ? 4 : plan.pagesPerSheet === '2-in-1' ? 2 : 1;
        const pagesPerJob = pagesPerSheet * (plan.duplex === 'Back-to-Back' ? 2 : 1);
        const pageChunks: number[][] = [];
        for (let pageIndex = 0; pageIndex < pageNumbers.length; pageIndex += pagesPerJob) {
          pageChunks.push(pageNumbers.slice(pageIndex, pageIndex + pagesPerJob));
        }

        const wrapper =
          plan.pagesPerSheet !== '1-in-1' ? await loadDocument(plan.sourceDocUrl) : undefined;
        let nextChunkIndex = 0;
        for (let chunkIndex = 0; chunkIndex < pageChunks.length; chunkIndex++) {
          if (!(await printQueue.waitUntilReady())) {
            cancelled = true;
            break;
          }

          const pageNums = pageChunks[chunkIndex];
          const pageRange = pageNums.join(',');
          let pageImages: string[] | undefined;
          if (wrapper && plan.pagesPerSheet !== '1-in-1') {
            pageImages = [];
            for (let pageIndex = 0; pageIndex < pageNums.length; pageIndex += pagesPerSheet) {
              const sheetPages = pageNums.slice(pageIndex, pageIndex + pagesPerSheet);
              pageImages.push(
                await renderDocumentToPrintDataUrl(
                  wrapper,
                  sheetPages[0],
                  {
                    targetPaper: plan.pageSize,
                    orientation: plan.layout.toLowerCase() === 'landscape' ? 'Landscape' : 'Portrait',
                    scaling: 'fit',
                    isBlackAndWhite: plan.colorMode === 'B&W',
                    equalMargins: true,
                    fitToPaper: true,
                    pagesPerSheet: plan.pagesPerSheet,
                    pageNums: sheetPages,
                  },
                  300
                )
              );
            }
          }

          if (!(await printQueue.waitUntilReady())) {
            cancelled = true;
            break;
          }

          printQueue.update(plan.docName, pageNums[0], `Sending page ${pageNums[0]} to ${plan.printer.name}...`);
          const res = await localPrintAgent.dispatchPrintJob({
            orderId: ord.id,
            shopId: ord.shop_id,
            pcId: plan.printer.pc_id || ord.target_pc_id || selectedPcId || '',
            printerId: plan.printer.id,
            printerName: plan.printer.name,
            fileName: plan.docName,
            fileUrl: plan.sourceDocUrl,
            pageImages,
            copies: plan.copies,
            colorMode: plan.colorMode,
            duplex: plan.duplex,
            paperSize: plan.pageSize,
            paperType: plan.paperType,
            pageCount: pageNums.length,
            pageRange: pageImages ? undefined : pageRange,
            totalPrice: Number(ord.grand_total) || 0,
            orientation: plan.layout.toLowerCase() === 'landscape' ? 'Landscape' : 'Portrait',
            scaling: 'fit',
          });

          if (!res.success) {
            pendingSegments.push({
              docName: plan.docName,
              pageRange,
              reason: res.message || 'Printer physical dispatch error',
              pagesCount: pageNums.length,
            });
          } else {
            const printedAt = new Date().toISOString();
            pageNums.forEach((pageNum) => {
              newlyPrinted.push({
                id: `seg-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
                doc_id: plan.docId,
                doc_name: plan.doc.file_name || plan.docName,
                page_range: String(pageNum),
                pages_count: 1,
                printer_name: plan.printer.name,
                printed_at: printedAt,
                status: 'printed',
                color_mode: plan.colorMode,
                duplex: plan.duplex,
                copies: plan.copies,
              });
            });
            printQueue.completePages(pageNums.length);
          }
          nextChunkIndex = chunkIndex + 1;
        }

        if (cancelled) {
          for (let remainingPlanIndex = planIndex; remainingPlanIndex < plansToDispatch.length; remainingPlanIndex++) {
            const remainingPlan = plansToDispatch[remainingPlanIndex];
            const remainingPages = parsePageRange(
              remainingPlan.pageRange,
              Math.max(1, Number(remainingPlan.doc.total_pages) || Number(ord.total_pages) || 1)
            );
            const firstRemainingChunk = remainingPlanIndex === planIndex ? nextChunkIndex : 0;
            const pagesNotSent = remainingPages.slice(firstRemainingChunk * pagesPerJob);
            if (pagesNotSent.length > 0) {
              pendingSegments.push({
                docName: remainingPlan.docName,
                pageRange: pagesNotSent.join(','),
                reason: 'Print cancelled by user',
                pagesCount: pagesNotSent.length,
              });
            }
          }
          break;
        }
      }

      const allPrinted = [...alreadyPrinted, ...newlyPrinted];

      // Compute persistent page-level statuses (Printed, Pending, Not Selected)
      const detailedPageStatuses = (docsToPrint || []).flatMap((d: any) => {
        const dTotal = Number(d.total_pages) || Number(ord.total_pages) || 1;
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

        // Save partial status in Supabase
        await shopkeeperApi.saveOrderPrintedSegments(ord.id, allPrinted, remainingPayload, 'Partially Printed');
        
        // Update local state
        setOrders((prev) =>
          prev.map((o) =>
            o.id === ord.id
              ? { ...o, order_status: 'Partially Printed', printed_segments: allPrinted, remaining_pages_info: remainingPayload }
              : o
          )
        );

        toast.dismiss(toastId);

        // Open Partial Print Summary Modal
        setSummaryActiveOrder(ord);
        setSummaryPrintedSegments(newlyPrinted);
        setSummaryPendingSegments(pendingSegments);
        setPartialSummaryOpen(true);
      } else {
        // 100% completed!
        await shopkeeperApi.saveOrderPrintedSegments(ord.id, allPrinted, [], 'Completed');
        const completedAt = new Date().toISOString();
        const completedOrder = {
          ...ord,
          order_status: 'Completed' as const,
          printed_segments: allPrinted,
          remaining_pages_info: [],
          completed_at: completedAt,
        };
        setOrders((prev) =>
          prev.map((o) =>
            o.id === ord.id
              ? completedOrder
              : o
          )
        );
        setRecentHistoryOrders((prev) => [
          completedOrder,
          ...prev.filter((order) => order.id !== ord.id),
        ]);

        toast.success(
          `Order #${ord.token_number} (${segmentPlans.length} segment${segmentPlans.length > 1 ? 's' : ''}) printed completely!`,
          { id: toastId }
        );
      }
    } catch (err: any) {
      console.error('Print execution error:', err);
      toast.error(err?.message || 'Print dispatch failed.', { id: toastId });
    } finally {
      setPrintingOrderId(null);
      printQueue.finish();
    }
  };

  const handlePrintSelection = (printAll: boolean) => {
    if (!printSelection) return;
    const documentIds = printAll
      ? new Set(printSelection.documents.map((document) => document.id))
      : new Set(selectedPrintDocumentIds);
    if (documentIds.size === 0) {
      toast.error('Select at least one document to print.');
      return;
    }
    const { order, previewData, printers } = printSelection;
    setPrintSelection(null);
    void handleDirectPrint(order, documentIds, previewData, printers);
  };

  // Open Edit Configuration Modal (supporting multi-document selection & All option)
  const handleOpenEdit = async (ord: PrintOrder) => {
    setEditingOrder(ord);
    setEditCopies(ord.config_copies || 1);
    setEditPrintType(
      ord.config_print_type?.toLowerCase().includes('color') ? 'Colour' : 'Black & White'
    );
    setEditSides(
      ord.config_sides?.toLowerCase().includes('back') || ord.config_sides?.toLowerCase().includes('double')
        ? 'Back-to-Back'
        : 'Single Side'
    );
    setEditPageSize(ord.config_page_size || 'A4');
    setEditPaperType(ord.config_paper_type || 'Standard 75 GSM');
    const firstDocumentConfig = Array.isArray(ord.documents_config) ? ord.documents_config[0] : undefined;
    const savedOrderOrientation =
      (ord as any).config_orientation ||
      ord.config_layout ||
      firstDocumentConfig?.orientation ||
      firstDocumentConfig?.layout;
    setEditOrientation(String(savedOrderOrientation || '').toLowerCase() === 'landscape' ? 'Landscape' : 'Portrait');
    const savedPagesPerSheet =
      firstDocumentConfig?.pagesPerSheet || firstDocumentConfig?.pages_per_sheet || firstDocumentConfig?.nUp;
    setEditPagesPerSheet(normalizePagesPerSheet(savedPagesPerSheet));
    setSelectedEditDocId('all');

    // Fetch documents linked to this order
    try {
      const { data: docs } = await supabase
        .from('uploaded_documents')
        .select('*')
        .eq('order_id', ord.id)
        .order('created_at', { ascending: true });
      if (docs && docs.length > 0) {
        setOrderDocsList(docs);
        const firstDocConfig = docs[0].print_config || {};
        const firstDocumentConfig = Array.isArray(ord.documents_config)
          ? ord.documents_config.find((config: any) => config.id === docs[0].id)
          : undefined;
        const savedOrientation =
          firstDocConfig.orientation ||
          firstDocConfig.layout ||
          firstDocumentConfig?.orientation ||
          firstDocumentConfig?.layout;
        const savedPagesPerSheet =
          firstDocConfig.pagesPerSheet ||
          firstDocConfig.pages_per_sheet ||
          firstDocConfig.nUp ||
          firstDocumentConfig?.pagesPerSheet ||
          firstDocumentConfig?.pages_per_sheet ||
          firstDocumentConfig?.nUp;
        if (savedOrientation) {
          setEditOrientation(String(savedOrientation).toLowerCase() === 'landscape' ? 'Landscape' : 'Portrait');
        }
        if (savedPagesPerSheet) {
          const normalizedPagesPerSheet = normalizePagesPerSheet(savedPagesPerSheet);
          setEditPagesPerSheet(
            docs.some((doc) => Number(doc.total_pages) === 2) && normalizedPagesPerSheet === '4-in-1'
              ? '1-in-1'
              : normalizedPagesPerSheet
          );
        } else if (docs.some((doc) => Number(doc.total_pages) === 2)) {
          setEditPagesPerSheet((current) => (current === '4-in-1' ? '1-in-1' : current));
        }
      } else {
        setOrderDocsList([]);
      }
    } catch {
      setOrderDocsList([]);
    }

    setEditModalOpen(true);
  };

  // Switch edited document target (Item 3)
  const handleSelectEditDoc = (docId: string) => {
    setSelectedEditDocId(docId);
    if (docId === 'all') {
      if (editingOrder) {
        setEditCopies(editingOrder.config_copies || 1);
        setEditPrintType(
          editingOrder.config_print_type?.toLowerCase().includes('color') ? 'Colour' : 'Black & White'
        );
        setEditSides(
          editingOrder.config_sides?.toLowerCase().includes('back') ? 'Back-to-Back' : 'Single Side'
        );
        setEditPageSize(editingOrder.config_page_size || 'A4');
        setEditPaperType(editingOrder.config_paper_type || 'Standard 75 GSM');
        setEditOrientation(
          String(
            (editingOrder as any).config_orientation ||
              editingOrder.config_layout ||
              editingOrder.documents_config?.[0]?.orientation ||
              editingOrder.documents_config?.[0]?.layout ||
              ''
          ).toLowerCase() === 'landscape'
            ? 'Landscape'
            : 'Portrait'
        );
        const savedPagesPerSheet =
          editingOrder.documents_config?.[0]?.pagesPerSheet ||
          editingOrder.documents_config?.[0]?.pages_per_sheet ||
          editingOrder.documents_config?.[0]?.nUp ||
          orderDocsList[0]?.print_config?.pagesPerSheet ||
          orderDocsList[0]?.print_config?.pages_per_sheet ||
          orderDocsList[0]?.print_config?.nUp;
        const normalizedPagesPerSheet = normalizePagesPerSheet(savedPagesPerSheet);
        setEditPagesPerSheet(
          orderDocsList.some((doc) => Number(doc.total_pages) === 2) && normalizedPagesPerSheet === '4-in-1'
            ? '1-in-1'
            : normalizedPagesPerSheet
        );
      }
    } else {
      const doc = orderDocsList.find((d) => d.id === docId);
      if (doc) {
        const docCfg = doc.print_config || {};
        setEditCopies(docCfg.copies || editingOrder?.config_copies || 1);
        setEditPrintType(
          docCfg.printType?.toLowerCase().includes('color') ||
          docCfg.color_mode?.toLowerCase().includes('color') ||
          docCfg.print_type?.toLowerCase().includes('color')
            ? 'Colour'
            : 'Black & White'
        );
        setEditSides(
          docCfg.sides?.toLowerCase().includes('back') ||
          docCfg.duplex?.toLowerCase().includes('back')
            ? 'Back-to-Back'
            : 'Single Side'
        );
        setEditPageSize(docCfg.pageSize || docCfg.page_size || editingOrder?.config_page_size || 'A4');
        setEditPaperType(docCfg.paperType || docCfg.paper_type || editingOrder?.config_paper_type || 'Standard 75 GSM');
        setEditOrientation(
          String(docCfg.orientation || docCfg.layout || (editingOrder as any)?.config_orientation || '').toLowerCase() ===
            'landscape'
            ? 'Landscape'
            : 'Portrait'
        );
        const pagesPerSheet = normalizePagesPerSheet(
          docCfg.pagesPerSheet ||
            docCfg.pages_per_sheet ||
            docCfg.nUp ||
            editingOrder?.documents_config?.find((config: any) => config.id === docId)?.pagesPerSheet ||
            editingOrder?.documents_config?.find((config: any) => config.id === docId)?.pages_per_sheet ||
            editingOrder?.documents_config?.find((config: any) => config.id === docId)?.nUp
        );
        const pageCount = Number(doc.total_pages) || Number(editingOrder?.total_pages) || 1;
        setEditPagesPerSheet(pageCount === 2 && pagesPerSheet === '4-in-1' ? '1-in-1' : pagesPerSheet);
      }
    }
  };

  const isCustomRangeActiveForEdit = useMemo(() => {
    if (selectedEditDocId === 'all') {
      return orderDocsList.some(
        (d) =>
          d.print_config?.pageRangeType === 'Custom Range' &&
          (d.print_config?.customRanges?.length > 0 || d.print_config?.custom_ranges?.length > 0)
      );
    }
    const doc = orderDocsList.find((d) => d.id === selectedEditDocId);
    if (!doc) return false;
    return (
      doc.print_config?.pageRangeType === 'Custom Range' &&
      (doc.print_config?.customRanges?.length > 0 || doc.print_config?.custom_ranges?.length > 0)
    );
  }, [selectedEditDocId, orderDocsList]);

  const handleClearCustomRangesForEdit = async () => {
    if (!editingOrder) return;
    try {
      if (selectedEditDocId === 'all') {
        const updatedDocs = orderDocsList.map((d) => ({
          ...d,
          print_config: {
            ...(d.print_config || {}),
            pageRangeType: 'All Pages',
            pageRange: 'All Pages',
            customRanges: [],
            custom_ranges: [],
          },
        }));
        setOrderDocsList(updatedDocs);
        await supabase
          .from('uploaded_documents')
          .update({
            print_config: {
              pageRangeType: 'All Pages',
              pageRange: 'All Pages',
              customRanges: [],
              custom_ranges: [],
            },
          })
          .eq('order_id', editingOrder.id);
      } else {
        const updatedDocs = orderDocsList.map((d) => {
          if (d.id === selectedEditDocId) {
            return {
              ...d,
              print_config: {
                ...(d.print_config || {}),
                pageRangeType: 'All Pages',
                pageRange: 'All Pages',
                customRanges: [],
                custom_ranges: [],
              },
            };
          }
          return d;
        });
        setOrderDocsList(updatedDocs);
        const targetDoc = orderDocsList.find((d) => d.id === selectedEditDocId);
        if (targetDoc) {
          await supabase
            .from('uploaded_documents')
            .update({
              print_config: {
                ...(targetDoc.print_config || {}),
                pageRangeType: 'All Pages',
                pageRange: 'All Pages',
                customRanges: [],
                custom_ranges: [],
              },
            })
            .eq('id', selectedEditDocId);
        }
      }
      toast.success('Custom Page Range removed. Print Type and Print Sides cards are now re-enabled.');
    } catch (err: any) {
      toast.error('Failed to clear custom page range');
    }
  };

  // Save updated print configuration to database
  const handleSaveEditConfig = async () => {
    if (!editingOrder) return;
    setSavingEdit(true);

    try {
      const updates = {
        config_copies: Number(editCopies) || 1,
        config_print_type: editPrintType,
        config_sides: editSides,
        config_page_size: editPageSize,
        config_paper_type: editPaperType,
      };

      if (selectedEditDocId === 'all') {
        // Apply to entire order and sync all linked documents
        const updatedDocsConfig = Array.isArray(editingOrder.documents_config)
          ? editingOrder.documents_config.map((d: any) => ({
              ...d,
              copies: Number(editCopies) || 1,
              printType: editPrintType === 'Colour' ? 'Color' : 'Black & White',
              color_mode: editPrintType === 'Colour' ? 'Color' : 'Black & White',
              sides: editSides,
              duplex: editSides,
              pageSize: editPageSize,
              page_size: editPageSize,
              paperType: editPaperType,
              paper_type: editPaperType,
              orientation: editOrientation,
              layout: editOrientation,
              pagesPerSheet: editPagesPerSheet,
              pages_per_sheet: editPagesPerSheet,
            }))
          : undefined;

        const { error: ordErr } = await supabase
          .from('print_orders')
          .update({
            ...updates,
            ...(updatedDocsConfig ? { documents_config: updatedDocsConfig } : {}),
          })
          .eq('id', editingOrder.id);

        if (ordErr) throw ordErr;

        if (orderDocsList.length > 0) {
          for (const doc of orderDocsList) {
            const nextPrintConfig = {
              ...(doc.print_config || {}),
              copies: Number(editCopies) || 1,
              printType: editPrintType === 'Colour' ? 'Color' : 'Black & White',
              color_mode: editPrintType === 'Colour' ? 'Color' : 'Black & White',
              sides: editSides,
              duplex: editSides,
              pageSize: editPageSize,
              page_size: editPageSize,
              paperType: editPaperType,
              paper_type: editPaperType,
              orientation: editOrientation,
              layout: editOrientation,
              pagesPerSheet: editPagesPerSheet,
              pages_per_sheet: editPagesPerSheet,
            };
            await supabase
              .from('uploaded_documents')
              .update({
                print_config: nextPrintConfig,
              })
              .eq('id', doc.id);
          }
        }

        setOrders((prev) =>
          prev.map((o) =>
            o.id === editingOrder.id
              ? {
                  ...o,
                  ...updates,
                  ...(updatedDocsConfig ? { documents_config: updatedDocsConfig } : {}),
                }
              : o
          )
        );
        toast.success(`Print configuration updated for All Documents in #${editingOrder.token_number}`);
      } else {
        // Apply changes strictly to the selected document
        const targetDoc = orderDocsList.find((d) => d.id === selectedEditDocId);
        const nextPrintConfig = {
          ...(targetDoc?.print_config || {}),
          copies: Number(editCopies) || 1,
          printType: editPrintType === 'Colour' ? 'Color' : 'Black & White',
          color_mode: editPrintType === 'Colour' ? 'Color' : 'Black & White',
          sides: editSides,
          duplex: editSides,
          pageSize: editPageSize,
          page_size: editPageSize,
          paperType: editPaperType,
          paper_type: editPaperType,
          orientation: editOrientation,
          layout: editOrientation,
          pagesPerSheet: editPagesPerSheet,
          pages_per_sheet: editPagesPerSheet,
        };

        const { error: docErr } = await supabase
          .from('uploaded_documents')
          .update({
            print_config: nextPrintConfig,
          })
          .eq('id', selectedEditDocId);

        if (docErr) throw docErr;

        if (Array.isArray(editingOrder.documents_config)) {
          const updatedDocsConfig = editingOrder.documents_config.map((d: any) =>
            d.id === selectedEditDocId
              ? {
                  ...d,
                  copies: Number(editCopies) || 1,
                  printType: editPrintType === 'Colour' ? 'Color' : 'Black & White',
                  color_mode: editPrintType === 'Colour' ? 'Color' : 'Black & White',
                  sides: editSides,
                  duplex: editSides,
                  pageSize: editPageSize,
                  page_size: editPageSize,
                  paperType: editPaperType,
                  paper_type: editPaperType,
                  orientation: editOrientation,
                  layout: editOrientation,
                  pagesPerSheet: editPagesPerSheet,
                  pages_per_sheet: editPagesPerSheet,
                }
              : d
          );
          await supabase
            .from('print_orders')
            .update({ documents_config: updatedDocsConfig })
            .eq('id', editingOrder.id);
        }

        setOrderDocsList((prev) =>
          prev.map((d) =>
            d.id === selectedEditDocId
              ? {
                  ...d,
                  print_config: nextPrintConfig,
                }
              : d
          )
        );
        toast.success(
          `Print configuration updated for "${targetDoc?.file_name || 'Selected Document'}" in #${editingOrder.token_number}`
        );
      }

      setEditModalOpen(false);
    } catch (err: any) {
      toast.error(`Failed to update configuration: ${err?.message || err}`);
    } finally {
      setSavingEdit(false);
    }
  };

  // Dismiss Order action (Item 4)
  const handleDismissOrder = async (ord: PrintOrder) => {
    if (
      !confirm(
        `Are you sure you want to dismiss Order #${ord.token_number || ord.order_number}? It will be removed from the active queue and moved to Recent History.`
      )
    ) {
      return;
    }

    try {
      const dismissedAt = new Date().toISOString();
      const { error } = await supabase
        .from('print_orders')
        .update({
          order_status: 'Dismissed',
          completed_at: dismissedAt,
        })
        .eq('id', ord.id);

      if (error) {
        toast.error(`Failed to dismiss order in database: ${error.message}`);
        return;
      }

      setOrders((prev) =>
        prev.map((o) =>
          o.id === ord.id
            ? { ...o, order_status: 'Dismissed', completed_at: dismissedAt }
            : o
        )
      );
      setRecentHistoryOrders((prev) => [
        { ...ord, order_status: 'Dismissed', completed_at: dismissedAt },
        ...prev.filter((order) => order.id !== ord.id),
      ]);
      toast.success(`Order #${ord.token_number || ord.order_number} dismissed and moved to Recent History`);
    } catch (err: any) {
      toast.error(`Failed to dismiss order: ${err?.message || err}`);
    }
  };

  // Filtered orders list
  const filteredOrders = orders.filter((ord) => {
    // Search match
    const matchSearch =
      !searchQuery ||
      ord.order_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ord.token_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ord.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ord.user_name?.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchSearch) return false;

    // Status filter
    if (statusFilter === 'Active') {
      if (ord.order_status === 'Completed' || ord.order_status === 'Cancelled' || ord.order_status === 'Dismissed') return false;
    } else if (statusFilter === 'Completed') {
      if (ord.order_status !== 'Completed') return false;
    } else if (statusFilter === 'Cancelled') {
      if (ord.order_status !== 'Cancelled') return false;
    }

    // VIP filter
    if (vipFilterActive) {
      if (!isVipOrder(ord)) return false;
    }

    // Date filter
    if (dateFilter !== 'all') {
      const ordDate = new Date(ord.created_at || Date.now());
      const now = new Date();
      if (dateFilter === 'today') {
        if (ordDate.toDateString() !== now.toDateString()) return false;
      } else if (dateFilter === 'yesterday') {
        const yest = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        if (ordDate.toDateString() !== yest.toDateString()) return false;
      } else if (dateFilter === 'last7days') {
        const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
        if (ordDate.getTime() < sevenDaysAgo) return false;
      } else if (dateFilter === 'last1month') {
        const thirtyDaysAgo = now.getTime() - 30 * 24 * 60 * 60 * 1000;
        if (ordDate.getTime() < thirtyDaysAgo) return false;
      } else if (dateFilter === 'custom') {
        if (customDateFrom) {
          const fromTime = new Date(`${customDateFrom}T00:00:00`).getTime();
          if (ordDate.getTime() < fromTime) return false;
        }
        if (customDateTo) {
          const toTime = new Date(`${customDateTo}T23:59:59`).getTime();
          if (ordDate.getTime() > toTime) return false;
        }
      }
    }

    // Print Type filter
    if (printTypeFilter !== 'all') {
      const pt = (ord.config_print_type || '').toLowerCase();
      const sides = (ord.config_sides || '').toLowerCase();
      if (printTypeFilter === 'Color') {
        if (!pt.includes('color') && !pt.includes('colour')) return false;
      } else if (printTypeFilter === 'Black & White') {
        if (pt.includes('color') || pt.includes('colour')) return false;
      } else if (printTypeFilter === 'Single Side') {
        if (sides.includes('back') || sides.includes('double') || sides.includes('duplex')) return false;
      } else if (printTypeFilter === 'Back-to-Back') {
        if (!sides.includes('back') && !sides.includes('double') && !sides.includes('duplex')) return false;
      }
    }

    return true;
  });

  // Helper to determine if an order is incomplete / has pending items remaining in queue
  const isIncompleteOrder = (ord: PrintOrder): boolean => {
    const status = ord.order_status as string;
    if (status === 'Completed' || status === 'Cancelled') return false;
    if (status === 'Partially Printed' || status === 'No Compatible Printer') return true;
    if (Array.isArray(ord.remaining_pages_info) && ord.remaining_pages_info.length > 0) return true;
    if (Array.isArray(ord.printed_segments) && ord.printed_segments.length > 0 && status !== 'Completed') return true;
    return false;
  };

  // Recent history is fetched separately so the active queue's PC filter and 100-order limit do not hide it.
  const completedHistoryOrders = useMemo(() => {
    return recentHistoryOrders.filter(
      (order) => order.order_status === 'Completed' || order.order_status === 'Dismissed'
    );
  }, [recentHistoryOrders]);

  // Sort orders with pinned rows always on top
  const sortedFilteredOrders = useMemo(() => {
    return [...filteredOrders].sort((a, b) => {
      const aPinned = pinnedOrderIds.includes(a.id);
      const bPinned = pinnedOrderIds.includes(b.id);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      if (aPinned && bPinned) {
        return pinnedOrderIds.indexOf(a.id) - pinnedOrderIds.indexOf(b.id);
      }
      return 0;
    });
  }, [filteredOrders, pinnedOrderIds]);

  const displayedHistoryOrders = useMemo(() => {
    return showAllHistory ? completedHistoryOrders : completedHistoryOrders.slice(0, 5);
  }, [completedHistoryOrders, showAllHistory]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setStatusFilter('Active');
    setDateFilter('all');
    setCustomDateFrom('');
    setCustomDateTo('');
    setPrintTypeFilter('all');
    setVipFilterActive(false);
  };

  const editTargetPageCounts =
    selectedEditDocId === 'all'
      ? orderDocsList.length
        ? orderDocsList.map((doc) =>
            Math.max(1, Number(doc.total_pages || doc.totalPages || editingOrder?.total_pages) || 1)
          )
        : [Math.max(1, Number(editingOrder?.total_pages) || 1)]
      : [
          Math.max(
            1,
            Number(orderDocsList.find((doc) => doc.id === selectedEditDocId)?.total_pages) ||
              Number(editingOrder?.total_pages) ||
              1
          ),
        ];
  const isNUpDisabled = editTargetPageCounts.some((pageCount) => pageCount <= 1);
  const isFourUpDisabled = isNUpDisabled || editTargetPageCounts.includes(2);

  useEffect(() => {
    if (isNUpDisabled && editPagesPerSheet !== '1-in-1') {
      setEditPagesPerSheet('1-in-1');
    } else if (isFourUpDisabled && editPagesPerSheet === '4-in-1') {
      setEditPagesPerSheet('1-in-1');
    }
  }, [editPagesPerSheet, isFourUpDisabled, isNUpDisabled]);

  const handleClearAllPrints = async () => {
    if (!user?.shop_id) {
      toast.error('Shop session is unavailable. Please sign in again.');
      return;
    }

    setClearingAllPrints(true);
    try {
      const { data: shopOrders, error: selectError } = await supabase
        .from('print_orders')
        .select('id, order_status')
        .eq('shop_id', user.shop_id);
      if (selectError) throw selectError;

      const { data: persistedHistory, error: historyError } = await supabase
        .from('print_orders')
        .select('*')
        .eq('shop_id', user.shop_id)
        .in('order_status', ['Completed', 'Dismissed'])
        .order('completed_at', { ascending: false })
        .limit(100);
      if (historyError) throw historyError;

      const historyIds = new Set((persistedHistory || []).map((order) => order.id));
      const completedOrderIds = (shopOrders || [])
        .filter(
          (order) =>
            order.order_status !== 'Cancelled' &&
            order.order_status !== 'Dismissed' &&
            !historyIds.has(order.id)
        )
        .map((order) => order.id);
      const completedAt = new Date().toISOString();

      for (let i = 0; i < completedOrderIds.length; i += 100) {
        const { error } = await supabase
          .from('print_orders')
          .update({
            remaining_pages_info: [],
            order_status: 'Completed',
            completed_at: completedAt,
          })
          .in('id', completedOrderIds.slice(i, i + 100));
        if (error) throw error;
      }

      setOrders((currentOrders) =>
        currentOrders.map((order) =>
          completedOrderIds.includes(order.id)
            ? { ...order, remaining_pages_info: [], order_status: 'Completed', completed_at: completedAt }
            : order
        )
      );
      const fetchedHistory: PrintOrder[] = (persistedHistory || []).map((order) => ({
        ...order,
        customer_name: order.customer_name || order.user_name || 'Customer',
        user_name: order.user_name || order.customer_name || 'Customer',
        user_phone: order.user_phone || order.customer_phone,
      }));
      const movedOrders: PrintOrder[] = orders
        .filter((order) => completedOrderIds.includes(order.id))
        .map((order) => ({
          ...order,
          remaining_pages_info: [],
          order_status: 'Completed',
          completed_at: completedAt,
        }));
      setRecentHistoryOrders((history) => {
        const ordersById = new Map<string, PrintOrder>();
        [...history, ...fetchedHistory, ...movedOrders].forEach((order) => ordersById.set(order.id, order));
        return Array.from(ordersById.values()).sort(
          (left, right) =>
            new Date(right.completed_at || right.created_at).getTime() -
            new Date(left.completed_at || left.created_at).getTime()
        );
      });
      setStatusFilter('Active');
      setSearchQuery('');
      setDateFilter('all');
      setCustomDateFrom('');
      setCustomDateTo('');
      setPrintTypeFilter('all');
      setVipFilterActive(false);
      setClearAllPrintsOpen(false);
      toast.success(`Moved ${completedOrderIds.length} order(s) to Recent History. Amounts and page counts were not changed.`);
      await Promise.all([fetchOrders(), fetchRecentHistoryOrders()]);
    } catch (error) {
      console.error('Failed to clear print progress:', error);
      toast.error('Could not clear print progress. Please try again.');
    } finally {
      setClearingAllPrints(false);
    }
  };

  const handleReprintOrder = async (order: PrintOrder) => {
    if (!user?.shop_id) {
      toast.error('Shop session is unavailable. Please sign in again.');
      return;
    }
    if (Date.now() - new Date(order.created_at || 0).getTime() > 12 * 60 * 60 * 1000) {
      toast.error('This document has expired and can no longer be reprinted.');
      return;
    }

    try {
      const { error } = await supabase
        .from('print_orders')
        .update({
          printed_segments: [],
          remaining_pages_info: [],
          order_status: 'In Queue',
          completed_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id)
        .eq('shop_id', user.shop_id);
      if (error) throw error;

      const queuedOrder: PrintOrder = {
        ...order,
        order_status: 'In Queue',
        printed_segments: [],
        remaining_pages_info: [],
        completed_at: undefined,
      };
      setOrders((currentOrders) => [queuedOrder, ...currentOrders.filter((item) => item.id !== order.id)]);
      setRecentHistoryOrders((history) => history.filter((item) => item.id !== order.id));
      setStatusFilter('Active');
      setSearchQuery('');
      if (selectedPcId !== 'all' && order.target_pc_id && selectedPcId !== order.target_pc_id) {
        setSelectedPcId('all');
      }
      toast.success(`Order #${order.token_number} added back to the queue. Click Go For Print to reprint.`);
    } catch (error) {
      console.error('Failed to queue order for reprint:', error);
      toast.error('Could not add this order back to the queue.');
    }
  };

  return (
    <div className="space-y-6 font-sans">
      <PrintDocumentSelectionDialog
        open={printSelection !== null}
        documents={printSelection?.documents || []}
        selectedDocumentIds={selectedPrintDocumentIds}
        onOpenChange={(open) => {
          if (!open) setPrintSelection(null);
        }}
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
      <PrintProgressControls
        progress={printQueue.progress}
      />
      {/* ---------------- 1. PRINT QUEUE HUB HEADER ---------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 md:p-6 bg-card border border-border rounded-xl shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono uppercase font-semibold text-muted-foreground">
              Print Queue Hub
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-heading font-bold tracking-tight text-foreground uppercase">
            {t('orders')}
          </h1>
          <p className="text-xs text-muted-foreground font-sans">
            Direct queue processing, file inspection, and one-click direct hardware printing.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchOrders}
            className="text-xs font-sans h-9 rounded-lg gap-1.5"
            disabled={loading}
          >
            <RotateCw className={`w-3.5 h-3.5 text-primary ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>
      {/* ---------------- 2. SEARCH & FILTER BAR WITH VIP TOGGLE ---------------- */}
      <Card className="bg-card border-border rounded-xl shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5 pointer-events-none" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by customer name or token ID..."
                className="pl-9 h-9 text-xs font-sans bg-background border-border rounded-lg"
              />
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setClearAllPrintsOpen(true)}
              disabled={clearingAllPrints}
              className="h-9 px-3 text-xs font-sans font-semibold rounded-lg gap-1.5 shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear All</span>
            </Button>

            {/* Status Filter Popover Button */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 px-3 text-xs font-sans font-semibold rounded-lg gap-1.5 shrink-0"
                >
                  <Filter className="w-3.5 h-3.5 text-primary" />
                  <span>Status: {statusFilter}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-2 bg-card border-border rounded-xl shadow-lg font-sans" align="end">
                <div className="text-[11px] font-semibold text-muted-foreground px-2 py-1 uppercase tracking-wider">
                  Order Status
                </div>
                <div className="space-y-1">
                  {(['All', 'Active', 'Completed', 'Cancelled'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStatusFilter(st)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg transition-colors text-left ${
                        statusFilter === st
                          ? 'bg-primary text-primary-foreground font-semibold'
                          : 'text-foreground hover:bg-muted'
                      }`}
                    >
                      <span>{st === 'All' ? 'All Orders' : st}</span>
                      {statusFilter === st && <Check className="w-3.5 h-3.5 shrink-0" />}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {/* Date Filter Popover */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={`h-9 px-3 text-xs font-sans font-semibold rounded-lg gap-1.5 shrink-0 ${
                    dateFilter !== 'all' ? 'border-primary text-primary bg-primary/5' : ''
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5 text-primary" />
                  <span>
                    Date:{' '}
                    {dateFilter === 'all'
                      ? 'All'
                      : dateFilter === 'today'
                      ? 'Today'
                      : dateFilter === 'yesterday'
                      ? 'Yesterday'
                      : dateFilter === 'last7days'
                      ? '7 Days'
                      : dateFilter === 'last1month'
                      ? '1 Month'
                      : 'Custom'}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-60 p-3 bg-card border-border rounded-xl shadow-lg font-sans" align="end">
                <div className="text-[11px] font-semibold text-muted-foreground px-1 py-1 uppercase tracking-wider">
                  Filter By Date
                </div>
                <div className="space-y-1 mt-1">
                  {[
                    { id: 'all', label: 'All Dates' },
                    { id: 'today', label: 'Today' },
                    { id: 'yesterday', label: 'Yesterday' },
                    { id: 'last7days', label: 'Last 7 Days' },
                    { id: 'last1month', label: 'Last 1 Month' },
                    { id: 'custom', label: 'Custom Date Range' },
                  ].map((df) => (
                    <button
                      key={df.id}
                      type="button"
                      onClick={() => setDateFilter(df.id as any)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg transition-colors text-left ${
                        dateFilter === df.id
                          ? 'bg-primary text-primary-foreground font-semibold'
                          : 'text-foreground hover:bg-muted'
                      }`}
                    >
                      <span>{df.label}</span>
                      {dateFilter === df.id && <Check className="w-3.5 h-3.5 shrink-0" />}
                    </button>
                  ))}
                </div>

                {dateFilter === 'custom' && (
                  <div className="mt-3 pt-2 border-t border-border space-y-2">
                    <div>
                      <span className="text-[10px] text-muted-foreground block mb-0.5">From Date</span>
                      <Input
                        type="date"
                        value={customDateFrom}
                        onChange={(e) => setCustomDateFrom(e.target.value)}
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground block mb-0.5">To Date</span>
                      <Input
                        type="date"
                        value={customDateTo}
                        onChange={(e) => setCustomDateTo(e.target.value)}
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                  </div>
                )}
              </PopoverContent>
            </Popover>

            {/* Print Type Filter Popover */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={`h-9 px-3 text-xs font-sans font-semibold rounded-lg gap-1.5 shrink-0 ${
                    printTypeFilter !== 'all' ? 'border-primary text-primary bg-primary/5' : ''
                  }`}
                >
                  <Printer className="w-3.5 h-3.5 text-primary" />
                  <span>Type: {printTypeFilter === 'all' ? 'All Types' : printTypeFilter}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-52 p-2 bg-card border-border rounded-xl shadow-lg font-sans" align="end">
                <div className="text-[11px] font-semibold text-muted-foreground px-2 py-1 uppercase tracking-wider">
                  Print Configuration
                </div>
                <div className="space-y-1">
                  {[
                    'all',
                    'Black & White',
                    'Color',
                    'Single Side',
                    'Back-to-Back',
                  ].map((pt) => (
                    <button
                      key={pt}
                      type="button"
                      onClick={() => setPrintTypeFilter(pt as any)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg transition-colors text-left ${
                        printTypeFilter === pt
                          ? 'bg-primary text-primary-foreground font-semibold'
                          : 'text-foreground hover:bg-muted'
                      }`}
                    >
                      <span>{pt === 'all' ? 'All Print Types' : pt}</span>
                      {printTypeFilter === pt && <Check className="w-3.5 h-3.5 shrink-0" />}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {/* Reset Filters Button */}
            {(searchQuery ||
              statusFilter !== 'Active' ||
              dateFilter !== 'all' ||
              printTypeFilter !== 'all' ||
              vipFilterActive) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="h-9 px-2 text-xs font-sans text-muted-foreground hover:text-foreground rounded-lg gap-1 shrink-0"
                title="Reset all filters"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </Button>
            )}

            {/* VIP Button (Only visible when Shopkeeper has enabled VIP membership in settings) */}
            {isVipEnabled && (
              <Button
                type="button"
                variant={vipFilterActive ? 'default' : 'outline'}
                size="sm"
                onClick={() => setVipFilterActive((prev) => !prev)}
                className={`h-9 px-3 text-xs font-heading font-bold rounded-lg gap-1.5 shrink-0 transition-colors ${
                  vipFilterActive
                    ? 'bg-amber-500 hover:bg-amber-600 text-black border-amber-500 shadow-sm'
                    : 'text-amber-600 dark:text-amber-400 border-amber-500/40 hover:bg-amber-500/10'
                }`}
                title="Filter VIP membership customers"
              >
                <Crown className="w-3.5 h-3.5" />
                <span>VIP</span>
                {vipOrdersCount > 0 && (
                  <span
                    className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                      vipFilterActive
                        ? 'bg-black text-amber-400'
                        : 'bg-amber-500 text-black'
                    }`}
                  >
                    {vipOrdersCount}
                  </span>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      {/* ---------------- 3. STREAMLINED LIVE ORDERS TABLE ---------------- */}
      <Card className="bg-card border-border rounded-xl shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[1100px] text-xs text-left font-sans">
              <thead className="bg-muted/70 text-muted-foreground uppercase text-[11px] font-semibold border-b border-border">
                <tr>
                  <th className="py-3 px-4 whitespace-nowrap">Token & ID</th>
                  <th className="py-3 px-4 whitespace-nowrap">Customer</th>
                  <th className="py-3 px-4 whitespace-nowrap">Print Configuration</th>
                  <th className="py-3 px-4 whitespace-nowrap">Payment</th>
                  <th className="py-3 px-4 whitespace-nowrap">Status</th>
                  <th className="min-w-[310px] py-3 px-4 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sortedFilteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-muted-foreground font-sans">
                      {loading ? 'Loading orders...' : 'No matching print orders found in queue.'}
                    </td>
                  </tr>
                ) : (
                  sortedFilteredOrders.map((ord) => {
                    const isOnlinePaid =
                      (ord.payment_method === 'Online' || ord.payment_method === 'UPI') &&
                      ord.payment_status === 'Completed';
                    const isVip = isVipOrder(ord);
                    const isIncomplete = isIncompleteOrder(ord);
                    const isPinned = pinnedOrderIds.includes(ord.id);

                    // Specialized Paper Highlighting (Item 15)
                    const paperTypeKey = ord.config_paper_type || ord.config_page_size || 'Normal';
                    const highlightColor =
                      specializedPaperColors[ord.config_paper_type] ||
                      specializedPaperColors[ord.config_page_size] ||
                      specializedPaperColors[paperTypeKey];

                    return (
                      <tr
                        key={ord.id}
                        className={`hover:bg-muted/30 transition-colors ${
                          isPinned ? 'bg-primary/[0.03]' : ''
                        } ${
                          isIncomplete && !highlightColor ? 'border-l-4 border-l-red-500 bg-red-500/[0.02]' : ''
                        }`}
                        style={
                          highlightColor
                            ? {
                                backgroundColor: `${highlightColor}2e`,
                                borderLeft: `4px solid ${highlightColor}`,
                              }
                            : undefined
                        }
                      >
                        {/* Token & Order Number with Pin Button */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleTogglePin(ord.id)}
                              className={`p-1 rounded transition-colors ${
                                isPinned
                                  ? 'text-primary bg-primary/15 hover:bg-primary/25'
                                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                              }`}
                              title={isPinned ? 'Unpin this order' : 'Pin order to top of queue'}
                            >
                              <Pin className={`w-3.5 h-3.5 ${isPinned ? 'fill-primary rotate-45' : ''}`} />
                            </button>
                            <span className="px-2 py-0.5 bg-primary/10 border border-primary/30 text-primary font-mono font-bold text-xs rounded">
                              {ord.token_number}
                            </span>
                            {isPinned && (
                              <span className="px-1 py-0.5 text-[8px] font-bold rounded bg-primary/20 text-primary border border-primary/40 font-mono">
                                PIN
                              </span>
                            )}
                            {isVip && (
                              <Badge className="bg-amber-500 text-black text-[9px] font-bold px-1 py-0 h-4 rounded">
                                VIP
                              </Badge>
                            )}
                            {isIncomplete && (
                              <span
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30 animate-slow-blink-red"
                                title="Incomplete / Pending print segments remaining"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block animate-slow-blink-red" />
                                Pending Items
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono mt-0.5 ml-6">
                            {ord.order_number}
                          </div>
                        </td>
                        {/* Customer Column: Real Customer Name from Database */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="font-semibold text-foreground text-xs font-sans">
                            {ord.customer_name || ord.user_name || 'Counter Customer'}
                          </span>
                        </td>
                        {/* Print Settings Specification */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex flex-wrap items-center gap-1">
                            <span
                              className={`px-1.5 py-0.5 text-[10px] font-semibold rounded border ${
                                ord.config_print_type?.toLowerCase().includes('color') ||
                                ord.config_print_type?.toLowerCase().includes('colour')
                                  ? 'bg-primary/15 text-primary border-primary/30'
                                  : 'bg-muted text-muted-foreground border-border'
                              }`}
                            >
                              {ord.config_print_type || 'B&W'}
                            </span>
                            <span className="px-1.5 py-0.5 text-[10px] bg-muted border border-border text-foreground rounded">
                              {ord.config_sides || 'Single Side'}
                            </span>
                            <span className="px-1.5 py-0.5 text-[10px] bg-muted border border-border text-foreground rounded font-mono">
                              {ord.config_page_size || 'A4'}
                            </span>
                            <span className="px-1.5 py-0.5 text-[10px] bg-muted border border-border text-muted-foreground rounded font-mono">
                              {ord.total_pages || 1}p × {ord.config_copies || 1}c
                            </span>
                          </div>
                        </td>
                        {/* Payment Column: Amount ONLY */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-heading font-bold text-foreground text-sm">
                            ₹{ord.grand_total}
                          </div>
                        </td>
                        {/* Status Column: Online Paid vs Pay on Counter + Order Status */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex flex-col gap-1 items-start">
                            {isOnlinePaid ? (
                              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                Online Paid
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                                Pay on Counter
                              </span>
                            )}

                          </div>
                        </td>
                        {/* Actions Column: Go For Print + Eye Icon + Edit Icon */}
                        <td className="min-w-[310px] py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex flex-nowrap items-center justify-end gap-1.5">
                            {/* 1-Click Direct Print to Physical Printer */}
                            <Button
                              size="sm"
                              disabled={printingOrderId === ord.id}
                              onClick={() => handleDirectPrint(ord)}
                              className="h-8 shrink-0 px-3 text-xs font-heading font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg gap-1.5 shadow-sm active:scale-95 transition-transform"
                              title="Print this order"
                            >
                              <Printer className={`w-3.5 h-3.5 ${printingOrderId === ord.id ? 'animate-spin' : ''}`} />
                              <span>Go For Print</span>
                            </Button>

                            {/* Inspect: Eye Icon - In-App Same Tab Route Preview */}
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => {
                                navigate(`/orders/${ord.id}/preview`);
                              }}
                              className="h-8 w-8 shrink-0 rounded-lg text-muted-foreground hover:text-foreground"
                              title="Inspect Customer Document Preview"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </Button>

                            {/* Edit Config: Pencil Icon */}
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => handleOpenEdit(ord)}
                              className="h-8 w-8 shrink-0 rounded-lg text-muted-foreground hover:text-foreground"
                              title="Edit Print Configuration"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>

                            {/* Vertical Three-dot Menu with Dismiss (Item 4) */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="h-8 w-8 shrink-0 rounded-lg text-muted-foreground hover:text-foreground"
                                  title="More Order Actions"
                                >
                                  <MoreVertical className="w-3.5 h-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-36 bg-popover border border-border shadow-md">
                                <DropdownMenuItem
                                  onClick={() => handleDismissOrder(ord)}
                                  className="text-destructive focus:text-destructive cursor-pointer flex items-center gap-2 text-xs py-2 font-sans"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  <span>Dismiss Order</span>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ---------------- 3.5 RECENT HISTORY TABLE (COMPLETED ORDERS) ---------------- */}
      <Card className="bg-card border-border rounded-xl shadow-sm overflow-hidden font-sans">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-primary" />
            <div>
              <h2 className="text-sm font-heading font-bold text-foreground uppercase tracking-tight">
                Recent History
              </h2>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                <Clock className="w-3 h-3 text-amber-500" />
                <span>12-Hour Document Retention: Uploaded files purged after 12h for privacy</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground font-mono">
              Completed: {completedHistoryOrders.length}
            </span>
          </div>
        </div>

        <CardContent className="p-0">
          <div className="w-full overflow-x-auto">
            <table className="w-full text-xs text-left font-sans">
              <thead className="bg-muted/70 text-muted-foreground uppercase text-[11px] font-semibold border-b border-border">
                <tr>
                  <th className="py-2.5 px-4 whitespace-nowrap">Token &amp; ID</th>
                  <th className="py-2.5 px-4 whitespace-nowrap">Customer</th>
                  <th className="py-2.5 px-4 whitespace-nowrap">Configuration</th>
                  <th className="py-2.5 px-4 whitespace-nowrap">Completed At</th>
                  <th className="py-2.5 px-4 whitespace-nowrap">Document Status</th>
                  <th className="py-2.5 px-4 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {displayedHistoryOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground font-sans">
                      No completed orders in recent history yet.
                    </td>
                  </tr>
                ) : (
                  displayedHistoryOrders.map((ord) => {
                    const isOlderThan12H =
                      Date.now() - new Date(ord.created_at || 0).getTime() > 12 * 60 * 60 * 1000;

                    return (
                      <tr key={ord.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          <span className="px-2 py-0.5 bg-neutral-200 dark:bg-neutral-800 text-foreground font-mono font-bold text-xs rounded">
                            {ord.token_number}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono block mt-0.5">
                            {ord.order_number}
                          </span>
                        </td>

                        <td className="py-2.5 px-4 whitespace-nowrap">
                          <div className="font-semibold text-foreground text-xs">
                            {ord.customer_name || ord.user_name || 'Customer'}
                          </div>
                          {ord.user_phone && (
                            <div className="text-[10px] text-muted-foreground font-mono">
                              {ord.user_phone}
                            </div>
                          )}
                        </td>

                        <td className="py-2.5 px-4 whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                          {ord.config_print_type || 'B&W'} • {ord.config_sides || 'Single Side'} •{' '}
                          {ord.config_copies || 1} cpy ({ord.total_pages || 1} pgs)
                        </td>

                        <td className="py-2.5 px-4 whitespace-nowrap text-muted-foreground font-mono text-[11px]">
                          {ord.created_at ? new Date(ord.created_at).toLocaleString() : 'Recent'}
                        </td>

                        <td className="py-2.5 px-4 whitespace-nowrap">
                          {ord.order_status === 'Dismissed' ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] text-neutral-600 dark:text-neutral-400 border-neutral-500/40 bg-neutral-100 dark:bg-neutral-800/80 font-sans flex items-center gap-1 w-fit"
                            >
                              <XCircle className="w-3 h-3 text-neutral-500" />
                              <span>Dismissed</span>
                            </Badge>
                          ) : isOlderThan12H ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] text-amber-600 dark:text-amber-400 border-amber-500/30 font-sans"
                            >
                              Purged (&gt;12h retention)
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-[10px] text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-sans flex items-center gap-1 w-fit"
                            >
                              <ShieldCheck className="w-3 h-3" />
                              <span>Retained (&lt;12h)</span>
                            </Badge>
                          )}
                        </td>

                        <td className="py-2.5 px-4 text-right whitespace-nowrap">
                          <div className="flex justify-end gap-1.5">
                            {ord.order_status === 'Completed' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleReprintOrder(ord)}
                                disabled={isOlderThan12H}
                                className="h-7 text-xs rounded-lg gap-1 font-sans"
                                title={isOlderThan12H ? 'Document retention expired' : 'Add order back to queue for reprinting'}
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>Reprint</span>
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigate(`/orders/${ord.id}/preview`)}
                              className="h-7 text-xs rounded-lg gap-1 font-sans"
                              title="Preview Order Metadata & Details"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Preview</span>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* View More / View Less Toggle for History (Only if > 5 orders) */}
          {completedHistoryOrders.length > 5 && (
            <div className="p-3 bg-muted/20 border-t border-border flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAllHistory((prev) => !prev)}
                className="text-xs font-semibold text-primary hover:text-primary/90 h-8 gap-1.5"
              >
                <span>
                  {showAllHistory
                    ? 'Show Latest 5 Records Only'
                    : `View More (${completedHistoryOrders.length - 5} older records)`}
                </span>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      {/* ---------------- 4. EDIT PRINT CONFIGURATION MODAL ---------------- */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md max-h-[90vh] overflow-y-auto bg-card border-border rounded-xl font-sans">
          <DialogHeader>
            <DialogTitle className="text-base font-heading font-bold uppercase text-foreground flex items-center gap-2">
              <Pencil className="w-4 h-4 text-primary" />
              <span>Edit Print Configuration</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Modify print parameters for Token no {editingOrder?.token_number}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Target Document Selection (When multiple documents exist in order) */}
            {orderDocsList.length > 1 && (
              <div className="space-y-1.5 p-2.5 rounded-lg border border-border bg-muted/40">
                <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-primary" />
                  <span>Target Document</span>
                </Label>
                <select
                  value={selectedEditDocId}
                  onChange={(e) => handleSelectEditDoc(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-border bg-background text-foreground text-xs font-mono focus:ring-1 focus:ring-primary"
                >
                  <option value="all">All Documents ({orderDocsList.length} files - Uniform Apply)</option>
                  {orderDocsList.map((doc, idx) => (
                    <option key={doc.id} value={doc.id}>
                      Doc #{idx + 1}: {doc.file_name}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-muted-foreground font-mono">
                  {selectedEditDocId === 'all'
                    ? 'Updating settings applies to all documents in this order.'
                    : `Updating settings solely for "${orderDocsList.find((d) => d.id === selectedEditDocId)?.file_name}".`}
                </p>
              </div>
            )}

            {/* Copies */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">Number of Copies</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={editCopies}
                onChange={(e) => setEditCopies(Math.max(1, parseInt(e.target.value) || 1))}
                className="h-9 text-xs rounded-lg font-mono bg-background"
              />
            </div>

            {/* Custom Page Range Status Banner & Override */}
            {isCustomRangeActiveForEdit && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wide">
                    Custom Page Range Active
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleClearCustomRangesForEdit}
                    className="h-6 text-[10px] px-2 border-amber-500/40 text-amber-800 dark:text-amber-200 hover:bg-amber-500/20"
                  >
                    Clear Custom Range
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Print Type and Print Side cards are locked because independent per-range color/simplex/duplex rules apply. Clearing custom ranges will restore uniform document controls.
                </p>
              </div>
            )}

            {/* Print Type (Color vs B&W) */}
            <div className={`space-y-1 ${isCustomRangeActiveForEdit ? 'opacity-50 pointer-events-none' : ''}`}>
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground">Color Mode (Print Type)</Label>
                {isCustomRangeActiveForEdit && (
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono">
                    (Disabled by Custom Range)
                  </span>
                )}
              </div>
              <select
                disabled={isCustomRangeActiveForEdit}
                value={editPrintType}
                onChange={(e) => setEditPrintType(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-border bg-background text-foreground text-xs focus:ring-1 focus:ring-primary disabled:cursor-not-allowed"
              >
                <option value="Black & White">Black &amp; White (B&amp;W)</option>
                <option value="Colour">Full Colour</option>
              </select>
            </div>

            {/* Sides / Duplex */}
            <div className={`space-y-1 ${isCustomRangeActiveForEdit ? 'opacity-50 pointer-events-none' : ''}`}>
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground">Print Sides</Label>
                {isCustomRangeActiveForEdit && (
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono">
                    (Disabled by Custom Range)
                  </span>
                )}
              </div>
              <select
                disabled={isCustomRangeActiveForEdit}
                value={editSides}
                onChange={(e) => setEditSides(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-border bg-background text-foreground text-xs focus:ring-1 focus:ring-primary disabled:cursor-not-allowed"
              >
                <option value="Single Side">Single Sided (Simplex)</option>
                <option value="Back-to-Back">Back-to-Back (Duplex)</option>
              </select>
            </div>

            {/* Paper Size */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">Paper Size</Label>
              <select
                value={editPageSize}
                onChange={(e) => setEditPageSize(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-border bg-background text-foreground text-xs focus:ring-1 focus:ring-primary"
              >
                {dynamicPaperTypes && dynamicPaperTypes.length > 0 ? (
                  dynamicPaperTypes
                    .filter((pt) => pt.is_active !== false)
                    .map((pt) => (
                      <option key={pt.id} value={pt.name}>
                        {pt.name} (₹{editPrintType === 'Color' ? pt.color_price : pt.bw_price}/page)
                      </option>
                    ))
                ) : (
                  <>
                    <option value="A4">A4 (Standard 210 × 297 mm)</option>
                    <option value="A3">A3 (Large Ledger)</option>
                    <option value="Legal">Legal (8.5 × 14 in)</option>
                    <option value="Letter">Letter (8.5 × 11 in)</option>
                  </>
                )}
              </select>
            </div>

            {/* Page Orientation */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">Page Orientation</Label>
              <select
                value={editOrientation}
                onChange={(e) => setEditOrientation(e.target.value as 'Portrait' | 'Landscape')}
                className="w-full h-9 px-3 rounded-lg border border-border bg-background text-foreground text-xs focus:ring-1 focus:ring-primary"
              >
                <option value="Portrait">Portrait</option>
                <option value="Landscape">Landscape</option>
              </select>
            </div>

            {/* Pages per sheet */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">Pages per Sheet</Label>
              <select
                value={editPagesPerSheet}
                onChange={(e) => setEditPagesPerSheet(normalizePagesPerSheet(e.target.value))}
                className="w-full h-9 px-3 rounded-lg border border-border bg-background text-foreground text-xs focus:ring-1 focus:ring-primary"
              >
                <option value="1-in-1">1 in 1 (Normal)</option>
                <option value="2-in-1" disabled={isNUpDisabled}>2 in 1</option>
                <option value="4-in-1" disabled={isFourUpDisabled}>4 in 1</option>
              </select>
            </div>

            {/* Paper Type */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">Paper Type</Label>
              <select
                value={editPaperType}
                onChange={(e) => setEditPaperType(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-border bg-background text-foreground text-xs focus:ring-1 focus:ring-primary"
              >
                {dynamicPaperTypes && dynamicPaperTypes.length > 0 ? (
                  dynamicPaperTypes
                    .filter((pt) => pt.is_active !== false)
                    .map((pt) => (
                      <option key={pt.id} value={pt.name}>
                        {pt.name}
                      </option>
                    ))
                ) : (
                  <>
                    <option value="Standard 75 GSM">Standard 75 GSM</option>
                    <option value="Bond Paper">Bond Paper 85 GSM</option>
                    <option value="Glossy">Glossy Photo Paper</option>
                    <option value="Executive">Executive 100 GSM</option>
                  </>
                )}
              </select>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditModalOpen(false)}
              className="text-xs rounded-lg"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={savingEdit}
              onClick={handleSaveEditConfig}
              className="text-xs font-semibold bg-primary text-primary-foreground rounded-lg"
            >
              {savingEdit ? 'Saving...' : 'Save Configuration'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={clearAllPrintsOpen} onOpenChange={setClearAllPrintsOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md bg-card border-border rounded-xl font-sans">
          <DialogHeader>
            <DialogTitle className="text-base font-heading font-bold text-foreground">Clear All Prints?</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              This moves all active orders to Recent History without changing their print records, amounts, or page counts.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={clearingAllPrints}
              onClick={() => setClearAllPrintsOpen(false)}
              className="text-xs rounded-lg"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={clearingAllPrints}
              onClick={handleClearAllPrints}
              className="text-xs rounded-lg"
            >
              {clearingAllPrints ? 'Clearing...' : 'Clear All Prints'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* ---------------- 5. INSPECT DOCUMENT MODAL ---------------- */}
      <Dialog open={previewModalOpen} onOpenChange={setPreviewModalOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-xl bg-card border-border rounded-xl font-sans max-h-[90vh] overflow-y-auto">
          {selectedOrder && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 bg-primary/10 text-primary font-bold text-xs rounded border border-primary/30">
                      TOKEN #{selectedOrder.token_number}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">
                      {selectedOrder.order_number}
                    </span>
                  </div>
                  <Badge variant="outline" className="text-xs font-mono uppercase">
                    {selectedOrder.order_status}
                  </Badge>
                </div>
                <DialogTitle className="text-base font-bold text-foreground mt-2 truncate">
                  {selectedOrder.document_name}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground font-sans">
                  Customer: {selectedOrder.customer_name || selectedOrder.user_name || 'Walk-in User'} • ₹{selectedOrder.grand_total}
                </DialogDescription>
              </DialogHeader>

              {/* Configuration summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-muted/40 border border-border rounded-lg text-xs">
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase">Print Mode</span>
                  <strong className="text-foreground">{selectedOrder.config_print_type}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase">Sides</span>
                  <strong className="text-foreground">{selectedOrder.config_sides}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase">Paper</span>
                  <strong className="text-foreground">{selectedOrder.config_page_size}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase">Volume</span>
                  <strong className="text-primary font-mono">
                    {selectedOrder.total_pages}p × {selectedOrder.config_copies}c
                  </strong>
                </div>
              </div>

              {selectedOrder.notes && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-xs text-amber-700 dark:text-amber-300 rounded-lg">
                  <strong className="block text-[11px] uppercase">Customer Notes:</strong>
                  {selectedOrder.notes}
                </div>
              )}

              {/* Document Action */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-border">
                <span className="text-xs text-muted-foreground">
                  File type: <strong>{selectedOrder.file_type || 'PDF Document'}</strong>
                </span>

                <div className="flex items-center gap-2">
                  {selectedOrder.file_url && (
                    <a href={selectedOrder.file_url} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="h-8 text-xs rounded-lg gap-1.5">
                        <ExternalLink className="w-3.5 h-3.5 text-primary" />
                        <span>Open Document</span>
                      </Button>
                    </a>
                  )}
                  <Button
                    size="sm"
                    onClick={() => {
                      setPreviewModalOpen(false);
                      handleDirectPrint(selectedOrder);
                    }}
                    className="h-8 text-xs font-semibold bg-primary text-primary-foreground rounded-lg gap-1.5"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Directly</span>
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ---------------- 6. QZ TRAY CUSTOM PRINT PERMISSION POPUP (Item 16) ---------------- */}
      <QzPermissionModal />

      {/* ---------------- 7. PARTIAL PRINTING SUMMARY POPUP (Item 3) ---------------- */}
      <PartialPrintSummaryModal
        open={partialSummaryOpen}
        tokenNumber={summaryActiveOrder?.token_number}
        orderNumber={summaryActiveOrder?.order_number}
        printedSegments={summaryPrintedSegments}
        pendingSegments={summaryPendingSegments}
        onKeepOrder={() => {
          setPartialSummaryOpen(false);
          toast.info(`Order #${summaryActiveOrder?.token_number} retained in active queue with remaining unprinted pages.`);
          fetchOrders();
        }}
        onMarkCompleted={async () => {
          if (!summaryActiveOrder) return;
          if (summaryPendingSegments.length > 0) {
            toast.info('Print all pending segments before completing this order.');
            return;
          }
          try {
            await shopkeeperApi.updateOrderStatus(summaryActiveOrder.id, 'Completed');
            const completedAt = new Date().toISOString();
            const completedOrder = {
              ...summaryActiveOrder,
              order_status: 'Completed' as const,
              remaining_pages_info: [],
              completed_at: completedAt,
            };
            setOrders((prev) =>
              prev.map((o) =>
                o.id === summaryActiveOrder.id
                  ? completedOrder
                  : o
              )
            );
            setRecentHistoryOrders((prev) => [
              completedOrder,
              ...prev.filter((order) => order.id !== summaryActiveOrder.id),
            ]);
            setPartialSummaryOpen(false);
            toast.success(`Order #${summaryActiveOrder.token_number} marked as Completed and moved to Recent History.`);
            fetchOrders();
          } catch {
            toast.error('Failed to update order status');
          }
        }}
      />

      {/* ---------------- 8. MANUAL DUPLEX POPUP (Item 5) ---------------- */}
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
    </div>
  );
};

export default OrdersPage;
