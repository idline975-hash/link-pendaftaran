import React, { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Download, MessageCircle } from 'lucide-react';
import QRCode from 'qrcode';
import {
  buildQrPayload,
  COMPETITION_MAP,
  EventInfo,
  Registration,
} from '../types/registration';

interface QrTicketCardProps {
  registration: Registration;
  eventInfo: EventInfo;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

function formatWhatsAppTarget(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits || digits.includes('*')) return '';
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  if (digits.startsWith('62')) return digits;
  return digits;
}

export const QrTicketCard: React.FC<QrTicketCardProps> = ({ registration, eventInfo }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const payload = buildQrPayload(registration);

    QRCode.toDataURL(payload, {
      width: 320,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#1C1917',
        light: '#FFFFFF',
      },
    })
      .then((url) => {
        if (isMounted) setQrDataUrl(url);
      })
      .catch((err) => {
        console.error('Gagal membuat QR Code:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [registration]);

  const ticketSummaryText = useMemo(() => {
    const compNames = registration.competitions
      .map((id) => COMPETITION_MAP[id]?.name ?? id)
      .join(', ');
    return [
      `TIKET LOMBA HUT RI KE - 82`,
      `Kode Daftar: ${registration.registrationCode}`,
      `Nama Anak: ${registration.childName} (${registration.age} Tahun)`,
      `Orang Tua/Wali: ${registration.parentName}`,
      `Lomba: ${compNames}`,
      `Jadwal & Lokasi: ${eventInfo.dateText} · ${eventInfo.locationText}`,
      `Tunjukkan kode/QR ini saat daftar ulang.`,
    ].join('\n');
  }, [eventInfo.dateText, eventInfo.locationText, registration]);

  const whatsappHref = useMemo(() => {
    const target = formatWhatsAppTarget(registration.whatsapp);
    const encoded = encodeURIComponent(ticketSummaryText);
    return target ? `https://wa.me/${target}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
  }, [registration.whatsapp, ticketSummaryText]);

  const handleCopyInfo = async () => {
    try {
      await navigator.clipboard.writeText(ticketSummaryText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard restrictions
    }
  };

  const handleDownloadTicket = async () => {
    if (!qrDataUrl) return;
    setIsDownloading(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 820;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#8B1520';
      ctx.fillRect(0, 0, canvas.width, 118);

      ctx.fillStyle = '#B58517';
      ctx.fillRect(0, 118, canvas.width, 6);

      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText('TIKET DAFTAR ULANG PESERTA', canvas.width / 2, 54);
      ctx.font = '16px sans-serif';
      ctx.fillStyle = '#F5EFE6';
      ctx.fillText(eventInfo.title, canvas.width / 2, 88);

      const qrSize = 280;
      const qrX = (canvas.width - qrSize) / 2;
      const qrY = 154;

      ctx.strokeStyle = '#E7E2DC';
      ctx.lineWidth = 2;
      drawRoundedRect(ctx, qrX - 14, qrY - 14, qrSize + 28, qrSize + 28, 16);
      ctx.stroke();

      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Gagal memuat gambar QR'));
        img.src = qrDataUrl;
      });
      ctx.drawImage(img, qrX, qrY, qrSize, qrSize);

      ctx.fillStyle = '#8B1520';
      ctx.font = 'bold 28px monospace';
      ctx.fillText(registration.registrationCode, canvas.width / 2, 488);

      ctx.strokeStyle = '#EFECE6';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(48, 514);
      ctx.lineTo(canvas.width - 48, 514);
      ctx.stroke();

      ctx.textAlign = 'left';
      ctx.fillStyle = '#78716C';
      ctx.font = '15px sans-serif';
      ctx.fillText('Nama Peserta', 48, 550);
      ctx.fillStyle = '#1C1917';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText(
        `${registration.childName} (${registration.age} Tahun)`,
        48,
        580
      );

      ctx.fillStyle = '#78716C';
      ctx.font = '15px sans-serif';
      ctx.fillText('Orang Tua / Wali', 48, 620);
      ctx.fillStyle = '#1C1917';
      ctx.font = '600 18px sans-serif';
      ctx.fillText(registration.parentName, 48, 646);

      ctx.fillStyle = '#78716C';
      ctx.font = '15px sans-serif';
      ctx.fillText('Lomba yang Diikuti', 48, 686);
      ctx.fillStyle = '#1C1917';
      ctx.font = '600 16px sans-serif';
      const compNames = registration.competitions
        .map((id) => COMPETITION_MAP[id]?.name ?? id)
        .join(' · ');
      const lines = wrapCanvasText(ctx, compNames, canvas.width - 96);
      lines.slice(0, 2).forEach((line, idx) => {
        ctx.fillText(line, 48, 712 + idx * 24);
      });

      ctx.fillStyle = '#78716C';
      ctx.textAlign = 'center';
      ctx.font = '13px sans-serif';
      ctx.fillText(
        `Tunjukkan QR ini ke panitia saat daftar ulang · ${eventInfo.locationText}`,
        canvas.width / 2,
        792
      );

      const pngUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = pngUrl;
      link.download = `tiket-${registration.registrationCode}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="flex flex-col items-center rounded-xl border border-[#E7E2DC] bg-white p-4 text-center">
      {qrDataUrl ? (
        <img
          src={qrDataUrl}
          alt={`QR Code pendaftaran ${registration.registrationCode}`}
          className="h-40 w-40 rounded-lg border border-[#EFECE6] p-1"
        />
      ) : (
        <div className="flex h-40 w-40 items-center justify-center rounded-lg border border-[#EFECE6] bg-[#FAF9F7] text-xs text-[#78716C]">
          Membuat QR...
        </div>
      )}

      <p className="mt-2 font-mono text-sm font-bold text-[#8B1520] tabular-nums">
        {registration.registrationCode}
      </p>
      <p className="mt-0.5 text-xs text-[#57534E]">
        Tunjukkan QR Code ini ke panitia untuk scan daftar ulang.
      </p>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={handleDownloadTicket}
          disabled={!qrDataUrl || isDownloading}
          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-[#D6D0C8] bg-[#FAF9F7] px-3 py-1.5 text-xs font-semibold text-[#1C1917] transition-colors hover:bg-[#F1ECE4] disabled:opacity-60"
        >
          <Download className="h-3.5 w-3.5 text-[#8B1520]" aria-hidden="true" />
          {isDownloading ? 'Menyiapkan...' : 'Simpan QR (.png)'}
        </button>

        <button
          type="button"
          onClick={() => void handleCopyInfo()}
          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-[#D6D0C8] bg-white px-3 py-1.5 text-xs font-medium text-[#1C1917] transition-colors hover:bg-[#FAF9F7]"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
              <span className="text-emerald-700">Tersalin</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5 text-[#57534E]" aria-hidden="true" />
              <span>Salin Info</span>
            </>
          )}
        </button>

        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 transition-colors hover:bg-emerald-100"
        >
          <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
          Kirim WA
        </a>
      </div>
    </div>
  );
};
