import React, { useEffect, useState } from 'react';
import { AlertCircle, Check, X } from 'lucide-react';
import {
  COMPETITIONS,
  CompetitionId,
  CreateRegistrationInput,
  Registration,
} from '../types/registration';

interface EditRegistrationModalProps {
  registration: Registration | null;
  onClose: () => void;
  onSave: (id: string, input: CreateRegistrationInput) => Promise<void>;
}

const AGE_OPTIONS = Array.from({ length: 13 }, (_, i) => i + 3);

export const EditRegistrationModal: React.FC<EditRegistrationModalProps> = ({
  registration,
  onClose,
  onSave,
}) => {
  const [childName, setChildName] = useState('');
  const [parentName, setParentName] = useState('');
  const [age, setAge] = useState<number>(8);
  const [whatsapp, setWhatsapp] = useState('');
  const [competitions, setCompetitions] = useState<CompetitionId[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!registration) return;
    setChildName(registration.childName);
    setParentName(registration.parentName);
    setAge(registration.age);
    setWhatsapp(registration.whatsapp);
    setCompetitions(registration.competitions);
    setError(null);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [registration, onClose]);

  if (!registration) return null;

  const toggleCompetition = (id: CompetitionId) => {
    setCompetitions((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (childName.trim().length < 2) {
      setError('Nama lengkap anak minimal 2 karakter.');
      return;
    }
    if (parentName.trim().length < 2) {
      setError('Nama orang tua / wali minimal 2 karakter.');
      return;
    }
    if (age < 3 || age > 15) {
      setError('Umur anak harus antara 3 hingga 15 tahun.');
      return;
    }
    if (competitions.length === 0) {
      setError('Pilih minimal satu cabang lomba.');
      return;
    }

    setIsSaving(true);
    try {
      await onSave(registration.id, {
        childName: childName.trim(),
        parentName: parentName.trim(),
        age,
        whatsapp: whatsapp.trim(),
        competitions,
      });
      onClose();
    } catch (err) {
      setError(
        err instanceof Error && err.message ? err.message : 'Gagal memperbarui data peserta.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/45 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-reg-title"
    >
      <div className="relative my-auto w-full max-w-lg overflow-hidden rounded-2xl border border-[#E7E2DC] bg-white shadow-xl">
        <div className="h-1.5 w-full bg-gradient-to-r from-[#8B1520] via-[#C8102E] to-[#B58517]" />

        <div className="max-h-[90vh] overflow-y-auto p-6">
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup form edit peserta"
            className="absolute right-4 top-5 rounded-lg p-2 text-[#78716C] hover:bg-[#FAF9F7] hover:text-[#1C1917]"
          >
            <X className="h-5 w-5" />
          </button>

          <p className="font-mono text-xs font-semibold text-[#8B1520]">
            Kode: {registration.registrationCode}
          </p>
          <h3 id="edit-reg-title" className="mt-0.5 text-lg font-bold text-[#1C1917]">
            Edit Data Peserta
          </h3>

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="edit-child-name" className="mb-1 block text-xs font-semibold text-[#1C1917]">
                  Nama Lengkap Anak <span className="text-[#8B1520]">*</span>
                </label>
                <input
                  id="edit-child-name"
                  type="text"
                  required
                  value={childName}
                  onChange={(e) => setChildName(e.target.value)}
                  className="min-h-[42px] w-full rounded-lg border border-[#D6D0C8] px-3 py-2 text-sm text-[#1C1917] focus:border-[#8B1520] focus:outline-none focus:ring-2 focus:ring-[#8B1520]/15"
                />
              </div>

              <div>
                <label htmlFor="edit-parent-name" className="mb-1 block text-xs font-semibold text-[#1C1917]">
                  Nama Orang Tua / Wali <span className="text-[#8B1520]">*</span>
                </label>
                <input
                  id="edit-parent-name"
                  type="text"
                  required
                  value={parentName}
                  onChange={(e) => setParentName(e.target.value)}
                  className="min-h-[42px] w-full rounded-lg border border-[#D6D0C8] px-3 py-2 text-sm text-[#1C1917] focus:border-[#8B1520] focus:outline-none focus:ring-2 focus:ring-[#8B1520]/15"
                />
              </div>

              <div>
                <label htmlFor="edit-age" className="mb-1 block text-xs font-semibold text-[#1C1917]">
                  Umur Anak <span className="text-[#8B1520]">*</span>
                </label>
                <select
                  id="edit-age"
                  value={age}
                  onChange={(e) => setAge(Number(e.target.value))}
                  className="min-h-[42px] w-full rounded-lg border border-[#D6D0C8] bg-white px-3 py-2 text-sm text-[#1C1917] focus:border-[#8B1520] focus:outline-none focus:ring-2 focus:ring-[#8B1520]/15"
                >
                  {AGE_OPTIONS.map((y) => (
                    <option key={y} value={y}>
                      {y} Tahun
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="edit-wa" className="mb-1 block text-xs font-semibold text-[#1C1917]">
                  Nomor WhatsApp
                </label>
                <input
                  id="edit-wa"
                  type="tel"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="081234567890"
                  className="min-h-[42px] w-full rounded-lg border border-[#D6D0C8] px-3 py-2 font-mono text-sm text-[#1C1917] focus:border-[#8B1520] focus:outline-none focus:ring-2 focus:ring-[#8B1520]/15"
                />
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold text-[#1C1917]">
                Cabang Perlombaan ({competitions.length} dipilih)
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {COMPETITIONS.map((comp) => {
                  const checked = competitions.includes(comp.id);
                  return (
                    <label
                      key={comp.id}
                      className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-xs transition-colors ${
                        checked
                          ? 'border-[#8B1520] bg-[#8B1520]/[0.05] font-semibold text-[#1C1917]'
                          : 'border-[#E7E2DC] bg-[#FAF9F7] text-[#44403C]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCompetition(comp.id)}
                        className="sr-only"
                      />
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          checked
                            ? 'border-[#8B1520] bg-[#8B1520] text-white'
                            : 'border-[#C7C0B6] bg-white text-transparent'
                        }`}
                      >
                        <Check className="h-3 w-3" />
                      </span>
                      <span>{comp.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {error && (
              <p className="flex items-center gap-1.5 text-xs font-medium text-red-700">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </p>
            )}

            <div className="flex justify-end gap-2 border-t border-[#EFECE6] pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="min-h-[40px] rounded-lg border border-[#D6D0C8] bg-white px-4 py-2 text-xs font-medium text-[#44403C] hover:bg-[#FAF9F7]"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="min-h-[40px] rounded-lg bg-[#8B1520] px-4 py-2 text-xs font-semibold text-white hover:bg-[#6D0F18] disabled:opacity-60"
              >
                {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
