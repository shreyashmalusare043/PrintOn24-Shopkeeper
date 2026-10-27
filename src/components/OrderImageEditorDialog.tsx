import { Crop, ImagePlus, Move, RotateCcw, RotateCw, Save } from 'lucide-react';
import type { PointerEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
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
import { Slider } from '@/components/ui/slider';
import { shopkeeperApi } from '@/services/shopkeeperApi';
import { supabase } from '@/services/supabase';
import type { PrintOrder } from '@/types/shopkeeper';

type Orientation = 'Portrait' | 'Landscape';
type EditMode = 'crop' | 'move';
type CropHandle = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

interface DragState {
  kind: 'draw-crop' | 'move-crop' | 'resize-crop' | 'move-image';
  pointerX: number;
  pointerY: number;
  cropLeft: number;
  cropTop: number;
  cropWidth: number;
  cropHeight: number;
  positionX: number;
  positionY: number;
  handle?: CropHandle;
}

interface ImageEditSettings {
  rotation: number;
  brightness: number;
  contrast: number;
  cropLeft: number;
  cropTop: number;
  cropWidth: number;
  cropHeight: number;
  imageWidth: number;
  positionX: number;
  positionY: number;
  pageSize: string;
  orientation: Orientation;
}

interface EditableDocument {
  id: string;
  file_name: string;
  file_type: string;
  file_url: string;
  total_pages: number;
  print_config?: Record<string, unknown>;
}

interface ImageRecord {
  id: string;
  file_name: string;
  file_type: string | null;
  mime_type: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  preview_url: string | null;
  print_config: Record<string, unknown> | null;
  image_editing: Record<string, unknown> | null;
}

interface OrderImageEditorDialogProps {
  open: boolean;
  order: PrintOrder | null;
  initialDocumentId?: string;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

const pageSizes: Record<string, { width: number; height: number }> = {
  A3: { width: 297, height: 420 },
  A4: { width: 210, height: 297 },
  A5: { width: 148, height: 210 },
  Letter: { width: 215.9, height: 279.4 },
  Legal: { width: 215.9, height: 355.6 },
  Tabloid: { width: 279.4, height: 431.8 },
};

const defaultEdits: ImageEditSettings = {
  rotation: 0,
  brightness: 100,
  contrast: 100,
  cropLeft: 0,
  cropTop: 0,
  cropWidth: 100,
  cropHeight: 100,
  imageWidth: 82,
  positionX: 50,
  positionY: 50,
  pageSize: 'A4',
  orientation: 'Portrait',
};

function isImageDocument(document: Pick<EditableDocument, 'file_type' | 'file_name' | 'file_url'>): boolean {
  return (
    document.file_type.toLowerCase().startsWith('image/') ||
    /\.(jpe?g|png|webp|bmp|gif|tiff?)(?:$|[?#])/i.test(document.file_url || '') ||
    /\.(jpe?g|png|webp|bmp|gif|tiff?)$/i.test(document.file_name)
  );
}

function normalizeOrientation(value: unknown): Orientation {
  return String(value || '').toLowerCase().startsWith('landscape') ? 'Landscape' : 'Portrait';
}

function normalizeEdits(value: unknown, document?: EditableDocument): ImageEditSettings {
  const saved = value && typeof value === 'object' ? (value as Partial<ImageEditSettings>) : {};
  const config = document?.print_config || {};
  const pageSize = String(saved.pageSize || config.pageSize || config.page_size || 'A4');
  return {
    rotation: Number.isFinite(saved.rotation) ? Number(saved.rotation) % 360 : 0,
    brightness: Number.isFinite(saved.brightness) ? Number(saved.brightness) : 100,
    contrast: Number.isFinite(saved.contrast) ? Number(saved.contrast) : 100,
    cropLeft: Number.isFinite(saved.cropLeft) ? Number(saved.cropLeft) : 0,
    cropTop: Number.isFinite(saved.cropTop) ? Number(saved.cropTop) : 0,
    cropWidth: Number.isFinite(saved.cropWidth) ? Number(saved.cropWidth) : 100,
    cropHeight: Number.isFinite(saved.cropHeight) ? Number(saved.cropHeight) : 100,
    imageWidth: Number.isFinite(saved.imageWidth) ? Number(saved.imageWidth) : 82,
    positionX: Number.isFinite(saved.positionX) ? Number(saved.positionX) : 50,
    positionY: Number.isFinite(saved.positionY) ? Number(saved.positionY) : 50,
    pageSize,
    orientation: normalizeOrientation(saved.orientation || config.orientation || config.layout),
  };
}

function getOrientedDimensions(image: HTMLImageElement, orientation: number) {
  return orientation % 180 === 0
    ? { width: image.naturalWidth, height: image.naturalHeight }
    : { width: image.naturalHeight, height: image.naturalWidth };
}

function getPageCrop(sourceAspect: number, pageAspect: number) {
  const cropRatio = pageAspect / sourceAspect;
  const width = cropRatio >= 1 ? 100 : cropRatio * 100;
  const height = cropRatio >= 1 ? 100 / cropRatio : 100;
  return {
    cropLeft: (100 - width) / 2,
    cropTop: (100 - height) / 2,
    cropWidth: width,
    cropHeight: height,
  };
}

function drawRotatedImage(image: HTMLImageElement, edits: ImageEditSettings): HTMLCanvasElement {
  const { width, height } = getOrientedDimensions(image, edits.rotation);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Your browser could not prepare the edited image.');
  context.filter = `brightness(${edits.brightness}%) contrast(${edits.contrast}%)`;
  context.translate(width / 2, height / 2);
  context.rotate((edits.rotation * Math.PI) / 180);
  context.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
  context.filter = 'none';
  return canvas;
}

function renderPreviewImage(image: HTMLImageElement, edits: ImageEditSettings): Promise<Blob> {
  const { width, height } = getOrientedDimensions(image, edits.rotation);
  const scale = Math.min(1, 1200 / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext('2d');
  if (!context) return Promise.reject(new Error('Your browser could not prepare the image preview.'));
  context.filter = `brightness(${edits.brightness}%) contrast(${edits.contrast}%)`;
  context.translate(canvas.width / 2, canvas.height / 2);
  context.scale(scale, scale);
  context.rotate((edits.rotation * Math.PI) / 180);
  context.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('The image preview could not be rendered.'));
    }, 'image/jpeg', 0.92);
  });
}

function renderPageImage(image: HTMLImageElement, edits: ImageEditSettings): Promise<Blob> {
  const rotated = drawRotatedImage(image, edits);
  const cropX = Math.max(0, Math.round((edits.cropLeft / 100) * rotated.width));
  const cropY = Math.max(0, Math.round((edits.cropTop / 100) * rotated.height));
  const cropWidth = Math.max(1, Math.min(rotated.width - cropX, Math.round((edits.cropWidth / 100) * rotated.width)));
  const cropHeight = Math.max(1, Math.min(rotated.height - cropY, Math.round((edits.cropHeight / 100) * rotated.height)));
  const page = pageSizes[edits.pageSize] || pageSizes.A4;
  const pageWidthMm = edits.orientation === 'Landscape' ? page.height : page.width;
  const pageHeightMm = edits.orientation === 'Landscape' ? page.width : page.height;
  const dpi = 300;
  const pixelScale = Math.min(
    1,
    Math.sqrt(12_000_000 / ((pageWidthMm * dpi / 25.4) * (pageHeightMm * dpi / 25.4)))
  );
  const canvas = document.createElement('canvas');
  canvas.width = Math.round((pageWidthMm * dpi / 25.4) * pixelScale);
  canvas.height = Math.round((pageHeightMm * dpi / 25.4) * pixelScale);
  const context = canvas.getContext('2d');
  if (!context) return Promise.reject(new Error('Your browser could not prepare the print page.'));
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);

  const cropAspect = cropWidth / cropHeight;
  const targetWidth = canvas.width * Math.min(100, Math.max(10, edits.imageWidth)) / 100;
  const targetHeight = targetWidth / cropAspect;
  const maxHeight = canvas.height * 0.96;
  const scale = Math.min(1, maxHeight / targetHeight);
  const drawWidth = targetWidth * scale;
  const drawHeight = targetHeight * scale;
  const centerX = (Math.min(100, Math.max(0, edits.positionX)) / 100) * canvas.width;
  const centerY = (Math.min(100, Math.max(0, edits.positionY)) / 100) * canvas.height;
  context.drawImage(
    rotated,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    centerX - drawWidth / 2,
    centerY - drawHeight / 2,
    drawWidth,
    drawHeight
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('The edited print page could not be exported.'));
    }, 'image/png');
  });
}

async function loadImage(blob: Blob): Promise<{ image: HTMLImageElement; url: string }> {
  const url = URL.createObjectURL(blob);
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
    return { image, url };
  } catch {
    URL.revokeObjectURL(url);
    throw new Error('The selected image could not be opened.');
  }
}

export function OrderImageEditorDialog({
  open,
  order,
  initialDocumentId,
  onOpenChange,
  onSaved,
}: OrderImageEditorDialogProps) {
  const [documents, setDocuments] = useState<EditableDocument[]>([]);
  const [records, setRecords] = useState<Map<string, ImageRecord>>(new Map());
  const [selectedDocumentId, setSelectedDocumentId] = useState('');
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [edits, setEdits] = useState<ImageEditSettings>({ ...defaultEdits });
  const [editMode, setEditMode] = useState<EditMode>('crop');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [drag, setDrag] = useState<DragState | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const imageUrlRef = useRef('');
  const previewUrlRef = useRef('');

  const imageDocuments = useMemo(() => documents.filter(isImageDocument), [documents]);
  const selectedDocument = imageDocuments.find((document) => document.id === selectedDocumentId) || null;
  const selectedRecord = selectedDocument ? records.get(selectedDocument.id) : undefined;
  const paper = pageSizes[edits.pageSize] || pageSizes.A4;
  const pageAspect = edits.orientation === 'Landscape' ? paper.height / paper.width : paper.width / paper.height;

  useEffect(() => {
    if (!open || !order?.shop_id) return;
    let active = true;
    setLoading(true);
    setDocuments([]);
    setRecords(new Map());
    setSelectedDocumentId('');

    shopkeeperApi.getOrderForPreview(order.id, order.shop_id).then(async (previewData) => {
      if (!active) return;
      if (!previewData) throw new Error('Unable to load documents for this order.');
      const { data: rows, error } = await supabase
        .from('uploaded_documents')
        .select('id, file_name, file_type, mime_type, storage_bucket, storage_path, preview_url, print_config, image_editing')
        .eq('shop_id', order.shop_id)
        .in('id', previewData.documents.map((document) => document.id));
      if (error) throw error;

      const recordMap = new Map<string, ImageRecord>(
        ((rows || []) as ImageRecord[]).map((record) => [record.id, record])
      );
      const docs = previewData.documents.map((document) => {
        const record = recordMap.get(document.id);
        const savedUrl = record?.image_editing?.edited_preview_url;
        return {
          ...document,
          file_type: record?.mime_type || record?.file_type || document.file_type || '',
          file_url: (typeof savedUrl === 'string' ? savedUrl : '') || document.file_url,
          print_config: record?.print_config || document.print_config || {},
        };
      });
      if (!active) return;
      setDocuments(docs);
      setRecords(recordMap);
      const firstImage = docs.find((document) => document.id === initialDocumentId && isImageDocument(document))
        || docs.find(isImageDocument);
      setSelectedDocumentId(firstImage?.id || '');
    }).catch((error: unknown) => {
      if (active) toast.error(error instanceof Error ? error.message : 'Unable to load order images.');
    }).finally(() => {
      if (active) setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [open, order?.id, order?.shop_id, initialDocumentId]);

  useEffect(() => {
    let active = true;
    setSourceImage(null);
    setEdits({ ...defaultEdits });
    if (imageUrlRef.current) {
      URL.revokeObjectURL(imageUrlRef.current);
      imageUrlRef.current = '';
    }

    const load = async () => {
      if (!selectedDocument || !selectedRecord) return;
      const saved = selectedRecord.image_editing || {};
      const sourcePath =
        (typeof saved.original_storage_path === 'string' && saved.original_storage_path) ||
        selectedRecord.storage_path;
      const bucket = selectedRecord.storage_bucket || 'print_documents';
      let blob: Blob;
      if (sourcePath) {
        const { data, error } = await supabase.storage.from(bucket).download(sourcePath);
        if (error) throw error;
        blob = data;
      } else {
        const response = await fetch(selectedRecord.preview_url || selectedDocument.file_url);
        if (!response.ok) throw new Error('The uploaded image could not be downloaded.');
        blob = await response.blob();
      }

      const loaded = await loadImage(blob);
      if (!active) {
        URL.revokeObjectURL(loaded.url);
        return;
      }
      imageUrlRef.current = loaded.url;
      setSourceImage(loaded.image);
      const normalizedEdits = normalizeEdits(saved.edits, selectedDocument);
      if (saved.edits && typeof saved.edits === 'object') {
        setEdits(normalizedEdits);
      } else {
        const dimensions = getOrientedDimensions(loaded.image, normalizedEdits.rotation);
        const page = pageSizes[normalizedEdits.pageSize] || pageSizes.A4;
        const pageAspect = normalizedEdits.orientation === 'Landscape'
          ? page.height / page.width
          : page.width / page.height;
        setEdits({
          ...normalizedEdits,
          ...getPageCrop(dimensions.width / dimensions.height, pageAspect),
        });
      }
    };

    if (!selectedDocument || !selectedRecord) {
      return () => {
        active = false;
      };
    }
    load().catch((error: unknown) => {
      if (active) toast.error(error instanceof Error ? error.message : 'Unable to open the uploaded image.');
    });
    return () => {
      active = false;
    };
  }, [selectedDocumentId, selectedRecord, selectedDocument]);

  useEffect(() => {
    let active = true;
    if (!sourceImage) {
      setPreviewUrl('');
      return () => {
        active = false;
      };
    }

    renderPreviewImage(sourceImage, edits).then((blob) => {
      if (!active) return;
      const nextUrl = URL.createObjectURL(blob);
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = nextUrl;
      setPreviewUrl(nextUrl);
    }).catch((error: unknown) => {
      if (active) toast.error(error instanceof Error ? error.message : 'Unable to render the image preview.');
    });

    return () => {
      active = false;
    };
  }, [sourceImage, edits.rotation, edits.brightness, edits.contrast]);

  useEffect(() => {
    return () => {
      if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current);
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  const updateCrop = (left: number, top: number, width: number, height: number) => {
    const cropRatio = pageAspect / sourceAspect;
    let cropWidth = Math.max(2, Math.min(100, width));
    let cropHeight = Math.max(2, Math.min(100, height));
    if (cropWidth / cropHeight > cropRatio) {
      cropWidth = cropHeight * cropRatio;
    } else {
      cropHeight = cropWidth / cropRatio;
    }
    cropWidth = Math.min(cropWidth, 100 - left);
    cropHeight = Math.min(cropHeight, 100 - top);
    setEdits((current) => ({
      ...current,
      cropLeft: Math.max(0, Math.min(100 - cropWidth, left)),
      cropTop: Math.max(0, Math.min(100 - cropHeight, top)),
      cropWidth,
      cropHeight,
    }));
  };

  const pointOnImage = (clientX: number, clientY: number) => {
    const bounds = imageRef.current?.getBoundingClientRect();
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return null;
    return {
      x: Math.min(100, Math.max(0, ((clientX - bounds.left) / bounds.width) * 100)),
      y: Math.min(100, Math.max(0, ((clientY - bounds.top) / bounds.height) * 100)),
    };
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (editMode === 'crop') {
      const bounds = imageRef.current?.getBoundingClientRect();
      const target = event.target instanceof Element ? event.target : null;
      const handle = target?.closest<HTMLElement>('[data-crop-handle]')?.dataset.cropHandle as CropHandle | undefined;
      if (!bounds) return;
      const outsideImage =
        event.clientX < bounds.left ||
        event.clientX > bounds.right ||
        event.clientY < bounds.top ||
        event.clientY > bounds.bottom;
      if (outsideImage && !handle) return;
      const point = pointOnImage(event.clientX, event.clientY);
      if (!point) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      const insideCrop =
        point.x >= edits.cropLeft &&
        point.x <= edits.cropLeft + edits.cropWidth &&
        point.y >= edits.cropTop &&
        point.y <= edits.cropTop + edits.cropHeight;
      const fullImageSelected =
        edits.cropLeft <= 0 &&
        edits.cropTop <= 0 &&
        edits.cropWidth >= 100 &&
        edits.cropHeight >= 100;
      const drawNewCrop = !handle && (!insideCrop || fullImageSelected);
      setDrag({
        kind: handle ? 'resize-crop' : drawNewCrop ? 'draw-crop' : 'move-crop',
        pointerX: point.x,
        pointerY: point.y,
        cropLeft: edits.cropLeft,
        cropTop: edits.cropTop,
        cropWidth: edits.cropWidth,
        cropHeight: edits.cropHeight,
        positionX: edits.positionX,
        positionY: edits.positionY,
        handle,
      });
      if (drawNewCrop) updateCrop(point.x, point.y, 2, 2);
      return;
    }
    const target = event.target instanceof Element ? event.target : null;
    if (!target?.closest('[data-image-viewport]')) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({
      kind: 'move-image',
      pointerX: event.clientX,
      pointerY: event.clientY,
      cropLeft: edits.cropLeft,
      cropTop: edits.cropTop,
      cropWidth: edits.cropWidth,
      cropHeight: edits.cropHeight,
      positionX: edits.positionX,
      positionY: edits.positionY,
    });
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag || !pageRef.current) return;
    if (drag.kind !== 'move-image') {
      const point = pointOnImage(event.clientX, event.clientY);
      if (!point) return;
      const deltaX = point.x - drag.pointerX;
      const deltaY = point.y - drag.pointerY;
      if (drag.kind === 'draw-crop') {
        const cropAspectRatio = pageAspect / sourceAspect;
        const availableWidth = point.x >= drag.pointerX ? 100 - drag.pointerX : drag.pointerX;
        const availableHeight = point.y >= drag.pointerY ? 100 - drag.pointerY : drag.pointerY;
        const rawWidth = Math.abs(deltaX);
        const rawHeight = Math.abs(deltaY);
        const widthFromHeight = rawHeight * cropAspectRatio;
        const width = Math.max(
          2,
          Math.min(
            rawWidth >= widthFromHeight ? rawWidth : widthFromHeight,
            availableWidth,
            availableHeight * cropAspectRatio,
          ),
        );
        const height = width / cropAspectRatio;
        updateCrop(
          point.x >= drag.pointerX ? drag.pointerX : drag.pointerX - width,
          point.y >= drag.pointerY ? drag.pointerY : drag.pointerY - height,
          width,
          height,
        );
      } else if (drag.kind === 'move-crop') {
        updateCrop(
          Math.max(0, Math.min(100 - drag.cropWidth, drag.cropLeft + deltaX)),
          Math.max(0, Math.min(100 - drag.cropHeight, drag.cropTop + deltaY)),
          drag.cropWidth,
          drag.cropHeight,
        );
      } else if (drag.kind === 'resize-crop' && drag.handle) {
        const cropAspectRatio = pageAspect / sourceAspect;
        let left = drag.cropLeft;
        let top = drag.cropTop;
        let right = drag.cropLeft + drag.cropWidth;
        let bottom = drag.cropTop + drag.cropHeight;
        const west = drag.handle.includes('w');
        const east = drag.handle.includes('e');
        const north = drag.handle.includes('n');
        const south = drag.handle.includes('s');

        if ((west || east) && (north || south)) {
          const anchorX = west ? right : left;
          const anchorY = north ? bottom : top;
          const availableWidth = west ? anchorX : 100 - anchorX;
          const availableHeight = north ? anchorY : 100 - anchorY;
          const rawWidth = Math.abs(point.x - anchorX);
          const rawHeight = Math.abs(point.y - anchorY);
          const width = Math.max(
            2,
            Math.min(
              Math.max(rawWidth, rawHeight * cropAspectRatio),
              availableWidth,
              availableHeight * cropAspectRatio,
            ),
          );
          const height = width / cropAspectRatio;
          left = west ? anchorX - width : anchorX;
          right = west ? anchorX : anchorX + width;
          top = north ? anchorY - height : anchorY;
          bottom = north ? anchorY : anchorY + height;
        } else if (west || east) {
          const anchorX = west ? right : left;
          const centerY = (top + bottom) / 2;
          const availableWidth = west ? anchorX : 100 - anchorX;
          const width = Math.max(2, Math.min(Math.abs(point.x - anchorX), availableWidth, centerY * 2 * cropAspectRatio, (100 - centerY) * 2 * cropAspectRatio));
          const height = width / cropAspectRatio;
          left = west ? anchorX - width : anchorX;
          right = west ? anchorX : anchorX + width;
          top = centerY - height / 2;
          bottom = centerY + height / 2;
        } else if (north || south) {
          const anchorY = north ? bottom : top;
          const centerX = (left + right) / 2;
          const availableHeight = north ? anchorY : 100 - anchorY;
          const height = Math.max(2, Math.min(Math.abs(point.y - anchorY), availableHeight, centerX * 2 / cropAspectRatio, (100 - centerX) * 2 / cropAspectRatio));
          const width = height * cropAspectRatio;
          left = centerX - width / 2;
          right = centerX + width / 2;
          top = north ? anchorY - height : anchorY;
          bottom = north ? anchorY : anchorY + height;
        }
        updateCrop(left, top, right - left, bottom - top);
      }
      return;
    }

    const pageBounds = pageRef.current.getBoundingClientRect();
    const positionX = drag.positionX + ((event.clientX - drag.pointerX) / pageBounds.width) * 100;
    const positionY = drag.positionY + ((event.clientY - drag.pointerY) / pageBounds.height) * 100;
    setEdits((current) => ({
      ...current,
      positionX: Math.min(100 - displayCropWidth / 2, Math.max(displayCropWidth / 2, positionX)),
      positionY: Math.min(100 - displayCropHeight / 2, Math.max(displayCropHeight / 2, positionY)),
    }));
  };

  const handlePointerUp = () => {
    if (drag?.kind === 'draw-crop' && (edits.cropWidth < 2 || edits.cropHeight < 2)) {
      updateCrop(0, 0, 100, 100);
    }
    setDrag(null);
  };

  const handleRotate = (degrees: number) => {
    setEdits((current) => ({
      ...current,
      rotation: (current.rotation + degrees + 360) % 360,
      ...getPageCrop(
        sourceImage
          ? getOrientedDimensions(sourceImage, (current.rotation + degrees + 360) % 360).width /
              getOrientedDimensions(sourceImage, (current.rotation + degrees + 360) % 360).height
          : sourceAspect,
        pageAspect,
      ),
    }));
  };

  const saveEdits = async () => {
    if (!order || !selectedDocument || !selectedRecord || !sourceImage) return;
    setSaving(true);
    let uploadedPath = '';
    try {
      const blob = await renderPageImage(sourceImage, edits);
      const bucket = selectedRecord.storage_bucket || 'print_documents';
      uploadedPath = `${order.shop_id}/${order.id}/edited/${selectedDocument.id}-${Date.now()}.png`;
      const { error: uploadError } = await supabase.storage.from(bucket).upload(uploadedPath, blob, {
        contentType: 'image/png',
        upsert: false,
      });
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(uploadedPath);
      const previousEditing = selectedRecord.image_editing || {};
      const originalStoragePath =
        typeof previousEditing.original_storage_path === 'string'
          ? previousEditing.original_storage_path
          : selectedRecord.storage_path;
      const imageEditing = {
        ...previousEditing,
        original_storage_path: originalStoragePath,
        edited_storage_path: uploadedPath,
        edited_preview_url: publicUrlData.publicUrl,
        edits: { ...edits },
        edited_at: new Date().toISOString(),
      };
      const printConfig = {
        ...(selectedRecord.print_config || selectedDocument.print_config || {}),
        pageSize: edits.pageSize,
        page_size: edits.pageSize,
        orientation: edits.orientation,
        layout: edits.orientation,
      };
      const { error: updateError } = await supabase
        .from('uploaded_documents')
        .update({ image_editing: imageEditing, print_config: printConfig })
        .eq('id', selectedDocument.id)
        .eq('shop_id', order.shop_id);
      if (updateError) throw updateError;

      setRecords((current) => new Map(current).set(selectedDocument.id, {
        ...selectedRecord,
        image_editing: imageEditing,
        print_config: printConfig,
      }));
      setDocuments((current) => current.map((document) =>
        document.id === selectedDocument.id
          ? { ...document, file_url: publicUrlData.publicUrl, print_config: printConfig }
          : document
      ));
      toast.success('Edited image saved. This page-sized image will be used when printing the order.');
      onSaved?.();
    } catch (error) {
      if (uploadedPath && selectedRecord.storage_bucket) {
        await supabase.storage.from(selectedRecord.storage_bucket).remove([uploadedPath]);
      }
      toast.error(error instanceof Error ? error.message : 'Unable to save the edited image.');
    } finally {
      setSaving(false);
    }
  };

  const cropStyle = {
    left: `${edits.cropLeft}%`,
    top: `${edits.cropTop}%`,
    width: `${edits.cropWidth}%`,
    height: `${edits.cropHeight}%`,
  };
  const orientedDimensions = sourceImage ? getOrientedDimensions(sourceImage, edits.rotation) : null;
  const sourceAspect = orientedDimensions ? orientedDimensions.width / orientedDimensions.height : 1;
  const cropAspect = sourceAspect * (edits.cropWidth / edits.cropHeight);
  const displayCropWidth = Math.min(edits.imageWidth, 90, (90 * cropAspect) / pageAspect);
  const displayCropHeight = (displayCropWidth * pageAspect / cropAspect) * 100;
  const displayImageWidth = Math.min(edits.imageWidth, 90, (90 * sourceAspect) / pageAspect);
  const displayImageHeight = (displayImageWidth * pageAspect / sourceAspect) * 100;
  const imageLeft = edits.positionX - displayImageWidth / 2;
  const imageTop = edits.positionY - displayImageHeight / 2;
  const cropHandles: Array<{ name: CropHandle; left: string; top: string; cursor: string }> = [
    { name: 'nw', left: '0%', top: '0%', cursor: 'nwse-resize' },
    { name: 'n', left: '50%', top: '0%', cursor: 'ns-resize' },
    { name: 'ne', left: '100%', top: '0%', cursor: 'nesw-resize' },
    { name: 'e', left: '100%', top: '50%', cursor: 'ew-resize' },
    { name: 'se', left: '100%', top: '100%', cursor: 'nwse-resize' },
    { name: 's', left: '50%', top: '100%', cursor: 'ns-resize' },
    { name: 'sw', left: '0%', top: '100%', cursor: 'nesw-resize' },
    { name: 'w', left: '0%', top: '50%', cursor: 'ew-resize' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[95dvh] max-h-[95dvh] max-w-[calc(100%-1rem)] flex-col overflow-hidden rounded-xl border-border bg-card md:max-w-6xl">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <ImagePlus className="h-5 w-5 text-primary" />
            Edit uploaded image for print
          </DialogTitle>
          <DialogDescription>
            Choose the page and orientation, drag on the image to crop, or move the image on the page. Saved changes are printed.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Loading order images...</div>
        ) : imageDocuments.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            This order does not contain any uploaded image files.
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] gap-4 overflow-hidden md:grid-cols-[minmax(0,1.5fr)_minmax(260px,0.8fr)]">
            <section className="flex min-h-0 flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={editMode === 'crop' ? 'default' : 'outline'}
                    onClick={() => {
                      setEditMode('crop');
                      setDrag(null);
                    }}
                  >
                    <Crop className="mr-1.5 h-4 w-4" /> Manual crop
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={editMode === 'move' ? 'default' : 'outline'}
                    onClick={() => {
                      setEditMode('move');
                      setDrag(null);
                    }}
                  >
                    <Move className="mr-1.5 h-4 w-4" /> Move image
                  </Button>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => updateCrop(
                    getPageCrop(sourceAspect, pageAspect).cropLeft,
                    getPageCrop(sourceAspect, pageAspect).cropTop,
                    getPageCrop(sourceAspect, pageAspect).cropWidth,
                    getPageCrop(sourceAspect, pageAspect).cropHeight,
                  )}
                >
                  Reset crop
                </Button>
              </div>

              <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-muted/50 p-2">
                <div className="flex h-full min-h-0 min-w-0 items-center justify-center">
                  <div
                    ref={pageRef}
                    className="relative h-full w-auto max-w-full overflow-hidden bg-white shadow-xl"
                    style={{
                      aspectRatio: `${pageAspect}`,
                    }}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    onLostPointerCapture={handlePointerUp}
                  >
                    <div className="pointer-events-none absolute inset-0 z-10 opacity-25">
                      <div className="grid h-full w-full grid-cols-3 grid-rows-3">
                        {Array.from({ length: 9 }, (_, index) => (
                          <div key={index} className="border border-dashed border-blue-600" />
                        ))}
                      </div>
                    </div>
                    {sourceImage && editMode === 'crop' && (
                      <div
                        ref={imageRef}
                        className="absolute"
                        style={{
                          width: `${displayImageWidth}%`,
                          height: `${displayImageHeight}%`,
                          left: `${imageLeft}%`,
                          top: `${imageTop}%`,
                          cursor: 'crosshair',
                        }}
                      >
                        <img
                          src={previewUrl || imageUrlRef.current}
                          alt={selectedDocument?.file_name || 'Image preview'}
                          draggable={false}
                          className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain"
                        />
                        <div className="pointer-events-none absolute inset-x-0 top-0 bg-black/45" style={{ height: `${edits.cropTop}%` }} />
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/45" style={{ height: `${100 - edits.cropTop - edits.cropHeight}%` }} />
                        <div className="pointer-events-none absolute left-0 bg-black/45" style={{ top: `${edits.cropTop}%`, width: `${edits.cropLeft}%`, height: `${edits.cropHeight}%` }} />
                        <div className="pointer-events-none absolute right-0 bg-black/45" style={{ top: `${edits.cropTop}%`, width: `${100 - edits.cropLeft - edits.cropWidth}%`, height: `${edits.cropHeight}%` }} />
                        <div
                          className="absolute touch-none border-2 border-blue-600 bg-blue-400/10"
                          style={cropStyle}
                        >
                          <div className="pointer-events-none grid h-full w-full grid-cols-3 grid-rows-3 opacity-70">
                            {Array.from({ length: 9 }, (_, index) => (
                              <div key={index} className="border border-dashed border-blue-700" />
                            ))}
                          </div>
                          {cropHandles.map((handle) => (
                            <button
                              type="button"
                              key={handle.name}
                              data-crop-handle={handle.name}
                              aria-label={`Resize crop ${handle.name}`}
                              className="absolute z-30 h-6 w-6 -translate-x-1/2 -translate-y-1/2 touch-none rounded-full border-2 border-white bg-blue-600 p-0 shadow-md"
                              style={{ left: handle.left, top: handle.top, cursor: handle.cursor, touchAction: 'none' }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                    {sourceImage && editMode === 'move' && (
                      <div
                        data-image-viewport="true"
                        className="absolute overflow-hidden"
                        style={{
                          width: `${displayCropWidth}%`,
                          height: `${displayCropHeight}%`,
                          left: `${edits.positionX}%`,
                          top: `${edits.positionY}%`,
                          transform: 'translate(-50%, -50%)',
                          cursor: 'move',
                          touchAction: 'none',
                        }}
                      >
                        <div
                          className="absolute"
                          style={{
                            width: `${10000 / edits.cropWidth}%`,
                            left: `${(-edits.cropLeft / edits.cropWidth) * 100}%`,
                            top: `${(-edits.cropTop / edits.cropHeight) * 100}%`,
                            aspectRatio: `${sourceAspect}`,
                          }}
                        >
                          <img
                            src={previewUrl || imageUrlRef.current}
                            alt={selectedDocument?.file_name || 'Image preview'}
                            draggable={false}
                            className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <section className="min-h-0 space-y-3 overflow-y-auto">
              <div className="space-y-1.5">
                <Label htmlFor="order-image-select">Image file</Label>
                <select
                  id="order-image-select"
                  value={selectedDocumentId}
                  onChange={(event) => setSelectedDocumentId(event.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  {imageDocuments.map((document) => (
                    <option key={document.id} value={document.id}>{document.file_name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="image-page-size">Page size</Label>
                  <select
                    id="image-page-size"
                    value={edits.pageSize}
                    onChange={(event) => setEdits((current) => ({ ...current, pageSize: event.target.value }))}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  >
                    {Object.keys(pageSizes).map((size) => <option key={size}>{size}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="image-orientation">Orientation</Label>
                  <select
                    id="image-orientation"
                    value={edits.orientation}
                    onChange={(event) =>
                      setEdits((current) => ({ ...current, orientation: normalizeOrientation(event.target.value) }))
                    }
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  >
                    <option>Portrait</option>
                    <option>Landscape</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => handleRotate(-90)}>
                  <RotateCcw className="mr-2 h-4 w-4" /> Rotate left
                </Button>
                <Button type="button" variant="outline" className="flex-1" onClick={() => handleRotate(90)}>
                  <RotateCw className="mr-2 h-4 w-4" /> Rotate right
                </Button>
              </div>

              {([
                ['brightness', 'Brightness', 30, 170],
                ['contrast', 'Contrast', 30, 170],
                ['imageWidth', 'Image size on page', 10, 90],
              ] as const).map(([key, label, min, max]) => (
                <div key={key} className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <Label>{label}</Label>
                    <span className="text-muted-foreground">{edits[key]}%</span>
                  </div>
                  <Slider
                    value={[edits[key]]}
                    min={min}
                    max={max}
                    step={1}
                    onValueChange={([value]) => setEdits((current) => ({ ...current, [key]: value }))}
                  />
                </div>
              ))}

              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setEdits(normalizeEdits(null, selectedDocument || undefined))}
              >
                Reset image adjustments
              </Button>
            </section>
          </div>
        )}

        <DialogFooter className="shrink-0 border-t border-border pt-3">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button
            type="button"
            onClick={saveEdits}
            disabled={loading || saving || !selectedDocument || !sourceImage}
          >
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Saving...' : 'Save edited print page'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
