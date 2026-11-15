import React, { useEffect, useState } from 'react';
import { AlertCircle, Lock, X } from 'lucide-react';

interface PinPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerifyPin: (pin: string) => Promise<boolean>;
  onSuccess: () => void;
}

export const PinPromptModal: React.FC<PinPromptModalProps> = ({
  isOpen,
  onClose,
  onVerifyPin,
  onSuccess,
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setPin('');
      setError(null);
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
    setIsVerifying(true);
    try {
      const valid = await onVerifyPin(pin);
      if (!valid) {
        setError('PIN panitia tidak sesuai. Silakan periksa kembali.');
        return;
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : 'Gagal terhubung ke server. Silakan coba lagi.'
      );
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pin-prompt-title"
    >
      <div className="relative w-full max-w-sm rounded-2xl border border-[#E7E2DC] bg-white p-6 shadow-xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup dialog PIN"
          className="absolute right-3.5 top-3.5 rounded-lg p-2 text-[#78716C] hover:bg-[#FAF9F7] hover:text-[#1C1917]"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#8B1520]/10 text-[#8B1520]">
            <Lock className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h3 id="pin-prompt-title" className="text-base font-bold text-[#1C1917]">
              Verifikasi Panitia
            </h3>
            <p className="text-xs text-[#57534E]">
              Masukkan PIN panitia untuk mengubah info acara.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label htmlFor="modal-pin-input" className="mb-1.5 block text-xs font-semibold text-[#1C1917]">
              PIN Panitia (Default: 1708)
            </label>
            <input
              id="modal-pin-input"
              type="password"
              inputMode="numeric"
              autoFocus
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Masukkan 4 digit PIN"
              className="min-h-[44px] w-full rounded-lg border border-[#D6D0C8] bg-white px-3.5 py-2 font-mono text-base tracking-widest text-[#1C1917] focus:border-[#8B1520] focus:outline-none focus:ring-2 focus:ring-[#8B1520]/15"
            />
            {error && (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-red-700">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[40px] rounded-lg border border-[#D6D0C8] bg-white px-4 py-2 text-xs font-medium text-[#44403C] hover:bg-[#FAF9F7]"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isVerifying || !pin.trim()}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-[#8B1520] px-4 py-2 text-xs font-semibold text-white hover:bg-[#6D0F18] disabled:opacity-60"
            >
              {isVerifying ? 'Memverifikasi...' : 'Lanjutkan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
