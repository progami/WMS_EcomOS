import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { startOfWeek, endOfWeek, addDays } from 'date-fns'
import { formatInTimeZone, toZonedTime } from 'date-fns-tz'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(amount)
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num)
}

const CENTRAL_TIMEZONE = 'America/Chicago'

export function formatDate(date: Date | string, formatStr: string = 'MMM dd, yyyy'): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return formatInTimeZone(dateObj, CENTRAL_TIMEZONE, formatStr)
}

export function formatDateTime(date: Date | string, formatStr: string = 'MMM dd, yyyy'): string {
  // Changed to use date-only format, removing time
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return formatInTimeZone(dateObj, CENTRAL_TIMEZONE, formatStr)
}

export function toCentralTime(date: Date | string): Date {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return toZonedTime(dateObj, CENTRAL_TIMEZONE)
}

export function getWeekRange(date: Date): { start: Date; end: Date } {
  const start = startOfWeek(date, { weekStartsOn: 1 }) // Monday
  const end = endOfWeek(date, { weekStartsOn: 1 }) // Sunday
  return { start, end }
}

export function getNextMonday(date: Date = new Date()): Date {
  const dayOfWeek = date.getDay()
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek
  return addDays(date, daysUntilMonday)
}

export function getBillingPeriod(date: Date): { start: Date; end: Date } {
  const day = date.getDate()
  const month = date.getMonth()
  const year = date.getFullYear()
  
  if (day <= 15) {
    // Current period: Previous month 16th to current month 15th
    const start = new Date(year, month - 1, 16)
    const end = new Date(year, month, 15)
    return { start, end }
  } else {
    // Current period: Current month 16th to next month 15th
    const start = new Date(year, month, 16)
    const end = new Date(year, month + 1, 15)
    return { start, end }
  }
}

export function calculatePallets(
  cartons: number,
  cartonsPerPallet: number
): number {
  if (cartonsPerPallet <= 0) return 0
  return Math.ceil(cartons / cartonsPerPallet)
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  
  return function (...args: Parameters<T>) {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

export function parseCSV(text: string): string[][] {
  const lines = text.trim().split('\n')
  return lines.map(line => {
    const values: string[] = []
    let current = ''
    let inQuotes = false
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    
    values.push(current.trim())
    return values
  })
}

export function downloadFile(
  content: string,
  filename: string,
  type: string = 'text/plain'
): void {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'An unexpected error occurred'
}