import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock,
  Download,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  MapPin,
  Pencil,
  Printer,
  QrCode,
  Search,
  Settings2,
  Trash2,
  Unlock,
  Upload,
  Users,
  X,
} from 'lucide-react';
import {
  assignBibNumbers,
  assignBibNumbersByCompetition,
  groupParticipantsByRundown,
} from '../data/rundownSchedule';
import {
  COMPETITIONS,
  COMPETITION_MAP,
  CompetitionId,
  CreateRegistrationInput,
  EventInfo,
  Registration,
} from '../types/registration';
import { exportRegistrationsToCsv } from '../utils/exportCsv';
import { exportRegistrationsToExcel } from '../utils/exportExcel';
import { formatDateTimeId } from '../utils/formatDate';
import { EditRegistrationModal } from './EditRegistrationModal';
import { PrintBibModal } from './PrintBibModal';
import { QrScannerPanel } from './QrScannerPanel';
import { QrTicketCard } from './QrTicketCard';

interface CommitteeDashboardProps {
  isUnlocked: boolean;
  syncError: string | null;
  isOnline: boolean;
  onVerifyPin: (pin: string) => Promise<boolean>;
  onChangePin: (currentPin: string, newPin: string) => Promise<boolean>;
  onUnlock: () => void;
  onLock: () => void;
  registrations: Registration[];
  onUpdateRegistration: (id: string, input: CreateRegistrationInput) => Promise<void>;
  onCheckInRegistration: (id: string, checkedIn: boolean) => Promise<void>;
  onDeleteRegistration: (id: string) => Promise<void>;
  onRestoreBackup: (payload: {
    registrations: Registration[];
    eventInfo?: EventInfo;
  }) => Promise<{ importedCount: number }>;
  eventInfo: EventInfo;
  onUpdateEventInfo: (info: EventInfo) => Promise<void>;
  onGoToRegistration: () => void;
}

type AttendanceFilter = 'all' | 'checked-in' | 'pending';

export const CommitteeDashboard: React.FC<CommitteeDashboardProps> = ({
  isUnlocked,
  syncError,
  isOnline,
  onVerifyPin,
  onChangePin,
  onUnlock,
  onLock,
  registrations,
  onUpdateRegistration,
  onCheckInRegistration,
  onDeleteRegistration,
  onRestoreBackup,
  eventInfo,
  onUpdateEventInfo,
  onGoToRegistration,
}) => {
  const [pinInput, setPinInput] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const [activeTab, setActiveTab] = useState<'peserta' | 'rekap' | 'scanner' | 'kelompok'>('peserta');
  const [groupCompFilter, setGroupCompFilter] = useState<CompetitionId | 'all'>('all');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<CompetitionId | 'all'>('all');
  const [attendanceFilter, setAttendanceFilter] = useState<AttendanceFilter>('all');
  const [pendingDelete, setPendingDelete] = useState<Registration | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingRegistration, setEditingRegistration] = useState<Registration | null>(null);
  const [qrModalRegistration, setQrModalRegistration] = useState<Registration | null>(null);
  const [updatingCheckInId, setUpdatingCheckInId] = useState<string | null>(null);
  const [isPrintBibOpen, setIsPrintBibOpen] = useState(false);
  const [printBibCompFilter, setPrintBibCompFilter] = useState<CompetitionId | 'all'>('all');

  const [isEditingEvent, setIsEditingEvent] = useState(false);
  const [draftTitle, setDraftTitle] = useState(eventInfo.title);
  const [draftDate, setDraftDate] = useState(eventInfo.dateText);
  const [draftLocation, setDraftLocation] = useState(eventInfo.locationText);
  const [isSavingEvent, setIsSavingEvent] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [currentPinDraft, setCurrentPinDraft] = useState('');
  const [newPinDraft, setNewPinDraft] = useState('');
  const [pinChangeError, setPinChangeError] = useState<string | null>(null);
  const [isChangingPin, setIsChangingPin] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const backupFileInputRef = useRef<HTMLInputElement | null>(null);

  const groupedByRundown = useMemo(
    () => groupParticipantsByRundown(registrations),
    [registrations]
  );

  const bibNumbersMap = useMemo(
    () => assignBibNumbers(registrations),
    [registrations]
  );

  const bibNumbersByComp = useMemo(
    () => assignBibNumbersByCompetition(registrations),
    [registrations]
  );

  const rekapPerLomba = useMemo(() => {
    return COMPETITIONS.map((comp) => {
      const entries = registrations
        .filter((reg) => reg.competitions.includes(comp.id))
        .map((reg) => ({
          reg,
          bib: bibNumbersByComp.get(reg.id)?.[comp.id] ?? '-',
        }))
        .sort((a, b) => a.bib.localeCompare(b.bib));

      return {
        comp,
        entries,
        checkedInCount: entries.filter((e) => e.reg.checkedIn).length,
      };
    });
  }, [registrations, bibNumbersByComp]);

  const visibleGroupedCompetitions = useMemo(() => {
    if (groupCompFilter === 'all') return groupedByRundown;
    return groupedByRundown.filter((item) => item.competitionId === groupCompFilter);
  }, [groupedByRundown, groupCompFilter]);

  const checkedInCount = useMemo(
    () => registrations.filter((reg) => reg.checkedIn).length,
    [registrations]
  );

  const competitionCounts = useMemo(() => {
    const counts: Record<CompetitionId, number> = {
      'balap-karung': 0,
      'makan-kerupuk': 0,
      'paku-botol': 0,
      mewarnai: 0,
      'estafet-kelereng': 0,
      'tarik-tambang': 0,
    };
    for (const reg of registrations) {
      for (const compId of reg.competitions) {
        if (counts[compId] !== undefined) {
          counts[compId] += 1;
        }
      }
    }
    return counts;
  }, [registrations]);

  const totalEntriesAcrossCompetitions = useMemo(
    () => registrations.reduce((sum, reg) => sum + reg.competitions.length, 0),
    [registrations]
  );

  const filteredRegistrations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return registrations.filter((reg) => {
      const matchesFilter =
        selectedFilter === 'all' || reg.competitions.includes(selectedFilter);
      if (!matchesFilter) return false;

      if (attendanceFilter === 'checked-in' && !reg.checkedIn) return false;
      if (attendanceFilter === 'pending' && reg.checkedIn) return false;

      if (!q) return true;
      const bibs = bibNumbersMap.get(reg.id) ?? [];
      return (
        reg.childName.toLowerCase().includes(q) ||
        reg.parentName.toLowerCase().includes(q) ||
        reg.registrationCode.toLowerCase().includes(q) ||
        bibs.some((bib) => bib.toLowerCase().includes(q))
      );
    });
  }, [registrations, searchQuery, selectedFilter, attendanceFilter, bibNumbersMap]);

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);
    setIsVerifying(true);
    try {
      const valid = await onVerifyPin(pinInput);
      if (!valid) {
        setPinError('PIN salah. Silakan masukkan PIN panitia yang benar.');
        return;
      }
      setPinInput('');
      onUnlock();
    } catch (err) {
      setPinError(
        err instanceof Error && err.message
          ? err.message
          : 'Gagal terhubung ke server. Silakan coba lagi.'
      );
    } finally {
      setIsVerifying(false);
    }
  };

  const handleToggleCheckIn = async (reg: Registration) => {
    setUpdatingCheckInId(reg.id);
    try {
      await onCheckInRegistration(reg.id, !reg.checkedIn);
    } finally {
      setUpdatingCheckInId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      await onDeleteRegistration(pendingDelete.id);
      setPendingDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenEventEditor = () => {
    setDraftTitle(eventInfo.title);
    setDraftDate(eventInfo.dateText);
    setDraftLocation(eventInfo.locationText);
    setIsEditingEvent((prev) => !prev);
  };

  const showNotice = (msg: string) => {
    setStatusNotice(msg);
    window.setTimeout(() => setStatusNotice(null), 3500);
  };

  const handleSaveEventInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftTitle.trim() || !draftDate.trim() || !draftLocation.trim()) return;
    setIsSavingEvent(true);
    try {
      await onUpdateEventInfo({
        title: draftTitle.trim(),
        dateText: draftDate.trim(),
        locationText: draftLocation.trim(),
      });
      setIsEditingEvent(false);
      showNotice('Informasi judul, tanggal, dan lokasi acara berhasil diperbarui.');
    } finally {
      setIsSavingEvent(false);
    }
  };

  const handleExportBackupJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      eventInfo,
      registrations,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup-lomba-hut-ri82-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showNotice('File cadangan JSON berhasil diunduh.');
  };

  const handleRestoreFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setIsRestoring(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as {
        registrations?: Registration[];
        eventInfo?: EventInfo;
      };
      if (!Array.isArray(parsed?.registrations)) {
        throw new Error('Format file cadangan JSON tidak sesuai.');
      }
      const res = await onRestoreBackup({
        registrations: parsed.registrations,
        eventInfo: parsed.eventInfo,
      });
      setShowSettingsPanel(false);
      showNotice(`Berhasil memulihkan ${res.importedCount} data peserta dari cadangan.`);
    } catch (err) {
      setPinChangeError(
        err instanceof Error && err.message
          ? err.message
          : 'Gagal membaca atau memulihkan file cadangan.'
      );
    } finally {
      setIsRestoring(false);
    }
  };

  const handlePinChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinChangeError(null);
    if (!/^[a-zA-Z0-9]{4,12}$/.test(newPinDraft.trim())) {
      setPinChangeError('PIN baru harus 4–12 karakter (angka/huruf tanpa spasi).');
      return;
    }
    setIsChangingPin(true);
    try {
      await onChangePin(currentPinDraft.trim(), newPinDraft.trim());
      setCurrentPinDraft('');
      setNewPinDraft('');
      setShowSettingsPanel(false);
      showNotice('PIN panitia berhasil diperbarui.');
    } catch (err) {
      setPinChangeError(
        err instanceof Error && err.message ? err.message : 'Gagal mengubah PIN panitia.'
      );
    } finally {
      setIsChangingPin(false);
    }
  };

  // Lock screen: Server-verified PIN Authentication
  if (!isUnlocked) {
    return (
      <section className="mx-auto max-w-md px-4 py-14 sm:px-6">
        <div className="overflow-hidden rounded-2xl border border-[#E7E2DC] bg-white">
          <div className="h-1.5 w-full bg-gradient-to-r from-[#8B1520] via-[#C8102E] to-[#B58517]" />

          <div className="p-6 sm:p-8">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#8B1520]/10 text-[#8B1520]">
              <Lock className="h-5 w-5" aria-hidden="true" />
            </div>

            <h1 className="mt-4 text-xl font-bold tracking-tight text-[#1C1917]">
              Dashboard Panitia HUT RI Ke - 82
            </h1>
            <p className="mt-1.5 text-sm text-[#57534E]">
              Masukkan PIN panitia untuk mengakses data peserta secara real-time di perangkat ini
              tanpa perlu login email Google.
            </p>

            <form onSubmit={handlePinSubmit} className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="committee-pin"
                  className="mb-1.5 block text-sm font-semibold text-[#1C1917]"
                >
                  PIN Panitia
                </label>
                <div className="relative">
                  <input
                    id="committee-pin"
                    type={showPin ? 'text' : 'password'}
                    inputMode="numeric"
                    autoComplete="off"
                    value={pinInput}
                    onChange={(e) => {
                      setPinInput(e.target.value);
                      if (pinError) setPinError(null);
                    }}
                    placeholder="Masukkan PIN panitia"
                    className="min-h-[46px] w-full rounded-lg border border-[#D6D0C8] bg-white py-2.5 pl-3.5 pr-11 font-mono text-base tracking-widest text-[#1C1917] placeholder:font-sans placeholder:tracking-normal placeholder:text-[#A8A29E] focus:border-[#8B1520] focus:outline-none focus:ring-2 focus:ring-[#8B1520]/15"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin((prev) => !prev)}
                    aria-label={showPin ? 'Sembunyikan PIN' : 'Lihat PIN'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-[#78716C] hover:text-[#1C1917]"
                  >
                    {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {pinError && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-red-700">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>{pinError}</span>
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isVerifying || !pinInput.trim()}
                className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-lg bg-[#8B1520] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#6D0F18] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isVerifying ? 'Memverifikasi...' : 'Buka Dashboard Panitia'}
              </button>
            </form>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 print:m-0 print:max-w-none print:p-0">
      <div className={isPrintBibOpen ? 'print:hidden' : ''}>
      {/* Header Toolbar */}
      <div className="flex flex-col gap-4 border-b border-[#E7E2DC] pb-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-medium text-[#8B1520]">
            Portal Panitia <span aria-hidden="true">·</span> {eventInfo.dateText}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#1C1917] sm:text-3xl">
            Data Peserta &amp; Daftar Ulang
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleOpenEventEditor}
            className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#D6D0C8] bg-white px-3.5 py-2 text-xs font-medium text-[#1C1917] transition-colors hover:bg-[#FAF9F7] sm:text-sm"
          >
            <Pencil className="h-4 w-4 text-[#8B1520]" aria-hidden="true" />
            Info Acara
          </button>

          <button
            type="button"
            onClick={() => {
              setPinChangeError(null);
              setShowSettingsPanel((prev) => !prev);
            }}
            className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#D6D0C8] bg-white px-3.5 py-2 text-xs font-medium text-[#1C1917] transition-colors hover:bg-[#FAF9F7] sm:text-sm"
          >
            <Settings2 className="h-4 w-4 text-[#8B1520]" aria-hidden="true" />
            PIN &amp; Cadangan
          </button>

          <button
            type="button"
            onClick={() => {
              setPrintBibCompFilter(selectedFilter);
              setIsPrintBibOpen(true);
            }}
            disabled={registrations.length === 0}
            className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#8B1520]/35 bg-[#8B1520]/[0.06] px-3.5 py-2 text-xs font-semibold text-[#8B1520] transition-colors hover:bg-[#8B1520]/10 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
          >
            <Printer className="h-4 w-4" aria-hidden="true" />
            Cetak Nomor Dada
          </button>

          <button
            type="button"
            onClick={() => exportRegistrationsToExcel(registrations, eventInfo)}
            disabled={registrations.length === 0}
            className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#8B1520] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#6D0F18] disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export Excel (.xlsx)
          </button>

          <button
            type="button"
            onClick={() => exportRegistrationsToCsv(registrations)}
            disabled={registrations.length === 0}
            className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#D6D0C8] bg-white px-3.5 py-2 text-xs font-medium text-[#1C1917] transition-colors hover:bg-[#FAF9F7] disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
          >
            CSV
          </button>

          <button
            type="button"
            onClick={onLock}
            className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#D6D0C8] bg-white px-3 py-2 text-xs font-medium text-[#57534E] transition-colors hover:bg-[#FAF9F7] hover:text-[#1C1917] sm:text-sm"
          >
            <Unlock className="h-4 w-4" aria-hidden="true" />
            Kunci
          </button>
        </div>
      </div>

      {/* Sync Error Banner */}
      {syncError && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <p className="font-medium">{syncError}</p>
        </div>
      )}

      {/* Status Notice Banner */}
      {statusNotice && (
        <div
          role="status"
          className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-800"
        >
          <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{statusNotice}</span>
        </div>
      )}

      {/* Panel Pengaturan PIN & Backup/Restore Data */}
      {showSettingsPanel && (
        <div className="mt-6 grid grid-cols-1 gap-5 rounded-xl border border-[#8B1520]/25 bg-white p-5 sm:p-6 lg:grid-cols-2">
          <form onSubmit={handlePinChangeSubmit} className="space-y-3 border-b border-[#EFECE6] pb-5 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-6">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-[#8B1520]" aria-hidden="true" />
              <h2 className="text-sm font-bold text-[#1C1917]">Ubah PIN Panitia</h2>
            </div>
            <p className="text-xs text-[#57534E]">
              Ganti PIN default (1708) agar hanya panitia inti yang bisa mengakses daftar peserta.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="old-pin" className="mb-1 block text-xs font-semibold text-[#44403C]">
                  PIN Lama
                </label>
                <input
                  id="old-pin"
                  type="password"
                  required
                  value={currentPinDraft}
                  onChange={(e) => setCurrentPinDraft(e.target.value)}
                  placeholder="PIN saat ini"
                  className="min-h-[40px] w-full rounded-lg border border-[#D6D0C8] px-3 py-1.5 font-mono text-sm text-[#1C1917] focus:border-[#8B1520] focus:outline-none focus:ring-2 focus:ring-[#8B1520]/15"
                />
              </div>
              <div>
                <label htmlFor="new-pin" className="mb-1 block text-xs font-semibold text-[#44403C]">
                  PIN Baru (4–12 karakter)
                </label>
                <input
                  id="new-pin"
                  type="password"
                  required
                  value={newPinDraft}
                  onChange={(e) => setNewPinDraft(e.target.value)}
                  placeholder="Contoh: 4581"
                  className="min-h-[40px] w-full rounded-lg border border-[#D6D0C8] px-3 py-1.5 font-mono text-sm text-[#1C1917] focus:border-[#8B1520] focus:outline-none focus:ring-2 focus:ring-[#8B1520]/15"
                />
              </div>
            </div>
            {pinChangeError && (
              <p className="flex items-center gap-1.5 text-xs font-medium text-red-700">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{pinChangeError}</span>
              </p>
            )}
            <button
              type="submit"
              disabled={isChangingPin}
              className="min-h-[38px] rounded-lg bg-[#8B1520] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#6D0F18] disabled:opacity-60"
            >
              {isChangingPin ? 'Menyimpan...' : 'Simpan PIN Baru'}
            </button>
          </form>

          <div className="flex flex-col justify-between space-y-3">
            <div>
              <h2 className="text-sm font-bold text-[#1C1917]">Cadangkan &amp; Pulihkan Data (.json)</h2>
              <p className="mt-1 text-xs leading-relaxed text-[#57534E]">
                Simpan salinan penuh database peserta secara berkala. Jika server mengalami restart,
                panitia dapat memulihkan seluruh data dan status kehadiran dalam satu klik.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleExportBackupJson}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[#D6D0C8] bg-[#FAF9F7] px-3.5 py-2 text-xs font-semibold text-[#1C1917] hover:bg-[#F1ECE4]"
              >
                <Download className="h-3.5 w-3.5 text-[#8B1520]" aria-hidden="true" />
                Unduh Cadangan (.json)
              </button>
              <button
                type="button"
                disabled={isRestoring}
                onClick={() => backupFileInputRef.current?.click()}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[#D6D0C8] bg-white px-3.5 py-2 text-xs font-semibold text-[#1C1917] hover:bg-[#FAF9F7] disabled:opacity-60"
              >
                <Upload className="h-3.5 w-3.5 text-[#8B1520]" aria-hidden="true" />
                {isRestoring ? 'Memulihkan...' : 'Pulihkan dari File (.json)'}
              </button>
              <input
                ref={backupFileInputRef}
                type="file"
                accept="application/json,.json"
                onChange={(e) => void handleRestoreFileChange(e)}
                className="hidden"
              />
            </div>
          </div>
        </div>
      )}

      {/* Panel Edit Info Acara */}
      {isEditingEvent && (
        <form
          onSubmit={handleSaveEventInfo}
          className="mt-6 rounded-xl border border-[#8B1520]/25 bg-white p-5 sm:p-6"
        >
          <div className="flex items-center justify-between border-b border-[#EFECE6] pb-3">
            <h2 className="text-sm font-bold text-[#1C1917]">
              Pengaturan Informasi Acara (Tampil di Header Halaman Utama)
            </h2>
            <button
              type="button"
              onClick={() => setIsEditingEvent(false)}
              aria-label="Tutup pengaturan acara"
              className="rounded-md p-1 text-[#78716C] hover:bg-[#FAF9F7]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label htmlFor="dash-title" className="mb-1 block text-xs font-semibold text-[#44403C]">
                Judul Utama
              </label>
              <input
                id="dash-title"
                type="text"
                required
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                className="min-h-[42px] w-full rounded-lg border border-[#D6D0C8] px-3 py-2 text-sm text-[#1C1917] focus:border-[#8B1520] focus:outline-none focus:ring-2 focus:ring-[#8B1520]/15"
              />
            </div>

            <div>
              <label htmlFor="dash-date" className="mb-1 block text-xs font-semibold text-[#44403C]">
                Tanggal &amp; Waktu Acara
              </label>
              <input
                id="dash-date"
                type="text"
                required
                value={draftDate}
                onChange={(e) => setDraftDate(e.target.value)}
                className="min-h-[42px] w-full rounded-lg border border-[#D6D0C8] px-3 py-2 text-sm text-[#1C1917] focus:border-[#8B1520] focus:outline-none focus:ring-2 focus:ring-[#8B1520]/15"
              />
            </div>

            <div>
              <label htmlFor="dash-location" className="mb-1 block text-xs font-semibold text-[#44403C]">
                Lokasi Acara
              </label>
              <input
                id="dash-location"
                type="text"
                required
                value={draftLocation}
                onChange={(e) => setDraftLocation(e.target.value)}
                className="min-h-[42px] w-full rounded-lg border border-[#D6D0C8] px-3 py-2 text-sm text-[#1C1917] focus:border-[#8B1520] focus:outline-none focus:ring-2 focus:ring-[#8B1520]/15"
              />
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsEditingEvent(false)}
              className="rounded-lg border border-[#D6D0C8] bg-white px-4 py-2 text-xs font-medium text-[#44403C] hover:bg-[#FAF9F7]"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSavingEvent}
              className="rounded-lg bg-[#8B1520] px-4 py-2 text-xs font-semibold text-white hover:bg-[#6D0F18] disabled:opacity-60"
            >
              {isSavingEvent ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
      )}

      {/* Statistik Singkat */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Ringkasan Total Peserta & Kehadiran */}
        <div className="flex flex-col justify-between rounded-xl border border-[#E7E2DC] bg-white p-5 lg:col-span-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-[#78716C]">Total Terdaftar</p>
              <p className="mt-1.5 font-mono text-3xl font-bold tracking-tight text-[#8B1520] tabular-nums">
                {registrations.length}
              </p>
              <p className="mt-0.5 text-[11px] text-[#57534E]">Anak</p>
            </div>
            <div className="border-l border-[#EFECE6] pl-4">
              <p className="text-xs font-medium text-[#78716C]">Sudah Hadir</p>
              <p className="mt-1.5 font-mono text-3xl font-bold tracking-tight text-emerald-700 tabular-nums">
                {checkedInCount}
              </p>
              <p className="mt-0.5 text-[11px] text-[#57534E]">Daftar ulang</p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-[#EFECE6] pt-3 text-xs text-[#57534E]">
            <span>Total keikutsertaan lomba</span>
            <span className="font-mono font-semibold text-[#1C1917] tabular-nums">
              {totalEntriesAcrossCompetitions} slot
            </span>
          </div>
        </div>

        {/* Jumlah Peserta per Cabang Lomba */}
        <div className="rounded-xl border border-[#E7E2DC] bg-white p-5 lg:col-span-8">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-[#78716C]">
              Jumlah Peserta per Cabang Lomba
            </p>
            {selectedFilter !== 'all' && (
              <button
                type="button"
                onClick={() => setSelectedFilter('all')}
                className="text-xs font-semibold text-[#8B1520] hover:underline"
              >
                Tampilkan Semua
              </button>
            )}
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {COMPETITIONS.map((comp) => {
              const isActive = selectedFilter === comp.id;
              return (
                <button
                  key={comp.id}
                  type="button"
                  onClick={() => {
                    setActiveTab('peserta');
                    setSelectedFilter((prev) => (prev === comp.id ? 'all' : comp.id));
                  }}
                  className={`flex items-center justify-between gap-2 rounded-lg border px-3.5 py-2.5 text-left transition-colors ${
                    isActive
                      ? 'border-[#8B1520] bg-[#8B1520]/[0.05]'
                      : 'border-[#EFECE6] bg-[#FAF9F7] hover:border-[#D6CEC4]'
                  }`}
                >
                  <span className="truncate text-xs font-medium text-[#1C1917]">
                    {comp.name}
                  </span>
                  <span className="shrink-0 font-mono text-sm font-bold text-[#8B1520] tabular-nums">
                    {competitionCounts[comp.id]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tab Switcher: Semua Peserta | Rekap per Lomba | Scan Daftar Ulang | Kelompok Umur & Rundown */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div
          role="tablist"
          aria-label="Tampilan dashboard panitia"
          className="inline-flex flex-wrap rounded-xl border border-[#E7E2DC] bg-white p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'peserta'}
            onClick={() => setActiveTab('peserta')}
            className={`shrink-0 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors sm:text-sm ${
              activeTab === 'peserta'
                ? 'bg-[#8B1520] text-white'
                : 'text-[#57534E] hover:bg-[#FAF9F7] hover:text-[#1C1917]'
            }`}
          >
            Semua Peserta ({registrations.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'rekap'}
            onClick={() => setActiveTab('rekap')}
            className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors sm:text-sm ${
              activeTab === 'rekap'
                ? 'bg-[#8B1520] text-white'
                : 'text-[#57534E] hover:bg-[#FAF9F7] hover:text-[#1C1917]'
            }`}
          >
            <ClipboardList className="h-4 w-4" aria-hidden="true" />
            Rekap per Lomba
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'scanner'}
            onClick={() => setActiveTab('scanner')}
            className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors sm:text-sm ${
              activeTab === 'scanner'
                ? 'bg-[#8B1520] text-white'
                : 'text-[#57534E] hover:bg-[#FAF9F7] hover:text-[#1C1917]'
            }`}
          >
            <QrCode className="h-4 w-4" aria-hidden="true" />
            Scan Daftar Ulang
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'kelompok'}
            onClick={() => setActiveTab('kelompok')}
            className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors sm:text-sm ${
              activeTab === 'kelompok'
                ? 'bg-[#8B1520] text-white'
                : 'text-[#57534E] hover:bg-[#FAF9F7] hover:text-[#1C1917]'
            }`}
          >
            <Users className="h-4 w-4" aria-hidden="true" />
            Kelompok Umur &amp; Rundown
          </button>
        </div>

        {activeTab === 'kelompok' && (
          <div className="flex items-center gap-2.5">
            <label htmlFor="filter-kelompok-lomba" className="shrink-0 text-xs font-medium text-[#57534E]">
              Cabang Lomba:
            </label>
            <select
              id="filter-kelompok-lomba"
              value={groupCompFilter}
              onChange={(e) => setGroupCompFilter(e.target.value as CompetitionId | 'all')}
              className="min-h-[40px] rounded-lg border border-[#D6D0C8] bg-white px-3 py-1.5 text-xs font-medium text-[#1C1917] focus:border-[#8B1520] focus:outline-none focus:ring-2 focus:ring-[#8B1520]/15 sm:text-sm"
            >
              <option value="all">Semua Cabang (Urut Rundown)</option>
              {groupedByRundown.map((g) => (
                <option key={g.competitionId} value={g.competitionId}>
                  {g.time.replace(' WIB', '')} · {g.competitionName} ({g.totalParticipants})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {activeTab === 'scanner' ? (
        <QrScannerPanel
          registrations={registrations}
          onCheckIn={onCheckInRegistration}
          isOnline={isOnline}
        />
      ) : activeTab === 'rekap' ? (
        <div className="mt-5 overflow-hidden rounded-xl border border-[#E7E2DC] bg-white">
          <div className="flex flex-col gap-1 border-b border-[#E7E2DC] bg-[#FAF9F7] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-bold text-[#1C1917]">
                Rekap Peserta &amp; Nomor Dada per Cabang Lomba
              </h2>
              <p className="mt-0.5 text-xs text-[#57534E]">
                Nomor dada dibuat otomatis sesuai cabang lomba, kelompok umur, dan urutan pendaftaran.
              </p>
            </div>
            <div className="font-mono text-xs font-semibold text-[#1C1917] tabular-nums">
              Total:{' '}
              <span className="text-[#8B1520]">{totalEntriesAcrossCompetitions} slot</span> ·{' '}
              {registrations.length} anak unik
            </div>
          </div>

          {/* Desktop Rekap Table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[#E7E2DC] bg-[#FAF9F7] text-xs font-semibold text-[#57534E]">
                  <th className="w-12 px-4 py-3 text-center">No</th>
                  <th className="px-4 py-3">Cabang Lomba</th>
                  <th className="whitespace-nowrap px-4 py-3">Kelompok Usia</th>
                  <th className="whitespace-nowrap px-4 py-3 text-center">Jumlah</th>
                  <th className="whitespace-nowrap px-4 py-3 text-center">Hadir</th>
                  <th className="px-4 py-3">Daftar Nomor Dada &amp; Peserta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFECE6]">
                {rekapPerLomba.map(({ comp, entries, checkedInCount: compCheckedIn }, idx) => (
                  <tr key={comp.id} className="align-top transition-colors hover:bg-[#FAF9F7]/60">
                    <td className="px-4 py-3.5 text-center font-mono text-xs text-[#78716C] tabular-nums">
                      {idx + 1}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFilter(comp.id);
                          setActiveTab('peserta');
                        }}
                        className="text-left font-bold text-[#1C1917] hover:text-[#8B1520] hover:underline"
                        title="Lihat di tabel Semua Peserta"
                      >
                        {comp.name}
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-xs text-[#57534E]">
                      {comp.ageHint}
                    </td>
                    <td className="px-4 py-3.5 text-center font-mono text-sm font-bold text-[#8B1520] tabular-nums">
                      {entries.length}
                    </td>
                    <td className="px-4 py-3.5 text-center font-mono text-xs font-semibold text-emerald-700 tabular-nums">
                      {compCheckedIn}
                    </td>
                    <td className="px-4 py-3.5">
                      {entries.length === 0 ? (
                        <span className="text-xs italic text-[#78716C]">Belum ada peserta</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {entries.map(({ reg, bib }) => (
                            <span
                              key={`${comp.id}-${reg.id}`}
                              className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${
                                reg.checkedIn
                                  ? 'border-emerald-200 bg-emerald-50/70 text-[#1C1917]'
                                  : 'border-[#E7E2DC] bg-[#FAF9F7] text-[#1C1917]'
                              }`}
                            >
                              <span className="font-mono font-bold text-[#8B1520] tabular-nums">
                                {bib}
                              </span>
                              <span className="font-medium">{reg.childName}</span>
                              <span className="text-[#78716C]">({reg.age} thn)</span>
                              {reg.checkedIn && (
                                <CheckCircle2
                                  className="h-3.5 w-3.5 shrink-0 text-emerald-700"
                                  aria-label="Sudah hadir"
                                />
                              )}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Rekap Cards */}
          <div className="divide-y divide-[#EFECE6] md:hidden">
            {rekapPerLomba.map(({ comp, entries, checkedInCount: compCheckedIn }, idx) => (
              <div key={comp.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-[11px] font-semibold text-[#78716C]">
                      #{idx + 1} · {comp.ageHint}
                    </p>
                    <h3 className="mt-0.5 text-sm font-bold text-[#1C1917]">{comp.name}</h3>
                  </div>
                  <div className="text-right font-mono text-xs tabular-nums">
                    <span className="font-bold text-[#8B1520]">{entries.length} peserta</span>
                    <p className="text-[11px] text-emerald-700">{compCheckedIn} hadir</p>
                  </div>
                </div>

                {entries.length === 0 ? (
                  <p className="mt-2 text-xs italic text-[#78716C]">Belum ada peserta</p>
                ) : (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {entries.map(({ reg, bib }) => (
                      <span
                        key={`${comp.id}-${reg.id}`}
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs ${
                          reg.checkedIn
                            ? 'border-emerald-200 bg-emerald-50/70 text-[#1C1917]'
                            : 'border-[#E7E2DC] bg-[#FAF9F7] text-[#1C1917]'
                        }`}
                      >
                        <span className="font-mono font-bold text-[#8B1520] tabular-nums">
                          {bib}
                        </span>
                        <span className="font-medium">{reg.childName}</span>
                        <span className="text-[#78716C]">({reg.age})</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : activeTab === 'kelompok' ? (
        <div className="mt-5 space-y-6">
          {visibleGroupedCompetitions.map((comp) => (
            <div
              key={comp.competitionId}
              className="overflow-hidden rounded-xl border border-[#E7E2DC] bg-white"
            >
              <div className="flex flex-col gap-2 border-b border-[#E7E2DC] bg-[#FAF9F7] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-[#8B1520]">
                    <span className="inline-flex items-center gap-1 font-mono font-semibold tabular-nums">
                      <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                      {comp.time}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1 text-[#57534E]">
                      <MapPin className="h-3.5 w-3.5 text-[#B58517]" aria-hidden="true" />
                      {comp.location}
                    </span>
                  </div>
                  <h2 className="mt-1 text-base font-bold text-[#1C1917] sm:text-lg">
                    {comp.competitionName}
                  </h2>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-[#1C1917] tabular-nums">
                  <span>
                    Total:{' '}
                    <span className="font-mono text-sm text-[#8B1520]">
                      {comp.totalParticipants} anak
                    </span>
                  </span>
                  {comp.totalParticipants > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setPrintBibCompFilter(comp.competitionId);
                        setIsPrintBibOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#D6D0C8] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#1C1917] transition-colors hover:bg-[#FAF9F7]"
                    >
                      <Printer className="h-3.5 w-3.5 text-[#8B1520]" aria-hidden="true" />
                      Cetak Lomba Ini
                    </button>
                  )}
                </div>
              </div>

              <div className="divide-y divide-[#EFECE6]">
                {comp.sessions.map((session) => (
                  <div key={session.id} className="p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3
                        className={`text-sm font-bold ${
                          session.isAdjustmentGroup ? 'text-amber-800' : 'text-[#1C1917]'
                        }`}
                      >
                        {session.label}
                      </h3>
                      <span className="font-mono text-xs font-semibold text-[#57534E] tabular-nums">
                        {session.participants.length} peserta ·{' '}
                        {session.participants.filter((p) => p.checkedIn).length} hadir
                      </span>
                    </div>

                    {session.participants.length === 0 ? (
                      <p className="mt-2 text-xs text-[#78716C]">
                        Belum ada anak yang terdaftar pada kelompok umur ini.
                      </p>
                    ) : (
                      <div className="mt-3 overflow-x-auto rounded-lg border border-[#EFECE6]">
                        <table className="w-full border-collapse text-left text-xs sm:text-sm">
                          <thead>
                            <tr className="border-b border-[#EFECE6] bg-[#FAF9F7] text-xs font-semibold text-[#57534E]">
                              <th className="w-10 px-3 py-2 text-center">No</th>
                              <th className="px-3 py-2">Nomor Dada</th>
                              <th className="px-3 py-2">Kode</th>
                              <th className="px-3 py-2">Nama Anak</th>
                              <th className="px-3 py-2 text-right">Umur</th>
                              <th className="px-3 py-2">Orang Tua / Wali</th>
                              <th className="px-3 py-2">Kehadiran</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#EFECE6]">
                            {session.participants.map((child, idx) => {
                              const sessionBib =
                                bibNumbersByComp.get(child.id)?.[comp.competitionId] ?? '-';
                              return (
                                <tr key={child.id} className="hover:bg-[#FAF9F7]/60">
                                  <td className="px-3 py-2 text-center font-mono text-xs text-[#78716C] tabular-nums">
                                    {idx + 1}
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-2">
                                    <span className="inline-block rounded border border-[#E7E2DC] bg-[#FAF9F7] px-2 py-0.5 font-mono text-xs font-bold text-[#1C1917] tabular-nums">
                                      {sessionBib}
                                    </span>
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs font-semibold text-[#8B1520] tabular-nums">
                                    {child.registrationCode}
                                  </td>
                                  <td className="px-3 py-2 font-semibold text-[#1C1917]">
                                    {child.childName}
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-xs text-[#1C1917] tabular-nums">
                                    {child.age} thn
                                  </td>
                                  <td className="px-3 py-2 text-[#44403C]">{child.parentName}</td>
                                  <td className="whitespace-nowrap px-3 py-2 text-xs">
                                    {child.checkedIn ? (
                                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                                        Hadir
                                      </span>
                                    ) : (
                                      <span className="text-[#78716C]">Belum</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Filter & Pencarian */}
          <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1 lg:max-w-md">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#78716C]"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama anak, orang tua, kode, atau nomor dada..."
                aria-label="Cari nama peserta atau nomor dada"
                className="min-h-[42px] w-full rounded-lg border border-[#D6D0C8] bg-white py-2 pl-10 pr-3.5 text-sm text-[#1C1917] placeholder:text-[#A8A29E] focus:border-[#8B1520] focus:outline-none focus:ring-2 focus:ring-[#8B1520]/15"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <select
                aria-label="Filter status kehadiran"
                value={attendanceFilter}
                onChange={(e) => setAttendanceFilter(e.target.value as AttendanceFilter)}
                className="min-h-[42px] rounded-lg border border-[#D6D0C8] bg-white px-3 py-2 text-sm text-[#1C1917] focus:border-[#8B1520] focus:outline-none focus:ring-2 focus:ring-[#8B1520]/15"
              >
                <option value="all">Semua Kehadiran ({registrations.length})</option>
                <option value="checked-in">Sudah Hadir ({checkedInCount})</option>
                <option value="pending">
                  Belum Hadir ({registrations.length - checkedInCount})
                </option>
              </select>

              <select
                aria-label="Filter cabang lomba"
                value={selectedFilter}
                onChange={(e) => setSelectedFilter(e.target.value as CompetitionId | 'all')}
                className="min-h-[42px] rounded-lg border border-[#D6D0C8] bg-white px-3 py-2 text-sm text-[#1C1917] focus:border-[#8B1520] focus:outline-none focus:ring-2 focus:ring-[#8B1520]/15"
              >
                <option value="all">Semua Cabang Lomba ({registrations.length})</option>
                {COMPETITIONS.map((comp) => (
                  <option key={comp.id} value={comp.id}>
                    {comp.name} ({competitionCounts[comp.id]})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tabel Data Peserta */}
          <div className="mt-4 overflow-hidden rounded-xl border border-[#E7E2DC] bg-white">
            {registrations.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <p className="text-base font-semibold text-[#1C1917]">
                  Belum ada peserta yang terdaftar
                </p>
                <p className="mt-1 text-sm text-[#57534E]">
                  Data peserta yang mendaftar melalui formulir akan langsung tersinkronisasi di sini.
                </p>
                <button
                  type="button"
                  onClick={onGoToRegistration}
                  className="mt-5 rounded-lg bg-[#8B1520] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#6D0F18]"
                >
                  Buka Form Pendaftaran
                </button>
              </div>
            ) : filteredRegistrations.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <p className="text-base font-semibold text-[#1C1917]">
                  Tidak ada peserta yang cocok
                </p>
                <p className="mt-1 text-sm text-[#57534E]">
                  Ubah kata kunci pencarian atau pilih filter lain.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedFilter('all');
                    setAttendanceFilter('all');
                  }}
                  className="mt-4 rounded-lg border border-[#D6D0C8] bg-white px-4 py-2 text-xs font-medium text-[#1C1917] hover:bg-[#FAF9F7]"
                >
                  Reset Pencarian &amp; Filter
                </button>
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-[#E7E2DC] bg-[#FAF9F7] text-xs font-semibold text-[#57534E]">
                        <th className="px-4 py-3 text-center">No</th>
                        <th className="px-4 py-3">Kode</th>
                        <th className="px-4 py-3">Nomor Dada</th>
                        <th className="px-4 py-3">Nama Anak</th>
                        <th className="px-4 py-3">Nama Orang Tua</th>
                        <th className="px-4 py-3 text-right">Umur</th>
                        <th className="px-4 py-3">No WA</th>
                        <th className="px-4 py-3">Lomba yang Diikuti</th>
                        <th className="px-4 py-3">Kehadiran</th>
                        <th className="px-4 py-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EFECE6]">
                      {filteredRegistrations.map((reg, idx) => {
                        const perCompBibs = bibNumbersByComp.get(reg.id) ?? {};
                        return (
                          <tr
                            key={reg.id}
                            className="transition-colors hover:bg-[#FAF9F7]/70"
                          >
                            <td className="px-4 py-3.5 text-center font-mono text-xs text-[#78716C] tabular-nums">
                              {idx + 1}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3.5 font-mono text-xs font-semibold text-[#8B1520] tabular-nums">
                              {reg.registrationCode}
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="flex flex-wrap gap-1">
                                {reg.competitions.map((compId) => {
                                  const bib = perCompBibs[compId];
                                  if (!bib) return null;
                                  return (
                                    <span
                                      key={compId}
                                      title={COMPETITION_MAP[compId]?.name ?? compId}
                                      className="inline-block whitespace-nowrap rounded border border-[#E7E2DC] bg-[#FAF9F7] px-2 py-0.5 font-mono text-[11px] font-bold text-[#1C1917] tabular-nums"
                                    >
                                      {bib}
                                    </span>
                                  );
                                })}
                              </div>
                            </td>
                            <td className="px-4 py-3.5 font-semibold text-[#1C1917]">
                              {reg.childName}
                            </td>
                            <td className="px-4 py-3.5 text-[#44403C]">{reg.parentName}</td>
                            <td className="whitespace-nowrap px-4 py-3.5 text-right font-mono text-xs text-[#1C1917] tabular-nums">
                              {reg.age} thn
                            </td>
                            <td className="whitespace-nowrap px-4 py-3.5 font-mono text-xs text-[#44403C] tabular-nums">
                              {reg.whatsapp || '-'}
                            </td>
                            <td className="max-w-xs px-4 py-3.5 text-xs leading-relaxed text-[#44403C]">
                              {reg.competitions
                                .map((id) => COMPETITION_MAP[id]?.name ?? id)
                                .join(' · ')}
                            </td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-xs">
                            <button
                              type="button"
                              disabled={updatingCheckInId === reg.id}
                              onClick={() => void handleToggleCheckIn(reg)}
                              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 font-semibold transition-colors ${
                                reg.checkedIn
                                  ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                  : 'bg-[#FAF9F7] text-[#57534E] hover:bg-[#EFECE6]'
                              }`}
                              title={
                                reg.checkedIn
                                  ? 'Klik untuk batalkan kehadiran'
                                  : 'Klik untuk tandai hadir'
                              }
                            >
                              {reg.checkedIn ? (
                                <>
                                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                                  Hadir
                                </>
                              ) : (
                                'Tandai Hadir'
                              )}
                            </button>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-right">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setQrModalRegistration(reg)}
                                aria-label={`Lihat QR ${reg.childName}`}
                                className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-[#1C1917] transition-colors hover:bg-[#FAF9F7]"
                              >
                                <QrCode className="h-3.5 w-3.5 text-[#8B1520]" aria-hidden="true" />
                                QR
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingRegistration(reg)}
                                aria-label={`Edit data ${reg.childName}`}
                                className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-[#1C1917] transition-colors hover:bg-[#FAF9F7]"
                              >
                                <Pencil className="h-3.5 w-3.5 text-[#57534E]" aria-hidden="true" />
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => setPendingDelete(reg)}
                                aria-label={`Hapus data ${reg.childName}`}
                                className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                Hapus
                              </button>
                            </div>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card List */}
                <div className="divide-y divide-[#EFECE6] md:hidden">
                  {filteredRegistrations.map((reg, idx) => (
                    <div key={reg.id} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-mono text-xs font-semibold text-[#8B1520] tabular-nums">
                            #{idx + 1} · {reg.registrationCode}
                          </p>
                          <h3 className="mt-0.5 text-base font-bold text-[#1C1917]">
                            {reg.childName}
                          </h3>
                          <p className="text-xs text-[#57534E]">
                            Ortu: {reg.parentName} · Umur {reg.age} thn
                          </p>
                        </div>

                        <button
                          type="button"
                          disabled={updatingCheckInId === reg.id}
                          onClick={() => void handleToggleCheckIn(reg)}
                          className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                            reg.checkedIn
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'border border-[#D6D0C8] bg-white text-[#44403C]'
                          }`}
                        >
                          {reg.checkedIn ? (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                              Hadir
                            </>
                          ) : (
                            'Tandai Hadir'
                          )}
                        </button>
                      </div>

                      <div className="mt-3 space-y-1.5 text-xs text-[#44403C]">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[#78716C]">Nomor Dada:</span>
                          {reg.competitions.map((compId) => {
                            const bib = bibNumbersByComp.get(reg.id)?.[compId];
                            if (!bib) return null;
                            return (
                              <span
                                key={compId}
                                className="inline-block rounded border border-[#E7E2DC] bg-[#FAF9F7] px-2 py-0.5 font-mono text-[11px] font-bold text-[#1C1917] tabular-nums"
                              >
                                {bib}
                              </span>
                            );
                          })}
                        </div>
                        <p>
                          <span className="text-[#78716C]">No WA:</span>{' '}
                          <span className="font-mono">{reg.whatsapp || '-'}</span>
                        </p>
                        <p>
                          <span className="text-[#78716C]">Lomba:</span>{' '}
                          <span className="font-medium text-[#1C1917]">
                            {reg.competitions
                              .map((id) => COMPETITION_MAP[id]?.name ?? id)
                              .join(' · ')}
                          </span>
                        </p>
                        <p className="font-mono text-[11px] text-[#78716C] tabular-nums">
                          Daftar: {formatDateTimeId(reg.createdAt)}
                        </p>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setQrModalRegistration(reg)}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#D6D0C8] bg-white px-3 py-1.5 text-xs font-medium text-[#1C1917]"
                        >
                          <QrCode className="h-3.5 w-3.5 text-[#8B1520]" aria-hidden="true" />
                          Lihat QR
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingRegistration(reg)}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#D6D0C8] bg-white px-3 py-1.5 text-xs font-medium text-[#1C1917]"
                        >
                          <Pencil className="h-3.5 w-3.5 text-[#57534E]" aria-hidden="true" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDelete(reg)}
                          className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700"
                        >
                          Hapus
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* Modal Lihat & Unduh Tiket QR Peserta */}
      {qrModalRegistration && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="qr-modal-title"
        >
          <div className="relative w-full max-w-sm rounded-2xl border border-[#E7E2DC] bg-white p-6 shadow-xl">
            <button
              type="button"
              onClick={() => setQrModalRegistration(null)}
              aria-label="Tutup tiket QR"
              className="absolute right-3.5 top-3.5 rounded-lg p-2 text-[#78716C] hover:bg-[#FAF9F7] hover:text-[#1C1917]"
            >
              <X className="h-4 w-4" />
            </button>

            <h3 id="qr-modal-title" className="pr-8 text-base font-bold text-[#1C1917]">
              Tiket QR — {qrModalRegistration.childName}
            </h3>
            <p className="mt-0.5 text-xs text-[#57534E]">
              Orang Tua: {qrModalRegistration.parentName} · {qrModalRegistration.age} Tahun
            </p>

            <div className="mt-4">
              <QrTicketCard registration={qrModalRegistration} eventInfo={eventInfo} />
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus */}
      {pendingDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-[#E7E2DC] bg-white p-6 shadow-xl">
            <h3 id="delete-modal-title" className="text-lg font-bold text-[#1C1917]">
              Hapus Data Peserta?
            </h3>
            <p className="mt-2 text-sm text-[#57534E]">
              Anda akan menghapus data pendaftaran{' '}
              <span className="font-semibold text-[#1C1917]">{pendingDelete.childName}</span> (Kode:{' '}
              <span className="font-mono font-semibold">{pendingDelete.registrationCode}</span>).
              Tindakan ini tidak dapat dibatalkan.
            </p>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                disabled={isDeleting}
                className="min-h-[40px] rounded-lg border border-[#D6D0C8] bg-white px-4 py-2 text-sm font-medium text-[#1C1917] hover:bg-[#FAF9F7]"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="min-h-[40px] rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60"
              >
                {isDeleting ? 'Menghapus...' : 'Ya, Hapus Data'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal Edit Data Peserta */}
      <EditRegistrationModal
        registration={editingRegistration}
        onClose={() => setEditingRegistration(null)}
        onSave={async (id, input) => {
          await onUpdateRegistration(id, input);
          showNotice('Data peserta berhasil diperbarui.');
        }}
      />
      </div>

      {/* Modal Cetak & Unduh Lembar A4 Nomor Dada */}
      <PrintBibModal
        isOpen={isPrintBibOpen}
        registrations={registrations}
        eventInfo={eventInfo}
        initialCompetitionFilter={printBibCompFilter}
        onClose={() => setIsPrintBibOpen(false)}
      />
    </section>
  );
};
