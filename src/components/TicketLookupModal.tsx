import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, QrCode, Search, X } from 'lucide-react';
import { TicketLookupQuery } from '../services/registrationRepository';
import { COMPETITION_MAP, EventInfo, Registration } from '../types/registration';
import { QrTicketCard } from './QrTicketCard';

interface TicketLookupModalProps {
  isOpen: boolean;
  eventInfo: EventInfo;
  onClose: () => void;
  onLookup: (query: TicketLookupQuery) => Promise<Registration[]>;
}

export const TicketLookupModal: React.FC<TicketLookupModalProps> = ({
  isOpen,
  eventInfo,
  onClose,
  onLookup,
}) => {
  const [parentName, setParentName] = useState('');
  const [codeOrChild, setCodeOrChild] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Registration[] | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setParentName('');
      setCodeOrChild('');
      setError(null);
      setResults(null);
      return;
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedParent = parentName.trim();
    const trimmedSecond = codeOrChild.trim();
    if (trimmedParent.length < 2) {
      setError('Masukkan nama orang tua/wali sesuai saat mendaftar.');
      return;
    }
    if (trimmedSecond.length < 2) {
      setError('Masukkan Kode Pendaftaran (RI81-XXXXX) atau Nama Lengkap Anak.');
      return;
    }

    const isCode = /^RI81-[A-Z0-9]+$/i.test(trimmedSecond);
    setIsSearching(true);
    try {
      const found = await onLookup({
        parentName: trimmedParent,
        ...(isCode ? { registrationCode: trimmedSecond.toUpperCase() } : { childName: trimmedSecond }),
      });
      setResults(found);
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : 'Gagal mencari data tiket pendaftaran.'
      );
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/45 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lookup-modal-title"
    >
      <div className="relative my-auto w-full max-w-lg overflow-hidden rounded-2xl border border-[#E7E2DC] bg-white shadow-xl">
        <div className="h-1.5 w-full bg-gradient-to-r from-[#8B1520] via-[#C8102E] to-[#B58517]" />

        <div className="max-h-[90vh] overflow-y-auto p-6">
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup pencarian tiket"
            className="absolute right-4 top-5 rounded-lg p-2 text-[#78716C] hover:bg-[#FAF9F7] hover:text-[#1C1917]"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex items-start gap-3 pr-8">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#8B1520]/10 text-[#8B1520]">
              <QrCode className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h3 id="lookup-modal-title" className="text-lg font-bold text-[#1C1917]">
                Cek &amp; Unduh Ulang Tiket QR
              </h3>
              <p className="mt-0.5 text-xs text-[#57534E]">
                Lupa menyimpan tiket? Masukkan nama orang tua dan nama anak atau kode pendaftaran.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label htmlFor="lookup-parent" className="mb-1 block text-xs font-semibold text-[#1C1917]">
                Nama Orang Tua / Wali <span className="text-[#8B1520]">*</span>
              </label>
              <input
                id="lookup-parent"
                type="text"
                value={parentName}
                onChange={(e) => setParentName(e.target.value)}
                placeholder="Sama persis seperti saat mendaftar"
                className="min-h-[42px] w-full rounded-lg border border-[#D6D0C8] bg-white px-3.5 py-2 text-sm text-[#1C1917] focus:border-[#8B1520] focus:outline-none focus:ring-2 focus:ring-[#8B1520]/15"
              />
            </div>

            <div>
              <label htmlFor="lookup-second" className="mb-1 block text-xs font-semibold text-[#1C1917]">
                Kode Pendaftaran atau Nama Lengkap Anak <span className="text-[#8B1520]">*</span>
              </label>
              <input
                id="lookup-second"
                type="text"
                value={codeOrChild}
                onChange={(e) => setCodeOrChild(e.target.value)}
                placeholder="Contoh: RI82-7K4M2 atau Bagas Pratama"
                className="min-h-[42px] w-full rounded-lg border border-[#D6D0C8] bg-white px-3.5 py-2 text-sm text-[#1C1917] focus:border-[#8B1520] focus:outline-none focus:ring-2 focus:ring-[#8B1520]/15"
              />
            </div>

            {error && (
              <p className="flex items-center gap-1.5 text-xs font-medium text-red-700">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </p>
            )}

            <button
              type="submit"
              disabled={isSearching}
              className="inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-lg bg-[#8B1520] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#6D0F18] disabled:opacity-60"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
              {isSearching ? 'Mencari Tiket...' : 'Cari Tiket Saya'}
            </button>
          </form>

          {results !== null && (
            <div className="mt-6 border-t border-[#EFECE6] pt-5">
              {results.length === 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
                  Data tidak ditemukan. Pastikan ejaan <strong>Nama Orang Tua</strong> dan{' '}
                  <strong>Nama Anak / Kode Pendaftaran</strong> sama persis dengan saat mendaftar.
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs font-semibold text-emerald-800">
                    Ditemukan {results.length} tiket pendaftaran:
                  </p>
                  {results.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-[#E7E2DC] bg-[#FAF9F7] p-4"
                    >
                      <div className="mb-3 flex items-center justify-between gap-2 text-left">
                        <div>
                          <p className="text-sm font-bold text-[#1C1917]">
                            {item.childName} ({item.age} Tahun)
                          </p>
                          <p className="text-xs text-[#57534E]">
                            {item.competitions
                              .map((id) => COMPETITION_MAP[id]?.name ?? id)
                              .join(' · ')}
                          </p>
                        </div>
                        {item.checkedIn && (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-800">
                            <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                            Sudah Hadir
                          </span>
                        )}
                      </div>
                      <QrTicketCard registration={item} eventInfo={eventInfo} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
