// EAN-13 and Barcode utilities for in-store products (Prefix 2)

/**
 * Calculate EAN-13 checksum digit for a 12-digit string
 */
export function calculateEan13CheckDigit(twelveDigits) {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(twelveDigits[i], 10);
    // odd positions (index 0, 2, 4...) * 1, even positions (index 1, 3, 5...) * 3
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const mod = sum % 10;
  return mod === 0 ? 0 : 10 - mod;
}

/**
 * Generate a new in-store EAN-13 barcode
 * Uses prefix "20" (reserved for in-store usage by GS1 standards)
 */
export function generateInStoreBarcode(seedNumber = 1) {
  const padded = String(seedNumber).padStart(10, '0');
  const twelve = '20' + padded;
  const checkDigit = calculateEan13CheckDigit(twelve);
  return twelve + checkDigit;
}

/**
 * Validate EAN-13 string
 */
export function isValidEan13(code) {
  if (!code || typeof code !== 'string' || code.length !== 13 || !/^\d{13}$/.test(code)) {
    return false;
  }
  const twelve = code.slice(0, 12);
  const expectedCheck = calculateEan13CheckDigit(twelve);
  return parseInt(code[12], 10) === expectedCheck;
}

// EAN-13 patterns for encoding
const L_PATTERNS = [
  '0001101', '0011001', '0010011', '0111101', '0100011',
  '0110001', '0101111', '0111011', '0110111', '0001011'
];
const G_PATTERNS = [
  '0100111', '0110011', '0011011', '0100001', '0011101',
  '0111001', '0000101', '0010001', '0001001', '0010111'
];
const R_PATTERNS = [
  '1110010', '1100110', '1101100', '1000010', '1011100',
  '1001110', '1010000', '1000100', '1001000', '1110100'
];
const FIRST_DIGIT_STRUCTURE = [
  'LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG',
  'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'
];

/**
 * Convert EAN-13 to binary bar pattern for rendering
 */
export function getEan13BinaryPattern(ean13) {
  if (!/^\d{13}$/.test(ean13)) return null;
  const first = parseInt(ean13[0], 10);
  const leftGroup = ean13.slice(1, 7);
  const rightGroup = ean13.slice(7, 13);
  const structure = FIRST_DIGIT_STRUCTURE[first];

  let pattern = '101'; // Start guard

  for (let i = 0; i < 6; i++) {
    const digit = parseInt(leftGroup[i], 10);
    const type = structure[i];
    pattern += type === 'L' ? L_PATTERNS[digit] : G_PATTERNS[digit];
  }

  pattern += '01010'; // Center guard

  for (let i = 0; i < 6; i++) {
    const digit = parseInt(rightGroup[i], 10);
    pattern += R_PATTERNS[digit];
  }

  pattern += '101'; // End guard
  return pattern;
}
