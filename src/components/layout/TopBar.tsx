import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import type { AlertItem, Language } from '../../types';
import { Bell } from 'lucide-react';

interface TopBarProps {
  viewTitle: string;
  viewSubtitle: string;
  currentLanguage: Language;
  onLanguageChange: (lang: Language) => void;
  unacknowledgedCount: number;
  alerts: AlertItem[];
  acknowledgeAlert: (id: string) => void;
  onAlertsClick: () => void;
  currentTime: string;
}

const severityDot: Record<string, string> = {
  crit: 'bg-[#991b1b]',
  warn: 'bg-[#b45309]',
  info: 'bg-[#64748b]',
};

export function TopBar({
  viewTitle,
  viewSubtitle,
  currentLanguage,
  onLanguageChange,
  unacknowledgedCount,
  alerts,
  acknowledgeAlert,
  onAlertsClick,
  currentTime,
}: TopBarProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const liveAlerts = alerts.filter((a) => !a.acknowledged).slice(0, 5);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open ]);

  const handleViewAll = () => {
    setOpen(false);
    onAlertsClick();
  };

  return (
    <header className="relative z-20 h-16 flex-none flex items-center justify-between px-6 gap-5 bg-white border-b border-border">
      <div className="min-w-0">
        <h1 className="text-[16px] font-semibold text-ice tracking-tight truncate">{viewTitle}</h1>
        <p className="text-[12px] text-ice-faint truncate">{viewSubtitle}</p>
      </div>

      <div className="flex items-center gap-3 flex-none">
        <div className="hidden md:flex items-center gap-2 pr-3 border-r border-border">
          <span className="w-1.5 h-1.5 rounded-full bg-[#178a4c]" />
          <div className="leading-tight">
            <div className="text-[12px] font-medium text-ice">{t('vessel.name')}</div>
            <div className="text-[11px] text-ice-faint">{t('vessel.position')}</div>
          </div>
        </div>

        <div className="flex border border-border rounded-md overflow-hidden bg-white">
          <button
            className={cn(
              'px-2.5 py-1.5 text-[12px] font-medium transition-colors',
              currentLanguage === 'en' ? 'bg-[#111e32] text-white' : 'text-ice-dim hover:bg-[#f3f5f8]'
            )}
            onClick={() => onLanguageChange('en')}
            aria-pressed={currentLanguage === 'en'}
          >
            EN
          </button>
          <button
            className={cn(
              'px-2.5 py-1.5 text-[12px] font-medium transition-colors border-l border-border',
              currentLanguage === 'hi' ? 'bg-[#111e32] text-white' : 'text-ice-dim hover:bg-[#f3f5f8]'
            )}
            onClick={() => onLanguageChange('hi')}
            aria-pressed={currentLanguage === 'hi'}
          >
            HI
          </button>
        </div>

        <div ref={wrapRef} className="relative">
          <button
            className={cn(
              'relative w-9 h-9 rounded-md border bg-white flex items-center justify-center transition-colors',
              open
                ? 'border-border-strong text-ice bg-[#f8fafc]'
                : 'border-border text-ice-dim hover:bg-[#f8fafc] hover:text-ice'
            )}
            onClick={() => setOpen((v) => !v)}
            aria-label={t('nav.alerts')}
            aria-haspopup="true"
            aria-expanded={open}
          >
            <Bell className="w-[18px] h-[18px]" strokeWidth={1.8} />
            {unacknowledgedCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#991b1b] text-white text-[10px] font-semibold min-w-[16px] h-4 rounded-full flex items-center justify-center px-1">
                {unacknowledgedCount > 9 ? '9+' : unacknowledgedCount}
              </span>
            )}
          </button>

          {open && (
            <div
              className="absolute right-0 top-11 w-[340px] max-w-[86vw] bg-white border border-border rounded-lg z-50 overflow-hidden"
              style={{ boxShadow: '0 12px 32px rgba(16,24,40,.14)' }}
              role="menu"
              aria-label={t('nav.alerts')}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <span className="text-[13px] font-semibold text-ice">{t('command.alerts.title')}</span>
                <span className="text-[11.5px] text-ice-faint" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {unacknowledgedCount > 0 ? `${unacknowledgedCount} new` : t('common.all')}
                </span>
              </div>

              <div className="max-h-[320px] overflow-y-auto scrollbar-thin">
                {liveAlerts.length === 0 ? (
                  <div className="px-4 py-6 text-center text-[12.5px] text-ice-faint">
                    {currentLanguage === 'hi' ? 'कोई नई चेतावनी नहीं' : 'No new alerts'}
                  </div>
                ) : (
                  liveAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="flex items-start gap-2.5 px-4 py-3 border-b border-border last:border-0 hover:bg-[#f8fafc]"
                    >
                      <span className={cn('w-2 h-2 rounded-full mt-1.5 flex-shrink-0', severityDot[alert.severity])} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[12.5px] leading-snug text-ice">{t(alert.title)}</div>
                        <div className="text-[11px] text-ice-faint mt-0.5">{alert.meta}</div>
                      </div>
                      <button
                        className="text-[11px] font-medium px-2 py-1 rounded-md border border-border bg-white text-ice-dim hover:text-ice hover:border-border-strong transition-colors flex-shrink-0"
                        onClick={() => acknowledgeAlert(alert.id)}
                      >
                        {t('common.acknowledge')}
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="border-t border-border p-2">
                <button
                  className="w-full text-center text-[12.5px] font-medium text-ice py-2 rounded-md hover:bg-[#f3f5f8] transition-colors"
                  onClick={handleViewAll}
                >
                  {t('command.alerts.viewAll')}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="text-[12px] text-ice-dim min-w-[86px] text-right hidden sm:block" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {currentTime}
        </div>
      </div>
    </header>
  );
}
