import QRCode from 'qrcode';
import JSZip from 'jszip';
import { ParticipantProfile } from '../types';

/**
 * Creates a clean, standardized QR payload for an attendee.
 * Includes explicit JSON attributes for the summit scanner, with the ID as fallback.
 */
export const buildQRPayload = (p: ParticipantProfile): string => {
  const payload = {
    id: p.id || '',
    event_id: p.event_id || '',
    name: p.name || '',
    email: p.email || '',
    company: p.company || '',
    category: p.category || 'Delegate',
    gender: (p as any).gender || '',
  };
  return JSON.stringify(payload);
};

const sanitizeFilename = (name: string): string => {
  return (name || 'guest')
    .trim()
    .replace(/[^a-zA-Z0-9_\- ]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 40);
};

/**
 * Renders a crisp 600x720 PNG badge image containing:
 * - Clean white background with subtle border
 * - Top header with Event Name
 * - Centered high-resolution QR code
 * - Attendee Name, Category, and Organization at the bottom
 */
export const generateQRImageBlob = async (
  p: ParticipantProfile,
  eventName: string = 'SummitSync Event'
): Promise<Blob> => {
  const payload = buildQRPayload(p);

  // Generate high-resolution QR matrix
  const qrDataUrl = await QRCode.toDataURL(payload, {
    errorCorrectionLevel: 'H',
    margin: 1,
    width: 480,
    color: {
      dark: '#020617',
      light: '#ffffff',
    },
  });

  // Render on offscreen canvas with attendee label
  const canvas = document.createElement('canvas');
  const width = 600;
  const height = 720;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Canvas 2D context not available');
  }

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Subtle outer border
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 4;
  ctx.strokeRect(8, 8, width - 16, height - 16);

  // Top banner accent
  ctx.fillStyle = '#10b981';
  ctx.fillRect(8, 8, width - 16, 12);

  // Event Name
  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 16px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(eventName.toUpperCase(), width / 2, 48);

  // Draw QR Image
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Failed to load QR code image'));
    img.src = qrDataUrl;
  });

  const qrX = (width - 480) / 2;
  const qrY = 64;
  ctx.drawImage(img, qrX, qrY, 480, 480);

  // Attendee Full Name
  ctx.fillStyle = '#0f172a';
  ctx.font = '900 24px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  const attendeeName = p.name || 'Registered Attendee';
  ctx.fillText(attendeeName, width / 2, 580);

  // Category & Company
  ctx.fillStyle = '#059669';
  ctx.font = 'bold 16px "Plus Jakarta Sans", sans-serif';
  const cat = (p.category || 'Delegate').toUpperCase();
  ctx.fillText(cat, width / 2, 615);

  ctx.fillStyle = '#64748b';
  ctx.font = 'normal 15px "Plus Jakarta Sans", sans-serif';
  const org = p.company || p.email || 'SummitSync Verified';
  ctx.fillText(org, width / 2, 645);

  // Identifier / Security Tag
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 11px monospace';
  const identifier = p.id ? `ID: ${p.id.slice(0, 16)}` : 'VERIFIED PASS';
  ctx.fillText(identifier, width / 2, 680);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to convert canvas to blob'));
    }, 'image/png');
  });
};

/**
 * Downloads a single attendee's QR code directly as a PNG.
 */
export const downloadSingleQR = async (
  p: ParticipantProfile,
  eventName: string = 'SummitSync'
): Promise<void> => {
  const blob = await generateQRImageBlob(p, eventName);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const filename = `${sanitizeFilename(p.name || 'attendee')}_QR.png`;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export interface BulkProgress {
  current: number;
  total: number;
  percent: number;
  currentName: string;
}

/**
 * Downloads a ZIP archive of all provided attendees' QR code PNG images.
 */
export const downloadBulkQRZip = async (
  participants: ParticipantProfile[],
  eventName: string = 'SummitSync',
  onProgress?: (progress: BulkProgress) => void
): Promise<void> => {
  if (!participants || participants.length === 0) {
    throw new Error('No participants selected for QR download');
  }

  const zip = new JSZip();
  const folder = zip.folder('qr_codes') || zip;
  const total = participants.length;

  const manifestRows: string[] = ['"Index","Name","Email","Category","Organization","QR_Filename"'];

  for (let i = 0; i < total; i++) {
    const p = participants[i];
    const safeName = sanitizeFilename(p.name || `guest_${i + 1}`);
    const filename = `${String(i + 1).padStart(3, '0')}_${safeName}_QR.png`;

    if (onProgress) {
      onProgress({
        current: i + 1,
        total,
        percent: Math.round(((i + 1) / total) * 100),
        currentName: p.name || `Guest #${i + 1}`,
      });
    }

    try {
      const blob = await generateQRImageBlob(p, eventName);
      folder.file(filename, blob);

      manifestRows.push(
        [
          i + 1,
          p.name || '',
          p.email || '',
          p.category || 'Delegate',
          p.company || '',
          filename,
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(',')
      );
    } catch (err) {
      console.warn(`Failed to generate QR for ${p.name}:`, err);
    }
  }

  // Include index spreadsheet / manifest inside the ZIP for easy reference
  zip.file('ROSTER_QR_INDEX.csv', manifestRows.join('\n'));

  // Generate and download ZIP file
  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = url;
  const zipFilename = `${sanitizeFilename(eventName)}_QR_Codes_${total}_Guests.zip`;
  a.download = zipFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};
