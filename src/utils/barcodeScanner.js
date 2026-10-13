/**
 * barcodeScanner.js
 * High-reliability multi-engine barcode and QR scanner for images and photos.
 *
 * Engines & Features:
 *  1. EXIF orientation correction (handles portrait/landscape smartphone photos)
 *  2. Downscaling to optimal OCR resolution (1280px max)
 *  3. Multi-angle evaluation: 0°, 90°, 270°
 *  4. High-contrast binarization pass for glossy or low-contrast packaging
 *  5. Hardware BarcodeDetector API (Chrome Android / Safari 17+)
 *  6. @zxing/browser BrowserMultiFormatReader universal fallback
 */

import { BrowserMultiFormatReader } from '@zxing/browser';
import { DecodeHintType, BarcodeFormat } from '@zxing/library';

// ─────────────────────────────────────────────────────────────────────────────
// EXIF orientation parser
// ─────────────────────────────────────────────────────────────────────────────

function readExifOrientation(buffer) {
  try {
    const view = new DataView(buffer);
    if (view.getUint16(0, false) !== 0xffd8) return 1; // not JPEG

    let offset = 2;
    while (offset < view.byteLength - 1) {
      const marker = view.getUint16(offset, false);
      offset += 2;
      if (marker === 0xffe1) {
        const exifMagic = view.getUint32(offset + 2, false);
        if (exifMagic !== 0x45786966) break; // 'Exif'
        const le = view.getUint16(offset + 10, false) === 0x4949;
        const ifd = view.getUint32(offset + 14, le);
        const entries = view.getUint16(offset + 10 + ifd, le);
        for (let i = 0; i < entries; i++) {
          const tag = view.getUint16(offset + 10 + ifd + 2 + i * 12, le);
          if (tag === 0x0112) {
            return view.getUint16(offset + 10 + ifd + 2 + i * 12 + 8, le);
          }
        }
        break;
      } else if ((marker & 0xff00) !== 0xff00) {
        break;
      } else {
        offset += view.getUint16(offset, false);
      }
    }
  } catch { /* ignore */ }
  return 1;
}

function applyExifOrientation(img, orientation) {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const swap = orientation >= 5;
  c.width = swap ? h : w;
  c.height = swap ? w : h;
  switch (orientation) {
    case 2: ctx.transform(-1, 0, 0, 1, w, 0); break;
    case 3: ctx.transform(-1, 0, 0, -1, w, h); break;
    case 4: ctx.transform(1, 0, 0, -1, 0, h); break;
    case 5: ctx.transform(0, 1, 1, 0, 0, 0); break;
    case 6: ctx.transform(0, 1, -1, 0, h, 0); break;
    case 7: ctx.transform(0, -1, -1, 0, h, w); break;
    case 8: ctx.transform(0, -1, 1, 0, 0, w); break;
    default: break;
  }
  ctx.drawImage(img, 0, 0);
  return c;
}

// ─────────────────────────────────────────────────────────────────────────────
// Canvas transformation helpers
// ─────────────────────────────────────────────────────────────────────────────

function loadImg(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.crossOrigin = 'anonymous';
    img.src = url;
  });
}

function downscale(canvas, max = 1280) {
  const { width: w, height: h } = canvas;
  if (w <= max && h <= max) return canvas;
  const ratio = Math.min(max / w, max / h);
  const nw = Math.round(w * ratio);
  const nh = Math.round(h * ratio);
  const out = document.createElement('canvas');
  out.width = nw;
  out.height = nh;
  out.getContext('2d', { willReadFrequently: true }).drawImage(canvas, 0, 0, nw, nh);
  return out;
}

function rotateCanvas(src, deg) {
  if (!deg) return src;
  const { width: w, height: h } = src;
  const out = document.createElement('canvas');
  const ctx = out.getContext('2d', { willReadFrequently: true });
  const swap = deg === 90 || deg === 270;
  out.width = swap ? h : w;
  out.height = swap ? w : h;
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate((deg * Math.PI) / 180);
  ctx.drawImage(src, -w / 2, -h / 2);
  return out;
}

function enhanceContrast(src) {
  const { width: w, height: h } = src;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(src, 0, 0);
  try {
    const imgData = ctx.getImageData(0, 0, w, h);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      const val = gray > 128 ? 255 : 0;
      d[i] = val;
      d[i + 1] = val;
      d[i + 2] = val;
    }
    ctx.putImageData(imgData, 0, 0);
    return out;
  } catch {
    return src;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ZXing MultiFormat reader instance
// ─────────────────────────────────────────────────────────────────────────────

let _zxBrowserReader = null;
export function getBrowserBarcodeReader() {
  if (!_zxBrowserReader) {
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.QR_CODE,
      BarcodeFormat.ITF,
      BarcodeFormat.CODE_93,
      BarcodeFormat.CODABAR,
    ]);
    hints.set(DecodeHintType.TRY_HARDER, true);
    _zxBrowserReader = new BrowserMultiFormatReader(hints, {
      delayBetweenScanAttempts: 80,
      delayBetweenScanSuccess: 500,
    });
  }
  return _zxBrowserReader;
}

function zxDecodeCanvas(canvas) {
  try {
    const reader = getBrowserBarcodeReader();
    const result = reader.decodeFromCanvas(canvas);
    return result ? result.getText() : null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export: scanBarcodeFromImageFile
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Scan a barcode or QR from a File or Blob.
 * Handles EXIF orientation, high-res downscaling, portrait/landscape rotation, and high-contrast passes.
 * @param {File|Blob} file
 * @returns {Promise<string>} decoded barcode text
 */
export async function scanBarcodeFromImageFile(file) {
  if (!file) throw new Error('No file provided');

  // 1. Read EXIF
  let exifOri = 1;
  try {
    const buf = await file.arrayBuffer();
    exifOri = readExifOrientation(buf);
  } catch { /* ignore */ }

  // 2. Load image & fix orientation
  const objUrl = URL.createObjectURL(file);
  let base;
  try {
    const img = await loadImg(objUrl);
    base = applyExifOrientation(img, exifOri);
    base = downscale(base, 1280);
  } finally {
    URL.revokeObjectURL(objUrl);
  }

  // 3. Prepare rotation & filter candidates
  const r90 = rotateCanvas(base, 90);
  const r270 = rotateCanvas(base, 270);
  const candidates = [
    base,
    r90,
    r270,
    enhanceContrast(base),
    enhanceContrast(r90),
  ];

  // 4. Try Native BarcodeDetector (Chrome Android / Safari 17+)
  if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
    try {
      const supported = await window.BarcodeDetector.getSupportedFormats().catch(() => []);
      const wanted = ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code', 'itf'];
      const formats = wanted.filter((f) => !supported.length || supported.includes(f));
      const bd = new window.BarcodeDetector({
        formats: formats.length ? formats : ['ean_13', 'code_128', 'qr_code'],
      });

      for (const canvas of candidates) {
        try {
          const hits = await bd.detect(canvas);
          if (hits.length > 0 && hits[0].rawValue) {
            return hits[0].rawValue.trim();
          }
        } catch { /* next candidate */ }
      }
    } catch (e) {
      console.warn('[scanner] BarcodeDetector failed, falling back to ZXing:', e);
    }
  }

  // 5. ZXing MultiFormatReader
  for (const canvas of candidates) {
    const text = zxDecodeCanvas(canvas);
    if (text) return text.trim();
  }

  throw new Error('Barcode not found in image');
}
