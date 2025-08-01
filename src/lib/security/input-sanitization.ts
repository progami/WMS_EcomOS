import DOMPurify from 'isomorphic-dompurify';

export function sanitizeHtml(input: string): string {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: []
  });
}

export function sanitizeForDisplay(input: string | null | undefined): string {
  if (!input) return '';
  
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

export function sanitizeForExcel(value: string): string {
  if (typeof value !== 'string') return String(value);
  
  // Prevent formula injection
  const firstChar = value.charAt(0);
  if ('=+-@'.includes(firstChar)) {
    return `'${value}`;
  }
  
  // Remove dangerous patterns
  return value
    .replace(/^[=+\-@]/g, '')
    .replace(/[\r\n]/g, ' ')
    .replace(/\t/g, ' ');
}

export function sanitizeFilename(filename: string): string {
  // Remove path traversal attempts
  let safe = filename
    .replace(/\.\./g, '')
    .replace(/[\/\\]/g, '')
    .replace(/%/g, '')
    .replace(/\x00/g, ''); // Remove null bytes
  
  // Remove Windows reserved names
  const reserved = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 
                    'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 
                    'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
  
  const nameWithoutExt = safe.split('.')[0].toUpperCase();
  if (reserved.includes(nameWithoutExt)) {
    safe = `SAFE_${safe}`;
  }
  
  // Ensure it doesn't start with a dot (hidden file)
  if (safe.startsWith('.')) {
    safe = `SAFE_${safe}`;
  }
  
  return safe;
}

// SQL sanitization removed - always use Prisma parameterized queries instead
// If you need to build dynamic queries, use Prisma's query builder or
// parameterized raw queries with $queryRaw`SELECT * FROM table WHERE id = ${value}`

export function sanitizeSearchQuery(query: string): string {
  // Remove special characters that could break searches
  return query
    .replace(/[^\w\s\-\.]/g, '')
    .trim()
    .substring(0, 100); // Limit length
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validateAlphanumeric(input: string): boolean {
  return /^[a-zA-Z0-9\-_]+$/.test(input);
}

export function validateNumeric(input: string): boolean {
  return /^\d+$/.test(input);
}

export function validateDateString(date: string): boolean {
  const parsed = new Date(date);
  return !isNaN(parsed.getTime());
}

export function normalizeUnicode(input: string): string {
  // Remove zero-width characters and normalize
  return input
    .normalize('NFKC')
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F]/g, '')
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, ''); // Control characters
}

export function preventCommandInjection(input: string): string {
  // Remove shell metacharacters
  return input.replace(/[;&|`$\n<>(){}[\]\\'"]/g, '');
}

export function validateFileType(filename: string, allowedTypes: string[]): boolean {
  const ext = filename.split('.').pop()?.toLowerCase();
  return ext ? allowedTypes.includes(`.${ext}`) : false;
}

export function validateFileSize(sizeInBytes: number, maxSizeMB: number = 10): boolean {
  const maxBytes = maxSizeMB * 1024 * 1024;
  return sizeInBytes > 0 && sizeInBytes <= maxBytes;
}

export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function validatePositiveInteger(value: any): boolean {
  const num = Number(value);
  return Number.isInteger(num) && num > 0 && num <= Number.MAX_SAFE_INTEGER;
}

export function validateDecimal(value: any, precision: number = 2): boolean {
  const regex = new RegExp(`^\\d+(\\.\\d{1,${precision}})?$`);
  return regex.test(String(value));
}

export function sanitizeForAudit(data: any): any {
  if (!data) return data;
  
  if (typeof data === 'string') {
    return sanitizeForDisplay(data);
  }
  
  if (typeof data === 'object') {
    if (Array.isArray(data)) {
      return data.map(item => sanitizeForAudit(item));
    }
    
    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = sanitizeForAudit(value);
    }
    return sanitized;
  }
  
  return data;
}