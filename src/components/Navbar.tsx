import React, { useEffect, useRef, useState } from 'react';
import { Menu, X } from 'lucide-react';

export type ActivePage = 'home' | 'rundown' | 'faq' | 'dashboard';

interface NavbarProps {
  activePage: ActivePage;
  onSelectPage: (page: ActivePage, scrollToId?: string) => void;
  isCommitteeUnlocked: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activePage,
  onSelectPage,
  isCommitteeUnlocked,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!isMenuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  const handleNavigate = (page: ActivePage, scrollToId?: string) => {
    setIsMenuOpen(false);
    onSelectPage(page, scrollToId);
  };

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-30 border-b border-[#E7E2DC] bg-white/95 backdrop-blur-sm print:hidden"
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* Brand wordmark */}
        <button
          type="button"
          onClick={() => handleNavigate('home')}
          className="shrink-0 whitespace-nowrap text-left text-lg font-bold tracking-tight text-[#8B1520] transition-colors hover:text-[#6D0F18] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#8B1520]"
        >
          HUT RI Ke - 82
        </button>

        {/* Single menu toggle button; navigation buttons stay hidden until clicked */}
        <button
          type="button"
          onClick={() => setIsMenuOpen((prev) => !prev)}
          aria-expanded={isMenuOpen}
          aria-controls="top-navigation-menu"
          aria-label={isMenuOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
          className="inline-flex min-h-[40px] shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border border-[#D6D0C8] bg-white px-3.5 py-2 text-xs font-semibold text-[#1C1917] transition-colors hover:bg-[#FAF9F7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8B1520] sm:text-sm"
        >
          {isMenuOpen ? (
            <X className="h-4 w-4 text-[#8B1520]" aria-hidden="true" />
          ) : (
            <Menu className="h-4 w-4 text-[#8B1520]" aria-hidden="true" />
          )}
          <span>Menu</span>
        </button>
      </div>

      {/* Collapsible navigation panel - only visible when clicked */}
      {isMenuOpen && (
        <nav
          id="top-navigation-menu"
          aria-label="Menu navigasi utama"
          className="border-t border-[#EFECE6] bg-white shadow-lg"
        >
          <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-end sm:gap-2 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={() => handleNavigate('home', 'form-pendaftaran')}
              className={`min-h-[42px] shrink-0 whitespace-nowrap rounded-lg px-4 py-2 text-left text-sm font-medium transition-colors sm:text-center ${
                activePage === 'home'
                  ? 'bg-[#8B1520]/[0.07] font-semibold text-[#8B1520]'
                  : 'text-[#44403C] hover:bg-[#FAF9F7] hover:text-[#1C1917]'
              }`}
            >
              Formulir Pendaftaran
            </button>

            <button
              type="button"
              onClick={() => handleNavigate('rundown')}
              className={`min-h-[42px] shrink-0 whitespace-nowrap rounded-lg px-4 py-2 text-left text-sm font-medium transition-colors sm:text-center ${
                activePage === 'rundown'
                  ? 'bg-[#8B1520]/[0.07] font-semibold text-[#8B1520]'
                  : 'text-[#44403C] hover:bg-[#FAF9F7] hover:text-[#1C1917]'
              }`}
            >
              Jadwal Acara
            </button>

            <button
              type="button"
              onClick={() => handleNavigate('faq')}
              className={`min-h-[42px] shrink-0 whitespace-nowrap rounded-lg px-4 py-2 text-left text-sm font-medium transition-colors sm:text-center ${
                activePage === 'faq'
                  ? 'bg-[#8B1520]/[0.07] font-semibold text-[#8B1520]'
                  : 'text-[#44403C] hover:bg-[#FAF9F7] hover:text-[#1C1917]'
              }`}
            >
              Tanya Jawab
            </button>

            <button
              type="button"
              onClick={() => handleNavigate('dashboard')}
              className={`min-h-[42px] shrink-0 whitespace-nowrap rounded-lg px-4 py-2 text-left text-sm font-semibold transition-colors sm:ml-2 sm:text-center ${
                activePage === 'dashboard'
                  ? 'bg-[#6D0F18] text-white'
                  : 'bg-[#8B1520] text-white hover:bg-[#6D0F18]'
              }`}
            >
              {isCommitteeUnlocked ? 'Dashboard Panitia' : 'Portal Panitia'}
            </button>
          </div>
        </nav>
      )}
    </header>
  );
};
