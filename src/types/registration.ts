export type CompetitionId =
  | 'balap-karung'
  | 'makan-kerupuk'
  | 'paku-botol'
  | 'mewarnai'
  | 'estafet-kelereng'
  | 'tarik-tambang';

export interface CompetitionOption {
  id: CompetitionId;
  name: string;
  ageHint: string;
  description: string;
}

export const COMPETITIONS: CompetitionOption[] = [
  {
    id: 'balap-karung',
    name: 'Balap Karung',
    ageHint: 'Usia 6–15 tahun',
    description: 'Lomba ketangkasan melompat menggunakan karung goni menuju garis finis.',
  },
  {
    id: 'makan-kerupuk',
    name: 'Makan Kerupuk',
    ageHint: 'Usia 4–15 tahun',
    description: 'Menghabiskan kerupuk yang digantung tali tanpa menggunakan tangan.',
  },
  {
    id: 'paku-botol',
    name: 'Memasukkan Paku ke Botol',
    ageHint: 'Usia 5–15 tahun',
    description: 'Melatih fokus dan keseimbangan memasukkan paku bertali ke dalam botol.',
  },
  {
    id: 'mewarnai',
    name: 'Lomba Mewarnai',
    ageHint: 'Usia 3–10 tahun',
    description: 'Kreasi mewarnai gambar bertema kemerdekaan Indonesia untuk anak.',
  },
  {
    id: 'estafet-kelereng',
    name: 'Estafet Kelereng',
    ageHint: 'Usia 5–13 tahun',
    description: 'Membawa kelereng di atas sendok secara bergantian bersama tim.',
  },
  {
    id: 'tarik-tambang',
    name: 'Tarik Tambang Anak',
    ageHint: 'Usia 7–15 tahun',
    description: 'Lomba kekompakan beregu menarik tali tambang sesuai kelompok umur.',
  },
];

export const COMPETITION_MAP: Record<CompetitionId, CompetitionOption> = COMPETITIONS.reduce(
  (acc, comp) => {
    acc[comp.id] = comp;
    return acc;
  },
  {} as Record<CompetitionId, CompetitionOption>
);

export interface Registration {
  id: string;
  registrationCode: string;
  childName: string;
  parentName: string;
  age: number;
  whatsapp: string;
  competitions: CompetitionId[];
  bibNumber?: string | null;
  checkedIn: boolean;
  checkedInAt: string | null;
  createdAt: string;
}

export interface CreateRegistrationInput {
  childName: string;
  parentName: string;
  age: number;
  whatsapp: string;
  competitions: CompetitionId[];
}

export interface EventInfo {
  title: string;
  dateText: string;
  locationText: string;
}

export const DEFAULT_EVENT_INFO: EventInfo = {
  title: 'Pendaftaran Lomba HUT RI Ke - 82',
  dateText: 'Selasa, 17 Agustus 2027 · 07.00 WIB – Selesai',
  locationText: 'Lapangan RT 011 Kp Barani',
};

export const DEFAULT_COMMITTEE_PIN = '1708';

export function buildQrPayload(registration: Pick<Registration, 'id' | 'registrationCode'>): string {
  return `HUTRI82|${registration.id}|${registration.registrationCode}`;
}

export function parseQrPayload(raw: string): { id?: string; code?: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('HUTRI81|') || trimmed.startsWith('HUTRI82|')) {
    const parts = trimmed.split('|');
    if (parts.length >= 3) {
      return {
        id: parts[1]?.trim() || undefined,
        code: parts[2]?.trim().toUpperCase() || undefined,
      };
    }
  }

  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as { id?: string; code?: string };
      if (parsed.id || parsed.code) {
        return {
          id: parsed.id?.trim(),
          code: parsed.code?.trim().toUpperCase(),
        };
      }
    } catch {
      return null;
    }
  }

  const normalized = trimmed.toUpperCase();
  if (/^RI8[12]-[A-Z0-9]+$/.test(normalized)) {
    return { code: normalized };
  }

  return null;
}
