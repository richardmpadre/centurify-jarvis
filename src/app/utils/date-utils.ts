/**
 * Get local date string in YYYY-MM-DD format without timezone issues
 */
export function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get formatted display date (Today, Yesterday, or short date)
 */
export function getFormattedDisplayDate(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (dateStr === getLocalDateString(today)) {
    return 'Today';
  } else if (dateStr === getLocalDateString(yesterday)) {
    return 'Yesterday';
  }
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * Navigate to previous day
 */
export function getPreviousDay(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  date.setDate(date.getDate() - 1);
  return getLocalDateString(date);
}

/**
 * Navigate to next day
 */
export function getNextDay(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  date.setDate(date.getDate() + 1);
  return getLocalDateString(date);
}

/**
 * Check if date string is today
 */
export function isToday(dateStr: string): boolean {
  return dateStr === getLocalDateString(new Date());
}

