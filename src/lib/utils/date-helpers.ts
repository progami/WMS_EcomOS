/**
 * Get the week ending date (Saturday) for a given date
 * @param date The date to get the week ending for
 * @returns The Saturday of the week containing the date
 */
export function getWeekEndingDate(date: Date): Date {
  const result = new Date(date)
  const day = result.getDay()
  const daysUntilSaturday = (6 - day + 7) % 7 || 7
  result.setDate(result.getDate() + daysUntilSaturday)
  result.setHours(23, 59, 59, 999)
  return result
}

/**
 * Parse a date string in YYYY-MM-DD format as a local date (not UTC)
 * This prevents timezone offset issues when storing dates
 * @param dateString Date string in YYYY-MM-DD format
 * @returns Date object set to midnight in local timezone
 */
export function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(year, month - 1, day, 0, 0, 0, 0)
}

/**
 * Parse a date string in YYYY-MM-DD format with explicit timezone
 * @param dateString Date string in YYYY-MM-DD format
 * @param timezone IANA timezone identifier (default: 'America/Chicago')
 * @returns Date object properly adjusted for timezone
 */
export function parseTimezoneDate(dateString: string, timezone: string = 'America/Chicago'): Date {
  // For now, use parseLocalDate to ensure consistent behavior
  // In future, this could be enhanced with proper timezone library
  return parseLocalDate(dateString)
}