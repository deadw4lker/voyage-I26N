import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(date: Date = new Date()): string {
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss} UTC`;
}

export function formatDistance(nm: number): string {
  return `${nm.toFixed(1)} nm`;
}

export function haversineNm(a: [number, number], b: [number, number]): number {
  const R = 3440.065; // Earth radius in nautical miles
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function pathDistanceNm(path: Array<[number, number]>): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    total += haversineNm(path[i - 1], path[i]);
  }
  return total;
}

export function formatVoyageDuration(nm: number, speedKn = 12): string {
  const hours = Math.round(nm / speedKn);
  const days = Math.floor(hours / 24);
  const rem = hours % 24;
  return days > 0 ? `${days}d ${rem}h` : `${rem}h`;
}

export function estimateFuelKl(nm: number): string {
  return `${(nm * 0.0624).toFixed(1)} kL`;
}

export function formatPercentage(value: number): string {
  return `${value}%`;
}

export function getRiskClass(risk: number): 'high' | 'med' | 'low' {
  if (risk >= 60) return 'high';
  if (risk >= 30) return 'med';
  return 'low';
}

export function getSeverityColor(severity: 'crit' | 'warn' | 'info'): string {
  switch (severity) {
    case 'crit': return '#991b1b';
    case 'warn': return '#92400e';
    case 'info': return '#475569';
  }
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

export function debounce<T extends (...args: unknown[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function throttle<T extends (...args: unknown[]) => void>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}