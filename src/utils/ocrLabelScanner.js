/**
 * ocrLabelScanner.js
 * Intelligent multi-engine OCR scanner for product packaging labels.
 * Extracts brand and product names from packaging photos.
 */

// Common packaging noise patterns to filter out
const NOISE_PATTERNS = [
  /^(exp|mfd|bbf|bb|lot|no\.|วันหมดอายุ|ผลิต|ควรบริโภคก่อน)/i,
  /^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/, // Date
  /^\d{8,14}$/, // Barcode
  /(kcal|แคลอรี|กิโลแคลอรี|พลังงาน|ไขมัน|โซเดียม|น้ำตาล|protein|fat|sodium|sugar)/i,
  /(ส่วนประกอบ|ข้อมูลสำหรับผู้แพ้|อย\.|อย|fda|gmp|haccp)/i,
  /(net\s*wt|น้ำหนักสุทธิ|ปริมาตรสุทธิ|ขนาดบรรจุ)/i,
  /(www\.|\.com|\.co\.th|facebook|line|tel|โทร)/i,
  /^\d+\s*(g|kg|ml|l|กรัม|กิโลกรัม|มล\.|ลิตร)$/i,
  /^[0-9\W]+$/, // Only numbers and symbols
];

/**
 * Clean and normalize a candidate product title line
 */
function cleanLine(text) {
  if (!text) return '';
  return text
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[|•·*#_~`^]+/g, '')
    .trim();
}

/**
 * Score how likely a line is to be the primary product name
 */
function scoreCandidateLine(line) {
  if (!line || line.length < 2) return -100;
  if (line.length > 50) return -20; // Too long, likely a sentence or paragraph

  // Check noise patterns
  for (const pattern of NOISE_PATTERNS) {
    if (pattern.test(line)) return -50;
  }

  let score = 10;

  // Good product name length (4 - 25 chars)
  if (line.length >= 4 && line.length <= 25) {
    score += 15;
  }

  // Contains Thai characters
  if (/[\u0E00-\u0E7F]/.test(line)) {
    score += 10;
  }

  // Contains capitalized English brand words
  if (/^[A-Z][a-zA-Z\s]+$/.test(line)) {
    score += 8;
  }

  return score;
}

/**
 * Filter and rank detected text lines
 */
export function rankProductNames(rawLines) {
  const seen = new Set();
  const scored = [];

  for (const raw of rawLines) {
    const cleaned = cleanLine(raw);
    if (!cleaned || cleaned.length < 2) continue;

    const lower = cleaned.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);

    const score = scoreCandidateLine(cleaned);
    if (score > 0) {
      scored.push({ text: cleaned, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);

  const candidates = scored.map((s) => s.text);
  const bestName = candidates[0] || (rawLines[0] ? cleanLine(rawLines[0]) : '');

  return {
    bestName,
    candidates: candidates.slice(0, 8),
  };
}

/**
 * Try native Shape Detection API (available in modern Android Chrome)
 */
async function tryNativeTextDetector(imageSource) {
  if (typeof window === 'undefined' || !('TextDetector' in window)) {
    return null;
  }

  try {
    const detector = new window.TextDetector();
    let imgElement;

    if (imageSource instanceof HTMLImageElement || imageSource instanceof HTMLCanvasElement) {
      imgElement = imageSource;
    } else {
      imgElement = new window.Image();
      const url = typeof imageSource === 'string' ? imageSource : URL.createObjectURL(imageSource);
      imgElement.src = url;
      await new Promise((res, rej) => {
        imgElement.onload = res;
        imgElement.onerror = rej;
      });
    }

    const detections = await detector.detect(imgElement);
    if (detections && detections.length > 0) {
      return detections.map((d) => d.rawValue).filter(Boolean);
    }
  } catch (err) {
    console.warn('Native TextDetector failed:', err);
  }
  return null;
}

/**
 * Universal in-browser OCR using Tesseract.js
 */
async function tryTesseractOcr(imageSource, onProgress) {
  try {
    const { createWorker } = await import('tesseract.js');
    onProgress?.({ status: 'กำลังโหลดระบบอ่านภาษา...', progress: 0.15 });

    // Use Thai + English for grocery / convenience items in Thailand
    const worker = await createWorker('tha+eng', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          const pct = 0.3 + (m.progress || 0) * 0.65;
          onProgress?.({ status: 'กำลังอ่านตัวหนังสือบนฉลาก...', progress: pct });
        }
      },
    });

    onProgress?.({ status: 'กำลังประมวลผลรูปฉลาก...', progress: 0.35 });
    const ret = await worker.recognize(imageSource);
    await worker.terminate();

    if (ret && ret.data && ret.data.text) {
      return ret.data.lines
        ? ret.data.lines.map((l) => l.text).filter(Boolean)
        : ret.data.text.split('\n').filter(Boolean);
    }
  } catch (err) {
    console.warn('Tesseract OCR failed:', err);
  }
  return null;
}

/**
 * Main function: Extract product name from label photo
 * @param {File|Blob|string} imageSource
 * @param {Function} onProgress
 * @returns {Promise<{ bestName: string, candidates: string[], rawText: string }>}
 */
export async function extractProductNameFromImage(imageSource, onProgress = null) {
  onProgress?.({ status: 'เริ่มตรวจสอบรูปภาพฉลาก...', progress: 0.05 });

  // 1. Try Native fast TextDetector
  const nativeLines = await tryNativeTextDetector(imageSource);
  if (nativeLines && nativeLines.length > 0) {
    onProgress?.({ status: 'อ่านข้อความสำเร็จ!', progress: 1 });
    const ranked = rankProductNames(nativeLines);
    return {
      bestName: ranked.bestName,
      candidates: ranked.candidates,
      rawText: nativeLines.join('\n'),
    };
  }

  // 2. Fallback to Tesseract.js
  const ocrLines = await tryTesseractOcr(imageSource, onProgress);
  if (ocrLines && ocrLines.length > 0) {
    onProgress?.({ status: 'อ่านข้อความสำเร็จ!', progress: 1 });
    const ranked = rankProductNames(ocrLines);
    return {
      bestName: ranked.bestName,
      candidates: ranked.candidates,
      rawText: ocrLines.join('\n'),
    };
  }

  return {
    bestName: '',
    candidates: [],
    rawText: '',
  };
}
