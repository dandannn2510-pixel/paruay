import generatePayload from 'promptpay-qr';
import QRCode from 'qrcode';

/**
 * Generate a PromptPay QR Data URL
 * @param {string} promptpayId - Mobile number (08XXXXXXXX) or Tax/National ID (13 digits)
 * @param {number} amount - Amount in THB (can be undefined or 0 for open amount)
 * @returns {Promise<string>} Data URL string of QR Code
 */
export async function generatePromptPayQR(promptpayId, amount = 0) {
  try {
    const cleanId = String(promptpayId || '').replace(/[^0-9]/g, '');
    if (!cleanId) {
      throw new Error('ไม่พบหมายเลขพร้อมเพย์ของร้าน');
    }

    const payload = generatePayload(cleanId, { amount: Number(amount) || 0 });
    const qrDataUrl = await QRCode.toDataURL(payload, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 320,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    });

    return {
      payload,
      qrDataUrl,
    };
  } catch (error) {
    console.error('Failed to generate PromptPay QR:', error);
    throw error;
  }
}
