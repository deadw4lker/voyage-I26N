import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import type { ViewKey } from '../../types';
import {
  LayoutDashboard,
  BarChart3,
  GitCompare,
  AlertTriangle,
  BookOpen,
} from 'lucide-react';

interface SidebarProps {
  currentView: ViewKey;
  onNavigate: (view: ViewKey) => void;
  onAlertsClick: () => void;
}

const navItems: { key: ViewKey; icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>; labelKey: string }[] = [
  { key: 'command', icon: LayoutDashboard, labelKey: 'nav.command' },
  { key: 'forecast', icon: BarChart3, labelKey: 'nav.forecast' },
  { key: 'icebergs', icon: GitCompare, labelKey: 'nav.icebergs' },
  { key: 'alerts', icon: AlertTriangle, labelKey: 'nav.alerts' },
  { key: 'log', icon: BookOpen, labelKey: 'nav.log' },
];

export function Sidebar({ currentView, onNavigate }: SidebarProps) {
  const { t } = useTranslation();

  return (
    <aside className="w-[228px] flex-none bg-white border-r border-border flex flex-col relative z-10">
      <div className="flex items-center gap-2.5 px-4 h-16 border-b border-border">
        <div className="w-8 h-8 rounded-md bg-[#111e32] flex items-center justify-center flex-none">
          <svg viewBox="0 0 32 32" fill="none" className="w-5 h-5">
            <circle cx="16" cy="16" r="11" stroke="#ffffff" strokeWidth="1.6" opacity="0.9" />
            <path d="M7 20 Q16 11 25 20" stroke="#cbd3df" strokeWidth="1.4" fill="none" />
            <circle cx="16" cy="16" r="2.4" fill="#ffffff" />
          </svg>
        </div>
        <div className="leading-tight">
          <div className="text-[13px] font-semibold text-ice tracking-tight">Voyage-I26N</div>
          <div className="text-[11px] text-ice-faint">Polar Operations</div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 overflow-y-auto" aria-label="Main navigation">
        <div className="text-[11px] font-medium text-ice-faint uppercase tracking-wide px-2 mb-2">
          Operations
        </div>
        <ul className="list-none flex flex-col gap-0.5">
          {navItems.map(({ key, icon: Icon, labelKey }) => (
            <li key={key}>
              <button
                className={cn(
                  'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium',
                  'text-ice-dim hover:bg-[#f3f5f8] hover:text-ice',
                  currentView === key && 'bg-[#eef2f6] text-ice'
                )}
                onClick={() => onNavigate(key)}
                aria-current={currentView === key ? 'page' : undefined}
                aria-label={t(labelKey)}
              >
                <Icon className="w-[18px] h-[18px] flex-none" size={18} strokeWidth={1.8} />
                <span>{t(labelKey)}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="px-4 py-3.5 border-t border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#e4e9f0] flex items-center justify-center text-[11px] font-semibold text-ice-dim flex-none">
            AK
          </div>
          <div className="min-w-0 leading-tight">
            <div className="text-[12.5px] font-medium text-ice truncate">Dr. A. Khare</div>
            <div className="text-[11px] text-ice-faint truncate">Voyage Navigator</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
