import React, { useState } from 'react';
import { AlertCircle, Check, QrCode } from 'lucide-react';
import {
  COMPETITIONS,
  CompetitionId,
  CreateRegistrationInput,
} from '../types/registration';

interface RegistrationFormProps {
  selectedCompetitions: CompetitionId[];
  onToggleCompetition: (id: CompetitionId) => void;
  onResetCompetitions: () => void;
  onSubmitRegistration: (input: CreateRegistrationInput) => Promise<void>;
  onOpenTicketLookup?: () => void;
}

interface FormErrors {
  childName?: string;
  parentName?: string;
  age?: string;
  whatsapp?: string;
  competitions?: string;
}

const AGE_OPTIONS = Array.from({ length: 13 }, (_, i) => i + 3); // 3 sampai 15 tahun

export const RegistrationForm: React.FC<RegistrationFormProps> = ({
  selectedCompetitions,
  onToggleCompetition,
  onResetCompetitions,
  onSubmitRegistration,
  onOpenTicketLookup,
}) => {
  const [childName, setChildName] = useState('');
  const [parentName, setParentName] = useState('');
  const [age, setAge] = useState<string>('');
  const [whatsapp, setWhatsapp] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = (): boolean => {
    const nextErrors: FormErrors = {};

    if (!childName.trim()) {
      nextErrors.childName = 'Nama lengkap anak wajib diisi.';
    } else if (childName.trim().length < 2) {
      nextErrors.childName = 'Nama lengkap anak minimal 2 karakter.';
    }

    if (!parentName.trim()) {
      nextErrors.parentName = 'Nama orang tua / wali wajib diisi.';
    } else if (parentName.trim().length < 2) {
      nextErrors.parentName = 'Nama orang tua / wali minimal 2 karakter.';
    }

    const parsedAge = Number.parseInt(age, 10);
    if (!age || Number.isNaN(parsedAge) || parsedAge < 3 || parsedAge > 15) {
      nextErrors.age = 'Silakan pilih umur anak antara 3 hingga 15 tahun.';
    }

    if (whatsapp.trim()) {
      const digitsOnly = whatsapp.replace(/[^\d+]/g, '');
      if (digitsOnly.length < 9 || digitsOnly.length > 16) {
        nextErrors.whatsapp = 'Nomor WhatsApp tidak valid (contoh: 081234567890).';
      }
    }

    if (selectedCompetitions.length === 0) {
      nextErrors.competitions = 'Pilih minimal satu cabang lomba yang ingin diikuti.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmitRegistration({
        childName: childName.trim(),
        parentName: parentName.trim(),
        age: Number.parseInt(age, 10),
        whatsapp: whatsapp.trim(),
        competitions: selectedCompetitions,
      });

      setChildName('');
      setParentName('');
      setAge('');
      setWhatsapp('');
      setErrors({});
      onResetCompetitions();
    } catch {
      setSubmitError('Terjadi kendala saat menyimpan pendaftaran. Silakan coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section
      id="form-pendaftaran"
      className="mx-auto max-w-4xl px-4 pb-16 pt-10 sm:px-6 sm:pt-12 lg:px-8"
    >
      <div className="overflow-hidden rounded-2xl border border-[#E7E2DC] bg-white">
        {/* Top Merdeka red & gold accent strip */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#8B1520] via-[#C8102E] to-[#B58517]" />

        <div className="p-6 sm:p-8 lg:p-10">
          <div className="flex flex-col gap-3 border-b border-[#EFECE6] pb-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-[#1C1917] sm:text-2xl">
                Formulir Pendaftaran Peserta
              </h2>
              <p className="mt-1.5 text-sm text-[#57534E]">
                Lengkapi data anak dan pilih cabang perlombaan. Bidang bertanda{' '}
                <span className="font-semibold text-[#8B1520]">*</span> wajib diisi.
              </p>
            </div>

            {onOpenTicketLookup && (
              <button
                type="button"
                onClick={onOpenTicketLookup}
                className="inline-flex min-h-[38px] shrink-0 items-center gap-1.5 self-start whitespace-nowrap rounded-lg border border-[#D6D0C8] bg-[#FAF9F7] px-3.5 py-2 text-xs font-semibold text-[#1C1917] transition-colors hover:bg-[#F1ECE4] sm:self-auto"
              >
                <QrCode className="h-3.5 w-3.5 text-[#8B1520]" aria-hidden="true" />
                Sudah daftar? Cek Tiket QR
              </button>
            )}
          </div>

          {submitError && (
            <div
              role="alert"
              className="mt-6 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3.5 text-sm text-red-800"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{submitError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-6">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {/* Nama Lengkap Anak */}
              <div>
                <label
                  htmlFor="childName"
                  className="mb-1.5 block text-sm font-semibold text-[#1C1917]"
                >
                  Nama Lengkap Anak <span className="text-[#8B1520]">*</span>
                </label>
                <input
                  id="childName"
                  name="childName"
                  type="text"
                  autoComplete="name"
                  value={childName}
                  onChange={(e) => {
                    setChildName(e.target.value);
                    if (errors.childName) setErrors((prev) => ({ ...prev, childName: undefined }));
                  }}
                  placeholder="Contoh: Bagas Pratama"
                  aria-invalid={Boolean(errors.childName)}
                  aria-describedby={errors.childName ? 'childName-error' : undefined}
                  className={`min-h-[44px] w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-[#1C1917] placeholder:text-[#A8A29E] focus:outline-none focus:ring-2 ${
                    errors.childName
                      ? 'border-red-500 focus:border-red-500 focus:ring-red-500/15'
                      : 'border-[#D6D0C8] focus:border-[#8B1520] focus:ring-[#8B1520]/15'
                  }`}
                />
                {errors.childName && (
                  <p
                    id="childName-error"
                    className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-red-700"
                  >
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>{errors.childName}</span>
                  </p>
                )}
              </div>

              {/* Nama Orang Tua / Wali */}
              <div>
                <label
                  htmlFor="parentName"
                  className="mb-1.5 block text-sm font-semibold text-[#1C1917]"
                >
                  Nama Orang Tua / Wali <span className="text-[#8B1520]">*</span>
                </label>
                <input
                  id="parentName"
                  name="parentName"
                  type="text"
                  value={parentName}
                  onChange={(e) => {
                    setParentName(e.target.value);
                    if (errors.parentName) setErrors((prev) => ({ ...prev, parentName: undefined }));
                  }}
                  placeholder="Contoh: Ibu Sari / Bapak Hendra"
                  aria-invalid={Boolean(errors.parentName)}
                  aria-describedby={errors.parentName ? 'parentName-error' : undefined}
                  className={`min-h-[44px] w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-[#1C1917] placeholder:text-[#A8A29E] focus:outline-none focus:ring-2 ${
                    errors.parentName
                      ? 'border-red-500 focus:border-red-500 focus:ring-red-500/15'
                      : 'border-[#D6D0C8] focus:border-[#8B1520] focus:ring-[#8B1520]/15'
                  }`}
                />
                {errors.parentName && (
                  <p
                    id="parentName-error"
                    className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-red-700"
                  >
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>{errors.parentName}</span>
                  </p>
                )}
              </div>

              {/* Umur Anak */}
              <div>
                <label
                  htmlFor="age"
                  className="mb-1.5 block text-sm font-semibold text-[#1C1917]"
                >
                  Umur Anak <span className="text-[#8B1520]">*</span>
                </label>
                <select
                  id="age"
                  name="age"
                  value={age}
                  onChange={(e) => {
                    setAge(e.target.value);
                    if (errors.age) setErrors((prev) => ({ ...prev, age: undefined }));
                  }}
                  aria-invalid={Boolean(errors.age)}
                  aria-describedby={errors.age ? 'age-error' : undefined}
                  className={`min-h-[44px] w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 ${
                    age ? 'text-[#1C1917]' : 'text-[#78716C]'
                  } ${
                    errors.age
                      ? 'border-red-500 focus:border-red-500 focus:ring-red-500/15'
                      : 'border-[#D6D0C8] focus:border-[#8B1520] focus:ring-[#8B1520]/15'
                  }`}
                >
                  <option value="">Pilih umur anak (3 – 15 tahun)</option>
                  {AGE_OPTIONS.map((year) => (
                    <option key={year} value={year} className="text-[#1C1917]">
                      {year} Tahun
                    </option>
                  ))}
                </select>
                {errors.age && (
                  <p
                    id="age-error"
                    className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-red-700"
                  >
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>{errors.age}</span>
                  </p>
                )}
              </div>

              {/* Nomor WhatsApp Orang Tua */}
              <div>
                <label
                  htmlFor="whatsapp"
                  className="mb-1.5 block text-sm font-semibold text-[#1C1917]"
                >
                  Nomor WhatsApp Orang Tua{' '}
                  <span className="font-normal text-[#78716C]">(Opsional)</span>
                </label>
                <input
                  id="whatsapp"
                  name="whatsapp"
                  type="tel"
                  inputMode="tel"
                  value={whatsapp}
                  onChange={(e) => {
                    setWhatsapp(e.target.value);
                    if (errors.whatsapp) setErrors((prev) => ({ ...prev, whatsapp: undefined }));
                  }}
                  placeholder="Contoh: 081234567890"
                  aria-invalid={Boolean(errors.whatsapp)}
                  aria-describedby={errors.whatsapp ? 'whatsapp-error' : undefined}
                  className={`min-h-[44px] w-full rounded-lg border bg-white px-3.5 py-2.5 font-mono text-sm text-[#1C1917] placeholder:font-sans placeholder:text-[#A8A29E] focus:outline-none focus:ring-2 ${
                    errors.whatsapp
                      ? 'border-red-500 focus:border-red-500 focus:ring-red-500/15'
                      : 'border-[#D6D0C8] focus:border-[#8B1520] focus:ring-[#8B1520]/15'
                  }`}
                />
                {errors.whatsapp ? (
                  <p
                    id="whatsapp-error"
                    className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-red-700"
                  >
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>{errors.whatsapp}</span>
                  </p>
                ) : (
                  <p className="mt-1.5 text-xs text-[#78716C]">
                    Digunakan panitia untuk info jadwal panggilan lomba.
                  </p>
                )}
              </div>
            </div>

            {/* Pilihan Perlombaan */}
            <fieldset className="pt-2">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <legend className="text-sm font-semibold text-[#1C1917]">
                  Pilihan Perlombaan <span className="text-[#8B1520]">*</span>
                </legend>
                <span className="text-xs text-[#57534E] tabular-nums">
                  Bisa pilih lebih dari satu · {selectedCompetitions.length} dipilih
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {COMPETITIONS.map((comp) => {
                  const checked = selectedCompetitions.includes(comp.id);
                  return (
                    <label
                      key={comp.id}
                      className={`flex min-h-[52px] cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors ${
                        checked
                          ? 'border-[#8B1520] bg-[#8B1520]/[0.04]'
                          : 'border-[#E7E2DC] bg-[#FAF9F7]/60 hover:border-[#D6CEC4] hover:bg-white'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          onToggleCompetition(comp.id);
                          if (errors.competitions) {
                            setErrors((prev) => ({ ...prev, competitions: undefined }));
                          }
                        }}
                        className="sr-only"
                      />
                      <span
                        aria-hidden="true"
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                          checked
                            ? 'border-[#8B1520] bg-[#8B1520] text-white'
                            : 'border-[#C7C0B6] bg-white text-transparent'
                        }`}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </span>
                      <span className="flex flex-col">
                        <span className="text-sm font-semibold text-[#1C1917]">{comp.name}</span>
                        <span className="mt-0.5 text-xs text-[#78716C]">{comp.ageHint}</span>
                      </span>
                    </label>
                  );
                })}
              </div>

              {errors.competitions && (
                <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-red-700">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{errors.competitions}</span>
                </p>
              )}
            </fieldset>

            {/* Submit Bar */}
            <div className="flex flex-col-reverse items-stretch justify-between gap-3 border-t border-[#EFECE6] pt-6 sm:flex-row sm:items-center">
              <p className="text-xs text-[#78716C]">
                Pastikan data sudah benar sebelum mengirim pendaftaran.
              </p>
              <button
                type="submit"
                disabled={isSubmitting}
                className="min-h-[46px] shrink-0 whitespace-nowrap rounded-lg bg-[#8B1520] px-7 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#6D0F18] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8B1520] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Mendaftarkan...' : 'Daftar Sekarang'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
};
