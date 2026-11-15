import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { EventInfo } from '../types/registration';

interface FaqSectionProps {
  eventInfo: EventInfo;
  onScrollToForm: () => void;
}

interface FaqItem {
  id: string;
  question: string;
  answer: React.ReactNode;
}

export const FaqSection: React.FC<FaqSectionProps> = ({ eventInfo, onScrollToForm }) => {
  const [openId, setOpenId] = useState<string>('batas-umur');

  const faqItems: FaqItem[] = [
    {
      id: 'batas-umur',
      question: 'Berapa batas umur peserta dan bagaimana pembagian kelompok lombanya?',
      answer: (
        <div className="space-y-2">
          <p>
            Pendaftaran terbuka untuk anak usia <strong className="font-semibold text-[#1C1917]">3 hingga 15 tahun</strong>.
            Agar perlombaan adil dan aman, panitia membagi babak pertandingan berdasarkan kelompok usia anak serta menyesuaikan tingkat kesulitan tiap cabang:
          </p>
          <ul className="list-disc space-y-1 pl-5 text-[#44403C]">
            <li>Lomba Mewarnai: usia 3–10 tahun (dibagi kategori TK dan SD)</li>
            <li>Makan Kerupuk: usia 4–15 tahun</li>
            <li>Memasukkan Paku ke Botol: usia 5–15 tahun</li>
            <li>Estafet Kelereng: usia 5–13 tahun</li>
            <li>Balap Karung: usia 6–15 tahun</li>
            <li>Tarik Tambang Anak: usia 7–15 tahun</li>
          </ul>
        </div>
      ),
    },
    {
      id: 'lokasi-jadwal',
      question: 'Di mana lokasi lengkap dan kapan jadwal perlombaan dimulai?',
      answer: (
        <div className="space-y-2">
          <p>
            Seluruh rangkaian perlombaan dilaksanakan pada{' '}
            <strong className="font-semibold text-[#1C1917]">{eventInfo.dateText}</strong> bertempat di{' '}
            <strong className="font-semibold text-[#1C1917]">{eventInfo.locationText}</strong>.
          </p>
          <p>
            Peserta dan orang tua dimohon hadir minimal 30 menit sebelum lomba dimulai untuk melakukan daftar ulang di meja panitia menggunakan kode pendaftaran (contoh: <span className="font-mono font-medium text-[#8B1520]">RI82-001</span>).
          </p>
        </div>
      ),
    },
    {
      id: 'jumlah-lomba',
      question: 'Apakah satu anak boleh mengikuti lebih dari satu cabang lomba?',
      answer: (
        <p>
          Boleh. Orang tua atau wali dapat mencentang lebih dari satu cabang perlombaan pada formulir di atas. Panitia telah menyusun jadwal tiap cabang lomba secara bergantian sehingga anak tetap bisa mengikuti seluruh lomba yang dipilih tanpa bentrok waktu.
        </p>
      ),
    },
    {
      id: 'biaya-perlengkapan',
      question: 'Apakah ada biaya pendaftaran dan perlengkapan apa yang perlu dibawa?',
      answer: (
        <p>
          Seluruh perlombaan <strong className="font-semibold text-[#1C1917]">gratis tanpa biaya pendaftaran</strong>. Perlengkapan utama lomba (karung, kerupuk, kelereng, sendok, paku dan botol, tali tambang, serta kertas gambar) disediakan oleh panitia. Khusus peserta <em>Lomba Mewarnai</em>, anak diperbolehkan membawa krayon atau pensil warna pribadi (panitia juga menyiapkan perlengkapan cadangan), serta disarankan memakai pakaian santai yang nyaman dan membawa air minum sendiri.
        </p>
      ),
    },
    {
      id: 'koreksi-data',
      question: 'Bagaimana jika ada kesalahan penulisan nama atau ingin mengubah pilihan lomba?',
      answer: (
        <p>
          Jika terdapat kesalahan input setelah formulir dikirim, silakan hubungi panitia di meja registrasi pada hari acara dengan menyebutkan nama anak atau kode pendaftaran, atau sampaikan melalui panitia untuk diperbarui melalui Dashboard Panitia. Nomor WhatsApp bersifat opsional dan hanya digunakan panitia apabila diperlukan informasi panggilan peserta.
        </p>
      ),
    },
  ];

  const toggleItem = (id: string) => {
    setOpenId((prev) => (prev === id ? '' : id));
  };

  return (
    <section
      id="tanya-jawab"
      aria-labelledby="faq-heading"
      className="mx-auto max-w-4xl px-4 pb-16 sm:px-6 lg:px-8"
    >
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium text-[#8B1520]">Informasi Peserta</p>
          <h2
            id="faq-heading"
            className="mt-1 text-xl font-bold tracking-tight text-[#1C1917] sm:text-2xl"
          >
            Pertanyaan Umum (Tanya Jawab)
          </h2>
        </div>
        <button
          type="button"
          onClick={onScrollToForm}
          className="self-start whitespace-nowrap text-xs font-semibold text-[#8B1520] hover:underline sm:self-auto sm:text-sm"
        >
          Kembali ke Formulir
        </button>
      </div>

      <div className="divide-y divide-[#EFECE6] overflow-hidden rounded-2xl border border-[#E7E2DC] bg-white">
        {faqItems.map((item) => {
          const isOpen = openId === item.id;
          const buttonId = `faq-btn-${item.id}`;
          const panelId = `faq-panel-${item.id}`;

          return (
            <div key={item.id}>
              <h3>
                <button
                  id={buttonId}
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => toggleItem(item.id)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-[#FAF9F7] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#8B1520] sm:px-6 sm:py-5"
                >
                  <span className="text-sm font-semibold text-[#1C1917] sm:text-base">
                    {item.question}
                  </span>
                  <ChevronDown
                    aria-hidden="true"
                    className={`h-4 w-4 shrink-0 text-[#8B1520] transition-transform duration-200 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
              </h3>

              {isOpen && (
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  className="border-t border-[#F5F2EC] bg-[#FAF9F7]/55 px-5 py-4 text-sm leading-relaxed text-[#57534E] sm:px-6 sm:py-5"
                >
                  {item.answer}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
