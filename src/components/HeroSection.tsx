import React, { useState } from 'react';
import { Calendar, Flag, MapPin } from 'lucide-react';
import { EventInfo } from '../types/registration';

interface HeroSectionProps {
  eventInfo: EventInfo;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ eventInfo }) => {
  const [imageError, setImageError] = useState(false);

  return (
    <section className="border-b border-[#E7E2DC] bg-white">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
        <div className="grid grid-cols-1 items-stretch gap-8 lg:grid-cols-12 lg:gap-12">
          {/* Left editorial column */}
          <div className="flex flex-col justify-center lg:col-span-7">
            <div>
              <p className="text-xs font-medium tracking-wide text-[#8B1520]">
                HUT RI Ke - 82 <span aria-hidden="true">·</span> 17 Agustus 2027
              </p>

              <h1
                className="mt-3 text-balance font-bold tracking-tight text-[#1C1917]"
                style={{ fontSize: 'clamp(2rem, 3.8vw, 3.25rem)', lineHeight: 1.12 }}
              >
                {eventInfo.title}
              </h1>

              {/* Date & Location Card */}
              <div className="mt-5">
                <div className="rounded-xl border border-[#E7E2DC] bg-[#FAF9F7] p-4 sm:p-5">
                  <div className="flex flex-col gap-2.5 text-sm text-[#44403C] sm:text-base">
                    <div className="flex items-start gap-2.5">
                      <Calendar
                        className="mt-0.5 h-4 w-4 shrink-0 text-[#8B1520]"
                        aria-hidden="true"
                      />
                      <span className="font-medium text-[#1C1917]">{eventInfo.dateText}</span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <MapPin
                        className="mt-0.5 h-4 w-4 shrink-0 text-[#B58517]"
                        aria-hidden="true"
                      />
                      <span>{eventInfo.locationText}</span>
                    </div>
                  </div>

                  <div className="mt-3 border-t border-[#E7E2DC] pt-3">
                    <span className="text-xs text-[#78716C]">
                      Terbuka untuk anak usia 3–15 tahun
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right visual column */}
          <div className="lg:col-span-5">
            <div className="relative h-64 w-full overflow-hidden rounded-xl border border-[#E7E2DC] bg-[#F5F2EC] sm:h-80 lg:h-full lg:min-h-[320px]">
              {!imageError ? (
                <img
                  src="/src/assets/images/merdeka_field_banner_1794569677670.jpg"
                  alt="Suasana lapangan perayaan HUT Kemerdekaan Indonesia Ke - 82 dengan hiasan bendera merah putih"
                  referrerPolicy="no-referrer"
                  onError={() => setImageError(true)}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-[#8B1520]/10 via-[#FAF9F7] to-[#B58517]/15 p-6 text-center">
                  <Flag className="mb-3 h-10 w-10 text-[#8B1520]" aria-hidden="true" />
                  <p className="text-sm font-semibold text-[#1C1917]">
                    Semarak Kemerdekaan Ke - 82
                  </p>
                  <p className="mt-1 text-xs text-[#57534E]">
                    Bersatu, Bergembira, Meraih Prestasi
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
