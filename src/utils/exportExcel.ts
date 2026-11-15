import XLSX from 'xlsx-js-style';
import {
  assignBibNumbers,
  assignBibNumbersByCompetition,
  groupParticipantsByRundown,
} from '../data/rundownSchedule';
import {
  COMPETITIONS,
  COMPETITION_MAP,
  EventInfo,
  Registration,
} from '../types/registration';
import { formatDateTimeId } from './formatDate';

const HEADER_FILL = { fgColor: { rgb: '8B1520' } };
const ZEBRA_FILL = { fgColor: { rgb: 'FAF9F7' } };
const WHITE_FILL = { fgColor: { rgb: 'FFFFFF' } };
const TOTAL_FILL = { fgColor: { rgb: 'F3ECE1' } };

const THIN_BORDER = {
  top: { style: 'thin', color: { rgb: 'D6D0C8' } },
  bottom: { style: 'thin', color: { rgb: 'D6D0C8' } },
  left: { style: 'thin', color: { rgb: 'D6D0C8' } },
  right: { style: 'thin', color: { rgb: 'D6D0C8' } },
} as const;

const HEADER_BORDER = {
  top: { style: 'thin', color: { rgb: '6D0F18' } },
  bottom: { style: 'medium', color: { rgb: 'B58517' } },
  left: { style: 'thin', color: { rgb: '6D0F18' } },
  right: { style: 'thin', color: { rgb: '6D0F18' } },
} as const;

function buildHeaderCell(value: string, align: 'left' | 'center' | 'right' = 'left'): XLSX.CellObject {
  return {
    v: value,
    t: 's',
    s: {
      font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
      fill: HEADER_FILL,
      border: HEADER_BORDER,
      alignment: { horizontal: align, vertical: 'center', wrapText: true },
    },
  };
}

function buildDataCell(
  value: string | number,
  options: {
    type?: 's' | 'n';
    isAltRow?: boolean;
    align?: 'left' | 'center' | 'right';
    bold?: boolean;
    wrapText?: boolean;
    numFmt?: string;
    color?: string;
  } = {}
): XLSX.CellObject {
  const {
    type = typeof value === 'number' ? 'n' : 's',
    isAltRow = false,
    align = 'left',
    bold = false,
    wrapText = false,
    numFmt,
    color = '1C1917',
  } = options;

  return {
    v: value,
    t: type,
    z: numFmt,
    s: {
      font: { name: 'Calibri', sz: 10, bold, color: { rgb: color } },
      fill: isAltRow ? ZEBRA_FILL : WHITE_FILL,
      border: THIN_BORDER,
      alignment: { horizontal: align, vertical: 'center', wrapText },
    },
  };
}

function buildDaftarPesertaSheet(
  registrations: Registration[],
  eventInfo: EventInfo,
  bibMap: Map<string, string[]>
): XLSX.WorkSheet {
  const printedAt = formatDateTimeId(new Date().toISOString());

  const titleCell: XLSX.CellObject = {
    v: `REKAP DATA PESERTA — ${eventInfo.title.toUpperCase()}`,
    t: 's',
    s: {
      font: { name: 'Calibri', sz: 14, bold: true, color: { rgb: '8B1520' } },
      alignment: { horizontal: 'left', vertical: 'center' },
    },
  };

  const subtitleCell: XLSX.CellObject = {
    v: `${eventInfo.dateText}   |   ${eventInfo.locationText}`,
    t: 's',
    s: {
      font: { name: 'Calibri', sz: 10, color: { rgb: '44403C' } },
      alignment: { horizontal: 'left', vertical: 'center' },
    },
  };

  const metaCell: XLSX.CellObject = {
    v: `Total Peserta Terdaftar: ${registrations.length} anak   |   Sudah Daftar Ulang: ${registrations.filter((r) => r.checkedIn).length} anak   |   Dicetak: ${printedAt}`,
    t: 's',
    s: {
      font: { name: 'Calibri', sz: 9, italic: true, color: { rgb: '78716C' } },
      alignment: { horizontal: 'left', vertical: 'center' },
    },
  };

  const headers = [
    buildHeaderCell('No', 'center'),
    buildHeaderCell('Kode Daftar', 'center'),
    buildHeaderCell('Nomor Dada', 'left'),
    buildHeaderCell('Nama Lengkap Anak', 'left'),
    buildHeaderCell('Nama Orang Tua / Wali', 'left'),
    buildHeaderCell('Umur (Thn)', 'center'),
    buildHeaderCell('No. WhatsApp', 'left'),
    buildHeaderCell('Lomba yang Diikuti', 'left'),
    buildHeaderCell('Kehadiran', 'center'),
    buildHeaderCell('Waktu Daftar', 'center'),
  ];

  const dataRows = registrations.map((item, idx) => {
    const isAltRow = idx % 2 === 1;
    const compNames = item.competitions
      .map((id) => COMPETITION_MAP[id]?.name ?? id)
      .join(', ');
    const bibText = (bibMap.get(item.id) ?? []).join(', ') || '-';

    return [
      buildDataCell(idx + 1, { type: 'n', isAltRow, align: 'center' }),
      buildDataCell(item.registrationCode, {
        type: 's',
        isAltRow,
        align: 'center',
        bold: true,
        color: '8B1520',
      }),
      buildDataCell(bibText, {
        type: 's',
        isAltRow,
        align: 'left',
        bold: true,
        wrapText: true,
        color: '1C1917',
      }),
      buildDataCell(item.childName, { type: 's', isAltRow, bold: true, wrapText: true }),
      buildDataCell(item.parentName, { type: 's', isAltRow, wrapText: true }),
      buildDataCell(item.age, { type: 'n', isAltRow, align: 'center' }),
      buildDataCell(item.whatsapp || '-', {
        type: 's',
        isAltRow,
        align: 'left',
        numFmt: '@',
      }),
      buildDataCell(compNames, { type: 's', isAltRow, wrapText: true }),
      buildDataCell(
        item.checkedIn
          ? `Hadir (${item.checkedInAt ? formatDateTimeId(item.checkedInAt) : '-'})`
          : 'Belum Hadir',
        {
          type: 's',
          isAltRow,
          align: 'center',
          bold: item.checkedIn,
          color: item.checkedIn ? '15803D' : '78716C',
        }
      ),
      buildDataCell(formatDateTimeId(item.createdAt), {
        type: 's',
        isAltRow,
        align: 'center',
        color: '57534E',
      }),
    ];
  });

  const rows: XLSX.CellObject[][] = [
    [titleCell],
    [subtitleCell],
    [metaCell],
    [],
    headers,
    ...dataRows,
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Merge judul & info acara melintang A-J
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 9 } },
  ];

  // Hitung lebar kolom otomatis yang rapi & lega
  const maxChildNameLen = Math.max(
    'Nama Lengkap Anak'.length,
    ...registrations.map((r) => r.childName.length)
  );
  const maxParentNameLen = Math.max(
    'Nama Orang Tua / Wali'.length,
    ...registrations.map((r) => r.parentName.length)
  );
  const maxWaLen = Math.max(
    'No. WhatsApp'.length,
    ...registrations.map((r) => (r.whatsapp || '-').length)
  );
  const maxBibLen = Math.max(
    'Nomor Dada'.length,
    ...registrations.map((r) => ((bibMap.get(r.id) ?? []).join(', ') || '-').length)
  );

  ws['!cols'] = [
    { wch: 6 },
    { wch: 14 },
    { wch: Math.min(Math.max(maxBibLen + 3, 18), 34) },
    { wch: Math.min(Math.max(maxChildNameLen + 4, 22), 34) },
    { wch: Math.min(Math.max(maxParentNameLen + 4, 22), 34) },
    { wch: 12 },
    { wch: Math.min(Math.max(maxWaLen + 4, 16), 22) },
    { wch: 42 },
    { wch: 24 },
    { wch: 22 },
  ];

  // Tinggi baris proporsional agar teks lomba/bib yang panjang tidak terpotong
  ws['!rows'] = [
    { hpt: 28 },
    { hpt: 20 },
    { hpt: 18 },
    { hpt: 10 },
    { hpt: 26 },
    ...registrations.map((r) => {
      const compText = r.competitions.map((id) => COMPETITION_MAP[id]?.name ?? id).join(', ');
      const bibText = (bibMap.get(r.id) ?? []).join(', ');
      const estimatedLines = Math.max(
        1,
        Math.ceil(compText.length / 38),
        Math.ceil(bibText.length / 30)
      );
      return { hpt: Math.max(22, estimatedLines * 15 + 8) };
    }),
  ];

  if (registrations.length > 0) {
    ws['!autofilter'] = { ref: `A5:J${5 + registrations.length}` };
  }

  return ws;
}

function buildRekapLombaSheet(
  registrations: Registration[],
  eventInfo: EventInfo,
  bibByComp: Map<string, Partial<Record<string, string>>>
): XLSX.WorkSheet {
  const titleCell: XLSX.CellObject = {
    v: 'REKAP PESERTA PER CABANG LOMBA',
    t: 's',
    s: {
      font: { name: 'Calibri', sz: 14, bold: true, color: { rgb: '8B1520' } },
      alignment: { horizontal: 'left', vertical: 'center' },
    },
  };

  const subtitleCell: XLSX.CellObject = {
    v: `${eventInfo.title}   |   ${eventInfo.dateText}`,
    t: 's',
    s: {
      font: { name: 'Calibri', sz: 10, color: { rgb: '44403C' } },
      alignment: { horizontal: 'left', vertical: 'center' },
    },
  };

  const headers = [
    buildHeaderCell('No', 'center'),
    buildHeaderCell('Cabang Lomba', 'left'),
    buildHeaderCell('Kelompok Usia', 'center'),
    buildHeaderCell('Jumlah Peserta', 'center'),
    buildHeaderCell('Daftar Nomor Dada & Nama Peserta', 'left'),
  ];

  let totalSlots = 0;
  const formattedTexts: string[] = [];

  const compRows = COMPETITIONS.map((comp, idx) => {
    const isAltRow = idx % 2 === 1;
    const matched = registrations
      .filter((r) => r.competitions.includes(comp.id))
      .sort((a, b) => {
        const bibA = bibByComp.get(a.id)?.[comp.id] ?? '';
        const bibB = bibByComp.get(b.id)?.[comp.id] ?? '';
        return bibA.localeCompare(bibB);
      });
    totalSlots += matched.length;

    const namesText =
      matched.length > 0
        ? matched
            .map((r, i) => {
              const bib = bibByComp.get(r.id)?.[comp.id] ?? '-';
              return `${i + 1}. [${bib}] ${r.childName} (${r.age} thn)`;
            })
            .join(', ')
        : 'Belum ada peserta';
    formattedTexts.push(namesText);

    return [
      buildDataCell(idx + 1, { type: 'n', isAltRow, align: 'center' }),
      buildDataCell(comp.name, { type: 's', isAltRow, bold: true }),
      buildDataCell(comp.ageHint, { type: 's', isAltRow, align: 'center', color: '57534E' }),
      buildDataCell(matched.length, {
        type: 'n',
        isAltRow,
        align: 'center',
        bold: true,
        color: '8B1520',
      }),
      buildDataCell(namesText, {
        type: 's',
        isAltRow,
        wrapText: true,
        color: matched.length > 0 ? '1C1917' : '78716C',
      }),
    ];
  });

  const totalRow: XLSX.CellObject[] = [
    {
      v: 'Total Keikutsertaan Lomba',
      t: 's',
      s: {
        font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '1C1917' } },
        fill: TOTAL_FILL,
        border: THIN_BORDER,
        alignment: { horizontal: 'right', vertical: 'center' },
      },
    },
    { v: '', t: 's', s: { fill: TOTAL_FILL, border: THIN_BORDER } },
    { v: '', t: 's', s: { fill: TOTAL_FILL, border: THIN_BORDER } },
    {
      v: totalSlots,
      t: 'n',
      s: {
        font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: '8B1520' } },
        fill: TOTAL_FILL,
        border: THIN_BORDER,
        alignment: { horizontal: 'center', vertical: 'center' },
      },
    },
    {
      v: `${registrations.length} anak unik terdaftar`,
      t: 's',
      s: {
        font: { name: 'Calibri', sz: 10, italic: true, color: { rgb: '44403C' } },
        fill: TOTAL_FILL,
        border: THIN_BORDER,
        alignment: { horizontal: 'left', vertical: 'center' },
      },
    },
  ];

  const rows: XLSX.CellObject[][] = [
    [titleCell],
    [subtitleCell],
    [],
    headers,
    ...compRows,
    totalRow,
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);

  const totalRowIdx = 4 + COMPETITIONS.length;
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
    { s: { r: totalRowIdx, c: 0 }, e: { r: totalRowIdx, c: 2 } },
  ];

  ws['!cols'] = [
    { wch: 6 },
    { wch: 28 },
    { wch: 18 },
    { wch: 16 },
    { wch: 68 },
  ];

  ws['!rows'] = [
    { hpt: 28 },
    { hpt: 20 },
    { hpt: 10 },
    { hpt: 26 },
    ...formattedTexts.map((namesText) => {
      const lines = Math.max(1, Math.ceil(namesText.length / 60));
      return { hpt: Math.max(24, lines * 15 + 8) };
    }),
    { hpt: 24 },
  ];

  return ws;
}

function buildKelompokSesiSheet(
  registrations: Registration[],
  eventInfo: EventInfo,
  bibByComp: Map<string, Partial<Record<string, string>>>
): XLSX.WorkSheet {
  const grouped = groupParticipantsByRundown(registrations);

  const titleCell: XLSX.CellObject = {
    v: 'PEMBAGIAN KELOMPOK UMUR & PESERTA SESUAI RUNDOWN ACARA',
    t: 's',
    s: {
      font: { name: 'Calibri', sz: 14, bold: true, color: { rgb: '8B1520' } },
      alignment: { horizontal: 'left', vertical: 'center' },
    },
  };

  const subtitleCell: XLSX.CellObject = {
    v: `${eventInfo.title}   |   ${eventInfo.dateText}   |   ${eventInfo.locationText}`,
    t: 's',
    s: {
      font: { name: 'Calibri', sz: 10, color: { rgb: '44403C' } },
      alignment: { horizontal: 'left', vertical: 'center' },
    },
  };

  const headers = [
    buildHeaderCell('Jam Lomba', 'center'),
    buildHeaderCell('Cabang Lomba', 'left'),
    buildHeaderCell('Kelompok Umur / Sesi', 'left'),
    buildHeaderCell('Jml', 'center'),
    buildHeaderCell('No', 'center'),
    buildHeaderCell('Nomor Dada', 'center'),
    buildHeaderCell('Kode', 'center'),
    buildHeaderCell('Nama Lengkap Anak', 'left'),
    buildHeaderCell('Umur', 'center'),
    buildHeaderCell('Orang Tua & No. WA', 'left'),
  ];

  const rows: XLSX.CellObject[][] = [[titleCell], [subtitleCell], [], headers];
  const rowHeights: XLSX.RowInfo[] = [
    { hpt: 28 },
    { hpt: 20 },
    { hpt: 10 },
    { hpt: 26 },
  ];

  let rowToggle = 0;

  for (const comp of grouped) {
    for (const session of comp.sessions) {
      if (session.participants.length === 0) {
        const isAlt = rowToggle % 2 === 1;
        rowToggle += 1;
        rows.push([
          buildDataCell(comp.time, { type: 's', isAltRow: isAlt, align: 'center', color: '57534E' }),
          buildDataCell(`${comp.competitionName} (${comp.location})`, {
            type: 's',
            isAltRow: isAlt,
            bold: true,
            wrapText: true,
          }),
          buildDataCell(session.label, { type: 's', isAltRow: isAlt, wrapText: true }),
          buildDataCell(0, { type: 'n', isAltRow: isAlt, align: 'center', color: '78716C' }),
          buildDataCell('-', { type: 's', isAltRow: isAlt, align: 'center', color: '78716C' }),
          buildDataCell('-', { type: 's', isAltRow: isAlt, align: 'center', color: '78716C' }),
          buildDataCell('-', { type: 's', isAltRow: isAlt, align: 'center', color: '78716C' }),
          buildDataCell('Belum ada peserta terdaftar di kelompok ini', {
            type: 's',
            isAltRow: isAlt,
            color: '78716C',
          }),
          buildDataCell('-', { type: 's', isAltRow: isAlt, align: 'center', color: '78716C' }),
          buildDataCell('-', { type: 's', isAltRow: isAlt, color: '78716C' }),
        ]);
        rowHeights.push({ hpt: 24 });
        continue;
      }

      session.participants.forEach((child, idx) => {
        const isAlt = rowToggle % 2 === 1;
        rowToggle += 1;
        const contact = child.whatsapp
          ? `${child.parentName} (${child.whatsapp})`
          : child.parentName;
        const bibNumber = bibByComp.get(child.id)?.[comp.competitionId] ?? '-';

        rows.push([
          buildDataCell(comp.time, { type: 's', isAltRow: isAlt, align: 'center', color: '8B1520' }),
          buildDataCell(`${comp.competitionName}`, {
            type: 's',
            isAltRow: isAlt,
            bold: true,
            wrapText: true,
          }),
          buildDataCell(session.label, { type: 's', isAltRow: isAlt, wrapText: true }),
          buildDataCell(session.participants.length, {
            type: 'n',
            isAltRow: isAlt,
            align: 'center',
            bold: true,
          }),
          buildDataCell(idx + 1, { type: 'n', isAltRow: isAlt, align: 'center' }),
          buildDataCell(bibNumber, {
            type: 's',
            isAltRow: isAlt,
            align: 'center',
            bold: true,
            color: '1C1917',
          }),
          buildDataCell(child.registrationCode, {
            type: 's',
            isAltRow: isAlt,
            align: 'center',
            bold: true,
            color: '8B1520',
          }),
          buildDataCell(child.childName, { type: 's', isAltRow: isAlt, bold: true, wrapText: true }),
          buildDataCell(`${child.age} thn`, { type: 's', isAltRow: isAlt, align: 'center' }),
          buildDataCell(contact, { type: 's', isAltRow: isAlt, wrapText: true, numFmt: '@' }),
        ]);
        rowHeights.push({ hpt: 22 });
      });
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } },
  ];

  ws['!cols'] = [
    { wch: 18 },
    { wch: 26 },
    { wch: 30 },
    { wch: 7 },
    { wch: 6 },
    { wch: 15 },
    { wch: 12 },
    { wch: 24 },
    { wch: 10 },
    { wch: 32 },
  ];

  ws['!rows'] = rowHeights;
  ws['!autofilter'] = { ref: `A4:J${rows.length}` };

  return ws;
}

export function exportRegistrationsToExcel(
  registrations: Registration[],
  eventInfo: EventInfo,
  filenamePrefix = 'rekap-lomba-hut-ri-82'
): void {
  const wb = XLSX.utils.book_new();
  const bibMap = assignBibNumbers(registrations);
  const bibByComp = assignBibNumbersByCompetition(registrations);

  const daftarSheet = buildDaftarPesertaSheet(registrations, eventInfo, bibMap);
  const rekapSheet = buildRekapLombaSheet(registrations, eventInfo, bibByComp);
  const kelompokSheet = buildKelompokSesiSheet(registrations, eventInfo, bibByComp);

  XLSX.utils.book_append_sheet(wb, daftarSheet, 'Daftar Peserta');
  XLSX.utils.book_append_sheet(wb, rekapSheet, 'Rekap per Lomba');
  XLSX.utils.book_append_sheet(wb, kelompokSheet, 'Kelompok Sesi Rundown');

  const today = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${filenamePrefix}-${today}.xlsx`);
}
