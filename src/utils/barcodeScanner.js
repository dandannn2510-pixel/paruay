import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

/**
 * Loads an image file or blob into an HTMLImageElement
 */
function loadImageElement(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}

/**
 * Renders an image to an offscreen canvas at a specified angle and max resolution
 */
function renderRotatedCanvas(img, angleDegrees = 0, maxDimension = 1200) {
  let { width, height } = img;

  // Scale down if image is huge (e.g. 4000x3000 down to 1200x900)
  if (width > maxDimension || height > maxDimension) {
    if (width > height) {
      height = Math.round((height * maxDimension) / width);
      width = maxDimension;
    } else {
      width = Math.round((width * maxDimension) / height);
      height = maxDimension;
    }
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  if (angleDegrees === 90 || angleDegrees === 270) {
    canvas.width = height;
    canvas.height = width;
  } else {
    canvas.width = width;
    canvas.height = height;
  }

  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((angleDegrees * Math.PI) / 180);
  ctx.drawImage(img, -width / 2, -height / 2, width, height);

  return canvas;
}

/**
 * Converts canvas to a Blob file
 */
function canvasToBlob(canvas) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.92);
  });
}

/**
 * Scans a barcode or QR code from an image file (e.g. snapped by mobile camera).
 * Supports 4-way rotation (0°, 90°, 270°) to handle portrait and landscape smartphone photos.
 * @param {File|Blob} file 
 * @returns {Promise<string>} decoded barcode text
 */
export async function scanBarcodeFromImageFile(file) {
  if (!file) {
    throw new Error('ไม่พบไฟล์รูปภาพ');
  }

  let img;
  try {
    img = await loadImageElement(file);
  } catch (err) {
    console.warn('Failed to load image element, trying direct fallback', err);
  }

  // 1. Try Native BarcodeDetector (Chrome Android hardware accelerated) across rotations
  if (typeof window !== 'undefined' && 'BarcodeDetector' in window && img) {
    try {
      const formats = (await window.BarcodeDetector.getSupportedFormats?.().catch(() => [])) || [];
      const supported = [
        'ean_13',
        'ean_8',
        'code_128',
        'code_39',
        'upc_a',
        'upc_e',
        'qr_code',
        'itf',
      ].filter((f) => formats.length === 0 || formats.includes(f));

      const detector = new window.BarcodeDetector({ formats: supported });

      // Try 0° (normal), 90° (portrait phone hold), and 270°
      const angles = [0, 90, 270];
      for (const angle of angles) {
        try {
          const canvas = renderRotatedCanvas(img, angle, 1200);
          const detections = await detector.detect(canvas);
          if (detections && detections.length > 0 && detections[0].rawValue) {
            return detections[0].rawValue.trim();
          }
        } catch {
          // continue to next angle
        }
      }
    } catch (nativeErr) {
      console.warn('Native BarcodeDetector loop failed:', nativeErr);
    }
  }

  // 2. Fallback to Html5Qrcode / ZXing engine with multi-angle rotation
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
    // If we have the image, try resized 0° and 90° rotated blobs
    if (img) {
      const angles = [0, 90, 270];
      for (const angle of angles) {
        try {
          const canvas = renderRotatedCanvas(img, angle, 1200);
          const blob = await canvasToBlob(canvas);
          if (blob) {
            const fileObj = new File([blob], 'barcode.jpg', { type: 'image/jpeg' });
            const result = await html5QrCode.scanFile(fileObj, true);
            if (result) return result.trim();
          }
        } catch {
          // ignore frame miss and try next angle
        }
      }
    }

    // Direct scan on original file as final attempt
    const directResult = await html5QrCode.scanFile(file, true);
    return directResult.trim();
  } finally {
    try {
      html5QrCode.clear();
    } catch {
      // ignore
    }
  }
}
