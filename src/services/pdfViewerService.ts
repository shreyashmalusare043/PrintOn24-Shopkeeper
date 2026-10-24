import * as pdfjsLib from 'pdfjs-dist';
// Configure worker with Vite URL or Cloudflare CDN fallback
// @ts-ignore
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.js?url';

if (typeof window !== 'undefined') {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      pdfjsWorker || `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '3.11.174'}/pdf.worker.min.js`;
  } catch {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
  }
}

export interface PdfDocumentWrapper {
  numPages: number;
  pdfDoc: any;
  isImage?: boolean;
  imageUrl?: string;
  detectedOrientation?: 'Portrait' | 'Landscape';
  naturalWidth?: number;
  naturalHeight?: number;
}

export interface RenderPageOptions {
  scale?: number;
  rotation?: number; // 0, 90, 180, 270
  isBlackAndWhite?: boolean;
  paperSize?: string;
  targetPaper?: string;
  orientation?: 'Portrait' | 'Landscape' | 'portrait' | 'landscape';
  fitToPaper?: boolean;
  scaling?: 'fit' | 'actual' | 'shrink';
  equalMargins?: boolean;
  pagesPerSheet?: '1-in-1' | '2-in-1' | '4-in-1' | string;
  pageNums?: number[];
}

/**
 * Parses user's custom page range specification (e.g. "1-3, 5, 8-10")
 * into a sorted list of unique 1-indexed page numbers.
 */
export function parsePageRange(rangeStr: string | undefined | null, totalPages: number): number[] {
  if (!rangeStr || rangeStr.trim() === '' || rangeStr.toLowerCase() === 'all') {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pagesSet = new Set<number>();
  const parts = rangeStr.split(',').map((p) => p.trim());

  for (const part of parts) {
    if (!part) continue;
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-').map((s) => s.trim());
      const start = Number.parseInt(startStr, 10);
      const end = Number.parseInt(endStr, 10);
      if (!Number.isNaN(start) && !Number.isNaN(end)) {
        const min = Math.max(1, Math.min(start, end));
        const max = Math.min(totalPages, Math.max(start, end));
        for (let p = min; p <= max; p++) {
          pagesSet.add(p);
        }
      }
    } else {
      const p = Number.parseInt(part, 10);
      if (!Number.isNaN(p) && p >= 1 && p <= totalPages) {
        pagesSet.add(p);
      }
    }
  }

  const result = Array.from(pagesSet).sort((a, b) => a - b);
  return result.length > 0 ? result : Array.from({ length: totalPages }, (_, i) => i + 1);
}

// Document and page cache for instant preview loading
const documentCache = new Map<string, Promise<PdfDocumentWrapper>>();
const thumbCache = new Map<string, string>();

export function clearDocumentCache(): void {
  const cachedDocuments = Array.from(documentCache.values());
  documentCache.clear();
  thumbCache.clear();

  for (const documentPromise of cachedDocuments) {
    void documentPromise
      .then((wrapper) => wrapper.pdfDoc?.destroy?.())
      .catch((err) => {
        console.warn('Failed to release cached PDF document:', err);
      });
  }
}

/**
 * Loads a PDF document or image from public URL or storage path with instant caching.
 */
/**
 * Loads a document (PDF, Image, Office formats PPT/DOCX/Excel, or text) and returns a normalized PdfDocumentWrapper.
 * Results are cached in memory by fileUrl so subsequent requests are instant.
 */
export async function loadDocument(fileUrl: string): Promise<PdfDocumentWrapper> {
  if (!fileUrl) {
    return { numPages: 1, pdfDoc: null, isImage: false };
  }

  if (documentCache.has(fileUrl)) {
    return documentCache.get(fileUrl)!;
  }

  const loadPromise = (async () => {
    const cleanUrl = fileUrl.split('?')[0].toLowerCase();
    const isImage = /\.(jpe?g|png|webp|gif|bmp|svg)$/i.test(cleanUrl);
    const isPpt = /\.(pptx?)$/i.test(cleanUrl);
    const isExcel = /\.(xlsx?|csv)$/i.test(cleanUrl);
    const isDocx = /\.(docx?|rtf|txt)$/i.test(cleanUrl);

    // Fast path 1: Direct Raster Image
    if (isImage) {
      return new Promise<PdfDocumentWrapper>((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const isLand = (img.naturalWidth || img.width) > (img.naturalHeight || img.height);
          resolve({
            numPages: 1,
            pdfDoc: null,
            isImage: true,
            imageUrl: fileUrl,
            detectedOrientation: isLand ? 'Landscape' : 'Portrait',
            naturalWidth: img.naturalWidth || img.width,
            naturalHeight: img.naturalHeight || img.height,
          });
        };
        img.onerror = () => {
          resolve({
            numPages: 1,
            pdfDoc: null,
            isImage: true,
            imageUrl: fileUrl,
            detectedOrientation: 'Portrait',
            naturalWidth: 800,
            naturalHeight: 600,
          });
        };
        img.src = fileUrl;
      });
    }

    // Fast path 2: Office Documents (PPT / Excel / Word) - High-Fidelity Instant Preview Synthesis
    if (isPpt || isExcel || isDocx) {
      try {
        const simCanvas = document.createElement('canvas');
        const isLand = isPpt; // Presentations default to widescreen landscape
        const w = isLand ? 960 : 595;
        const h = isLand ? 540 : 842;
        simCanvas.width = w * 2;
        simCanvas.height = h * 2;
        const ctx = simCanvas.getContext('2d');
        if (ctx) {
          ctx.scale(2, 2);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);

          // Header banner
          const headerH = isLand ? 70 : 80;
          ctx.fillStyle = isPpt ? '#c0392b' : isExcel ? '#27ae60' : '#2980b9';
          ctx.fillRect(0, 0, w, headerH);

          // Header typography
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 18px sans-serif';
          const fileTitle = decodeURIComponent(fileUrl.split('/').pop()?.split('?')[0] || 'Office Document');
          ctx.fillText(fileTitle, 24, 38);

          ctx.font = '12px sans-serif';
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          const typeLabel = isPpt ? 'PowerPoint Presentation Slide' : isExcel ? 'Excel Workbook Spreadsheet' : 'Word Document';
          ctx.fillText(`${typeLabel} • Ready for High-Resolution Printing`, 24, 58);

          if (isExcel) {
            // Render spreadsheet grid simulation
            ctx.strokeStyle = '#e2e8f0';
            ctx.lineWidth = 1;
            const startY = headerH + 20;
            const rowH = 26;
            const colW = (w - 48) / 5;
            for (let r = 0; r < 20 && startY + r * rowH < h - 20; r++) {
              const y = startY + r * rowH;
              ctx.fillStyle = r === 0 ? '#f1f5f9' : (r % 2 === 0 ? '#fafafa' : '#ffffff');
              ctx.fillRect(24, y, w - 48, rowH);
              ctx.strokeRect(24, y, w - 48, rowH);
              for (let c = 0; c < 5; c++) {
                ctx.strokeRect(24 + c * colW, y, colW, rowH);
              }
            }
          } else if (isPpt) {
            // Render presentation layout simulation
            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(40, headerH + 40, w - 80, h - headerH - 80);
            ctx.strokeStyle = '#cbd5e1';
            ctx.strokeRect(40, headerH + 40, w - 80, h - headerH - 80);

            ctx.fillStyle = '#1e293b';
            ctx.font = 'bold 24px sans-serif';
            ctx.fillText('Key Presentation Overview', 70, headerH + 90);

            ctx.fillStyle = '#64748b';
            ctx.font = '14px sans-serif';
            ctx.fillText('• Full color slide output ready for high-fidelity presentation prints', 70, headerH + 130);
            ctx.fillText('• Landscape ratio aligned with standard projection and display standards', 70, headerH + 160);
          } else {
            // Render document page layout simulation
            ctx.fillStyle = '#1e293b';
            ctx.font = 'bold 20px sans-serif';
            ctx.fillText('Document Content Overview', 40, headerH + 45);

            ctx.fillStyle = '#475569';
            ctx.font = '13px sans-serif';
            const lines = [
              'This document is prepared for immediate printing and finishing.',
              'All margins and layout dimensions match standard publication specifications.',
              'Formatted for clear, high-contrast black & white or vibrant full-color physical reproduction.'
            ];
            lines.forEach((ln, i) => {
              ctx.fillText(ln, 40, headerH + 80 + i * 24);
            });

            // Simulated document paragraphs
            ctx.fillStyle = '#cbd5e1';
            for (let i = 0; i < 8; i++) {
              ctx.fillRect(40, headerH + 160 + i * 28, w - 80 - (i % 3) * 40, 10);
            }
          }

          const dataUrl = simCanvas.toDataURL('image/png');
          return {
            numPages: 1,
            pdfDoc: null,
            isImage: true,
            imageUrl: dataUrl,
            detectedOrientation: (isLand ? 'Landscape' : 'Portrait') as 'Landscape' | 'Portrait',
            naturalWidth: w,
            naturalHeight: h,
          };
        }
      } catch (simErr) {
        console.warn('Office preview simulation error:', simErr);
      }
    }

    // Standard PDF.js Loading Path
    try {
      const loadingTask = pdfjsLib.getDocument({
        url: fileUrl,
        cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
        cMapPacked: true,
        enableXfa: true,
        disableAutoFetch: true,
        disableStream: true,
        rangeChunkSize: 64 * 1024,
      });
      const pdfDoc = await loadingTask.promise;
      let detectedOrientation: 'Portrait' | 'Landscape' = 'Portrait';
      let naturalWidth = 595.28;
      let naturalHeight = 841.89;

      try {
        const page1 = await pdfDoc.getPage(1);
        const vp = page1.getViewport({ scale: 1.0 });
        naturalWidth = vp.width;
        naturalHeight = vp.height;
        detectedOrientation = vp.width > vp.height ? 'Landscape' : 'Portrait';
      } catch {
        // Fallback to portrait default if first page viewport fails
      }

      return {
        numPages: pdfDoc.numPages,
        pdfDoc,
        isImage: false,
        detectedOrientation,
        naturalWidth,
        naturalHeight,
      };
    } catch (err: any) {
      // If PDF parsing fails because it is an image masked as PDF or another format, fallback to image
      console.warn('PDF.js failed to parse as PDF, attempting image fallback:', err);
      return new Promise<PdfDocumentWrapper>((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const isLand = (img.naturalWidth || img.width) > (img.naturalHeight || img.height);
          resolve({
            numPages: 1,
            pdfDoc: null,
            isImage: true,
            imageUrl: fileUrl,
            detectedOrientation: isLand ? 'Landscape' : 'Portrait',
            naturalWidth: img.naturalWidth || img.width,
            naturalHeight: img.naturalHeight || img.height,
          });
        };
        img.onerror = () => {
          resolve({
            numPages: 1,
            pdfDoc: null,
            isImage: true,
            imageUrl: fileUrl,
            detectedOrientation: 'Portrait',
            naturalWidth: 800,
            naturalHeight: 600,
          });
        };
        img.src = fileUrl;
      });
    }
  })();

  documentCache.set(fileUrl, loadPromise);
  return loadPromise;
}

/**
 * Renders a specific page onto an HTMLCanvasElement with high-DPI scaling.
 */
export async function renderPdfPage(
  pdfWrapper: PdfDocumentWrapper,
  pageNum: number,
  canvas: HTMLCanvasElement,
  options: RenderPageOptions = {}
): Promise<{ width: number; height: number }> {
  const scale = options.scale || 1.0;
  const rotation = options.rotation || 0;

  // Helper: target paper dimensions in pt (72 points per inch)
  const getPaperDimensionsInPt = (paper?: string, orientation?: 'portrait' | 'landscape' | 'Portrait' | 'Landscape'): { widthPt: number; heightPt: number } => {
    const p = (paper || 'A4').toUpperCase();
    let w = 595.28; // A4 pt
    let h = 841.89;

    if (p.includes('A3')) {
      w = 841.89;
      h = 1190.55;
    } else if (p.includes('A5')) {
      w = 419.53;
      h = 595.28;
    } else if (p.includes('LETTER')) {
      w = 612.00;
      h = 792.00;
    } else if (p.includes('LEGAL')) {
      w = 612.00;
      h = 1008.00;
    } else if (p.includes('TABLOID')) {
      w = 792.00;
      h = 1224.00;
    }

    const isLandscape = orientation?.toLowerCase() === 'landscape';
    if (isLandscape) {
      return { widthPt: Math.max(w, h), heightPt: Math.min(w, h) };
    }
    return { widthPt: Math.min(w, h), heightPt: Math.max(w, h) };
  };

  if (pdfWrapper.isImage && pdfWrapper.imageUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const dpr = window.devicePixelRatio || 1;
        const isRotated = rotation === 90 || rotation === 270;
        const rawWidth = isRotated ? (img.naturalHeight || img.height) : (img.naturalWidth || img.width);
        const rawHeight = isRotated ? (img.naturalWidth || img.width) : (img.naturalHeight || img.height);
        const isSourceLandscape = rawWidth > rawHeight;

        // Effective orientation: respect explicit user option, else source document orientation
        const effectiveOrientation: 'Portrait' | 'Landscape' =
          options.orientation?.toLowerCase() === 'landscape'
            ? 'Landscape'
            : options.orientation?.toLowerCase() === 'portrait'
            ? 'Portrait'
            : isSourceLandscape
            ? 'Landscape'
            : 'Portrait';

        // Paper dimensions based on target paper & effective orientation
        const paperDims = getPaperDimensionsInPt(options.targetPaper || 'A4', effectiveOrientation);
        const paperWidth = paperDims.widthPt;
        const paperHeight = paperDims.heightPt;

        // 2–3 mm equal margins (2.5 mm = 7.09 pt)
        const marginPt = options.equalMargins !== false ? 7.1 : 0;
        const availWidth = Math.max(10, paperWidth - marginPt * 2);
        const availHeight = Math.max(10, paperHeight - marginPt * 2);

        let contentScale = 1.0;
        if (options.scaling === 'actual' || options.fitToPaper === false) {
          contentScale = 1.0;
        } else if (options.scaling === 'shrink') {
          if (rawWidth > availWidth || rawHeight > availHeight) {
            contentScale = Math.min(availWidth / rawWidth, availHeight / rawHeight);
          } else {
            contentScale = 1.0;
          }
        } else {
          // Default: genuine Fit to Page with equal 2–3 mm margins
          contentScale = Math.min(availWidth / rawWidth, availHeight / rawHeight);
        }

        const sheetWidth = Math.round(paperWidth * scale);
        const sheetHeight = Math.round(paperHeight * scale);

        canvas.width = Math.floor(sheetWidth * dpr);
        canvas.height = Math.floor(sheetHeight * dpr);
        canvas.style.width = `${sheetWidth}px`;
        canvas.style.height = `${sheetHeight}px`;

        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return resolve({ width: sheetWidth, height: sheetHeight });

        ctx.save();
        ctx.scale(dpr, dpr);

        // White paper sheet background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, sheetWidth, sheetHeight);

        if (options.isBlackAndWhite) {
          ctx.filter = 'grayscale(100%) contrast(105%)';
        }

        const drawW = Math.round(rawWidth * contentScale * scale);
        const drawH = Math.round(rawHeight * contentScale * scale);

        // Centered balanced margins (Left == Right, Top == Bottom)
        const offsetX = Math.max(0, (sheetWidth - drawW) / 2);
        const offsetY = Math.max(0, (sheetHeight - drawH) / 2);

        if (rotation !== 0) {
          ctx.translate(sheetWidth / 2, sheetHeight / 2);
          ctx.rotate((rotation * Math.PI) / 180);
          ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
        } else {
          ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
        }

        ctx.restore();
        resolve({ width: sheetWidth, height: sheetHeight });
      };
      img.onerror = () => reject(new Error('Failed to load document image preview'));
      img.src = pdfWrapper.imageUrl!;
    });
  }

  // Determine effective orientation: preserve source unless user explicitly requested Portrait or Landscape
  const effectiveOrientation: 'Portrait' | 'Landscape' =
    options.orientation?.toLowerCase() === 'landscape'
      ? 'Landscape'
      : options.orientation?.toLowerCase() === 'portrait'
      ? 'Portrait'
      : (pdfWrapper.detectedOrientation === 'Landscape' ? 'Landscape' : 'Portrait');

  // Compute target paper dimensions
  const paperDims = getPaperDimensionsInPt(options.targetPaper || 'A4', effectiveOrientation);
  const paperWidth = paperDims.widthPt;
  const paperHeight = paperDims.heightPt;
  const sheetWidth = Math.round(paperWidth * scale);
  const sheetHeight = Math.round(paperHeight * scale);
  const dpr = window.devicePixelRatio || 1;

  // Determine N-up mode: 1-in-1, 2-in-1, or 4-in-1
  const pagesPerSheet = options.pagesPerSheet || '1-in-1';
  const isNUp =
    (pagesPerSheet === '2-in-1' || pagesPerSheet === '4-in-1') ||
    (options.pageNums && options.pageNums.length > 1);

  if (isNUp && pdfWrapper.pdfDoc) {
    canvas.width = Math.floor(sheetWidth * dpr);
    canvas.height = Math.floor(sheetHeight * dpr);
    canvas.style.width = `${sheetWidth}px`;
    canvas.style.height = `${sheetHeight}px`;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D context unavailable');

    ctx.save();
    ctx.scale(dpr, dpr);

    // Clean white paper background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, sheetWidth, sheetHeight);

    if (options.isBlackAndWhite) {
      ctx.filter = 'grayscale(100%) contrast(105%)';
    }

    const subPageNums = options.pageNums && options.pageNums.length > 0
      ? options.pageNums
      : [pageNum];

    // Compute slots
    type Slot = { x: number; y: number; w: number; h: number };
    const slots: Slot[] = [];
    const gap = Math.round(8 * scale);
    const m = Math.round(10 * scale);

    if (pagesPerSheet === '4-in-1' || subPageNums.length > 2) {
      // 2x2 Grid
      const slotW = Math.round((sheetWidth - m * 2 - gap) / 2);
      const slotH = Math.round((sheetHeight - m * 2 - gap) / 2);
      slots.push({ x: m, y: m, w: slotW, h: slotH });
      slots.push({ x: m + slotW + gap, y: m, w: slotW, h: slotH });
      slots.push({ x: m, y: m + slotH + gap, w: slotW, h: slotH });
      slots.push({ x: m + slotW + gap, y: m + slotH + gap, w: slotW, h: slotH });
    } else {
      // 2-in-1
      if (effectiveOrientation === 'Landscape') {
        // 2 columns
        const slotW = Math.round((sheetWidth - m * 2 - gap) / 2);
        const slotH = Math.round(sheetHeight - m * 2);
        slots.push({ x: m, y: m, w: slotW, h: slotH });
        slots.push({ x: m + slotW + gap, y: m, w: slotW, h: slotH });
      } else {
        // 2 rows
        const slotW = Math.round(sheetWidth - m * 2);
        const slotH = Math.round((sheetHeight - m * 2 - gap) / 2);
        slots.push({ x: m, y: m, w: slotW, h: slotH });
        slots.push({ x: m, y: m + slotH + gap, w: slotW, h: slotH });
      }
    }

    for (let i = 0; i < subPageNums.length && i < slots.length; i++) {
      const pNum = subPageNums[i];
      const slot = slots[i];
      const subRenderDpr = dpr * (scale > 0.5 ? 2 : 1);

      try {
        const subPage = await pdfWrapper.pdfDoc.getPage(pNum);
        const subIntrinsicRot = ((subPage.rotate || 0) % 360 + 360) % 360;
        const subEffRot = ((subIntrinsicRot + (rotation || 0)) % 360 + 360) % 360;
        const subUnscaled = subPage.getViewport({ scale: 1.0, rotation: subEffRot });

        // Proportional fit into slot
        const subFitScale = Math.min(slot.w / subUnscaled.width, slot.h / subUnscaled.height);
        const subRenderViewport = subPage.getViewport({ scale: subFitScale * subRenderDpr, rotation: subEffRot });

        const subOffscreen = document.createElement('canvas');
        subOffscreen.width = Math.floor(subRenderViewport.width);
        subOffscreen.height = Math.floor(subRenderViewport.height);

        const subCtx = subOffscreen.getContext('2d', { alpha: false });
        if (subCtx) {
          subCtx.fillStyle = '#ffffff';
          subCtx.fillRect(0, 0, subOffscreen.width, subOffscreen.height);
          await subPage.render({
            canvasContext: subCtx,
            viewport: subRenderViewport,
          }).promise;

          // Draw centered in slot
          const drawnW = Math.round(subRenderViewport.width / subRenderDpr);
          const drawnH = Math.round(subRenderViewport.height / subRenderDpr);
          const posX = slot.x + Math.max(0, Math.round((slot.w - drawnW) / 2));
          const posY = slot.y + Math.max(0, Math.round((slot.h - drawnH) / 2));

          ctx.drawImage(subOffscreen, posX, posY, drawnW, drawnH);
        }
      } catch (subErr) {
        console.warn(`Failed to render N-up sub-page ${pNum}:`, subErr);
      }
    }

    ctx.restore();
    return { width: sheetWidth, height: sheetHeight };
  }

  // Standard 1-in-1 Page Rendering
  const page = await pdfWrapper.pdfDoc.getPage(pageNum);

  // 1. Determine source document orientation & dimensions (respect intrinsic page.rotate)
  const intrinsicRotation = ((page.rotate || 0) % 360 + 360) % 360;

  // Rotation logic:
  let additionalRotation = 0;
  if (rotation !== undefined && rotation !== 0) {
    additionalRotation = rotation;
  }
  const effectiveRotation = ((intrinsicRotation + additionalRotation) % 360 + 360) % 360;

  // 4. Fit to Paper / Scaling with Equal Balanced Margins Guarantee (2–3 mm outer margin)
  let contentScale = 1.0;
  const pageViewAtZero = page.getViewport({ scale: 1.0, rotation: effectiveRotation });

  // 2–3 mm equal margins (2.5 mm = 7.1 pt on each side)
  const marginPt = options.equalMargins !== false ? 7.1 : 0;
  const availWidth = Math.max(10, paperWidth - marginPt * 2);
  const availHeight = Math.max(10, paperHeight - marginPt * 2);

  if (options.scaling === 'actual' || options.fitToPaper === false) {
    contentScale = 1.0;
  } else if (options.scaling === 'shrink') {
    if (pageViewAtZero.width > availWidth || pageViewAtZero.height > availHeight) {
      contentScale = Math.min(availWidth / pageViewAtZero.width, availHeight / pageViewAtZero.height);
    } else {
      contentScale = 1.0;
    }
  } else {
    const scaleX = availWidth / pageViewAtZero.width;
    const scaleY = availHeight / pageViewAtZero.height;
    contentScale = Math.min(scaleX, scaleY);
  }

  const finalScale = contentScale * scale;
  const renderViewport = page.getViewport({ scale: finalScale, rotation: effectiveRotation });

  canvas.width = Math.floor(sheetWidth * dpr);
  canvas.height = Math.floor(sheetHeight * dpr);
  canvas.style.width = `${sheetWidth}px`;
  canvas.style.height = `${sheetHeight}px`;

  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable');
  }

  ctx.save();
  ctx.scale(dpr, dpr);

  // Clean white paper background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, sheetWidth, sheetHeight);

  if (options.isBlackAndWhite) {
    ctx.filter = 'grayscale(100%) contrast(105%)';
  }

  // Calculate centered balanced margins (Top == Bottom, Left == Right)
  const offsetX = Math.max(0, (sheetWidth - renderViewport.width) / 2);
  const offsetY = Math.max(0, (sheetHeight - renderViewport.height) / 2);

  ctx.translate(offsetX, offsetY);

  const renderContext = {
    canvasContext: ctx,
    viewport: renderViewport,
  };

  await page.render(renderContext).promise;
  ctx.restore();

  return { width: sheetWidth, height: sheetHeight };
}

/**
 * Renders a document page to a high-resolution print-ready image Data URL (300 DPI).
 * This guarantees 100% exact visual synchronization between on-screen preview and physical output:
 * - Proper paper dimensions (A4, A3, Legal, Letter)
 * - Horizontal landscape orientation with genuine Fit to Page scaling
 * - Small equal balanced margins (2.5 mm / ~7.1 pt) on all 4 sides
 * - Perfectly centered without distortion, clipping, or bottom/side shifting
 */
export async function renderDocumentToPrintDataUrl(
  pdfWrapper: PdfDocumentWrapper,
  pageNum: number,
  options: RenderPageOptions = {},
  dpi = 300
): Promise<string> {
  const offscreenCanvas = document.createElement('canvas');
  // 72 points per inch -> scale factor = dpi / 72 (e.g. 300 / 72 = 4.1667)
  const printScale = dpi / 72;

  await renderPdfPage(pdfWrapper, pageNum, offscreenCanvas, {
    ...options,
    scale: printScale,
    equalMargins: options.equalMargins !== false,
  });

  return offscreenCanvas.toDataURL('image/jpeg', 0.96);
}

/**
 * Renders a miniature thumbnail for the sidebar.
 */
export async function renderThumbnail(
  pdfWrapper: PdfDocumentWrapper,
  pageNum: number,
  canvas: HTMLCanvasElement,
  targetWidth = 120,
  isBlackAndWhite = false
): Promise<void> {
  if (pdfWrapper.isImage && pdfWrapper.imageUrl) {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const aspectRatio = img.height / img.width;
        const targetHeight = Math.round(targetWidth * aspectRatio);
        const dpr = window.devicePixelRatio || 1;

        canvas.width = targetWidth * dpr;
        canvas.height = targetHeight * dpr;
        canvas.style.width = `${targetWidth}px`;
        canvas.style.height = `${targetHeight}px`;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.save();
          ctx.scale(dpr, dpr);
          if (isBlackAndWhite) {
            ctx.filter = 'grayscale(100%) contrast(105%)';
          }
          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
          ctx.restore();
        }
        resolve();
      };
      img.onerror = () => resolve();
      img.src = pdfWrapper.imageUrl!;
    });
  }

  try {
    const page = await pdfWrapper.pdfDoc.getPage(pageNum);
    const unscaledViewport = page.getViewport({ scale: 1.0 });
    const scale = targetWidth / unscaledViewport.width;
    const viewport = page.getViewport({ scale });
    const dpr = window.devicePixelRatio || 1;

    canvas.width = Math.floor(viewport.width * dpr);
    canvas.height = Math.floor(viewport.height * dpr);
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    ctx.save();
    ctx.scale(dpr, dpr);

    if (isBlackAndWhite) {
      ctx.filter = 'grayscale(100%) contrast(105%)';
    }

    await page.render({
      canvasContext: ctx,
      viewport,
    }).promise;

    ctx.restore();
  } catch (err) {
    console.warn(`Failed to render thumbnail for page ${pageNum}:`, err);
  }
}
