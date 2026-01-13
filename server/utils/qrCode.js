const QRCode = require('qrcode');

async function generateQRCode(text) {
  try {
    return await QRCode.toDataURL(text);
  } catch (err) {
    throw new Error('QR code generation failed: ' + err.message);
  }
}

module.exports = { generateQRCode };