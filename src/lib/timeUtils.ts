/**
 * Time utility functions for financial transaction timeline analysis.
 */

export function parseTimestampToEpochMs(timestampStr: string): number {
  if (!timestampStr) return 0;
  // Format: YYYY-MM-DD HH:MM:SS or ISO
  const normalized = timestampStr.trim().replace(' ', 'T');
  const parsed = Date.parse(normalized);
  return isNaN(parsed) ? 0 : parsed;
}

export function formatTimestamp(epochMs: number | string): string {
  if (!epochMs) return 'N/A';
  const date = typeof epochMs === 'string' ? new Date(epochMs) : new Date(epochMs);
  if (isNaN(date.getTime())) return String(epochMs);

  const pad = (n: number) => n.toString().padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export function getElapsedMinutes(startEpochMs: number, endEpochMs: number): number {
  if (!startEpochMs || !endEpochMs) return 0;
  return Math.abs(endEpochMs - startEpochMs) / (1000 * 60);
}

export function formatDuration(minutes: number): string {
  if (minutes < 1) {
    return `${Math.round(minutes * 60)} sec`;
  }
  if (minutes < 60) {
    return `${minutes.toFixed(1)} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMin = Math.round(minutes % 60);
  return `${hours} hr ${remainingMin} min`;
}
