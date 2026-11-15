import React, { useEffect, useMemo, useState } from 'react';
import { Download, Printer, Search, X } from 'lucide-react';
import { assignBibNumbersByCompetition, getAgeCategoryCode } from '../data/rundownSchedule';
import {
  COMPETITIONS,
  COMPETITION_MAP,
  CompetitionId,
  EventInfo,
  Registration,
} from '../types/registration';

interface PrintBibModalProps {
  isOpen: boolean;
  registrations: Registration[];
  eventInfo: EventInfo;
  initialCompetitionFilter?: CompetitionId | 'all';
  onClose: () => void;
}

type CardsPerPage = 2 | 4 | 6;
type PrintAttendanceFilter = 'all' | 'checked-in' | 'pending';

interface BibCardItem {
  key: string;
  bib: string;
  compId: CompetitionId;
  compName: string;
  ageLabel: string;
  reg: Registration;
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

function fitFontSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  startSize: number,
  minSize: number,
  fontWeight: string,
  fontFamily: string
): number {
  let size = startSize;
  while (size > minSize) {
    ctx.font = `${fontWeight} ${size}px ${fontFamily}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  return size;
}

function renderA4SheetToPngDataUrl(
  cards: BibCardItem[],
  perPage: CardsPerPage,
  eventInfo: EventInfo,
  pageIndex: number,
  totalPages: number
): string {
  // 150 DPI A4 Portrait: 1240 x 1754 px
  const W = 1240;
  const H = 1754;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);

  const marginX = 56;
  const topHeaderH = 68;
  const marginBottom = 56;
  const gap = 28;

  // Subtle sheet header for panitia reference
  ctx.fillStyle = '#57534E';
  ctx.font = '600 18px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(
    `LEMBAR CETAK NOMOR DADA — ${eventInfo.title.toUpperCase()}`,
    marginX,
    42
  );
  ctx.textAlign = 'right';
  ctx.fillText(`Halaman ${pageIndex + 1} / ${totalPages}`, W - marginX, 42);

  const cols = perPage === 2 ? 1 : 2;
  const rows = perPage === 2 ? 2 : perPage === 4 ? 2 : 3;

  const usableW = W - marginX * 2 - gap * (cols - 1);
  const usableH = H - topHeaderH - marginBottom - gap * (rows - 1);
  const cardW = usableW / cols;
  const cardH = usableH / rows;

  cards.forEach((card, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x = marginX + col * (cardW + gap);
    const y = topHeaderH + row * (cardH + gap);

    // Outer dashed cut guide
    ctx.save();
    ctx.strokeStyle = '#A8A29E';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 8]);
    ctx.strokeRect(x, y, cardW, cardH);
    ctx.restore();

    const pad = 16;
    const ix = x + pad;
    const iy = y + pad;
    const iw = cardW - pad * 2;
    const ih = cardH - pad * 2;

    // Inner card frame
    ctx.fillStyle = '#FFFFFF';
    drawRoundedRect(ctx, ix, iy, iw, ih, 14);
    ctx.fill();
    ctx.strokeStyle = '#8B1520';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Header strip
    const stripH = Math.round(ih * 0.16);
    ctx.save();
    drawRoundedRect(ctx, ix, iy, iw, ih, 14);
    ctx.clip();
    ctx.fillStyle = '#8B1520';
    ctx.fillRect(ix, iy, iw, stripH);
    ctx.fillStyle = '#B58517';
    ctx.fillRect(ix, iy + stripH, iw, 6);
    ctx.restore();

    // Corner peniti / hole punch guides
    const holeOffset = 22;
    const holes = [
      [ix + holeOffset, iy + stripH / 2],
      [ix + iw - holeOffset, iy + stripH / 2],
      [ix + holeOffset, iy + ih - holeOffset],
      [ix + iw - holeOffset, iy + ih - holeOffset],
    ];
    for (const [hx, hy] of holes) {
      ctx.beginPath();
      ctx.arc(hx, hy, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#78716C';
      ctx.stroke();
    }

    // Strip title
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const stripTitleSize = perPage === 6 ? 16 : 20;
    ctx.font = `bold ${stripTitleSize}px sans-serif`;
    ctx.fillText(
      `${eventInfo.title.toUpperCase()} · ${eventInfo.locationText.toUpperCase()}`,
      ix + iw / 2,
      iy + stripH / 2,
      iw - 110
    );

    // Competition & Age Group pill label
    const badgeY = iy + stripH + (perPage === 6 ? 28 : 38);
    ctx.fillStyle = '#FAF9F7';
    ctx.strokeStyle = '#E7E2DC';
    ctx.lineWidth = 2;
    const badgeText = `${card.compName.toUpperCase()} · ${card.ageLabel.toUpperCase()}`;
    const badgeFontSize = perPage === 6 ? 15 : 18;
    ctx.font = `bold ${badgeFontSize}px sans-serif`;
    const badgeTextW = Math.min(ctx.measureText(badgeText).width + 36, iw - 40);
    const badgeH = perPage === 6 ? 32 : 38;
    drawRoundedRect(ctx, ix + (iw - badgeTextW) / 2, badgeY - badgeH / 2, badgeTextW, badgeH, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#8B1520';
    ctx.fillText(badgeText, ix + iw / 2, badgeY + 1, badgeTextW - 18);

    // Giant Bib Number
    const bibCenterY = iy + ih * (perPage === 6 ? 0.51 : 0.5);
    const maxBibW = iw - 48;
    const startBibFont = perPage === 2 ? 128 : perPage === 4 ? 92 : 74;
    const bibFontSize = fitFontSize(ctx, card.bib, maxBibW, startBibFont, 40, '800', 'monospace');
    ctx.fillStyle = '#1C1917';
    ctx.font = `800 ${bibFontSize}px monospace`;
    ctx.fillText(card.bib, ix + iw / 2, bibCenterY);

    // Divider line
    const divY = iy + ih * 0.72;
    ctx.strokeStyle = '#E7E2DC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ix + 28, divY);
    ctx.lineTo(ix + iw - 28, divY);
    ctx.stroke();

    // Child Name
    const nameY = divY + (perPage === 6 ? 32 : 42);
    const maxNameW = iw - 72;
    const startNameFont = perPage === 2 ? 36 : perPage === 4 ? 28 : 24;
    const nameFontSize = fitFontSize(
      ctx,
      card.reg.childName,
      maxNameW,
      startNameFont,
      16,
      'bold',
      'sans-serif'
    );
    ctx.fillStyle = '#1C1917';
    ctx.font = `bold ${nameFontSize}px sans-serif`;
    ctx.fillText(card.reg.childName, ix + iw / 2, nameY);

    // Sub meta (Age, Code, Parent)
    const metaY = nameY + (perPage === 6 ? 28 : 34);
    ctx.fillStyle = '#57534E';
    const metaFontSize = perPage === 6 ? 15 : 18;
    ctx.font = `600 ${metaFontSize}px sans-serif`;
    ctx.fillText(
      `Usia ${card.reg.age} Thn  ·  Kode: ${card.reg.registrationCode}  ·  Wali: ${card.reg.parentName}`,
      ix + iw / 2,
      metaY,
      iw - 96
    );
  });

  return canvas.toDataURL('image/png');
}

export const PrintBibModal: React.FC<PrintBibModalProps> = ({
  isOpen,
  registrations,
  eventInfo,
  initialCompetitionFilter = 'all',
  onClose,
}) => {
  const [compFilter, setCompFilter] = useState<CompetitionId | 'all'>(initialCompetitionFilter);
  const [attendanceFilter, setAttendanceFilter] = useState<PrintAttendanceFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [perPage, setPerPage] = useState<CardsPerPage>(4);
  const [isDownloadingPng, setIsDownloadingPng] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCompFilter(initialCompetitionFilter);
    }
  }, [isOpen, initialCompetitionFilter]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const bibByComp = useMemo(
    () => assignBibNumbersByCompetition(registrations),
    [registrations]
  );

  const allBibCards = useMemo<BibCardItem[]>(() => {
    const cards: BibCardItem[] = [];
    for (const comp of COMPETITIONS) {
      const compRegs = registrations
        .filter((reg) => reg.competitions.includes(comp.id))
        .map((reg) => {
          const bib = bibByComp.get(reg.id)?.[comp.id] ?? '';
          const { label } = getAgeCategoryCode(comp.id, reg.age);
          return {
            key: `${comp.id}-${reg.id}`,
            bib,
            compId: comp.id,
            compName: COMPETITION_MAP[comp.id]?.name ?? comp.name,
            ageLabel: label,
            reg,
          };
        })
        .filter((item) => Boolean(item.bib))
        .sort((a, b) => a.bib.localeCompare(b.bib));

      cards.push(...compRegs);
    }
    return cards;
  }, [registrations, bibByComp]);

  const filteredCards = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allBibCards.filter((card) => {
      if (compFilter !== 'all' && card.compId !== compFilter) return false;
      if (attendanceFilter === 'checked-in' && !card.reg.checkedIn) return false;
      if (attendanceFilter === 'pending' && card.reg.checkedIn) return false;
      if (!q) return true;
      return (
        card.bib.toLowerCase().includes(q) ||
        card.reg.childName.toLowerCase().includes(q) ||
        card.reg.registrationCode.toLowerCase().includes(q) ||
        card.compName.toLowerCase().includes(q)
      );
    });
  }, [allBibCards, compFilter, attendanceFilter, searchQuery]);

  const pages = useMemo<BibCardItem[][]>(() => {
    const chunks: BibCardItem[][] = [];
    for (let i = 0; i < filteredCards.length; i += perPage) {
      chunks.push(filteredCards.slice(i, i + perPage));
    }
    return chunks;
  }, [filteredCards, perPage]);

  if (!isOpen) return null;

  const handlePrintNow = () => {
    window.print();
  };

  const handleDownloadSheetsPng = async () => {
    if (pages.length === 0) return;
    setIsDownloadingPng(true);
    try {
      const slug = compFilter === 'all' ? 'semua-lomba' : compFilter;
      for (let i = 0; i < pages.length; i += 1) {
        const dataUrl = renderA4SheetToPngDataUrl(pages[i], perPage, eventInfo, i, pages.length);
        if (!dataUrl) continue;
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `nomor-dada-${slug}-hal-${i + 1}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        if (i < pages.length - 1) {
          await new Promise((r) => window.setTimeout(r, 220));
        }
      }
    } finally {
      setIsDownloadingPng(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="print-bib-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 backdrop-blur-[2px] sm:p-5 print:static print:inset-auto print:block print:bg-white print:p-0 print:backdrop-blur-none"
    >
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[#E7E2DC] bg-[#FAF9F7] shadow-2xl print:max-h-none print:max-w-none print:overflow-visible print:rounded-none print:border-0 print:bg-white print:shadow-none">
        {/* Modal Header & Controls (Hidden when printing) */}
        <div className="border-b border-[#E7E2DC] bg-white px-5 py-4 print:hidden">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="print-bib-title" className="text-lg font-bold text-[#1C1917]">
                Cetak Nomor Dada Peserta (A4)
              </h2>
              <p className="mt-0.5 text-xs text-[#57534E]">
                Pilih cabang lomba dan tata letak kertas A4, lalu cetak langsung atau unduh lembar
                siap cetak (.png).
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup jendela cetak nomor dada"
              className="rounded-lg p-2 text-[#78716C] hover:bg-[#FAF9F7] hover:text-[#1C1917]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label
                htmlFor="print-comp-filter"
                className="mb-1 block text-[11px] font-semibold text-[#57534E]"
              >
                Cabang Lomba
              </label>
              <select
                id="print-comp-filter"
                value={compFilter}
                onChange={(e) => setCompFilter(e.target.value as CompetitionId | 'all')}
                className="min-h-[38px] w-full rounded-lg border border-[#D6D0C8] bg-white px-3 py-1.5 text-xs font-medium text-[#1C1917] focus:border-[#8B1520] focus:outline-none"
              >
                <option value="all">Semua Lomba ({allBibCards.length} kartu)</option>
                {COMPETITIONS.map((c) => {
                  const count = allBibCards.filter((card) => card.compId === c.id).length;
                  return (
                    <option key={c.id} value={c.id}>
                      {c.name} ({count})
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label
                htmlFor="print-attendance-filter"
                className="mb-1 block text-[11px] font-semibold text-[#57534E]"
              >
                Status Kehadiran
              </label>
              <select
                id="print-attendance-filter"
                value={attendanceFilter}
                onChange={(e) => setAttendanceFilter(e.target.value as PrintAttendanceFilter)}
                className="min-h-[38px] w-full rounded-lg border border-[#D6D0C8] bg-white px-3 py-1.5 text-xs font-medium text-[#1C1917] focus:border-[#8B1520] focus:outline-none"
              >
                <option value="all">Semua Peserta</option>
                <option value="checked-in">Hanya yang Sudah Hadir</option>
                <option value="pending">Belum Hadir</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="print-layout-select"
                className="mb-1 block text-[11px] font-semibold text-[#57534E]"
              >
                Ukuran / Isi per Lembar A4
              </label>
              <select
                id="print-layout-select"
                value={perPage}
                onChange={(e) => setPerPage(Number(e.target.value) as CardsPerPage)}
                className="min-h-[38px] w-full rounded-lg border border-[#D6D0C8] bg-white px-3 py-1.5 text-xs font-medium text-[#1C1917] focus:border-[#8B1520] focus:outline-none"
              >
                <option value={4}>4 Kartu / A4 (Standar 2×2)</option>
                <option value={6}>6 Kartu / A4 (Ringkas 2×3)</option>
                <option value={2}>2 Kartu / A4 (Besar 1×2)</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="print-search-input"
                className="mb-1 block text-[11px] font-semibold text-[#57534E]"
              >
                Cari Anak / Nomor Dada
              </label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#78716C]"
                  aria-hidden="true"
                />
                <input
                  id="print-search-input"
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Contoh: MW-36-001"
                  className="min-h-[38px] w-full rounded-lg border border-[#D6D0C8] bg-white py-1.5 pl-8 pr-2.5 text-xs text-[#1C1917] placeholder:text-[#A8A29E] focus:border-[#8B1520] focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2.5 border-t border-[#EFECE6] pt-3.5 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-mono text-xs font-semibold text-[#57534E] tabular-nums">
              Siap cetak:{' '}
              <span className="text-[#8B1520]">{filteredCards.length} kartu nomor dada</span> ·{' '}
              {pages.length} halaman A4
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={filteredCards.length === 0 || isDownloadingPng}
                onClick={() => void handleDownloadSheetsPng()}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[#D6D0C8] bg-white px-3.5 py-2 text-xs font-semibold text-[#1C1917] transition-colors hover:bg-[#FAF9F7] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download className="h-4 w-4 text-[#8B1520]" aria-hidden="true" />
                {isDownloadingPng
                  ? 'Menyiapkan Gambar...'
                  : `Unduh Lembar A4 (.png)${pages.length > 1 ? ` (${pages.length} hal)` : ''}`}
              </button>

              <button
                type="button"
                disabled={filteredCards.length === 0}
                onClick={handlePrintNow}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-[#8B1520] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#6D0F18] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Printer className="h-4 w-4" aria-hidden="true" />
                Cetak / Simpan PDF
              </button>
            </div>
          </div>
        </div>

        {/* Printable A4 Pages Preview */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 print:overflow-visible print:p-0">
          {pages.length === 0 ? (
            <div className="rounded-xl border border-[#E7E2DC] bg-white px-6 py-12 text-center print:hidden">
              <p className="text-sm font-semibold text-[#1C1917]">
                Tidak ada nomor dada yang cocok dengan filter
              </p>
              <p className="mt-1 text-xs text-[#57534E]">
                Ubah pilihan cabang lomba, kehadiran, atau kata kunci pencarian.
              </p>
            </div>
          ) : (
            <div className="space-y-6 print:space-y-0">
              {pages.map((pageCards, pageIdx) => (
                <div
                  key={`bib-page-${pageIdx}`}
                  className="mx-auto rounded-xl border border-[#D6D0C8] bg-white p-5 shadow-sm print:mx-0 print:rounded-none print:border-0 print:p-0 print:shadow-none print:break-after-page last:print:break-after-auto"
                >
                  {/* Page header */}
                  <div className="mb-3 flex items-center justify-between border-b border-[#EFECE6] pb-2 text-[11px] font-semibold text-[#57534E]">
                    <span>
                      LEMBAR NOMOR DADA — {eventInfo.title.toUpperCase()}
                    </span>
                    <span className="font-mono tabular-nums">
                      Hal {pageIdx + 1} / {pages.length}
                    </span>
                  </div>

                  {/* Card grid */}
                  <div
                    className={`grid gap-4 ${
                      perPage === 2 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 print:grid-cols-2'
                    }`}
                  >
                    {pageCards.map((card) => (
                      <div
                        key={card.key}
                        className="break-inside-avoid rounded-lg border-2 border-dashed border-[#A8A29E] p-2.5"
                      >
                        <div className="relative overflow-hidden rounded-lg border-2 border-[#8B1520] bg-white">
                          {/* Top Crimson Banner */}
                          <div className="relative flex items-center justify-center border-b-4 border-[#B58517] bg-[#8B1520] px-8 py-2 text-center text-white">
                            <span
                              aria-hidden="true"
                              className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border border-[#57534E] bg-white"
                            />
                            <p className="truncate text-[11px] font-bold tracking-wider uppercase">
                              {eventInfo.title} · {eventInfo.locationText}
                            </p>
                            <span
                              aria-hidden="true"
                              className="absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border border-[#57534E] bg-white"
                            />
                          </div>

                          {/* Card Body */}
                          <div
                            className={`flex flex-col items-center justify-center px-4 text-center ${
                              perPage === 2
                                ? 'py-8'
                                : perPage === 4
                                  ? 'py-5'
                                  : 'py-3.5'
                            }`}
                          >
                            <span className="rounded border border-[#E7E2DC] bg-[#FAF9F7] px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-[#8B1520] uppercase">
                              {card.compName} · {card.ageLabel}
                            </span>

                            <p
                              className={`mt-2.5 font-mono leading-none font-extrabold tracking-tight text-[#1C1917] tabular-nums ${
                                perPage === 2
                                  ? 'text-6xl'
                                  : perPage === 4
                                    ? 'text-4xl sm:text-5xl'
                                    : 'text-3xl sm:text-4xl'
                              }`}
                            >
                              {card.bib}
                            </p>

                            <div className="mt-3 w-full border-t border-[#EFECE6] pt-2.5">
                              <p
                                className={`truncate font-bold text-[#1C1917] ${
                                  perPage === 2 ? 'text-xl' : 'text-base'
                                }`}
                              >
                                {card.reg.childName}
                              </p>
                              <p className="mt-0.5 truncate text-xs text-[#57534E]">
                                Usia {card.reg.age} Thn <span aria-hidden="true">·</span>{' '}
                                <span className="font-mono font-semibold">
                                  {card.reg.registrationCode}
                                </span>{' '}
                                <span aria-hidden="true">·</span> Wali: {card.reg.parentName}
                              </p>
                            </div>
                          </div>

                          {/* Bottom peniti pin marks */}
                          <span
                            aria-hidden="true"
                            className="absolute bottom-2 left-2.5 h-3 w-3 rounded-full border border-[#A8A29E] bg-white"
                          />
                          <span
                            aria-hidden="true"
                            className="absolute bottom-2 right-2.5 h-3 w-3 rounded-full border border-[#A8A29E] bg-white"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
