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

/**
 * Get ISO week number (1-52/53)
 * Week 1 is the week containing the first Thursday of the year
 */
export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7; // Make Sunday = 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum); // Set to nearest Thursday
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return weekNo;
}

/**
 * Get the Monday (start) of the week containing the given date
 */
export function getWeekStartDate(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get the Sunday (end) of the week containing the given date
 */
export function getWeekEndDate(date: Date): Date {
  const start = getWeekStartDate(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

/**
 * Get week date range info
 */
export interface WeekDateRange {
  startDate: string;
  endDate: string;
  weekNumber: number;
  year: number;
  displayRange: string;
}

export function getWeekDateRange(date: Date): WeekDateRange {
  const start = getWeekStartDate(date);
  const end = getWeekEndDate(date);
  const weekNumber = getWeekNumber(date);
  
  // Year is based on Thursday of the week (ISO standard)
  const thursday = new Date(start);
  thursday.setDate(thursday.getDate() + 3);
  const year = thursday.getFullYear();
  
  const formatOptions: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const startStr = start.toLocaleDateString('en-US', formatOptions);
  const endStr = end.toLocaleDateString('en-US', { ...formatOptions, year: 'numeric' });
  
  return {
    startDate: getLocalDateString(start),
    endDate: getLocalDateString(end),
    weekNumber,
    year,
    displayRange: `${startStr} - ${endStr}`
  };
}

/**
 * Get all dates in a week as array of YYYY-MM-DD strings
 */
export function getWeekDates(date: Date): string[] {
  const start = getWeekStartDate(date);
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    dates.push(getLocalDateString(d));
  }
  return dates;
}

/**
 * Navigate to previous week
 */
export function getPreviousWeek(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - 7);
  return d;
}

/**
 * Navigate to next week
 */
export function getNextWeek(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + 7);
  return d;
}

/**
 * Check if date is in current week
 */
export function isCurrentWeek(date: Date): boolean {
  const today = new Date();
  const currentWeekStart = getWeekStartDate(today);
  const dateWeekStart = getWeekStartDate(date);
  return getLocalDateString(currentWeekStart) === getLocalDateString(dateWeekStart);
}

