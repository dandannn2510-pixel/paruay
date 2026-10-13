/**
 * aiVisionScanner.js
 * High-precision AI-powered product recognition engine for Thai grocery and retail POS.
 * Supports Google Gemini Vision (Multimodal Flash) + Enhanced Thai Retail Semantic Parser fallback.
 */

// Storage keys
export const GEMINI_API_KEY_STORAGE = 'paruay_gemini_api_key';

// Thai Category IDs
export const CATEGORY_IDS = {
  FRESH: 'cat_fresh', // ของสด & เนื้อสัตว์
  VEG: 'cat_veg', // ผัก & ผลไม้
  RAW_BULK: 'cat_raw_bulk', // ของดิบ & แบ่งขาย
  BEVERAGE: 'cat_beverage', // เครื่องดื่ม
  DRY_FOOD: 'cat_dry_food', // บะหมี่ & เครื่องปรุง
  SNACK: 'cat_snack', // ขนม & ของกินเล่น
  HOUSEHOLD: 'cat_household', // ของใช้ในบ้าน
  SERVICE: 'cat_service', // บริการ & เบ็ดเตล็ด
};

/**
 * Get active Gemini API key from localStorage or Vite environment variable
 */
export function getActiveGeminiApiKey() {
  try {
    const fromStorage = localStorage.getItem(GEMINI_API_KEY_STORAGE);
    if (fromStorage && fromStorage.trim().length > 10) {
      return fromStorage.trim();
    }
  } catch (_) {}

  // Fallback to Vite env
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) {
      return import.meta.env.VITE_GEMINI_API_KEY.trim();
    }
  } catch (_) {}

  return '';
}

/**
 * Save Gemini API key
 */
export function setStoredGeminiApiKey(key) {
  try {
    if (!key || !key.trim()) {
      localStorage.removeItem(GEMINI_API_KEY_STORAGE);
    } else {
      localStorage.setItem(GEMINI_API_KEY_STORAGE, key.trim());
    }
  } catch (_) {}
}

/**
 * Quick validation check for Gemini API key
 */
export async function testGeminiApiKey(apiKey) {
  const cleanKey = (apiKey || '').trim();
  if (!cleanKey) {
    return { success: false, error: 'กรุณากรอก API Key' };
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${cleanKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: 'Respond with the single word: OK' }],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      const msg = errJson?.error?.message || `HTTP ${response.status}`;
      return { success: false, error: `เชื่อมต่อไม่สำเร็จ: ${msg}` };
    }

    const data = await response.json();
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (reply.toLowerCase().includes('ok')) {
      return { success: true };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message || 'ไม่สามารถเชื่อมต่อ Google AI ได้' };
  }
}

/**
 * Convert any image source (DataURL, File, Blob) to clean base64 string + mimeType
 */
async function toBase64Payload(imageSource) {
  let dataUrl = '';

  if (typeof imageSource === 'string') {
    dataUrl = imageSource;
  } else if (imageSource instanceof Blob || imageSource instanceof File) {
    dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(imageSource);
    });
  }

  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (match) {
    return {
      mimeType: match[1],
      base64Data: match[2],
    };
  }

  return {
    mimeType: 'image/jpeg',
    base64Data: dataUrl.replace(/^data:[^;]+;base64,/, ''),
  };
}

/**
 * Call Gemini 1.5/2.0 Flash Vision to recognize product from photo
 */
async function callGeminiVision(base64Payload, apiKey, onProgress) {
  onProgress?.({ status: '🤖 ส่งรูปให้ AI Gemini วิเคราะห์ฉลากและสินค้า...', progress: 0.3 });

  // Try gemini-1.5-flash first, then gemini-2.0-flash
  const models = ['gemini-1.5-flash', 'gemini-2.0-flash'];
  let lastError = null;

  const promptText = `คุณคือระบบ AI ผู้เชี่ยวชาญด้านสินค้าในร้านค้าปลีก ร้านของชำ ซูเปอร์มาร์เก็ต และตลาดสดในประเทศไทย
วิเคราะห์รูปภาพสินค้านี้ (อาจเป็นซองขนม ขวดเครื่องดื่ม กล่องบรรจุภัณฑ์ ฉลาก ผัก ผลไม้ เนื้อสัตว์ ของใช้ในบ้าน ฯลฯ)
จงระบุรายละเอียดสินค้าให้ถูกต้อง ชัดเจน และเป็นธรรมชาติที่สุด

ส่งผลลัพธ์กลับมาเป็น JSON ตามโครงสร้างนี้เท่านั้น (ห้ามใส่ Markdown code blocks):
{
  "name": "ชื่อสินค้าภาษาไทยที่ถูกต้องและสมบูรณ์ [ชื่อแบรนด์] [รสชาติ/ประเภท] [ขนาด/ปริมาตรถ้ามี] เช่น เลย์ คลาสสิค รสมันฝรั่งแท้ 42 กรัม, โค้ก ไม่มีน้ำตาล 325 มล., นมโฟร์โมสต์ รสจืด 225 มล., อกไก่สด, มาม่า รสต้มยำกุ้ง",
  "categoryId": "ต้องเลือกจากค่าใดค่าหนึ่งในนี้เท่านั้น: cat_fresh | cat_veg | cat_raw_bulk | cat_beverage | cat_dry_food | cat_snack | cat_household | cat_service",
  "unit": "หน่วยนับภาษาไทย เช่น ชิ้น, ขวด, กระป๋อง, ซอง, กล่อง, ถุง, กก., มัด, แพ็ค",
  "isWeighted": true หรือ false (เป็น true เฉพาะสินค้าที่ชั่งกิโลขาย เช่น เนื้อสัตว์ ผักผลไม้สด ข้าวสารตักแบ่งขาย),
  "suggestedPrice": ราคาขายปลีกมาตรฐานในไทย (ตัวเลข เช่น 20, 15, 65 หรือ null ถ้าไม่ทราบ),
  "suggestedCost": ราคาทุนส่งโดยประมาณ (ตัวเลข เช่น ~75% ของราคาขาย หรือ null),
  "barcode": "ตัวเลขบาร์โค้ดถ้ามองเห็นในรูปภาพนี้ หรือ null",
  "alternativeNames": ["ชื่อสินค้าแบบสั้น 1", "ชื่อสินค้าแบบสั้น 2"]
}`;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inline_data: {
                    mime_type: base64Payload.mimeType,
                    data: base64Payload.base64Data,
                  },
                },
                { text: promptText },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
          },
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        lastError = new Error(errJson?.error?.message || `HTTP ${response.status}`);
        continue;
      }

      onProgress?.({ status: '✨ AI กำลังประมวลผลชื่อและหมวดหมู่...', progress: 0.8 });

      const resData = await response.json();
      const rawText = resData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (!rawText) continue;

      // Parse JSON from model
      const cleanedJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanedJson);

      if (parsed.name && parsed.name.trim().length > 1) {
        return {
          name: parsed.name.trim(),
          categoryId: parsed.categoryId || CATEGORY_IDS.DRY_FOOD,
          unit: parsed.unit || (parsed.isWeighted ? 'กก.' : 'ชิ้น'),
          isWeighted: Boolean(parsed.isWeighted),
          suggestedPrice: parsed.suggestedPrice ? Number(parsed.suggestedPrice) : null,
          suggestedCost: parsed.suggestedCost ? Number(parsed.suggestedCost) : null,
          barcode: parsed.barcode || null,
          candidates: Array.isArray(parsed.alternativeNames) ? parsed.alternativeNames : [],
          aiEngine: 'gemini',
        };
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('Gemini Vision did not return valid product data');
}

// ─────────────────────────────────────────────────────────────────────────────
// Thai Retail Brand & Semantic Dictionary (High accuracy local fallback)
// ─────────────────────────────────────────────────────────────────────────────
const THAI_BRANDS_CATALOG = [
  // ขนม & ของกินเล่น
  { keywords: ['เลย์', 'lay', 'lays'], name: 'เลย์ มันฝรั่งแท้ทอดกรอบ', cat: CATEGORY_IDS.SNACK, unit: 'ซอง', price: 20 },
  { keywords: ['คาราด้า', 'karada'], name: 'ขนมอบกรอบ คาราด้า', cat: CATEGORY_IDS.SNACK, unit: 'ซอง', price: 20 },
  { keywords: ['เถ้าแก่น้อย', 'taokaenoi'], name: 'สาหร่ายทอด เถ้าแก่น้อย', cat: CATEGORY_IDS.SNACK, unit: 'ซอง', price: 39 },
  { keywords: ['ฮานามิ', 'hanami'], name: 'ข้าวเกรียบกุ้ง ฮานามิ', cat: CATEGORY_IDS.SNACK, unit: 'ซอง', price: 20 },
  { keywords: ['โปเต้', 'pote'], name: 'มันฝรั่งกรอบ โปเต้', cat: CATEGORY_IDS.SNACK, unit: 'ซอง', price: 20 },
  { keywords: ['ปาปริก้า', 'paprika'], name: 'มันฝรั่งกรอบ ปาปริก้า', cat: CATEGORY_IDS.SNACK, unit: 'ซอง', price: 20 },
  { keywords: ['เบนโตะ', 'bento'], name: 'ปลาหมึกอบกรอบ เบนโตะ', cat: CATEGORY_IDS.SNACK, unit: 'ซอง', price: 20 },
  { keywords: ['กัสเซ็น', 'gussen'], name: 'เวเฟอร์ กัสเซ็น', cat: CATEGORY_IDS.SNACK, unit: 'ซอง', price: 10 },
  { keywords: ['คิทแคท', 'kitkat'], name: 'ช็อกโกแลต คิทแคท', cat: CATEGORY_IDS.SNACK, unit: 'ชิ้น', price: 15 },
  { keywords: ['โอรีโอ', 'oreo'], name: 'คุกกี้แซนวิช โอรีโอ', cat: CATEGORY_IDS.SNACK, unit: 'ซอง', price: 10 },

  // เครื่องดื่ม
  { keywords: ['โค้ก', 'coke', 'coca-cola', 'โคคา-โคลา'], name: 'โค้ก (Coca-Cola)', cat: CATEGORY_IDS.BEVERAGE, unit: 'กระป๋อง', price: 16 },
  { keywords: ['เป๊ปซี่', 'pepsi'], name: 'เป๊ปซี่ (Pepsi)', cat: CATEGORY_IDS.BEVERAGE, unit: 'กระป๋อง', price: 16 },
  { keywords: ['สไปรท์', 'sprite'], name: 'สไปรท์ (Sprite)', cat: CATEGORY_IDS.BEVERAGE, unit: 'กระป๋อง', price: 16 },
  { keywords: ['แฟนต้า', 'fanta'], name: 'แฟนต้า (Fanta)', cat: CATEGORY_IDS.BEVERAGE, unit: 'กระป๋อง', price: 16 },
  { keywords: ['สิงห์', 'singha'], name: 'น้ำดื่มสิงห์', cat: CATEGORY_IDS.BEVERAGE, unit: 'ขวด', price: 10 },
  { keywords: ['คริสตัล', 'crystal'], name: 'น้ำดื่มคริสตัล', cat: CATEGORY_IDS.BEVERAGE, unit: 'ขวด', price: 10 },
  { keywords: ['เนสท์เล่', 'nestle'], name: 'น้ำดื่มเนสท์เล่ เพียวไลฟ์', cat: CATEGORY_IDS.BEVERAGE, unit: 'ขวด', price: 10 },
  { keywords: ['โออิชิ', 'oishi'], name: 'ชาเขียว โออิชิ', cat: CATEGORY_IDS.BEVERAGE, unit: 'ขวด', price: 20 },
  { keywords: ['อิชิตัน', 'ichitan'], name: 'ชาเขียว อิชิตัน', cat: CATEGORY_IDS.BEVERAGE, unit: 'ขวด', price: 20 },
  { keywords: ['คาราบาว', 'carabao'], name: 'คาราบาวแดง เครื่องดื่มชูกำลัง', cat: CATEGORY_IDS.BEVERAGE, unit: 'ขวด', price: 10 },
  { keywords: ['m-150', 'เอ็ม-150', 'm150'], name: 'เครื่องดื่ม เอ็ม-150', cat: CATEGORY_IDS.BEVERAGE, unit: 'ขวด', price: 12 },
  { keywords: ['สปอนเซอร์', 'sponsor'], name: 'เครื่องดื่มเกลือแร่ สปอนเซอร์', cat: CATEGORY_IDS.BEVERAGE, unit: 'ขวด', price: 13 },
  { keywords: ['ดัชมิลล์', 'dutch mill'], name: 'นมเปรี้ยว ดัชมิลล์', cat: CATEGORY_IDS.BEVERAGE, unit: 'ขวด', price: 12 },
  { keywords: ['โฟร์โมสต์', 'foremost'], name: 'นมยูเอชที โฟร์โมสต์', cat: CATEGORY_IDS.BEVERAGE, unit: 'กล่อง', price: 13 },
  { keywords: ['แลคตาซอย', 'lactasoy'], name: 'นมถั่วเหลือง แลคตาซอย', cat: CATEGORY_IDS.BEVERAGE, unit: 'กล่อง', price: 12 },
  { keywords: ['ไวตามิลค์', 'vitamilk'], name: 'นมถั่วเหลือง ไวตามิลค์', cat: CATEGORY_IDS.BEVERAGE, unit: 'กล่อง', price: 15 },
  { keywords: ['เนสกาแฟ', 'nescafe'], name: 'กาแฟปรุงสำเร็จ เนสกาแฟ', cat: CATEGORY_IDS.BEVERAGE, unit: 'กระป๋อง', price: 17 },
  { keywords: ['เบอร์ดี้', 'birdy'], name: 'กาแฟกระป๋อง เบอร์ดี้', cat: CATEGORY_IDS.BEVERAGE, unit: 'กระป๋อง', price: 17 },
  { keywords: ['ช้าง', 'chang'], name: 'เบียร์ช้าง (Chang)', cat: CATEGORY_IDS.BEVERAGE, unit: 'กระป๋อง', price: 42 },
  { keywords: ['ลีโอ', 'leo'], name: 'เบียร์ลีโอ (Leo)', cat: CATEGORY_IDS.BEVERAGE, unit: 'กระป๋อง', price: 42 },

  // บะหมี่ & เครื่องปรุง
  { keywords: ['มาม่า', 'mama'], name: 'บะหมี่กึ่งสำเร็จรูป มาม่า', cat: CATEGORY_IDS.DRY_FOOD, unit: 'ซอง', price: 7 },
  { keywords: ['ไวไว', 'waiwai'], name: 'บะหมี่กึ่งสำเร็จรูป ไวไว', cat: CATEGORY_IDS.DRY_FOOD, unit: 'ซอง', price: 7 },
  { keywords: ['ยำยำ', 'yumyum'], name: 'บะหมี่กึ่งสำเร็จรูป ยำยำ', cat: CATEGORY_IDS.DRY_FOOD, unit: 'ซอง', price: 7 },
  { keywords: ['คนอร์', 'knorr'], name: 'ซุปก้อน คนอร์', cat: CATEGORY_IDS.DRY_FOOD, unit: 'กล่อง', price: 15 },
  { keywords: ['รสดี', 'rosdee'], name: 'ผงปรุงรส รสดี', cat: CATEGORY_IDS.DRY_FOOD, unit: 'ซอง', price: 10 },
  { keywords: ['อายิโนะโมะโต๊ะ', 'ajinomoto'], name: 'ผงชูรส อายิโนะโมะโต๊ะ', cat: CATEGORY_IDS.DRY_FOOD, unit: 'ซอง', price: 15 },
  { keywords: ['ภูเขาทอง', 'golden mountain'], name: 'ซอสปรุงรสฝาเขียว ภูเขาทอง', cat: CATEGORY_IDS.DRY_FOOD, unit: 'ขวด', price: 25 },
  { keywords: ['แม็กกี้', 'maggi'], name: 'ซอสปรุงรส แม็กกี้', cat: CATEGORY_IDS.DRY_FOOD, unit: 'ขวด', price: 28 },
  { keywords: ['ทิพรส', 'tiparos'], name: 'น้ำปลาแท้ ทิพรส', cat: CATEGORY_IDS.DRY_FOOD, unit: 'ขวด', price: 32 },
  { keywords: ['มิตรผล', 'mitr phol'], name: 'น้ำตาลทรายขาว มิตรผล', cat: CATEGORY_IDS.DRY_FOOD, unit: 'ถุง', price: 28 },
  { keywords: ['ปลากระป๋อง', 'สามแม่ครัว', 'roza', 'โรซ่า'], name: 'ปลากระป๋องในซอสมะเขือเทศ', cat: CATEGORY_IDS.DRY_FOOD, unit: 'กระป๋อง', price: 20 },

  // ของใช้ในบ้าน
  { keywords: ['ซันไลต์', 'sunlight'], name: 'น้ำยาล้างจาน ซันไลต์', cat: CATEGORY_IDS.HOUSEHOLD, unit: 'ถุง', price: 18 },
  { keywords: ['บรีส', 'breeze'], name: 'ผงซักฟอก บรีส เอกเซล', cat: CATEGORY_IDS.HOUSEHOLD, unit: 'ถุง', price: 35 },
  { keywords: ['โอโม', 'omo'], name: 'ผงซักฟอก โอโม', cat: CATEGORY_IDS.HOUSEHOLD, unit: 'ถุง', price: 32 },
  { keywords: ['ดาวน์นี่', 'downy'], name: 'น้ำยาปรับผ้านุ่ม ดาวน์นี่', cat: CATEGORY_IDS.HOUSEHOLD, unit: 'ซอง', price: 20 },
  { keywords: ['คอมฟอร์ท', 'comfort'], name: 'น้ำยาปรับผ้านุ่ม คอมฟอร์ท', cat: CATEGORY_IDS.HOUSEHOLD, unit: 'ซอง', price: 15 },
  { keywords: ['ไฮยีน', 'hygiene'], name: 'น้ำยาปรับผ้านุ่ม ไฮยีน', cat: CATEGORY_IDS.HOUSEHOLD, unit: 'ซอง', price: 15 },
  { keywords: ['สก็อตต์', 'scott'], name: 'กระดาษชำระ สก็อตต์', cat: CATEGORY_IDS.HOUSEHOLD, unit: 'ม้วน', price: 15 },
  { keywords: ['คอลเกต', 'colgate'], name: 'ยาสีฟัน คอลเกต', cat: CATEGORY_IDS.HOUSEHOLD, unit: 'หลอด', price: 39 },

  // ของสด / ตลาดสด
  { keywords: ['หมู', 'เนื้อหมู', 'หมูสับ', 'หมูบด'], name: 'หมูสดคุณภาพดี', cat: CATEGORY_IDS.FRESH, unit: 'กก.', isWeighted: true, price: 150 },
  { keywords: ['ไก่', 'อกไก่', 'น่องไก่', 'สะโพกไก่'], name: 'ไก่สดตัดแต่ง', cat: CATEGORY_IDS.FRESH, unit: 'กก.', isWeighted: true, price: 95 },
  { keywords: ['ไข่ไก่', 'ไข่'], name: 'ไข่ไก่สด เบอร์ 2', cat: CATEGORY_IDS.FRESH, unit: 'แผง', isWeighted: false, price: 125 },
  { keywords: ['แตงกวา'], name: 'แตงกวาสด', cat: CATEGORY_IDS.VEG, unit: 'กก.', isWeighted: true, price: 35 },
  { keywords: ['กะหล่ำปลี'], name: 'กะหล่ำปลีสด', cat: CATEGORY_IDS.VEG, unit: 'กก.', isWeighted: true, price: 40 },
  { keywords: ['มะนาว'], name: 'มะนาวแป้นสด', cat: CATEGORY_IDS.VEG, unit: 'กก.', isWeighted: true, price: 60 },
];

/**
 * Smart Local Thai Retail Semantic Parser (Fallback when no Gemini key is active)
 */
async function parseWithLocalSemanticEngine(imageSource, onProgress) {
  onProgress?.({ status: 'กำลังอ่านข้อความและเปรียบเทียบฐานข้อมูลสินค้าไทย...', progress: 0.3 });

  // Dynamically import ocrLabelScanner to read OCR text
  let rawText = '';
  try {
    const { extractProductNameFromImage } = await import('./ocrLabelScanner');
    const ocrRes = await extractProductNameFromImage(imageSource, onProgress);
    rawText = (ocrRes.rawText || ocrRes.bestName || '').toLowerCase();
  } catch (err) {
    console.warn('Local OCR fallback warning:', err);
  }

  // Look for volume or size (e.g. 325 มล., 42 กรัม, 500 ml, 1 ลิตร)
  let detectedSize = '';
  const sizeMatch = rawText.match(/(\d+\.?\d*)\s*(มล\.|กรัม|ก\.|กก\.|ลิตร|ml|g|kg|l)\b/i);
  if (sizeMatch) {
    detectedSize = `${sizeMatch[1]} ${sizeMatch[2]}`;
  }

  // Search against Thai Retail Brands Catalog
  let bestMatch = null;
  let bestScore = 0;

  for (const item of THAI_BRANDS_CATALOG) {
    for (const kw of item.keywords) {
      if (rawText.includes(kw.toLowerCase())) {
        const score = kw.length * 2;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = item;
        }
      }
    }
  }

  if (bestMatch) {
    const fullName = detectedSize ? `${bestMatch.name} ${detectedSize}` : bestMatch.name;
    return {
      name: fullName,
      categoryId: bestMatch.cat,
      unit: bestMatch.unit,
      isWeighted: Boolean(bestMatch.isWeighted),
      suggestedPrice: bestMatch.price,
      suggestedCost: Math.round(bestMatch.price * 0.78),
      barcode: null,
      candidates: [fullName, bestMatch.name],
      aiEngine: 'local_semantic',
    };
  }

  // If no known brand matched, clean up top OCR line gracefully
  const cleanLine = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length >= 3 && !/^\d+$/.test(l))[0] || '';

  return {
    name: cleanLine || 'สินค้าใหม่ (โปรดระบุชื่อ)',
    categoryId: CATEGORY_IDS.DRY_FOOD,
    unit: 'ชิ้น',
    isWeighted: false,
    suggestedPrice: null,
    suggestedCost: null,
    barcode: null,
    candidates: cleanLine ? [cleanLine] : [],
    aiEngine: 'local_ocr',
    isFallback: true,
  };
}

/**
 * Main AI Recognition Function: Analyzes a product image and extracts full catalog data
 * @param {File|Blob|string} imageSource
 * @param {Object} options - { apiKey, onProgress }
 */
export async function analyzeProductWithAI(imageSource, options = {}) {
  const { onProgress } = options;
  const apiKey = (options.apiKey || getActiveGeminiApiKey()).trim();

  // 1. If Gemini API Key is available, use Gemini Multimodal Vision!
  if (apiKey) {
    try {
      const payload = await toBase64Payload(imageSource);
      const geminiResult = await callGeminiVision(payload, apiKey, onProgress);
      onProgress?.({ status: '✨ AI ระบุข้อมูลสินค้าสำเร็จ 100%!', progress: 1 });
      return {
        success: true,
        aiEngine: 'gemini',
        ...geminiResult,
      };
    } catch (err) {
      console.warn('Gemini AI Vision call failed, falling back to local engine:', err);
      // Fall through to local parser
    }
  }

  // 2. Fallback to Local Semantic Parser
  const localResult = await parseWithLocalSemanticEngine(imageSource, onProgress);
  onProgress?.({ status: 'ประมวลผลเสร็จสิ้น', progress: 1 });
  return {
    success: true,
    hasGeminiKey: Boolean(apiKey),
    ...localResult,
  };
}
