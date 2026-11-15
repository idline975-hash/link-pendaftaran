import React from 'react';
import { Calendar, MapPin } from 'lucide-react';
import { RUNDOWN_ITEMS } from '../data/rundownSchedule';
import { EventInfo } from '../types/registration';

interface RundownSectionProps {
  eventInfo: EventInfo;
  onScrollToForm: () => void;
}

export const RundownSection: React.FC<RundownSectionProps> = ({
  eventInfo,
}) => {
  const filteredItems = RUNDOWN_ITEMS;

  return (
    <section
      id="jadwal-acara"
      aria-labelledby="rundown-heading"
      className="mx-auto max-w-4xl px-4 pb-12 sm:px-6 lg:px-8"
    >
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium text-[#8B1520]">Susunan Kegiatan</p>
          <h2
            id="rundown-heading"
            className="mt-1 text-xl font-bold tracking-tight text-[#1C1917] sm:text-2xl"
          >
            Jadwal &amp; Rundown Acara
          </h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#57534E]">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-[#8B1520]" aria-hidden="true" />
              {eventInfo.dateText}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-[#B58517]" aria-hidden="true" />
              {eventInfo.locationText}
            </span>
          </div>
        </div>


      </div>



      {/* Tabel Rundown (Desktop) & Daftar Terstruktur (Mobile) */}
      <div className="overflow-hidden rounded-2xl border border-[#E7E2DC] bg-white">
        {/* Desktop Table */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[#E7E2DC] bg-[#FAF9F7] text-xs font-semibold text-[#57534E]">
                <th className="whitespace-nowrap px-5 py-3.5">Waktu (WIB)</th>
                <th className="px-5 py-3.5">Agenda &amp; Cabang Lomba</th>
                <th className="whitespace-nowrap px-5 py-3.5">Kelompok Umur</th>
                <th className="px-5 py-3.5">Area / Lokasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFECE6]">
              {filteredItems.map((item) => (
                <tr
                  key={item.id}
                  className={`transition-colors hover:bg-[#FAF9F7]/70 ${
                    item.isHighlight ? '' : 'bg-[#FAF9F7]/35'
                  }`}
                >
                  <td className="whitespace-nowrap px-5 py-4 align-top font-mono text-xs font-semibold text-[#8B1520] tabular-nums">
                    {item.time}
                  </td>
                  <td className="px-5 py-4 align-top">
                    <p className="font-semibold text-[#1C1917]">{item.activity}</p>
                    <p className="mt-1 text-xs leading-relaxed text-[#57534E]">
                      {item.competitionNote}
                    </p>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 align-top text-xs font-medium text-[#1C1917]">
                    {item.ageGroups}
                  </td>
                  <td className="px-5 py-4 align-top text-xs text-[#57534E]">
                    {item.location}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Stacked Timeline */}
        <div className="divide-y divide-[#EFECE6] md:hidden">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className={`p-4 ${item.isHighlight ? 'bg-white' : 'bg-[#FAF9F7]/50'}`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-mono text-xs font-semibold text-[#8B1520] tabular-nums">
                  {item.time} WIB
                </span>
                <span className="text-xs font-medium text-[#57534E]">{item.ageGroups}</span>
              </div>

              <h3 className="mt-1.5 text-sm font-bold text-[#1C1917]">{item.activity}</h3>
              <p className="mt-1 text-xs leading-relaxed text-[#57534E]">
                {item.competitionNote}
              </p>
              <p className="mt-2 text-[11px] font-medium text-[#78716C]">
                Lokasi: {item.location}
              </p>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-3 text-xs text-[#78716C]">
        Catatan: Jadwal bersifat estimasi dan dapat menyesuaikan jumlah peserta di lapangan.
        Cabang lomba dilaksanakan bergantian agar peserta dapat mengikuti lebih dari satu lomba.
      </p>
    </section>
  );
};
