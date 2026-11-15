import React, { useEffect } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { COMPETITION_MAP, EventInfo, Registration } from '../types/registration';
import { formatDateTimeId } from '../utils/formatDate';
import { QrTicketCard } from './QrTicketCard';

interface SuccessModalProps {
  registration: Registration | null;
  eventInfo: EventInfo;
  onClose: () => void;
  onRegisterAnother: () => void;
}

export const SuccessModal: React.FC<SuccessModalProps> = ({
  registration,
  eventInfo,
  onClose,
  onRegisterAnother,
}) => {
  useEffect(() => {
    if (!registration) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [registration, onClose]);

  if (!registration) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/45 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="success-modal-title"
    >
      <div className="relative my-auto w-full max-w-lg overflow-hidden rounded-2xl border border-[#E7E2DC] bg-white shadow-xl">
        <div className="h-1.5 w-full bg-gradient-to-r from-[#8B1520] via-[#C8102E] to-[#B58517]" />

        <div className="max-h-[90vh] overflow-y-auto p-6 sm:p-7">
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup popup konfirmasi"
            className="absolute right-4 top-5 rounded-lg p-2 text-[#78716C] transition-colors hover:bg-[#FAF9F7] hover:text-[#1C1917]"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex items-start gap-3.5 pr-8">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <h3
                id="success-modal-title"
                className="text-lg font-bold tracking-tight text-[#1C1917] sm:text-xl"
              >
                Pendaftaran Berhasil Dicatat
              </h3>
              <p className="mt-1 text-sm text-[#57534E]">
                Simpan tiket QR Code di bawah untuk di-scan panitia saat daftar ulang di lapangan.
              </p>
            </div>
          </div>

          <div className="mt-5">
            <QrTicketCard registration={registration} eventInfo={eventInfo} />
          </div>

          <div className="mt-4 rounded-xl border border-[#E7E2DC] bg-[#FAF9F7] p-4">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-[#78716C]">Nama Anak</dt>
                <dd className="text-right font-semibold text-[#1C1917]">{registration.childName}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[#78716C]">Orang Tua / Wali</dt>
                <dd className="text-right font-medium text-[#1C1917]">{registration.parentName}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[#78716C]">Umur</dt>
                <dd className="text-right font-medium text-[#1C1917] tabular-nums">
                  {registration.age} Tahun
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[#78716C]">No. WhatsApp</dt>
                <dd className="text-right font-mono text-xs font-medium text-[#1C1917] sm:text-sm">
                  {registration.whatsapp || '-'}
                </dd>
              </div>
              <div className="border-t border-[#E7E2DC] pt-2">
                <dt className="text-[#78716C]">Lomba yang Diikuti</dt>
                <dd className="mt-1 font-medium text-[#1C1917]">
                  {registration.competitions
                    .map((id) => COMPETITION_MAP[id]?.name ?? id)
                    .join(' · ')}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-[#E7E2DC] pt-2 text-xs">
                <dt className="text-[#78716C]">Waktu Daftar</dt>
                <dd className="text-right font-mono text-[#57534E] tabular-nums">
                  {formatDateTimeId(registration.createdAt)}
                </dd>
              </div>
            </dl>
          </div>

          <p className="mt-3 text-xs leading-relaxed text-[#78716C]">
            Jadwal &amp; Lokasi: {eventInfo.dateText} · {eventInfo.locationText}
          </p>

          <div className="mt-5 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[42px] rounded-lg border border-[#D6D0C8] bg-white px-4 py-2 text-sm font-medium text-[#1C1917] transition-colors hover:bg-[#FAF9F7]"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={onRegisterAnother}
              className="min-h-[42px] rounded-lg bg-[#8B1520] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#6D0F18]"
            >
              Daftarkan Anak Lain
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
