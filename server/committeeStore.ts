import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  COMPETITIONS,
  type CompetitionId,
  type CreateRegistrationInput,
  DEFAULT_COMMITTEE_PIN,
  DEFAULT_EVENT_INFO,
  type EventInfo,
  type Registration,
} from '../src/types/registration.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '..', '.data');
const STORE_FILE = path.join(DATA_DIR, 'hut-ri82-store.json');

const VALID_COMPETITION_IDS = new Set<CompetitionId>(COMPETITIONS.map((c) => c.id));
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 jam aktif untuk hari-H lomba

interface ServerStoreData {
  pinHash: string;
  tokenSecret: string;
  eventInfo: EventInfo;
  registrations: Registration[];
}

export interface CommitteeTokenPayload {
  role: 'committee';
  iat: number;
  exp: number;
  pv: string;
}

function hashPin(pin: string, existingSalt?: string): string {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(pin, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPinHash(pin: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;
  const actualBuf = crypto.scryptSync(pin, salt, 64);
  const expectedBuf = Buffer.from(expectedHex, 'hex');
  if (actualBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(actualBuf, expectedBuf);
}

function sanitizeEventInfo(info: Partial<EventInfo> | undefined): EventInfo {
  const title = typeof info?.title === 'string' ? info.title.trim().slice(0, 120) : '';
  const dateText = typeof info?.dateText === 'string' ? info.dateText.trim().slice(0, 120) : '';
  const locationText =
    typeof info?.locationText === 'string' ? info.locationText.trim().slice(0, 150) : '';

  return {
    title: title.length >= 3 ? title : DEFAULT_EVENT_INFO.title,
    dateText: dateText.length >= 3 ? dateText : DEFAULT_EVENT_INFO.dateText,
    locationText: locationText.length >= 3 ? locationText : DEFAULT_EVENT_INFO.locationText,
  };
}

export function sanitizeRegistrationInput(input: Partial<CreateRegistrationInput>): CreateRegistrationInput {
  const childName = typeof input.childName === 'string' ? input.childName.trim().slice(0, 100) : '';
  const parentName =
    typeof input.parentName === 'string' ? input.parentName.trim().slice(0, 100) : '';
  const rawAge = Number(input.age);
  const parsedAge = Number.isFinite(rawAge) ? Math.round(rawAge) : 6;
  const age = Math.min(15, Math.max(3, parsedAge));
  const whatsapp = typeof input.whatsapp === 'string' ? input.whatsapp.trim().slice(0, 20) : '';

  const rawComps = Array.isArray(input.competitions) ? input.competitions : [];
  const filteredComps = Array.from(
    new Set(rawComps.filter((id): id is CompetitionId => VALID_COMPETITION_IDS.has(id as CompetitionId)))
  ).slice(0, 6);

  return {
    childName: childName.length >= 2 ? childName : 'Peserta Lomba',
    parentName: parentName.length >= 2 ? parentName : 'Orang Tua',
    age,
    whatsapp,
    competitions: filteredComps.length > 0 ? filteredComps : ['balap-karung'],
  };
}

function generateId(): string {
  return `reg-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
}

function generateCode(existing: Registration[]): string {
  const existingCodes = new Set(existing.map((r) => r.registrationCode.toUpperCase()));
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 30; attempt += 1) {
    let suffix = '';
    for (let i = 0; i < 5; i += 1) {
      suffix += chars[crypto.randomInt(0, chars.length)];
    }
    const candidate = `RI82-${suffix}`;
    if (!existingCodes.has(candidate)) {
      return candidate;
    }
  }
  return `RI82-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

function sortRegistrationsDesc(items: Registration[]): Registration[] {
  return [...items].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

class CommitteeStore {
  private data: ServerStoreData;

  constructor() {
    this.data = this.loadFromDisk();
  }

  private loadFromDisk(): ServerStoreData {
    try {
      if (fs.existsSync(STORE_FILE)) {
        const raw = fs.readFileSync(STORE_FILE, 'utf-8');
        const parsed = JSON.parse(raw) as Partial<ServerStoreData>;
        if (parsed && typeof parsed.pinHash === 'string' && typeof parsed.tokenSecret === 'string') {
          return {
            pinHash: parsed.pinHash,
            tokenSecret: parsed.tokenSecret,
            eventInfo: sanitizeEventInfo(parsed.eventInfo),
            registrations: Array.isArray(parsed.registrations)
              ? sortRegistrationsDesc(parsed.registrations)
              : [],
          };
        }
      }
    } catch (err) {
      console.error('Gagal membaca store server, membuat store baru:', err);
    }

    const initialPin = (process.env.COMMITTEE_PIN || DEFAULT_COMMITTEE_PIN).trim();
    const initial: ServerStoreData = {
      pinHash: hashPin(initialPin),
      tokenSecret: crypto.randomBytes(32).toString('hex'),
      eventInfo: { ...DEFAULT_EVENT_INFO },
      registrations: [],
    };
    this.data = initial;
    this.persistToDisk();
    return initial;
  }

  private persistToDisk(): void {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      const tmpFile = `${STORE_FILE}.${process.pid}.tmp`;
      fs.writeFileSync(tmpFile, JSON.stringify(this.data, null, 2), 'utf-8');
      fs.renameSync(tmpFile, STORE_FILE);
    } catch (err) {
      console.error('Gagal menyimpan store server:', err);
    }
  }

  getEventInfo(): EventInfo {
    return this.data.eventInfo;
  }

  getRegistrations(): Registration[] {
    return this.data.registrations;
  }

  verifyCommitteePin(pin: string): boolean {
    const clean = pin.trim();
    if (!clean) return false;
    return verifyPinHash(clean, this.data.pinHash);
  }

  changeCommitteePin(currentPin: string, newPin: string): string {
    if (!this.verifyCommitteePin(currentPin)) {
      throw new Error('PIN lama tidak sesuai.');
    }
    const cleanNew = newPin.trim();
    if (!/^[a-zA-Z0-9]{4,12}$/.test(cleanNew)) {
      throw new Error('PIN baru harus 4–12 karakter (huruf/angka tanpa spasi).');
    }
    this.data.pinHash = hashPin(cleanNew);
    this.persistToDisk();
    return this.issueSessionToken().token;
  }

  issueSessionToken(): { token: string; expiresAt: number } {
    const now = Date.now();
    const exp = now + TOKEN_TTL_MS;
    const payload: CommitteeTokenPayload = {
      role: 'committee',
      iat: now,
      exp,
      pv: this.data.pinHash.slice(-12),
    };
    const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
    const sig = crypto
      .createHmac('sha256', this.data.tokenSecret)
      .update(encodedPayload)
      .digest('base64url');

    return {
      token: `${encodedPayload}.${sig}`,
      expiresAt: exp,
    };
  }

  verifySessionToken(token: string | undefined | null): boolean {
    if (!token || typeof token !== 'string') return false;
    const parts = token.split('.');
    if (parts.length !== 2) return false;
    const [encodedPayload, providedSig] = parts;
    if (!encodedPayload || !providedSig) return false;

    const expectedSig = crypto
      .createHmac('sha256', this.data.tokenSecret)
      .update(encodedPayload)
      .digest('base64url');

    const providedBuf = Buffer.from(providedSig);
    const expectedBuf = Buffer.from(expectedSig);
    if (providedBuf.length !== expectedBuf.length) return false;
    if (!crypto.timingSafeEqual(providedBuf, expectedBuf)) return false;

    try {
      const payload = JSON.parse(
        Buffer.from(encodedPayload, 'base64url').toString('utf-8')
      ) as CommitteeTokenPayload;

      if (payload.role !== 'committee') return false;
      if (typeof payload.exp !== 'number' || Date.now() > payload.exp) return false;
      if (payload.pv !== this.data.pinHash.slice(-12)) return false;
      return true;
    } catch {
      return false;
    }
  }

  createRegistration(
    input: Partial<CreateRegistrationInput> & {
      id?: string;
      registrationCode?: string;
      createdAt?: string;
    }
  ): Registration {
    const clean = sanitizeRegistrationInput(input);
    const requestedId =
      typeof input.id === 'string' && /^[a-zA-Z0-9_-]{3,128}$/.test(input.id)
        ? input.id
        : generateId();

    const existingSameId = this.data.registrations.find((r) => r.id === requestedId);
    if (existingSameId) {
      return existingSameId;
    }

    const requestedCode =
      typeof input.registrationCode === 'string' &&
      /^RI8[12]-[A-Z0-9]+$/.test(input.registrationCode.trim().toUpperCase())
        ? input.registrationCode.trim().toUpperCase()
        : '';

    const codeCollision =
      requestedCode &&
      this.data.registrations.some((r) => r.registrationCode.toUpperCase() === requestedCode);

    const registrationCode =
      requestedCode && !codeCollision ? requestedCode : generateCode(this.data.registrations);

    const createdAt =
      typeof input.createdAt === 'string' && !Number.isNaN(Date.parse(input.createdAt))
        ? input.createdAt
        : new Date().toISOString();

    const created: Registration = {
      id: requestedId,
      registrationCode,
      childName: clean.childName,
      parentName: clean.parentName,
      age: clean.age,
      whatsapp: clean.whatsapp,
      competitions: clean.competitions,
      checkedIn: false,
      checkedInAt: null,
      createdAt,
    };

    this.data.registrations = sortRegistrationsDesc([created, ...this.data.registrations]);
    this.persistToDisk();
    return created;
  }

  updateRegistration(id: string, input: Partial<CreateRegistrationInput>): Registration {
    const idx = this.data.registrations.findIndex((r) => r.id === id);
    if (idx === -1) {
      throw new Error('Data peserta tidak ditemukan di server.');
    }

    const clean = sanitizeRegistrationInput(input);
    const updated: Registration = {
      ...this.data.registrations[idx],
      childName: clean.childName,
      parentName: clean.parentName,
      age: clean.age,
      whatsapp: clean.whatsapp,
      competitions: clean.competitions,
    };

    const next = [...this.data.registrations];
    next[idx] = updated;
    this.data.registrations = sortRegistrationsDesc(next);
    this.persistToDisk();
    return updated;
  }

  checkInRegistration(id: string, checkedIn: boolean): Registration {
    const idx = this.data.registrations.findIndex((r) => r.id === id);
    if (idx === -1) {
      throw new Error('Data peserta tidak ditemukan di server.');
    }

    const updated: Registration = {
      ...this.data.registrations[idx],
      checkedIn: Boolean(checkedIn),
      checkedInAt: checkedIn ? new Date().toISOString() : null,
    };

    const next = [...this.data.registrations];
    next[idx] = updated;
    this.data.registrations = sortRegistrationsDesc(next);
    this.persistToDisk();
    return updated;
  }

  deleteRegistration(id: string): boolean {
    const before = this.data.registrations.length;
    this.data.registrations = this.data.registrations.filter((r) => r.id !== id);
    if (this.data.registrations.length !== before) {
      this.persistToDisk();
      return true;
    }
    return false;
  }

  updateEventInfo(info: Partial<EventInfo>): EventInfo {
    this.data.eventInfo = sanitizeEventInfo(info);
    this.persistToDisk();
    return this.data.eventInfo;
  }

  restoreBackup(payload: {
    registrations?: Partial<Registration>[];
    eventInfo?: Partial<EventInfo>;
  }): { importedCount: number } {
    const map = new Map<string, Registration>(
      this.data.registrations.map((r) => [r.id, r])
    );
    const nowIso = new Date().toISOString();
    let importedCount = 0;

    if (Array.isArray(payload.registrations)) {
      for (const rawItem of payload.registrations) {
        if (!rawItem || !rawItem.childName || !rawItem.parentName) continue;
        const cleanId =
          typeof rawItem.id === 'string' && /^[a-zA-Z0-9_-]{3,128}$/.test(rawItem.id)
            ? rawItem.id
            : generateId();
        const cleanCode =
          typeof rawItem.registrationCode === 'string' &&
          /^RI8[12]-[A-Z0-9]+$/.test(rawItem.registrationCode.trim().toUpperCase())
            ? rawItem.registrationCode.trim().toUpperCase()
            : generateCode(Array.from(map.values()));

        const cleanInput = sanitizeRegistrationInput({
          childName: String(rawItem.childName),
          parentName: String(rawItem.parentName),
          age: Number(rawItem.age || 6),
          whatsapp: String(rawItem.whatsapp || ''),
          competitions: Array.isArray(rawItem.competitions)
            ? rawItem.competitions
            : ['balap-karung'],
        });

        const existing = map.get(cleanId);
        const normalized: Registration = {
          id: cleanId,
          registrationCode: existing?.registrationCode || cleanCode,
          childName: cleanInput.childName,
          parentName: cleanInput.parentName,
          age: cleanInput.age,
          whatsapp: cleanInput.whatsapp,
          competitions: cleanInput.competitions,
          checkedIn: Boolean(rawItem.checkedIn),
          checkedInAt: rawItem.checkedIn ? rawItem.checkedInAt || nowIso : null,
          createdAt:
            typeof rawItem.createdAt === 'string' && !Number.isNaN(Date.parse(rawItem.createdAt))
              ? rawItem.createdAt
              : existing?.createdAt || nowIso,
        };

        map.set(cleanId, normalized);
        importedCount += 1;
      }
    }

    this.data.registrations = sortRegistrationsDesc(Array.from(map.values()));
    if (payload.eventInfo) {
      this.data.eventInfo = sanitizeEventInfo(payload.eventInfo);
    }
    this.persistToDisk();
    return { importedCount };
  }

  lookupTickets(query: {
    parentName: string;
    registrationCode?: string;
    childName?: string;
  }): Registration[] {
    const parentTarget = query.parentName.trim().toLowerCase();
    const codeTarget = query.registrationCode?.trim().toUpperCase();
    const childTarget = query.childName?.trim().toLowerCase();

    if (!parentTarget || (!codeTarget && !childTarget)) {
      return [];
    }

    return this.data.registrations.filter((item) => {
      if (item.parentName.trim().toLowerCase() !== parentTarget) return false;
      if (codeTarget) {
        return item.registrationCode.trim().toUpperCase() === codeTarget;
      }
      if (childTarget) {
        return item.childName.trim().toLowerCase() === childTarget;
      }
      return false;
    });
  }
}

export const committeeStore = new CommitteeStore();
