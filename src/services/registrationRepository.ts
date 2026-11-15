import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase';
import {
  COMPETITIONS,
  CompetitionId,
  CreateRegistrationInput,
  DEFAULT_COMMITTEE_PIN,
  DEFAULT_EVENT_INFO,
  EventInfo,
  Registration,
} from '../types/registration';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

export type UnsubscribeFn = () => void;

export interface TicketLookupQuery {
  parentName: string;
  registrationCode?: string;
  childName?: string;
}

export type SyncState = 'synced' | 'syncing' | 'offline' | 'needs-auth' | 'error';

export interface SyncStatus {
  state: SyncState;
  pendingCount: number;
  serverConnected: boolean;
  userEmail: string | null;
  lastSyncedAt: string | null;
  errorMessage: string | null;
}

export interface RegistrationRepository {
  getRegistrations(): Promise<Registration[]>;
  subscribeRegistrations(
    onData: (registrations: Registration[]) => void,
    onError: (error: Error) => void
  ): UnsubscribeFn;
  createRegistration(input: CreateRegistrationInput): Promise<Registration>;
  updateRegistration?(id: string, input: CreateRegistrationInput): Promise<Registration>;
  checkInRegistration(id: string, checkedIn: boolean): Promise<void>;
  deleteRegistration(id: string): Promise<void>;
  getEventInfo(): Promise<EventInfo>;
  subscribeEventInfo(onData: (info: EventInfo) => void): UnsubscribeFn;
  updateEventInfo(info: EventInfo): Promise<EventInfo>;
  verifyPin(pin: string): Promise<boolean>;
  changePin?(currentPin: string, newPin: string): Promise<boolean>;
  lookupTickets?(query: TicketLookupQuery): Promise<Registration[]>;
  restoreBackup?(payload: {
    registrations: Registration[];
    eventInfo?: EventInfo;
  }): Promise<{ importedCount: number }>;
  hasCommitteeSession?(): boolean;
  clearCommitteeSession?(): void;
}

export class UnauthorizedCommitteeError extends Error {
  constructor(message = 'Sesi panitia berakhir. Silakan masukkan PIN kembali.') {
    super(message);
    this.name = 'UnauthorizedCommitteeError';
  }
}

const REG_CACHE_KEY = 'hut_ri_81_hybrid_registrations_v1';
const EVENT_CACHE_KEY = 'hut_ri_81_hybrid_event_info_v1';
const SYNC_QUEUE_KEY = 'hut_ri_82_server_sync_queue_v1';
const PIN_CACHE_KEY = 'hut_ri_81_committee_pin_v1';
const SESSION_KEY = 'hut_ri_81_committee_unlocked_v1';
const TOKEN_KEY = 'hut_ri_82_committee_token_v1';
const LAST_SYNCED_KEY = 'hut_ri_81_last_synced_at_v1';

const VALID_COMPETITION_IDS = new Set<CompetitionId>(COMPETITIONS.map((c) => c.id));

type SyncOperation =
  | {
      opId: string;
      type: 'create';
      id: string;
      registration: Registration;
      queuedAt: string;
    }
  | {
      opId: string;
      type: 'upsert';
      id: string;
      registration: Registration;
      queuedAt: string;
    }
  | {
      opId: string;
      type: 'update';
      id: string;
      input: CreateRegistrationInput;
      queuedAt: string;
    }
  | {
      opId: string;
      type: 'checkin';
      id: string;
      checkedIn: boolean;
      queuedAt: string;
    }
  | {
      opId: string;
      type: 'delete';
      id: string;
      queuedAt: string;
    }
  | {
      opId: string;
      type: 'event_info';
      id: 'main';
      info: EventInfo;
      queuedAt: string;
    };

function generateRegistrationId(): string {
  const timePart = Date.now().toString(36);
  const randPart = Math.random().toString(36).slice(2, 8);
  return `reg-${timePart}-${randPart}`;
}

function generateRegistrationCode(existing: Registration[]): string {
  const existingCodes = new Set(existing.map((r) => r.registrationCode.toUpperCase()));
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 25; attempt += 1) {
    let suffix = '';
    for (let i = 0; i < 5; i += 1) {
      suffix += chars[Math.floor(Math.random() * chars.length)];
    }
    const candidate = `RI82-${suffix}`;
    if (!existingCodes.has(candidate)) {
      return candidate;
    }
  }
  return `RI82-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

function sanitizeInput(input: CreateRegistrationInput): CreateRegistrationInput {
  const childName = input.childName.trim().slice(0, 100);
  const parentName = input.parentName.trim().slice(0, 100);
  const parsedAge = Number.isFinite(input.age) ? Math.round(input.age) : 6;
  const age = Math.min(15, Math.max(3, parsedAge));
  const whatsapp = (input.whatsapp || '').trim().slice(0, 20);
  const filteredComps = Array.from(
    new Set(input.competitions.filter((id): id is CompetitionId => VALID_COMPETITION_IDS.has(id)))
  ).slice(0, 6);
  const competitions: CompetitionId[] =
    filteredComps.length > 0 ? filteredComps : ['balap-karung'];

  return {
    childName: childName.length >= 2 ? childName : 'Peserta Lomba',
    parentName: parentName.length >= 2 ? parentName : 'Orang Tua',
    age,
    whatsapp,
    competitions,
  };
}

function upgradeLegacyEventInfo(info: EventInfo): EventInfo {
  const legacyTitle = info.title.trim();
  const legacyDate = info.dateText.trim();
  const legacyLocation = info.locationText.trim();
  return {
    title:
      legacyTitle === 'Pendaftaran Lomba HUT RI ke-81' || legacyTitle === 'HUT RI ke-81'
        ? DEFAULT_EVENT_INFO.title
        : info.title,
    dateText:
      legacyDate === 'Senin, 17 Agustus 2026 · 07.30 WIB – Selesai' ||
      legacyDate === 'Selasa, 17 Agustus 2027 · 07.30 WIB – Selesai'
        ? DEFAULT_EVENT_INFO.dateText
        : info.dateText,
    locationText:
      legacyLocation === 'Lapangan Utama RW 05, Taman Kemerdekaan'
        ? DEFAULT_EVENT_INFO.locationText
        : info.locationText,
  };
}

function sanitizeEventInfo(info: EventInfo): EventInfo {
  const title = info.title.trim().slice(0, 120);
  const dateText = info.dateText.trim().slice(0, 120);
  const locationText = info.locationText.trim().slice(0, 150);
  return {
    title: title.length >= 3 ? title : DEFAULT_EVENT_INFO.title,
    dateText: dateText.length >= 3 ? dateText : DEFAULT_EVENT_INFO.dateText,
    locationText: locationText.length >= 3 ? locationText : DEFAULT_EVENT_INFO.locationText,
  };
}

function timestampToIso(value: unknown, fallbackIso?: string): string {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof value === 'string' && value.trim()) {
    return value;
  }
  return fallbackIso ?? new Date().toISOString();
}

export class HybridRegistrationRepository implements RegistrationRepository {
  private registrationListeners = new Set<(items: Registration[]) => void>();
  private registrationErrorListeners = new Set<(error: Error) => void>();
  private eventListeners = new Set<(info: EventInfo) => void>();
  private queueListeners = new Set<(count: number) => void>();
  private syncStatusListeners = new Set<(status: SyncStatus) => void>();

  private currentUser: User | null = null;
  private isFlushing = false;
  private flushRequestedAgain = false;
  private lastSyncedAt: string | null = null;
  private lastErrorMessage: string | null = null;
  private permissionBlocked = false;
  private serverStreamConnected = false;

  private serverEventSource: EventSource | null = null;
  private publicEventSource: EventSource | null = null;
  private cloudRegistrationsUnsub: UnsubscribeFn | null = null;
  private cloudEventUnsub: UnsubscribeFn | null = null;
  private retryIntervalId: number | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        this.lastSyncedAt = window.localStorage.getItem(LAST_SYNCED_KEY);
      } catch {
        this.lastSyncedAt = null;
      }

      this.initPublicServerListeners();
      this.initCloudListeners();

      window.addEventListener('online', () => {
        this.lastErrorMessage = null;
        this.emitSyncStatus();
        void this.flushSyncQueue();
        if (this.hasCommitteeSession() && this.registrationListeners.size > 0) {
          this.attachServerRegistrationsStream();
        }
      });
      window.addEventListener('offline', () => {
        this.serverStreamConnected = false;
        this.emitSyncStatus();
      });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          void this.flushSyncQueue();
        }
      });

      this.retryIntervalId = window.setInterval(() => {
        if (this.getSyncQueue().length > 0 && navigator.onLine) {
          void this.flushSyncQueue();
        }
      }, 15000);
    }
  }

  private getCommitteeToken(): string | null {
    if (typeof window === 'undefined') return null;
    try {
      return window.sessionStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  }

  private setCommitteeSessionToken(token: string): void {
    if (typeof window === 'undefined') return;
    window.sessionStorage.setItem(SESSION_KEY, '1');
    window.sessionStorage.setItem(TOKEN_KEY, token);
  }

  private initPublicServerListeners(): void {
    if (typeof window === 'undefined') return;

    fetch('/api/event-info')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { eventInfo?: EventInfo } | null) => {
        if (data?.eventInfo && !this.getSyncQueue().some((op) => op.type === 'event_info')) {
          const clean = upgradeLegacyEventInfo(sanitizeEventInfo(data.eventInfo));
          this.setCachedEventInfo(clean);
          this.eventListeners.forEach((cb) => cb(clean));
        }
      })
      .catch(() => {
        // Offline / server unavailable - keep local cache
      });

    if (typeof EventSource !== 'undefined') {
      try {
        this.publicEventSource = new EventSource('/api/event-info/stream');
        this.publicEventSource.addEventListener('event_info', (event) => {
          try {
            const parsed = JSON.parse((event as MessageEvent<string>).data) as {
              eventInfo?: EventInfo;
            };
            if (
              parsed?.eventInfo &&
              !this.getSyncQueue().some((op) => op.type === 'event_info')
            ) {
              const clean = upgradeLegacyEventInfo(sanitizeEventInfo(parsed.eventInfo));
              this.setCachedEventInfo(clean);
              this.eventListeners.forEach((cb) => cb(clean));
            }
          } catch {
            // ignore malformed event
          }
        });
      } catch {
        // ignore EventSource errors
      }
    }
  }

  private initCloudListeners(): void {
    // 1. Metadata acara dari Firestore (opsional tambahan jika ada)
    const eventDocRef = doc(db, 'event_settings', 'main');
    this.cloudEventUnsub = onSnapshot(
      eventDocRef,
      (snapshot) => {
        if (!snapshot.exists()) return;
        const hasPendingEventUpdate = this.getSyncQueue().some(
          (op) => op.type === 'event_info'
        );
        if (hasPendingEventUpdate) return;

        const data = snapshot.data();
        if (data?.title && data?.dateText && data?.locationText) {
          const remoteInfo: EventInfo = upgradeLegacyEventInfo(
            sanitizeEventInfo({
              title: String(data.title),
              dateText: String(data.dateText),
              locationText: String(data.locationText),
            })
          );
          this.setCachedEventInfo(remoteInfo);
          this.eventListeners.forEach((cb) => cb(remoteInfo));
        }
      },
      () => {
        // Abaikan jika Firestore tidak aktif / offline
      }
    );

    // 2. Pantau status autentikasi Firebase opsional (untuk Cloud Backup Firestore)
    onAuthStateChanged(auth, (user) => {
      this.currentUser = user;
      this.permissionBlocked = false;

      this.detachCloudRegistrationsListener();
      if (user && this.hasCommitteeSession()) {
        this.attachCloudRegistrationsListener();
      }
      this.emitSyncStatus();
    });
  }

  private detachServerStream(): void {
    if (this.serverEventSource) {
      this.serverEventSource.close();
      this.serverEventSource = null;
    }
    this.serverStreamConnected = false;
  }

  private attachServerRegistrationsStream(): void {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;
    const token = this.getCommitteeToken();
    if (!token) return;

    this.detachServerStream();

    const url = `/api/committee/stream?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    this.serverEventSource = es;

    es.onopen = () => {
      this.serverStreamConnected = true;
      this.lastErrorMessage = null;
      this.emitSyncStatus();
    };

    es.addEventListener('snapshot', (event) => {
      try {
        const parsed = JSON.parse((event as MessageEvent<string>).data) as {
          registrations?: Registration[];
          eventInfo?: EventInfo;
        };
        this.serverStreamConnected = true;
        this.lastErrorMessage = null;

        if (Array.isArray(parsed.registrations)) {
          const merged = this.mergeWithLocalPending(parsed.registrations);
          this.setCachedRegistrations(merged);
          this.markSyncedNow();
          this.notifyRegistrationListeners(merged);
        }

        if (
          parsed.eventInfo &&
          !this.getSyncQueue().some((op) => op.type === 'event_info')
        ) {
          const cleanInfo = upgradeLegacyEventInfo(sanitizeEventInfo(parsed.eventInfo));
          this.setCachedEventInfo(cleanInfo);
          this.eventListeners.forEach((cb) => cb(cleanInfo));
        }

        this.emitSyncStatus();
      } catch {
        // ignore parse issue
      }
    });

    es.onerror = () => {
      this.serverStreamConnected = false;
      this.emitSyncStatus();

      const currentToken = this.getCommitteeToken();
      if (!currentToken) return;

      // Verify if session token expired or PIN was changed by another admin
      fetch('/api/committee/verify', {
        headers: { Authorization: `Bearer ${currentToken}` },
      })
        .then((res) => {
          if (res.status === 401) {
            this.detachServerStream();
            this.clearCommitteeSession();
            const err = new UnauthorizedCommitteeError();
            this.registrationErrorListeners.forEach((cb) => cb(err));
          }
        })
        .catch(() => {
          // Offline / transient network error; EventSource will auto-retry
        });
    };
  }

  private detachCloudRegistrationsListener(): void {
    if (this.cloudRegistrationsUnsub) {
      this.cloudRegistrationsUnsub();
      this.cloudRegistrationsUnsub = null;
    }
  }

  private attachCloudRegistrationsListener(): void {
    if (this.cloudRegistrationsUnsub || !this.currentUser) return;

    const regsQuery = query(collection(db, 'registrations'), orderBy('createdAt', 'desc'));
    this.cloudRegistrationsUnsub = onSnapshot(
      regsQuery,
      (snapshot) => {
        this.permissionBlocked = false;

        const cloudItems: Registration[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          const createdIso = timestampToIso(d.createdAt);
          return {
            id: docSnap.id,
            registrationCode: String(d.registrationCode || ''),
            childName: String(d.childName || ''),
            parentName: String(d.parentName || ''),
            age: Number(d.age || 6),
            whatsapp: String(d.whatsapp || ''),
            competitions: Array.isArray(d.competitions)
              ? (d.competitions.filter((id: unknown): id is CompetitionId =>
                  VALID_COMPETITION_IDS.has(id as CompetitionId)
                ) as CompetitionId[])
              : ['balap-karung'],
            checkedIn: Boolean(d.checkedIn),
            checkedInAt: d.checkedInAt ? timestampToIso(d.checkedInAt) : null,
            createdAt: createdIso,
          };
        });

        // Jika server baru restart (kosong) tapi Firestore punya cadangan, pulihkan ke server
        const token = this.getCommitteeToken();
        if (token && cloudItems.length > 0 && this.getCachedRegistrations().length === 0) {
          void fetch('/api/committee/restore', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ registrations: cloudItems }),
          }).catch(() => {});
        }

        const merged = this.mergeWithLocalPending(cloudItems);
        this.setCachedRegistrations(merged);
        this.markSyncedNow();
        this.notifyRegistrationListeners(merged);
        this.emitSyncStatus();
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, 'registrations');
        } catch (wrapped) {
          const msg = wrapped instanceof Error ? wrapped.message : String(wrapped);
          if (
            msg.includes('Missing or insufficient permissions') ||
            msg.includes('permission-denied')
          ) {
            this.permissionBlocked = true;
          }
          this.emitSyncStatus();
        }
      }
    );
  }

  // --- Synchronous LocalStorage Cache Accessors (0ms) ---

  getCachedRegistrations(): Registration[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(REG_CACHE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as Registration[]) : [];
    } catch {
      return [];
    }
  }

  private setCachedRegistrations(items: Registration[]): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(REG_CACHE_KEY, JSON.stringify(items));
    } catch {
      // Abaikan jika kuota localStorage penuh
    }
  }

  getCachedEventInfo(): EventInfo {
    if (typeof window === 'undefined') return DEFAULT_EVENT_INFO;
    try {
      const raw = window.localStorage.getItem(EVENT_CACHE_KEY);
      if (!raw) return DEFAULT_EVENT_INFO;
      const parsed = JSON.parse(raw) as Partial<EventInfo>;
      if (parsed?.title && parsed?.dateText && parsed?.locationText) {
        return upgradeLegacyEventInfo({
          title: parsed.title,
          dateText: parsed.dateText,
          locationText: parsed.locationText,
        });
      }
      return DEFAULT_EVENT_INFO;
    } catch {
      return DEFAULT_EVENT_INFO;
    }
  }

  private setCachedEventInfo(info: EventInfo): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(EVENT_CACHE_KEY, JSON.stringify(info));
    } catch {
      // ignore storage quota errors
    }
  }

  private getSyncQueue(): SyncOperation[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(SYNC_QUEUE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as SyncOperation[]) : [];
    } catch {
      return [];
    }
  }

  private setSyncQueue(queue: SyncOperation[]): void {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
      } catch {
        // ignore storage quota errors
      }
    }
    this.queueListeners.forEach((cb) => cb(queue.length));
    this.emitSyncStatus();
  }

  private markSyncedNow(): void {
    const nowIso = new Date().toISOString();
    this.lastSyncedAt = nowIso;
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(LAST_SYNCED_KEY, nowIso);
      } catch {
        // ignore
      }
    }
  }

  private notifyRegistrationListeners(items: Registration[]): void {
    this.registrationListeners.forEach((cb) => cb(items));
  }

  // --- Merge & Queue Coalescing ---

  private mergeWithLocalPending(remoteItems: Registration[]): Registration[] {
    const queue = this.getSyncQueue();
    const map = new Map<string, Registration>();

    for (const item of remoteItems) {
      map.set(item.id, item);
    }

    const pendingDeletes = new Set(
      queue.filter((op) => op.type === 'delete').map((op) => op.id)
    );
    const localBeforeMerge = this.getCachedRegistrations();
    for (const localItem of localBeforeMerge) {
      if (!map.has(localItem.id) && !pendingDeletes.has(localItem.id)) {
        const hasPendingCreate = queue.some(
          (op) => (op.type === 'create' || op.type === 'upsert') && op.id === localItem.id
        );
        if (hasPendingCreate) {
          map.set(localItem.id, localItem);
        }
      }
    }

    for (const op of queue) {
      if (op.type === 'create' || op.type === 'upsert') {
        map.set(op.id, op.registration);
      } else if (op.type === 'update') {
        const existing = map.get(op.id);
        if (existing) {
          map.set(op.id, {
            ...existing,
            childName: op.input.childName,
            parentName: op.input.parentName,
            age: op.input.age,
            whatsapp: op.input.whatsapp,
            competitions: op.input.competitions,
          });
        }
      } else if (op.type === 'checkin') {
        const existing = map.get(op.id);
        if (existing) {
          map.set(op.id, {
            ...existing,
            checkedIn: op.checkedIn,
            checkedInAt: op.checkedIn ? op.queuedAt : null,
          });
        }
      } else if (op.type === 'delete') {
        map.delete(op.id);
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  private enqueueOperation(newOp: SyncOperation): void {
    const queue = [...this.getSyncQueue()];
    const nowIso = newOp.queuedAt;

    if (newOp.type === 'event_info') {
      const filtered: SyncOperation[] = queue.filter((op) => op.type !== 'event_info');
      filtered.push(newOp);
      this.setSyncQueue(filtered);
      return;
    }

    if (newOp.type === 'delete') {
      const hadPendingCreateOnly = queue.some(
        (op) => op.id === newOp.id && op.type === 'create'
      );
      const filtered: SyncOperation[] = queue.filter((op) => op.id !== newOp.id);
      if (!hadPendingCreateOnly) {
        filtered.push(newOp);
      }
      this.setSyncQueue(filtered);
      return;
    }

    if (newOp.type === 'create' || newOp.type === 'upsert') {
      const filtered: SyncOperation[] = queue.filter((op) => op.id !== newOp.id);
      filtered.push(newOp);
      this.setSyncQueue(filtered);
      return;
    }

    if (newOp.type === 'update') {
      const existingCreateIdx = queue.findIndex(
        (op) => op.id === newOp.id && (op.type === 'create' || op.type === 'upsert')
      );
      if (existingCreateIdx !== -1) {
        const target = queue[existingCreateIdx] as Extract<
          SyncOperation,
          { type: 'create' | 'upsert' }
        >;
        queue[existingCreateIdx] = {
          ...target,
          queuedAt: nowIso,
          registration: {
            ...target.registration,
            childName: newOp.input.childName,
            parentName: newOp.input.parentName,
            age: newOp.input.age,
            whatsapp: newOp.input.whatsapp,
            competitions: newOp.input.competitions,
          },
        };
        this.setSyncQueue(queue);
        return;
      }
      const filtered: SyncOperation[] = queue.filter(
        (op) => !(op.id === newOp.id && op.type === 'update')
      );
      filtered.push(newOp);
      this.setSyncQueue(filtered);
      return;
    }

    if (newOp.type === 'checkin') {
      const existingCreateIdx = queue.findIndex(
        (op) => op.id === newOp.id && (op.type === 'create' || op.type === 'upsert')
      );
      if (existingCreateIdx !== -1) {
        const target = queue[existingCreateIdx] as Extract<
          SyncOperation,
          { type: 'create' | 'upsert' }
        >;
        queue[existingCreateIdx] = {
          ...target,
          queuedAt: nowIso,
          registration: {
            ...target.registration,
            checkedIn: newOp.checkedIn,
            checkedInAt: newOp.checkedIn ? nowIso : null,
          },
        };
        this.setSyncQueue(queue);
        return;
      }
      const filtered: SyncOperation[] = queue.filter(
        (op) => !(op.id === newOp.id && op.type === 'checkin')
      );
      filtered.push(newOp);
      this.setSyncQueue(filtered);
    }
  }

  // --- Background Server Sync (PIN-Authenticated) + Optional Firestore Mirror ---

  private async mirrorToFirestoreBestEffort(op: SyncOperation): Promise<void> {
    if (op.type === 'create' && !op.registration.checkedIn) {
      try {
        const reg = op.registration;
        await setDoc(doc(db, 'registrations', reg.id), {
          registrationCode: reg.registrationCode,
          childName: reg.childName,
          parentName: reg.parentName,
          age: reg.age,
          whatsapp: reg.whatsapp,
          competitions: reg.competitions,
          checkedIn: false,
          checkedInAt: null,
          createdAt: serverTimestamp(),
        });
      } catch {
        // Optional Firestore mirror; server.ts remains primary real-time source
      }
      return;
    }

    if (!this.currentUser || this.permissionBlocked) return;

    try {
      if (op.type === 'upsert') {
        const reg = op.registration;
        const existingSnap = await getDoc(doc(db, 'registrations', reg.id));
        if (existingSnap.exists()) {
          await updateDoc(doc(db, 'registrations', reg.id), {
            childName: reg.childName,
            parentName: reg.parentName,
            age: reg.age,
            whatsapp: reg.whatsapp,
            competitions: reg.competitions,
            checkedIn: Boolean(reg.checkedIn),
            checkedInAt: reg.checkedIn ? serverTimestamp() : null,
          });
        } else {
          await setDoc(doc(db, 'registrations', reg.id), {
            registrationCode: reg.registrationCode,
            childName: reg.childName,
            parentName: reg.parentName,
            age: reg.age,
            whatsapp: reg.whatsapp,
            competitions: reg.competitions,
            checkedIn: Boolean(reg.checkedIn),
            checkedInAt: reg.checkedIn ? serverTimestamp() : null,
            createdAt: serverTimestamp(),
          });
        }
      } else if (op.type === 'update') {
        await updateDoc(doc(db, 'registrations', op.id), {
          childName: op.input.childName,
          parentName: op.input.parentName,
          age: op.input.age,
          whatsapp: op.input.whatsapp,
          competitions: op.input.competitions,
        });
      } else if (op.type === 'checkin') {
        await updateDoc(doc(db, 'registrations', op.id), {
          checkedIn: op.checkedIn,
          checkedInAt: op.checkedIn ? serverTimestamp() : null,
        });
      } else if (op.type === 'delete') {
        await deleteDoc(doc(db, 'registrations', op.id));
      } else if (op.type === 'event_info') {
        await setDoc(doc(db, 'event_settings', 'main'), {
          title: op.info.title,
          dateText: op.info.dateText,
          locationText: op.info.locationText,
          updatedAt: serverTimestamp(),
        });
      }
    } catch {
      // Optional Firestore mirror failure doesn't block PIN-server sync
    }
  }

  private async executeServerOperation(op: SyncOperation): Promise<void> {
    const token = this.getCommitteeToken();

    if (op.type === 'create') {
      const reg = op.registration;
      const res = await fetch('/api/registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: reg.id,
          registrationCode: reg.registrationCode,
          createdAt: reg.createdAt,
          childName: reg.childName,
          parentName: reg.parentName,
          age: reg.age,
          whatsapp: reg.whatsapp,
          competitions: reg.competitions,
        }),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return;
    }

    if (!token) {
      throw new UnauthorizedCommitteeError();
    }

    if (op.type === 'upsert') {
      const res = await fetch('/api/committee/restore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ registrations: [op.registration] }),
      });
      if (res.status === 401) throw new UnauthorizedCommitteeError();
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return;
    }

    if (op.type === 'update') {
      const res = await fetch(`/api/committee/registrations/${encodeURIComponent(op.id)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(op.input),
      });
      if (res.status === 401) throw new UnauthorizedCommitteeError();
      if (!res.ok && res.status !== 404) throw new Error(`HTTP ${res.status}`);
      return;
    }

    if (op.type === 'checkin') {
      const res = await fetch(
        `/api/committee/registrations/${encodeURIComponent(op.id)}/checkin`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ checkedIn: op.checkedIn }),
        }
      );
      if (res.status === 401) throw new UnauthorizedCommitteeError();
      if (!res.ok && res.status !== 404) throw new Error(`HTTP ${res.status}`);
      return;
    }

    if (op.type === 'delete') {
      const res = await fetch(`/api/committee/registrations/${encodeURIComponent(op.id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) throw new UnauthorizedCommitteeError();
      if (!res.ok && res.status !== 404) throw new Error(`HTTP ${res.status}`);
      return;
    }

    if (op.type === 'event_info') {
      const res = await fetch('/api/committee/event-info', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(op.info),
      });
      if (res.status === 401) throw new UnauthorizedCommitteeError();
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    }
  }

  async flushSyncQueue(): Promise<number> {
    if (typeof window === 'undefined') return 0;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.emitSyncStatus();
      return 0;
    }

    if (this.isFlushing) {
      this.flushRequestedAgain = true;
      return 0;
    }

    const queue = this.getSyncQueue();
    if (queue.length === 0) {
      this.emitSyncStatus();
      return 0;
    }

    this.isFlushing = true;
    this.emitSyncStatus();

    let syncedCount = 0;
    const remaining: SyncOperation[] = [];

    try {
      for (const op of queue) {
        if (op.type !== 'create' && !this.getCommitteeToken()) {
          remaining.push(op);
          continue;
        }

        try {
          await this.executeServerOperation(op);
          void this.mirrorToFirestoreBestEffort(op);
          syncedCount += 1;
          this.lastErrorMessage = null;
        } catch (err) {
          if (err instanceof UnauthorizedCommitteeError) {
            this.clearCommitteeSession();
            this.registrationErrorListeners.forEach((cb) => cb(err));
          } else {
            this.lastErrorMessage =
              'Beberapa perubahan belum terkirim ke server dan akan otomatis dicoba ulang.';
          }
          remaining.push(op);
        }
      }

      const latestQueue = this.getSyncQueue();
      const processedOpIds = new Set(queue.map((q) => q.opId));
      const newlyAdded = latestQueue.filter((q) => !processedOpIds.has(q.opId));
      const finalQueue = [...remaining, ...newlyAdded];

      this.setSyncQueue(finalQueue);
      if (syncedCount > 0) {
        this.markSyncedNow();
      }
    } finally {
      this.isFlushing = false;
      this.emitSyncStatus();

      if (this.flushRequestedAgain) {
        this.flushRequestedAgain = false;
        setTimeout(() => {
          void this.flushSyncQueue();
        }, 50);
      }
    }

    return syncedCount;
  }

  // --- Sync Status & Optional Cloud Backup Controls ---

  getSyncStatus(): SyncStatus {
    const pendingCount = this.getSyncQueue().length;
    const online = typeof navigator !== 'undefined' ? navigator.onLine : true;

    let state: SyncState = 'synced';
    if (!online) {
      state = 'offline';
    } else if (this.isFlushing || pendingCount > 0) {
      state = 'syncing';
    } else if (this.lastErrorMessage) {
      state = 'error';
    } else if (this.serverStreamConnected || this.hasCommitteeSession()) {
      state = 'synced';
    } else {
      state = 'needs-auth';
    }

    return {
      state,
      pendingCount,
      serverConnected: this.serverStreamConnected,
      userEmail: this.currentUser?.email ?? null,
      lastSyncedAt: this.lastSyncedAt,
      errorMessage: this.lastErrorMessage,
    };
  }

  private emitSyncStatus(): void {
    const status = this.getSyncStatus();
    this.syncStatusListeners.forEach((cb) => cb(status));
  }

  subscribeSyncStatus(onChange: (status: SyncStatus) => void): UnsubscribeFn {
    this.syncStatusListeners.add(onChange);
    onChange(this.getSyncStatus());
    return () => {
      this.syncStatusListeners.delete(onChange);
    };
  }

  subscribePendingQueue(onChange: (count: number) => void): UnsubscribeFn {
    this.queueListeners.add(onChange);
    onChange(this.getSyncQueue().length);
    return () => {
      this.queueListeners.delete(onChange);
    };
  }

  async signInCloudSync(): Promise<void> {
    this.permissionBlocked = false;
    this.lastErrorMessage = null;
    await signInWithPopup(auth, googleProvider);
    if (this.hasCommitteeSession()) {
      this.attachCloudRegistrationsListener();
    }
    this.emitSyncStatus();
  }

  async signOutCloudSync(): Promise<void> {
    this.detachCloudRegistrationsListener();
    await signOut(auth);
    this.permissionBlocked = false;
    this.emitSyncStatus();
  }

  async syncPendingCheckIns(): Promise<number> {
    const count = await this.flushSyncQueue();
    await this.pullLatestFromServer();
    return count;
  }

  private async pullLatestFromServer(): Promise<void> {
    const token = this.getCommitteeToken();
    if (!token || (typeof navigator !== 'undefined' && !navigator.onLine)) return;

    try {
      const res = await fetch('/api/committee/registrations', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        this.clearCommitteeSession();
        const err = new UnauthorizedCommitteeError();
        this.registrationErrorListeners.forEach((cb) => cb(err));
        return;
      }
      if (!res.ok) return;

      const data = (await res.json()) as {
        registrations?: Registration[];
        eventInfo?: EventInfo;
      };
      const serverItems = Array.isArray(data.registrations) ? data.registrations : [];
      const localItems = this.getCachedRegistrations();

      // Jika server baru menyala kosong sedangkan perangkat ini masih menyimpan cache lokal,
      // otomatis sinkronkan data ke server agar admin di perangkat lain ikut mendapatkannya.
      if (serverItems.length === 0 && localItems.length > 0) {
        await fetch('/api/committee/restore', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            registrations: localItems,
            eventInfo: this.getCachedEventInfo(),
          }),
        }).catch(() => {});
        return;
      }

      const merged = this.mergeWithLocalPending(serverItems);
      this.setCachedRegistrations(merged);
      this.markSyncedNow();
      this.notifyRegistrationListeners(merged);

      if (data.eventInfo && !this.getSyncQueue().some((op) => op.type === 'event_info')) {
        const cleanInfo = upgradeLegacyEventInfo(sanitizeEventInfo(data.eventInfo));
        this.setCachedEventInfo(cleanInfo);
        this.eventListeners.forEach((cb) => cb(cleanInfo));
      }
      this.emitSyncStatus();
    } catch {
      // Offline / transient network error
    }
  }

  // --- Committee Session & Server-Verified PIN ---

  hasCommitteeSession(): boolean {
    if (typeof window === 'undefined') return false;
    const unlocked = window.sessionStorage.getItem(SESSION_KEY) === '1';
    if (!unlocked) return false;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return true;
    }
    return Boolean(this.getCommitteeToken());
  }

  clearCommitteeSession(): void {
    this.detachServerStream();
    this.detachCloudRegistrationsListener();
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(SESSION_KEY);
      window.sessionStorage.removeItem(TOKEN_KEY);
    }
    this.emitSyncStatus();
  }

  private getStoredPin(): string {
    if (typeof window === 'undefined') return DEFAULT_COMMITTEE_PIN;
    return window.localStorage.getItem(PIN_CACHE_KEY) || DEFAULT_COMMITTEE_PIN;
  }

  async verifyPin(pin: string): Promise<boolean> {
    const cleanPin = pin.trim();
    if (!cleanPin) return false;

    if (typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const res = await fetch('/api/committee/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: cleanPin }),
        });

        if (res.status === 401) {
          return false;
        }
        if (res.status === 429) {
          const errData = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(
            errData.error || 'Terlalu banyak percobaan PIN salah. Tunggu sebentar lalu coba lagi.'
          );
        }
        if (res.ok) {
          const data = (await res.json()) as { token?: string };
          if (data?.token) {
            this.setCommitteeSessionToken(data.token);
            if (typeof window !== 'undefined') {
              window.localStorage.setItem(PIN_CACHE_KEY, cleanPin);
            }
            await this.flushSyncQueue();
            await this.pullLatestFromServer();
            this.attachServerRegistrationsStream();
            if (this.currentUser) {
              this.attachCloudRegistrationsListener();
            }
            return true;
          }
        }
      } catch (err) {
        if (err instanceof Error && err.message.includes('Terlalu banyak percobaan')) {
          throw err;
        }
        // Network error fallback to local PIN check below
      }
    }

    const valid = cleanPin === this.getStoredPin();
    if (valid && typeof window !== 'undefined') {
      window.sessionStorage.setItem(SESSION_KEY, '1');
    }
    return valid;
  }

  async changePin(currentPin: string, newPin: string): Promise<boolean> {
    const cleanCurrent = currentPin.trim();
    const cleanNew = newPin.trim();
    if (!/^[a-zA-Z0-9]{4,12}$/.test(cleanNew)) {
      throw new Error('PIN baru harus 4–12 karakter (huruf/angka tanpa spasi).');
    }

    const token = this.getCommitteeToken();
    if (!token || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      throw new Error('Perubahan PIN memerlukan koneksi internet agar berlaku di semua perangkat.');
    }

    const res = await fetch('/api/committee/pin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ currentPin: cleanCurrent, newPin: cleanNew }),
    });

    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      token?: string;
    };
    if (res.status === 401) {
      this.clearCommitteeSession();
      throw new UnauthorizedCommitteeError();
    }
    if (!res.ok) {
      throw new Error(data.error || 'Gagal mengubah PIN panitia.');
    }

    if (data.token) {
      this.setCommitteeSessionToken(data.token);
      this.attachServerRegistrationsStream();
    }
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(PIN_CACHE_KEY, cleanNew);
    }
    return true;
  }

  // --- Core Hybrid CRUD Operations (LocalStorage 0ms + Server Real-Time SSE) ---

  async getRegistrations(): Promise<Registration[]> {
    return this.getCachedRegistrations();
  }

  subscribeRegistrations(
    onData: (registrations: Registration[]) => void,
    onError: (error: Error) => void
  ): UnsubscribeFn {
    this.registrationListeners.add(onData);
    this.registrationErrorListeners.add(onError);
    onData(this.getCachedRegistrations());

    if (this.hasCommitteeSession()) {
      void this.pullLatestFromServer();
      this.attachServerRegistrationsStream();
      if (this.currentUser) {
        this.attachCloudRegistrationsListener();
      }
    }

    return () => {
      this.registrationListeners.delete(onData);
      this.registrationErrorListeners.delete(onError);
      if (this.registrationListeners.size === 0) {
        this.detachServerStream();
      }
    };
  }

  async createRegistration(input: CreateRegistrationInput): Promise<Registration> {
    const clean = sanitizeInput(input);
    const current = this.getCachedRegistrations();
    const nowIso = new Date().toISOString();

    const created: Registration = {
      id: generateRegistrationId(),
      registrationCode: generateRegistrationCode(current),
      childName: clean.childName,
      parentName: clean.parentName,
      age: clean.age,
      whatsapp: clean.whatsapp,
      competitions: clean.competitions,
      checkedIn: false,
      checkedInAt: null,
      createdAt: nowIso,
    };

    const next = [created, ...current];
    this.setCachedRegistrations(next);
    this.notifyRegistrationListeners(next);

    this.enqueueOperation({
      opId: `op-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'create',
      id: created.id,
      registration: created,
      queuedAt: nowIso,
    });

    setTimeout(() => {
      void this.flushSyncQueue();
    }, 0);

    return created;
  }

  async updateRegistration(id: string, input: CreateRegistrationInput): Promise<Registration> {
    const clean = sanitizeInput(input);
    const current = this.getCachedRegistrations();
    const idx = current.findIndex((r) => r.id === id);
    if (idx === -1) {
      throw new Error('Data peserta tidak ditemukan di cache lokal.');
    }

    const updated: Registration = {
      ...current[idx],
      childName: clean.childName,
      parentName: clean.parentName,
      age: clean.age,
      whatsapp: clean.whatsapp,
      competitions: clean.competitions,
    };

    const next = [...current];
    next[idx] = updated;
    this.setCachedRegistrations(next);
    this.notifyRegistrationListeners(next);

    this.enqueueOperation({
      opId: `op-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'update',
      id,
      input: clean,
      queuedAt: new Date().toISOString(),
    });

    setTimeout(() => {
      void this.flushSyncQueue();
    }, 0);

    return updated;
  }

  async checkInRegistration(id: string, checkedIn: boolean): Promise<void> {
    const nowIso = new Date().toISOString();
    const current = this.getCachedRegistrations();
    const next = current.map((reg) =>
      reg.id === id
        ? {
            ...reg,
            checkedIn,
            checkedInAt: checkedIn ? nowIso : null,
          }
        : reg
    );

    this.setCachedRegistrations(next);
    this.notifyRegistrationListeners(next);

    this.enqueueOperation({
      opId: `op-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'checkin',
      id,
      checkedIn,
      queuedAt: nowIso,
    });

    setTimeout(() => {
      void this.flushSyncQueue();
    }, 0);
  }

  async deleteRegistration(id: string): Promise<void> {
    const current = this.getCachedRegistrations();
    const next = current.filter((reg) => reg.id !== id);
    this.setCachedRegistrations(next);
    this.notifyRegistrationListeners(next);

    this.enqueueOperation({
      opId: `op-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'delete',
      id,
      queuedAt: new Date().toISOString(),
    });

    setTimeout(() => {
      void this.flushSyncQueue();
    }, 0);
  }

  async lookupTickets(lookup: TicketLookupQuery): Promise<Registration[]> {
    const parentTarget = lookup.parentName.trim().toLowerCase();
    const codeTarget = lookup.registrationCode?.trim().toUpperCase();
    const childTarget = lookup.childName?.trim().toLowerCase();

    const cached = this.getCachedRegistrations();
    const localMatches = cached.filter((item) => {
      if (item.parentName.trim().toLowerCase() !== parentTarget) return false;
      if (codeTarget) {
        return item.registrationCode.trim().toUpperCase() === codeTarget;
      }
      if (childTarget) {
        return item.childName.trim().toLowerCase() === childTarget;
      }
      return false;
    });

    if (typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const res = await fetch('/api/lookup-tickets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(lookup),
        });
        if (res.ok) {
          const data = (await res.json()) as { registrations?: Registration[] };
          const serverMatches = Array.isArray(data.registrations) ? data.registrations : [];
          const merged = new Map<string, Registration>();
          for (const m of localMatches) merged.set(m.id, m);
          for (const m of serverMatches) merged.set(m.id, m);
          return Array.from(merged.values());
        }
      } catch {
        // Offline fallback to localMatches
      }
    }

    return localMatches;
  }

  async restoreBackup(payload: {
    registrations: Registration[];
    eventInfo?: EventInfo;
  }): Promise<{ importedCount: number }> {
    const current = this.getCachedRegistrations();
    const mergedMap = new Map<string, Registration>(current.map((r) => [r.id, r]));
    const nowIso = new Date().toISOString();
    let importedCount = 0;

    for (const rawItem of payload.registrations) {
      if (!rawItem || !rawItem.childName || !rawItem.parentName) continue;
      const cleanId =
        typeof rawItem.id === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(rawItem.id)
          ? rawItem.id
          : generateRegistrationId();
      const cleanCode =
        typeof rawItem.registrationCode === 'string' &&
        /^RI8[12]-[A-Z0-9]+$/.test(rawItem.registrationCode.toUpperCase())
          ? rawItem.registrationCode.toUpperCase()
          : generateRegistrationCode(Array.from(mergedMap.values()));

      const cleanInput = sanitizeInput({
        childName: String(rawItem.childName),
        parentName: String(rawItem.parentName),
        age: Number(rawItem.age || 6),
        whatsapp: String(rawItem.whatsapp || ''),
        competitions: Array.isArray(rawItem.competitions) ? rawItem.competitions : ['balap-karung'],
      });

      const normalized: Registration = {
        id: cleanId,
        registrationCode: cleanCode,
        childName: cleanInput.childName,
        parentName: cleanInput.parentName,
        age: cleanInput.age,
        whatsapp: cleanInput.whatsapp,
        competitions: cleanInput.competitions,
        checkedIn: Boolean(rawItem.checkedIn),
        checkedInAt: rawItem.checkedIn ? rawItem.checkedInAt || nowIso : null,
        createdAt: rawItem.createdAt || nowIso,
      };

      mergedMap.set(cleanId, normalized);
      this.enqueueOperation({
        opId: `op-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'upsert',
        id: cleanId,
        registration: normalized,
        queuedAt: nowIso,
      });
      importedCount += 1;
    }

    const next = Array.from(mergedMap.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    this.setCachedRegistrations(next);
    this.notifyRegistrationListeners(next);

    if (payload.eventInfo) {
      await this.updateEventInfo(payload.eventInfo);
    } else {
      setTimeout(() => {
        void this.flushSyncQueue();
      }, 0);
    }

    return { importedCount };
  }

  async getEventInfo(): Promise<EventInfo> {
    return this.getCachedEventInfo();
  }

  subscribeEventInfo(onData: (info: EventInfo) => void): UnsubscribeFn {
    this.eventListeners.add(onData);
    onData(this.getCachedEventInfo());
    return () => {
      this.eventListeners.delete(onData);
    };
  }

  async updateEventInfo(info: EventInfo): Promise<EventInfo> {
    const clean = sanitizeEventInfo(info);
    this.setCachedEventInfo(clean);
    this.eventListeners.forEach((cb) => cb(clean));

    this.enqueueOperation({
      opId: `op-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'event_info',
      id: 'main',
      info: clean,
      queuedAt: new Date().toISOString(),
    });

    setTimeout(() => {
      void this.flushSyncQueue();
    }, 0);

    return clean;
  }
}

export const registrationRepository = new HybridRegistrationRepository();
