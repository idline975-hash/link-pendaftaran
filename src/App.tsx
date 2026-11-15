import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { CommitteeDashboard } from './components/CommitteeDashboard';
import { FaqSection } from './components/FaqSection';
import { HeroSection } from './components/HeroSection';
import { Navbar, ActivePage } from './components/Navbar';
import { RegistrationForm } from './components/RegistrationForm';
import { RundownSection } from './components/RundownSection';
import { SuccessModal } from './components/SuccessModal';
import { TicketLookupModal } from './components/TicketLookupModal';
import {
  registrationRepository,
  TicketLookupQuery,
  UnauthorizedCommitteeError,
} from './services/registrationRepository';
import {
  CompetitionId,
  CreateRegistrationInput,
  EventInfo,
  Registration,
} from './types/registration';

export default function App() {
  const [activePage, setActivePage] = useState<ActivePage>('home');
  const [registrations, setRegistrations] = useState<Registration[]>(() =>
    registrationRepository.hasCommitteeSession()
      ? registrationRepository.getCachedRegistrations()
      : []
  );
  const [eventInfo, setEventInfo] = useState<EventInfo>(() =>
    registrationRepository.getCachedEventInfo()
  );
  const [selectedCompetitions, setSelectedCompetitions] = useState<CompetitionId[]>([]);
  const [lastSubmitted, setLastSubmitted] = useState<Registration | null>(null);
  const [isTicketLookupOpen, setIsTicketLookupOpen] = useState(false);

  const [isCommitteeUnlocked, setIsCommitteeUnlocked] = useState(() =>
    registrationRepository.hasCommitteeSession()
  );
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const unsubscribeEventInfo = registrationRepository.subscribeEventInfo((info) => {
      setEventInfo(info);
    });

    return () => {
      unsubscribeEventInfo();
    };
  }, []);

  // Sinkronisasi daftar peserta real-time (SSE + polling cadangan) ketika Portal Panitia terbuka
  useEffect(() => {
    if (!isCommitteeUnlocked) {
      setRegistrations([]);
      setSyncError(null);
      return;
    }

    setSyncError(null);
    const unsubscribeRegs = registrationRepository.subscribeRegistrations(
      (items) => {
        setRegistrations(items);
        setSyncError(null);
      },
      (err) => {
        if (err instanceof UnauthorizedCommitteeError) {
          setIsCommitteeUnlocked(false);
          setRegistrations([]);
          setSyncError(null);
          return;
        }
        setSyncError('Terjadi kendala saat menyinkronkan data dengan server.');
      }
    );

    return () => {
      unsubscribeRegs();
    };
  }, [isCommitteeUnlocked]);

  const navigateTo = (page: ActivePage, scrollToId?: string) => {
    setActivePage(page);
    if (scrollToId) {
      setTimeout(() => {
        const el = document.getElementById(scrollToId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 60);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleLockCommittee = () => {
    registrationRepository.clearCommitteeSession();
    setIsCommitteeUnlocked(false);
    setRegistrations([]);
    setSyncError(null);
  };

  const handleToggleCompetition = (id: CompetitionId) => {
    setSelectedCompetitions((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSubmitRegistration = async (input: CreateRegistrationInput) => {
    const created = await registrationRepository.createRegistration(input);
    setLastSubmitted(created);
  };

  const handleUpdateRegistration = async (id: string, input: CreateRegistrationInput) => {
    await registrationRepository.updateRegistration(id, input);
  };

  const handleCheckInRegistration = async (id: string, checkedIn: boolean) => {
    await registrationRepository.checkInRegistration(id, checkedIn);
  };

  const handleDeleteRegistration = async (id: string) => {
    await registrationRepository.deleteRegistration(id);
  };

  const handleRestoreBackup = async (payload: {
    registrations: Registration[];
    eventInfo?: EventInfo;
  }) => {
    const result = await registrationRepository.restoreBackup(payload);
    if (payload.eventInfo) {
      const latestInfo = await registrationRepository.getEventInfo().catch(() => eventInfo);
      setEventInfo(latestInfo);
    }
    return result;
  };

  const handleUpdateEventInfo = async (updated: EventInfo) => {
    const saved = await registrationRepository.updateEventInfo(updated);
    setEventInfo(saved);
  };

  const handleVerifyPin = async (pin: string) => {
    return registrationRepository.verifyPin(pin);
  };

  const handleChangePin = async (currentPin: string, newPin: string) => {
    return registrationRepository.changePin(currentPin, newPin);
  };

  const handleLookupTickets = async (query: TicketLookupQuery) => {
    return registrationRepository.lookupTickets(query);
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#FAF9F7] text-[#1C1917]">
      <Navbar
        activePage={activePage}
        onSelectPage={navigateTo}
        isCommitteeUnlocked={isCommitteeUnlocked}
      />

      <main className="flex-1">
        {activePage === 'home' ? (
          <>
            <HeroSection eventInfo={eventInfo} />

            <RegistrationForm
              selectedCompetitions={selectedCompetitions}
              onToggleCompetition={handleToggleCompetition}
              onResetCompetitions={() => setSelectedCompetitions([])}
              onSubmitRegistration={handleSubmitRegistration}
              onOpenTicketLookup={() => setIsTicketLookupOpen(true)}
            />
          </>
        ) : activePage === 'rundown' ? (
          <div className="pt-6 sm:pt-8">
            <div className="mx-auto mb-4 max-w-4xl px-4 sm:px-6 lg:px-8">
              <button
                type="button"
                onClick={() => navigateTo('home')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#57534E] transition-colors hover:text-[#8B1520] sm:text-sm"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Kembali ke Halaman Utama
              </button>
            </div>
            <RundownSection
              eventInfo={eventInfo}
              onScrollToForm={() => navigateTo('home', 'form-pendaftaran')}
            />
          </div>
        ) : activePage === 'faq' ? (
          <div className="pt-6 sm:pt-8">
            <div className="mx-auto mb-4 max-w-4xl px-4 sm:px-6 lg:px-8">
              <button
                type="button"
                onClick={() => navigateTo('home')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#57534E] transition-colors hover:text-[#8B1520] sm:text-sm"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Kembali ke Halaman Utama
              </button>
            </div>
            <FaqSection
              eventInfo={eventInfo}
              onScrollToForm={() => navigateTo('home', 'form-pendaftaran')}
            />
          </div>
        ) : (
          <CommitteeDashboard
            isUnlocked={isCommitteeUnlocked}
            syncError={syncError}
            isOnline={isOnline}
            onVerifyPin={handleVerifyPin}
            onChangePin={handleChangePin}
            onUnlock={() => setIsCommitteeUnlocked(true)}
            onLock={handleLockCommittee}
            registrations={registrations}
            onUpdateRegistration={handleUpdateRegistration}
            onCheckInRegistration={handleCheckInRegistration}
            onDeleteRegistration={handleDeleteRegistration}
            onRestoreBackup={handleRestoreBackup}
            eventInfo={eventInfo}
            onUpdateEventInfo={handleUpdateEventInfo}
            onGoToRegistration={() => navigateTo('home', 'form-pendaftaran')}
          />
        )}
      </main>

      <footer className="border-t border-[#E7E2DC] bg-white print:hidden">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-3 px-4 py-6 text-xs text-[#78716C] sm:flex-row sm:items-center sm:px-6 lg:px-8">
          <p>
            Panitia Pelaksana HUT Kemerdekaan RI Ke - 82 <span aria-hidden="true">·</span>{' '}
            {eventInfo.locationText}
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => navigateTo('home', 'form-pendaftaran')}
              className="hover:text-[#1C1917]"
            >
              Formulir Pendaftaran
            </button>
            <button
              type="button"
              onClick={() => setIsTicketLookupOpen(true)}
              className="hover:text-[#1C1917]"
            >
              Cek Tiket QR
            </button>
            <button
              type="button"
              onClick={() => navigateTo('rundown')}
              className="hover:text-[#1C1917]"
            >
              Jadwal Acara
            </button>
            <button
              type="button"
              onClick={() => navigateTo('faq')}
              className="hover:text-[#1C1917]"
            >
              Tanya Jawab
            </button>
            <button
              type="button"
              onClick={() => navigateTo('dashboard')}
              className="hover:text-[#1C1917]"
            >
              Dashboard Panitia
            </button>
          </div>
        </div>
      </footer>

      <SuccessModal
        registration={lastSubmitted}
        eventInfo={eventInfo}
        onClose={() => setLastSubmitted(null)}
        onRegisterAnother={() => {
          setLastSubmitted(null);
          navigateTo('home', 'form-pendaftaran');
          setTimeout(() => {
            document.getElementById('childName')?.focus();
          }, 150);
        }}
      />

      <TicketLookupModal
        isOpen={isTicketLookupOpen}
        eventInfo={eventInfo}
        onClose={() => setIsTicketLookupOpen(false)}
        onLookup={handleLookupTickets}
      />
    </div>
  );
}
