import {
  COMPETITION_MAP,
  CompetitionId,
  Registration,
} from '../types/registration';

export type AgeGroupFilter = 'all' | '3-6' | '7-10' | '11-15';

export interface RundownItem {
  id: string;
  time: string;
  activity: string;
  competitionNote: string;
  ageGroups: string;
  ageBuckets: Exclude<AgeGroupFilter, 'all'>[];
  location: string;
  isHighlight?: boolean;
  competitionId?: CompetitionId;
}

export const RUNDOWN_ITEMS: RundownItem[] = [
  {
    id: 'daftar-ulang',
    time: '07.00 – 08.00',
    activity: 'Daftar Ulang Peserta & Pembagian Nomor Dada',
    competitionNote:
      'Peserta menunjukkan tiket QR atau kode pendaftaran ke meja panitia untuk check-in kehadiran dan mengambil nomor dada.',
    ageGroups: 'Semua Usia (3–15 Tahun)',
    ageBuckets: ['3-6', '7-10', '11-15'],
    location: 'Meja Panitia · Lapangan RT 011 Kp Barani',
    isHighlight: false,
  },
  {
    id: 'pembukaan',
    time: '08.00 – 08.30',
    activity: 'Pembukaan & Menyanyikan Lagu Indonesia Raya',
    competitionNote:
      'Sambutan Ketua RT 011 Kp Barani, doa bersama, dan pengarahan teknis urutan lomba.',
    ageGroups: 'Semua Peserta & Orang Tua',
    ageBuckets: ['3-6', '7-10', '11-15'],
    location: 'Panggung Utama Lapangan RT 011',
    isHighlight: false,
  },
  {
    id: 'mewarnai',
    time: '08.30 – 09.30',
    activity: 'Lomba Mewarnai Kemerdekaan',
    competitionNote:
      'Peserta dibagi ke kelompok usia 3–6 tahun (PAUD/TK) dan 7–10 tahun (SD awal). Kertas gambar disediakan panitia; membawa alat warna sendiri.',
    ageGroups: 'Usia 3–6 & 7–10 Tahun',
    ageBuckets: ['3-6', '7-10'],
    location: 'Pendopo / Tenda Utama Lapangan',
    isHighlight: true,
    competitionId: 'mewarnai',
  },
  {
    id: 'makan-kerupuk',
    time: '09.30 – 10.30',
    activity: 'Lomba Makan Kerupuk',
    competitionNote:
      'Tinggi tali kerupuk disesuaikan kelompok usia: sesi 4–6 tahun, sesi 7–10 tahun, dan sesi 11–15 tahun.',
    ageGroups: 'Usia 4–6, 7–10 & 11–15 Tahun',
    ageBuckets: ['3-6', '7-10', '11-15'],
    location: 'Area Tiang Gantung Barat',
    isHighlight: true,
    competitionId: 'makan-kerupuk',
  },
  {
    id: 'paku-botol',
    time: '10.30 – 11.30',
    activity: 'Lomba Memasukkan Paku ke Botol',
    competitionNote:
      'Dibagi menjadi 2 gelombang usia: 5–8 tahun dan 9–15 tahun agar tinggi tali dan jarak botol seimbang.',
    ageGroups: 'Usia 5–8 & 9–15 Tahun',
    ageBuckets: ['3-6', '7-10', '11-15'],
    location: 'Lintasan Tengah Lapangan',
    isHighlight: true,
    competitionId: 'paku-botol',
  },
  {
    id: 'ishoma',
    time: '11.30 – 13.00',
    activity: 'Istirahat, Sholat & Makan Siang (ISHOMA)',
    competitionNote:
      'Jeda siang dan persiapan arena lomba ketangkasan dan beregu sesi siang.',
    ageGroups: 'Semua Peserta',
    ageBuckets: ['3-6', '7-10', '11-15'],
    location: 'Area Lapangan RT 011 Kp Barani',
    isHighlight: false,
  },
  {
    id: 'estafet-kelereng',
    time: '13.00 – 14.00',
    activity: 'Lomba Estafet Kelereng',
    competitionNote:
      'Lomba membawa kelereng di atas sendok secara bergantian per sesi usia 5–8 tahun dan 9–15 tahun.',
    ageGroups: 'Usia 5–8 & 9–15 Tahun',
    ageBuckets: ['3-6', '7-10', '11-15'],
    location: 'Lintasan Lari Timur Lapangan',
    isHighlight: true,
    competitionId: 'estafet-kelereng',
  },
  {
    id: 'balap-karung',
    time: '14.00 – 15.15',
    activity: 'Lomba Balap Karung',
    competitionNote:
      'Menggunakan karung ukuran anak (6–10 tahun) dan ukuran remaja (11–15 tahun) sesuai kelompok umur.',
    ageGroups: 'Usia 6–10 & 11–15 Tahun',
    ageBuckets: ['3-6', '7-10', '11-15'],
    location: 'Lintasan Utama Lapangan',
    isHighlight: true,
    competitionId: 'balap-karung',
  },
  {
    id: 'tarik-tambang',
    time: '15.15 – 16.30',
    activity: 'Lomba Tarik Tambang Anak',
    competitionNote:
      'Pertandingan beregu antar kelompok usia 7–11 tahun dan 12–15 tahun.',
    ageGroups: 'Usia 7–11 & 12–15 Tahun',
    ageBuckets: ['7-10', '11-15'],
    location: 'Lapangan Rumput Tengah',
    isHighlight: true,
    competitionId: 'tarik-tambang',
  },
  {
    id: 'pembagian-hadiah',
    time: '16.30 – Selesai',
    activity: 'Pengumuman Pemenang & Pembagian Hadiah',
    competitionNote:
      'Penyerahan piala, bingkisan juara tiap cabang lomba, serta penutupan acara HUT RI Ke-82.',
    ageGroups: 'Semua Peserta & Warga',
    ageBuckets: ['3-6', '7-10', '11-15'],
    location: 'Panggung Utama Lapangan RT 011 Kp Barani',
    isHighlight: false,
  },
];

export interface RundownGroupSession {
  id: string;
  label: string;
  participants: Registration[];
  isAdjustmentGroup?: boolean;
}

export interface RundownCompetitionGroup {
  competitionId: CompetitionId;
  competitionName: string;
  time: string;
  location: string;
  totalParticipants: number;
  sessions: RundownGroupSession[];
}

export interface AgeCategoryInfo {
  code: string;
  label: string;
  isAdjustmentGroup?: boolean;
}

interface SessionDefinition {
  id: string;
  code: string;
  label: string;
  isAdjustmentGroup?: boolean;
}

const COMPETITION_SESSIONS: Record<CompetitionId, SessionDefinition[]> = {
  mewarnai: [
    { id: 'mw-36', code: 'MW-36', label: 'Kelompok A · Usia 3–6 Tahun' },
    { id: 'mw-710', code: 'MW-710', label: 'Kelompok B · Usia 7–10 Tahun' },
    {
      id: 'mw-ot',
      code: 'MW-OT',
      label: 'Kelompok Penyesuaian · Usia >10 Tahun',
      isAdjustmentGroup: true,
    },
  ],
  'makan-kerupuk': [
    { id: 'kp-46', code: 'KP-46', label: 'Sesi 1 · Usia ≤ 6 Tahun' },
    { id: 'kp-710', code: 'KP-710', label: 'Sesi 2 · Usia 7–10 Tahun' },
    { id: 'kp-1115', code: 'KP-1115', label: 'Sesi 3 · Usia 11–15 Tahun' },
  ],
  'paku-botol': [
    { id: 'pb-58', code: 'PB-58', label: 'Sesi 1 · Usia ≤ 8 Tahun' },
    { id: 'pb-915', code: 'PB-915', label: 'Sesi 2 · Usia 9–15 Tahun' },
  ],
  'estafet-kelereng': [
    { id: 'ek-58', code: 'EK-58', label: 'Sesi 1 · Usia ≤ 8 Tahun' },
    { id: 'ek-915', code: 'EK-915', label: 'Sesi 2 · Usia 9–15 Tahun' },
  ],
  'balap-karung': [
    { id: 'bk-610', code: 'BK-610', label: 'Sesi 1 · Usia ≤ 10 Tahun' },
    { id: 'bk-1115', code: 'BK-1115', label: 'Sesi 2 · Usia 11–15 Tahun' },
  ],
  'tarik-tambang': [
    { id: 'tt-711', code: 'TT-711', label: 'Sesi 1 · Usia ≤ 11 Tahun' },
    { id: 'tt-1215', code: 'TT-1215', label: 'Sesi 2 · Usia 12–15 Tahun' },
  ],
};

export function getAgeCategoryCode(
  compId: CompetitionId,
  age: number
): AgeCategoryInfo {
  switch (compId) {
    case 'mewarnai':
      if (age <= 6) return { code: 'MW-36', label: 'Usia 3–6 Tahun' };
      if (age <= 10) return { code: 'MW-710', label: 'Usia 7–10 Tahun' };
      return {
        code: 'MW-OT',
        label: 'Penyesuaian (>10 Thn)',
        isAdjustmentGroup: true,
      };
    case 'makan-kerupuk':
      if (age <= 6) return { code: 'KP-46', label: 'Usia 4–6 Tahun' };
      if (age <= 10) return { code: 'KP-710', label: 'Usia 7–10 Tahun' };
      return { code: 'KP-1115', label: 'Usia 11–15 Tahun' };
    case 'paku-botol':
      if (age <= 8) return { code: 'PB-58', label: 'Usia 5–8 Tahun' };
      return { code: 'PB-915', label: 'Usia 9–15 Tahun' };
    case 'estafet-kelereng':
      if (age <= 8) return { code: 'EK-58', label: 'Usia 5–8 Tahun' };
      return { code: 'EK-915', label: 'Usia 9–15 Tahun' };
    case 'balap-karung':
      if (age <= 10) return { code: 'BK-610', label: 'Usia 6–10 Tahun' };
      return { code: 'BK-1115', label: 'Usia 11–15 Tahun' };
    case 'tarik-tambang':
      if (age <= 11) return { code: 'TT-711', label: 'Usia 7–11 Tahun' };
      return { code: 'TT-1215', label: 'Usia 12–15 Tahun' };
  }
}

function sortChronologicalAsc(registrations: Registration[]): Registration[] {
  return [...registrations].sort((a, b) => {
    const timeDiff =
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (!Number.isNaN(timeDiff) && timeDiff !== 0) return timeDiff;
    return a.registrationCode.localeCompare(b.registrationCode);
  });
}

export function assignBibNumbersByCompetition(
  registrations: Registration[]
): Map<string, Partial<Record<CompetitionId, string>>> {
  const result = new Map<string, Partial<Record<CompetitionId, string>>>();
  const counters = new Map<string, number>();

  const ordered = sortChronologicalAsc(registrations);

  for (const reg of ordered) {
    const perComp: Partial<Record<CompetitionId, string>> = {};
    for (const compId of reg.competitions) {
      const { code } = getAgeCategoryCode(compId, reg.age);
      const nextNum = (counters.get(code) ?? 0) + 1;
      counters.set(code, nextNum);
      perComp[compId] = `${code}-${String(nextNum).padStart(3, '0')}`;
    }
    result.set(reg.id, perComp);
  }

  return result;
}

export function assignBibNumbers(
  registrations: Registration[]
): Map<string, string[]> {
  const byComp = assignBibNumbersByCompetition(registrations);
  const result = new Map<string, string[]>();

  for (const reg of registrations) {
    const perComp = byComp.get(reg.id) ?? {};
    const bibs = reg.competitions
      .map((compId) => perComp[compId])
      .filter((bib): bib is string => Boolean(bib));
    result.set(reg.id, bibs);
  }

  return result;
}

export function groupParticipantsByRundown(
  registrations: Registration[]
): RundownCompetitionGroup[] {
  const ordered = sortChronologicalAsc(registrations);
  const competitionItems = RUNDOWN_ITEMS.filter(
    (item): item is RundownItem & { competitionId: CompetitionId } =>
      Boolean(item.competitionId)
  );

  return competitionItems.map((item) => {
    const compId = item.competitionId;
    const compName = COMPETITION_MAP[compId]?.name ?? item.activity;
    const matchingRegs = ordered.filter((reg) =>
      reg.competitions.includes(compId)
    );
    const definitions = COMPETITION_SESSIONS[compId];

    const buckets = new Map<string, Registration[]>();
    definitions.forEach((def) => buckets.set(def.code, []));

    for (const reg of matchingRegs) {
      const { code } = getAgeCategoryCode(compId, reg.age);
      const bucket = buckets.get(code);
      if (bucket) {
        bucket.push(reg);
      }
    }

    const sessions: RundownGroupSession[] = definitions
      .filter((def) => {
        if (!def.isAdjustmentGroup) return true;
        return (buckets.get(def.code)?.length ?? 0) > 0;
      })
      .map((def) => ({
        id: def.id,
        label: def.label,
        participants: buckets.get(def.code) ?? [],
        isAdjustmentGroup: def.isAdjustmentGroup,
      }));

    return {
      competitionId: compId,
      competitionName: compName,
      time: item.time,
      location: item.location,
      totalParticipants: matchingRegs.length,
      sessions,
    };
  });
}
