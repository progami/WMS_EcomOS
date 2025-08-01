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
export function parseLocalDate(dateString: string | null | undefined): Date | null {
  if (!dateString || dateString === 'null' || dateString === 'undefined') {
    return null
  }
  
  try {
    // Handle ISO date strings by extracting just the date part
    const datePart = dateString.split('T')[0]
    const [year, month, day] = datePart.split('-').map(Number)
    
    // Check if parsing resulted in valid numbers
    if (isNaN(year) || isNaN(month) || isNaN(day)) {
      console.error('parseLocalDate: Invalid date components:', { dateString, datePart, year, month, day })
      return null
    }
    
    // Validate reasonable date values
    if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
      console.error('parseLocalDate: Date values out of range:', { year, month, day })
      return null
    }
    
    const result = new Date(year, month - 1, day, 0, 0, 0, 0)
    
    // Final validation - check if Date constructor produced a valid date
    if (isNaN(result.getTime())) {
      console.error('parseLocalDate: Date constructor returned invalid date:', { dateString, result })
      return null
    }
    
    return result
  } catch (error) {
    console.error('parseLocalDate: Error parsing date:', dateString, error)
    return null
  }
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