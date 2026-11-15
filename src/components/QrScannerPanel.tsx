import React, { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import {
  AlertCircle,
  Camera,
  CameraOff,
  CheckCircle2,
  ImagePlus,
  QrCode,
  RotateCcw,
} from 'lucide-react';
import { COMPETITION_MAP, parseQrPayload, Registration } from '../types/registration';
import { formatDateTimeId } from '../utils/formatDate';

interface QrScannerPanelProps {
  registrations: Registration[];
  onCheckIn: (id: string, checkedIn: boolean) => Promise<void>;
  isOnline?: boolean;
}

type ScanFeedback =
  | { status: 'checked-in-now'; registration: Registration }
  | { status: 'already-checked-in'; registration: Registration }
  | { status: 'not-found'; rawCode: string }
  | { status: 'invalid-format'; rawCode: string };

export const QrScannerPanel: React.FC<QrScannerPanelProps> = ({
  registrations,
  onCheckIn,
  isOnline = true,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastScannedRef = useRef<{ value: string; timestamp: number }>({
    value: '',
    timestamp: 0,
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState<ScanFeedback | null>(null);

  const stopCamera = useCallback(() => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const handleDecodedString = useCallback(
    async (rawText: string) => {
      if (isProcessing) return;

      const now = Date.now();
      if (
        lastScannedRef.current.value === rawText &&
        now - lastScannedRef.current.timestamp < 3000
      ) {
        return;
      }
      lastScannedRef.current = { value: rawText, timestamp: now };

      const parsed = parseQrPayload(rawText);
      if (!parsed) {
        setFeedback({ status: 'invalid-format', rawCode: rawText });
        return;
      }

      const matched = registrations.find(
        (item) =>
          (parsed.id && item.id === parsed.id) ||
          (parsed.code && item.registrationCode.toUpperCase() === parsed.code.toUpperCase())
      );

      if (!matched) {
        setFeedback({
          status: 'not-found',
          rawCode: parsed.code ?? parsed.id ?? rawText,
        });
        return;
      }

      if (matched.checkedIn) {
        setFeedback({ status: 'already-checked-in', registration: matched });
        return;
      }

      setIsProcessing(true);
      try {
        await onCheckIn(matched.id, true);
        setFeedback({
          status: 'checked-in-now',
          registration: {
            ...matched,
            checkedIn: true,
            checkedInAt: new Date().toISOString(),
          },
        });
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, onCheckIn, registrations]
  );

  const startCamera = useCallback(async () => {
    setCameraError(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError(
        'Browser ini tidak mendukung akses kamera langsung. Gunakan tombol Upload / Foto QR atau input kode manual.'
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      setIsCameraActive(true);

      // Tunggu ref video terpasang
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
    } catch (err) {
      console.error('Gagal membuka kamera:', err);
      setCameraError(
        'Izin kamera tidak diberikan atau kamera tidak tersedia. Pastikan izin kamera aktif di browser HP, atau gunakan Foto QR / Kode Manual di bawah.'
      );
      stopCamera();
    }
  }, [stopCamera]);

  useEffect(() => {
    if (!isCameraActive) return;

    let lastTick = 0;
    const scanFrame = (timestamp: number) => {
      if (!isCameraActive) return;

      if (timestamp - lastTick >= 150) {
        lastTick = timestamp;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
          const width = video.videoWidth;
          const height = video.videoHeight;
          if (width > 0 && height > 0) {
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (ctx) {
              ctx.drawImage(video, 0, 0, width, height);
              const imageData = ctx.getImageData(0, 0, width, height);
              const code = jsQR(imageData.data, width, height, {
                inversionAttempts: 'dontInvert',
              });
              if (code?.data) {
                void handleDecodedString(code.data);
              }
            }
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(scanFrame);
    };

    animFrameRef.current = requestAnimationFrame(scanFrame);
    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isCameraActive, handleDecodedString]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    try {
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Gagal membaca gambar'));
        img.src = objectUrl;
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, canvas.width, canvas.height, {
        inversionAttempts: 'attemptBoth',
      });

      if (code?.data) {
        lastScannedRef.current = { value: '', timestamp: 0 };
        await handleDecodedString(code.data);
      } else {
        setFeedback({
          status: 'invalid-format',
          rawCode: 'QR Code tidak terdeteksi pada gambar tersebut.',
        });
      }
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    lastScannedRef.current = { value: '', timestamp: 0 };
    await handleDecodedString(manualCode.trim());
    setManualCode('');
  };

  return (
    <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Left: Camera & Manual Scanner */}
      <div className="rounded-xl border border-[#E7E2DC] bg-white p-5 sm:p-6 lg:col-span-7">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EFECE6] pb-4">
          <div>
            <h2 className="text-base font-bold text-[#1C1917] sm:text-lg">
              Scanner QR Daftar Ulang
            </h2>
            <p className="mt-0.5 text-xs text-[#57534E]">
              {isOnline
                ? 'Gunakan kamera HP/webcam, unggah foto QR, atau ketik kode / scan via alat USB barcode scanner.'
                : 'Mode offline aktif: hasil scan disimpan di perangkat ini dan akan tersinkronisasi otomatis saat internet kembali.'}
            </p>
          </div>

          {!isCameraActive ? (
            <button
              type="button"
              onClick={() => void startCamera()}
              className="inline-flex min-h-[42px] shrink-0 items-center gap-2 whitespace-nowrap rounded-lg bg-[#8B1520] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#6D0F18] sm:text-sm"
            >
              <Camera className="h-4 w-4" aria-hidden="true" />
              Buka Kamera
            </button>
          ) : (
            <button
              type="button"
              onClick={stopCamera}
              className="inline-flex min-h-[42px] shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border border-[#D6D0C8] bg-white px-4 py-2 text-xs font-semibold text-[#1C1917] transition-colors hover:bg-[#FAF9F7] sm:text-sm"
            >
              <CameraOff className="h-4 w-4 text-[#8B1520]" aria-hidden="true" />
              Matikan Kamera
            </button>
          )}
        </div>

        {/* Camera Viewport */}
        <div className="mt-4">
          {isCameraActive ? (
            <div className="relative overflow-hidden rounded-xl border border-[#1C1917]/20 bg-black">
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className="aspect-video w-full object-cover"
              />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-48 w-48 rounded-2xl border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)] sm:h-56 sm:w-56" />
              </div>
              <p className="absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-black/65 px-3 py-1 text-xs font-medium text-white">
                Posisikan QR Code di dalam kotak
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#D6D0C8] bg-[#FAF9F7] px-6 py-10 text-center">
              <QrCode className="h-10 w-10 text-[#8B1520]" aria-hidden="true" />
              <p className="mt-3 text-sm font-semibold text-[#1C1917]">
                Kamera scanner belum aktif
              </p>
              <p className="mt-1 max-w-md text-xs text-[#57534E]">
                Tidak ada kamera di PC/laptop? Klik <strong>Foto / Upload QR</strong> untuk memilih gambar/screenshot tiket, ketik kode peserta di bawah, atau scan langsung lewat kamera HP panitia dengan PIN yang sama.
              </p>

              <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={() => void startCamera()}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-[#8B1520] px-4 py-2 text-xs font-semibold text-white hover:bg-[#6D0F18]"
                >
                  <Camera className="h-4 w-4" aria-hidden="true" />
                  Aktifkan Kamera
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[#D6D0C8] bg-white px-4 py-2 text-xs font-semibold text-[#1C1917] hover:bg-[#FAF9F7]"
                >
                  <ImagePlus className="h-4 w-4 text-[#8B1520]" aria-hidden="true" />
                  Foto / Upload QR
                </button>
              </div>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => void handleImageUpload(e)}
            className="hidden"
          />
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {cameraError && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{cameraError}</span>
          </div>
        )}

        {/* Fallback: Manual Code, USB Scanner & Photo Scan */}
        <form onSubmit={handleManualSubmit} className="mt-5 border-t border-[#EFECE6] pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="manual-checkin-code" className="text-xs font-semibold text-[#1C1917]">
              Input Kode Manual / USB Scanner QR
            </label>
            {isCameraActive && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#8B1520] hover:underline"
              >
                <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
                Scan dari Foto
              </button>
            )}
          </div>

          <div className="mt-2 flex gap-2">
            <input
              id="manual-checkin-code"
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Ketik kode peserta (misal: RI82-7K4M2) atau tembak dengan USB scanner"
              className="min-h-[42px] flex-1 rounded-lg border border-[#D6D0C8] bg-white px-3.5 py-2 font-mono text-sm uppercase text-[#1C1917] placeholder:font-sans placeholder:normal-case placeholder:text-[#A8A29E] focus:border-[#8B1520] focus:outline-none focus:ring-2 focus:ring-[#8B1520]/15"
            />
            <button
              type="submit"
              disabled={!manualCode.trim() || isProcessing}
              className="min-h-[42px] shrink-0 whitespace-nowrap rounded-lg bg-[#1C1917] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#44403C] disabled:opacity-50 sm:text-sm"
            >
              Verifikasi
            </button>
          </div>
        </form>
      </div>

      {/* Right: Scan Result Card */}
      <div className="rounded-xl border border-[#E7E2DC] bg-white p-5 sm:p-6 lg:col-span-5">
        <h3 className="border-b border-[#EFECE6] pb-3 text-base font-bold text-[#1C1917]">
          Hasil Verifikasi Daftar Ulang
        </h3>

        {!feedback ? (
          <div className="py-12 text-center">
            <p className="text-sm font-medium text-[#57534E]">
              Menunggu hasil scan QR Code atau verifikasi kode...
            </p>
            <p className="mt-1 text-xs text-[#78716C]">
              Data anak dan status kehadiran akan tampil di sini secara otomatis.
            </p>
          </div>
        ) : feedback.status === 'checked-in-now' || feedback.status === 'already-checked-in' ? (
          <div className="mt-4">
            <div
              className={`flex items-start gap-3 rounded-xl border p-4 ${
                feedback.status === 'checked-in-now'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : 'border-amber-200 bg-amber-50 text-amber-900'
              }`}
            >
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <div>
                <p className="text-sm font-bold">
                  {feedback.status === 'checked-in-now'
                    ? 'Daftar Ulang Berhasil! Peserta Hadir'
                    : 'Peserta Sudah Daftar Ulang Sebelumnya'}
                </p>
                <p className="mt-0.5 text-xs">
                  {feedback.registration.checkedInAt
                    ? `Tercatat hadir: ${formatDateTimeId(feedback.registration.checkedInAt)}`
                    : 'Status hadir sudah aktif.'}
                </p>
              </div>
            </div>

            <dl className="mt-4 space-y-2.5 rounded-xl border border-[#EFECE6] bg-[#FAF9F7] p-4 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-[#78716C]">Kode Daftar</dt>
                <dd className="font-mono font-bold text-[#8B1520] tabular-nums">
                  {feedback.registration.registrationCode}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#78716C]">Nama Anak</dt>
                <dd className="text-right font-bold text-[#1C1917]">
                  {feedback.registration.childName}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#78716C]">Umur</dt>
                <dd className="font-mono font-medium text-[#1C1917] tabular-nums">
                  {feedback.registration.age} Tahun
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#78716C]">Orang Tua</dt>
                <dd className="text-right font-medium text-[#1C1917]">
                  {feedback.registration.parentName}
                </dd>
              </div>
              <div className="border-t border-[#E7E2DC] pt-2.5">
                <dt className="text-xs text-[#78716C]">Lomba yang Diikuti</dt>
                <dd className="mt-1 text-xs font-semibold leading-relaxed text-[#1C1917]">
                  {feedback.registration.competitions
                    .map((id) => COMPETITION_MAP[id]?.name ?? id)
                    .join(' · ')}
                </dd>
              </div>
            </dl>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={async () => {
                  await onCheckIn(feedback.registration.id, false);
                  setFeedback(null);
                }}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-[#D6D0C8] bg-white px-3 py-1.5 text-xs font-medium text-[#57534E] hover:bg-[#FAF9F7]"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                Batalkan Kehadiran
              </button>

              <button
                type="button"
                onClick={() => {
                  lastScannedRef.current = { value: '', timestamp: 0 };
                  setFeedback(null);
                }}
                className="min-h-[38px] rounded-lg bg-[#8B1520] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#6D0F18]"
              >
                Scan Peserta Berikutnya
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <div
              role="alert"
              className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-900"
            >
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <div>
                <p className="text-sm font-bold">
                  {feedback.status === 'not-found'
                    ? 'Peserta Tidak Ditemukan'
                    : 'QR Code Tidak Dikenali'}
                </p>
                <p className="mt-1 text-xs">
                  {feedback.status === 'not-found'
                    ? `Kode "${feedback.rawCode}" belum terdaftar di database server.`
                    : feedback.rawCode}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                lastScannedRef.current = { value: '', timestamp: 0 };
                setFeedback(null);
              }}
              className="mt-4 min-h-[38px] w-full rounded-lg border border-[#D6D0C8] bg-white px-4 py-2 text-xs font-semibold text-[#1C1917] hover:bg-[#FAF9F7]"
            >
              Coba Scan Ulang
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
