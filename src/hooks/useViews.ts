import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { ViewKey, Language, AlertItem, ToastMessage } from '../types';

export function useViews() {
  const [currentView, setCurrentView] = useState<ViewKey>('command');
  const { t } = useTranslation();

  const viewMeta: Record<ViewKey, { title: string; subtitle: string }> = {
    command: {
      title: t('view.command.title'),
      subtitle: t('view.command.subtitle'),
    },
    forecast: {
      title: t('view.forecast.title'),
      subtitle: t('view.forecast.subtitle'),
    },
    icebergs: {
      title: t('view.icebergs.title'),
      subtitle: t('view.icebergs.subtitle'),
    },
    alerts: {
      title: t('view.alerts.title'),
      subtitle: t('view.alerts.subtitle'),
    },
    log: {
      title: t('view.log.title'),
      subtitle: t('view.log.subtitle'),
    },
  };

  const navigate = useCallback((view: ViewKey) => {
    setCurrentView(view);
  }, []);

  return {
    currentView,
    setCurrentView: navigate,
    viewMeta: viewMeta[currentView],
  };
}

export function useLanguage() {
  const { i18n, t } = useTranslation();
  const [currentLanguage, setCurrentLanguage] = useState<Language>('en');

  const toggleLanguage = useCallback((lang?: Language) => {
    setCurrentLanguage((prev) => {
      const next = lang ?? (prev === 'en' ? 'hi' : 'en');
      if (next !== prev) i18n.changeLanguage(next);
      return next;
    });
  }, [i18n]);

  return {
    currentLanguage,
    toggleLanguage,
    t,
  };
}

export function useClock() {
  const [time, setTime] = useState(() => formatTime());

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(formatTime());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return time;
}

function formatTime(date: Date = new Date()): string {
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss} UTC`;
}

export function useForecastAnimation() {
  const [forecastDay, setForecastDay] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (isPlaying) {
      interval = setInterval(() => {
        setForecastDay((prev) => (prev + 1) % 15);
      }, 550);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying]);

  return {
    forecastDay,
    setForecastDay,
    isPlaying,
    togglePlay,
  };
}

export function useToast() {
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = useCallback((message: string, duration = 3200) => {
    setToast({ message, id: Date.now() });
    setTimeout(() => setToast(null), duration);
  }, []);

  return {
    toast,
    showToast,
  };
}

export function useAlerts(initialAlerts: AlertItem[]) {
  const [alerts, setAlerts] = useState<AlertItem[]>(initialAlerts);
  const [filter, setFilter] = useState<'all' | 'crit' | 'warn' | 'info'>('all');

  const acknowledgeAlert = useCallback((id: string) => {
    setAlerts((prev) =>
      prev.map((alert) =>
        alert.id === id ? { ...alert, acknowledged: true } : alert
      )
    );
  }, []);

  const filteredAlerts = alerts.filter(
    (alert) => filter === 'all' || alert.severity === filter
  );

  const unacknowledgedCount = alerts.filter((a) => !a.acknowledged).length;

  return {
    alerts: filteredAlerts,
    allAlerts: alerts,
    filter,
    setFilter,
    acknowledgeAlert,
    unacknowledgedCount,
  };
}

export function useLayerToggles(initialLayers: Record<string, boolean>) {
  const [activeLayers, setActiveLayers] = useState(initialLayers);

  const toggleLayer = useCallback((layerId: string) => {
    setActiveLayers((prev) => ({
      ...prev,
      [layerId]: !prev[layerId],
    }));
  }, []);

  return {
    activeLayers,
    toggleLayer,
  };
}

export function useSingleSelect<T extends string>(options: T[], defaultValue: T) {
  const [selected, setSelected] = useState<T>(defaultValue);

  const select = useCallback((value: T) => {
    setSelected(value);
  }, []);

  return {
    selected,
    select,
    options,
  };
}