export type ViewKey = 'command' | 'forecast' | 'icebergs' | 'alerts' | 'log';
export type Language = 'en' | 'hi';

export interface ViewMeta {
  en: [string, string];
  hi: [string, string];
}

export interface KPIData {
  label: string;
  value: string | number;
  unit?: string;
  delta: string;
  deltaType: 'up' | 'down';
}

export interface IcebergData {
  id: string;
  class: string;
  position: string;
  drift: string;
  risk: number;
  confidence: number;
  distance: number;
}

export interface RouteOption {
  name: string;
  distance: string;
  duration: string;
  fuel: string;
  safetyScore: number;
  color: string;
  recommended?: boolean;
}

export interface AlertItem {
  id: string;
  severity: 'crit' | 'warn' | 'info';
  title: string;
  meta: string;
  acknowledged: boolean;
  timestamp: number;
}

export interface VoyageLog {
  date: string;
  route: string;
  duration: string;
  routing: 'AI' | 'Manual';
  outcome: string;
}

export interface ChartDataPoint {
  label: string;
  value: number | null;
}

export interface AppState {
  currentView: ViewKey;
  currentLanguage: Language;
  forecastDay: number;
  isPlaying: boolean;
  activeLayers: Record<string, boolean>;
  selectedIceberg: string | null;
  acknowledgedAlerts: Set<string>;
  toastMessage: string | null;
}

export interface VesselInfo {
  name: string;
  position: string;
  callsign?: string;
  speed?: number;
  heading?: number;
}

export interface MapLayer {
  id: string;
  label: string;
  active: boolean;
}

export interface ToastMessage {
  id: number;
  message: string;
}