import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

/**
 * Scans a barcode or QR code from an image file (e.g. snapped by mobile camera).
 * Uses native BarcodeDetector API if available, falling back to Html5Qrcode/ZXing.
 * @param {File|Blob} file 
 * @returns {Promise<string>} decoded barcode text
 */
export async function scanBarcodeFromImageFile(file) {
  if (!file) {
    throw new Error('ไม่พบไฟล์รูปภาพ');
  }

  // 1. Try native BarcodeDetector (instant hardware acceleration on Android Chrome)
  if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
    try {
      const formats = await window.BarcodeDetector.getSupportedFormats?.().catch(() => []) || [];
      const supported = [
        'ean_13',
        'ean_8',
        'code_128',
        'code_39',
        'upc_a',
        'upc_e',
        'qr_code',
      ].filter((f) => formats.length === 0 || formats.includes(f));

      const detector = new window.BarcodeDetector({ formats: supported });
      const bitmap = await createImageBitmap(file);
      const detections = await detector.detect(bitmap);

      if (detections && detections.length > 0 && detections[0].rawValue) {
        return detections[0].rawValue.trim();
      }
    } catch (nativeErr) {
      console.warn('Native BarcodeDetector failed, trying html5-qrcode engine:', nativeErr);
    }
  }

  // 2. Fallback to Html5Qrcode / ZXing engine
  let tempDiv = document.getElementById('temp-barcode-reader-engine');
  if (!tempDiv) {
    tempDiv = document.createElement('div');
    tempDiv.id = 'temp-barcode-reader-engine';
    tempDiv.style.position = 'fixed';
    tempDiv.style.top = '-9999px';
    tempDiv.style.left = '-9999px';
    tempDiv.style.width = '300px';
    tempDiv.style.height = '300px';
    tempDiv.style.opacity = '0';
    tempDiv.style.pointerEvents = 'none';
    document.body.appendChild(tempDiv);
  }

  const html5QrCode = new Html5Qrcode('temp-barcode-reader-engine', {
    formatsToSupport: [
      Html5QrcodeSupportedFormats.EAN_13,
      Html5QrcodeSupportedFormats.EAN_8,
      Html5QrcodeSupportedFormats.CODE_128,
      Html5QrcodeSupportedFormats.CODE_39,
      Html5QrcodeSupportedFormats.UPC_A,
      Html5QrcodeSupportedFormats.UPC_E,
      Html5QrcodeSupportedFormats.QR_CODE,
      Html5QrcodeSupportedFormats.ITF,
    ],
    verbose: false,
  });

  try {
    const decodedText = await html5QrCode.scanFile(file, true);
    return decodedText.trim();
  } finally {
    try {
      html5QrCode.clear();
    } catch {
      // ignore
    }
  }
}
