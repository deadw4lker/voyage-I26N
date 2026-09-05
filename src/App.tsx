import { Sidebar } from './components/layout/Sidebar';
import { TopBar } from './components/layout/TopBar';
import { Toast } from './components/ui/Toast';
import { useViews, useLanguage, useClock, useToast, useAlerts } from './hooks/useViews';
import type { ViewKey, AlertItem, Language } from './types';
import { CommandView } from './views/CommandView';
import { ForecastView } from './views/ForecastView';
import { IcebergsView } from './views/IcebergsView';
import { AlertsView } from './views/AlertsView';
import { LogView } from './views/LogView';
import './index.css';

const initialAlerts: AlertItem[] = [
  {
    id: '1',
    severity: 'crit',
    title: 'alerts.item.iceberg',
    meta: '12 min ago, sector SW-2',
    acknowledged: false,
    timestamp: Date.now() - 12 * 60 * 1000,
  },
  {
    id: '2',
    severity: 'warn',
    title: 'alerts.item.concentration',
    meta: '48 min ago',
    acknowledged: false,
    timestamp: Date.now() - 48 * 60 * 1000,
  },
  {
    id: '3',
    severity: 'warn',
    title: 'alerts.item.katabatic',
    meta: '1 h ago',
    acknowledged: false,
    timestamp: Date.now() - 60 * 60 * 1000,
  },
  {
    id: '4',
    severity: 'info',
    title: 'alerts.item.reroute',
    meta: '2 h ago, acknowledged',
    acknowledged: true,
    timestamp: Date.now() - 2 * 60 * 60 * 1000,
  },
  {
    id: '5',
    severity: 'info',
    title: 'alerts.item.sar',
    meta: '3 h ago, acknowledged',
    acknowledged: true,
    timestamp: Date.now() - 3 * 60 * 60 * 1000,
  },
];

interface ViewProps {
  alerts: AlertItem[];
  allAlerts: AlertItem[];
  filter: 'all' | 'crit' | 'warn' | 'info';
  setFilter: (filter: 'all' | 'crit' | 'warn' | 'info') => void;
  acknowledgeAlert: (id: string) => void;
  showToast: (message: string) => void;
  currentLanguage: Language;
}

const ViewComponents: Record<ViewKey, React.FC<ViewProps>> = {
  command: CommandView,
  forecast: ForecastView,
  icebergs: IcebergsView,
  alerts: AlertsView,
  log: LogView,
};

export default function App() {
  const { currentView, setCurrentView, viewMeta } = useViews();
  const { currentLanguage, toggleLanguage } = useLanguage();
  const currentTime = useClock();
  const { toast, showToast } = useToast();
  const {
    alerts,
    allAlerts,
    filter,
    setFilter,
    acknowledgeAlert,
    unacknowledgedCount,
  } = useAlerts(initialAlerts);

  const handleNavClick = (view: ViewKey) => {
    setCurrentView(view);
  };

  const handleAlertClick = () => {
    setCurrentView('alerts');
  };

  const ActiveView = ViewComponents[currentView];

  return (
    <div className="app relative flex h-screen bg-[#f1f4f7]">
      <Sidebar
        currentView={currentView}
        onNavigate={handleNavClick}
        onAlertsClick={handleAlertClick}
      />

      <main className="main flex-1 flex flex-col min-w-0">
        <TopBar
          viewTitle={viewMeta.title}
          viewSubtitle={viewMeta.subtitle}
          currentLanguage={currentLanguage}
          onLanguageChange={toggleLanguage}
          unacknowledgedCount={unacknowledgedCount}
          alerts={allAlerts}
          acknowledgeAlert={acknowledgeAlert}
          onAlertsClick={handleAlertClick}
          currentTime={currentTime}
        />

        <div className="viewport flex-1 overflow-y-auto px-6 py-5 pb-10 scrollbar-thin">
          <div className="view max-w-[1200px] mx-auto" key={currentView}>
            <ActiveView
              alerts={alerts}
              allAlerts={allAlerts}
              filter={filter}
              setFilter={setFilter}
              acknowledgeAlert={acknowledgeAlert}
              showToast={showToast}
              currentLanguage={currentLanguage}
            />
          </div>
        </div>
      </main>

      <Toast toast={toast} onClose={() => showToast('')} />
    </div>
  );
}
