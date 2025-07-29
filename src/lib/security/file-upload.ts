import crypto from 'crypto';

interface FileValidationOptions {
  maxSizeMB?: number;
  allowedMimeTypes?: string[];
  allowedExtensions?: string[];
}

interface ValidationResult {
  valid: boolean;
  error?: string;
}

// Default allowed file types for different contexts
const DEFAULT_ALLOWED_TYPES = {
  document: {
    mimeTypes: [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ],
    extensions: ['pdf', 'jpg', 'jpeg', 'png', 'xlsx', 'xls', 'csv'],
  },
  image: {
    mimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
    extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
  },
  export: {
    mimeTypes: [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'application/pdf',
    ],
    extensions: ['xlsx', 'xls', 'csv', 'pdf'],
  },
};

/**
 * Validate file before upload
 */
export async function validateFile(
  file: File | { name: string; size: number; type: string },
  context: string,
  options: FileValidationOptions = {}
): Promise<ValidationResult> {
  // Determine context defaults
  const contextDefaults = context.includes('export') 
    ? DEFAULT_ALLOWED_TYPES.export
    : context.includes('image')
    ? DEFAULT_ALLOWED_TYPES.image
    : DEFAULT_ALLOWED_TYPES.document;

  const maxSizeMB = options.maxSizeMB || 10; // Default 10MB
  const allowedMimeTypes = options.allowedMimeTypes || contextDefaults.mimeTypes;
  const allowedExtensions = options.allowedExtensions || contextDefaults.extensions;

  // Check file size
  if (file.size > maxSizeMB * 1024 * 1024) {
    return {
      valid: false,
      error: `File size exceeds ${maxSizeMB}MB limit`,
    };
  }

  // Check file extension
  const fileName = file.name.toLowerCase();
  const extension = fileName.split('.').pop();
  
  if (!extension || !allowedExtensions.includes(extension)) {
    return {
      valid: false,
      error: `File type .${extension} is not allowed. Allowed types: ${allowedExtensions.join(', ')}`,
    };
  }

  // Check MIME type
  if (!allowedMimeTypes.includes(file.type)) {
    return {
      valid: false,
      error: `File MIME type ${file.type} is not allowed`,
    };
  }

  // Additional security checks for file name
  const securityIssues = checkFileNameSecurity(file.name);
  if (securityIssues) {
    return {
      valid: false,
      error: securityIssues,
    };
  }

  return { valid: true };
}

/**
 * Check filename for security issues
 */
function checkFileNameSecurity(fileName: string): string | null {
  // Check for path traversal attempts
  if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
    return 'Invalid file name: contains path characters';
  }

  // Check for null bytes
  if (fileName.includes('\0')) {
    return 'Invalid file name: contains null bytes';
  }

  // Check for control characters
  if (/[\x00-\x1f\x80-\x9f]/.test(fileName)) {
    return 'Invalid file name: contains control characters';
  }

  // Check length
  if (fileName.length > 255) {
    return 'File name too long (max 255 characters)';
  }

  return null;
}

/**
 * Generate secure filename
 */
export function generateSecureFilename(originalName: string): string {
  // Extract extension
  const extension = originalName.split('.').pop()?.toLowerCase() || '';
  
  // Generate timestamp and random hash
  const timestamp = Date.now();
  const hash = crypto.randomBytes(8).toString('hex');
  
  // Sanitize original name (remove extension and special chars)
  const baseName = originalName
    .replace(/\.[^/.]+$/, '') // Remove extension
    .replace(/[^a-zA-Z0-9-_]/g, '_') // Replace special chars
    .replace(/_{2,}/g, '_') // Replace multiple underscores
    .replace(/^_+|_+$/g, '') // Trim underscores
    .slice(0, 50); // Limit length

  // Construct secure filename
  return `${baseName}_${timestamp}_${hash}.${extension}`;
}

/**
 * Check if file is likely malicious based on content
 */
export async function scanFileContent(
  buffer: Buffer,
  mimeType: string
): Promise<ValidationResult> {
  // Check for common malware signatures (basic implementation)
  const malwareSignatures = [
    Buffer.from('4D5A'), // PE executable
    Buffer.from('7F454C46'), // ELF executable
    Buffer.from('CAFEBABE'), // Java class file
    Buffer.from('504B0304'), // ZIP (could be disguised executable)
  ];

  // Only check if not expected to be ZIP-based format
  const zipBasedFormats = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];

  if (!zipBasedFormats.includes(mimeType)) {
    for (const signature of malwareSignatures) {
      if (buffer.subarray(0, signature.length).equals(signature)) {
        return {
          valid: false,
          error: 'File appears to contain executable code',
        };
      }
    }
  }

  // Check for embedded scripts in PDFs
  if (mimeType === 'application/pdf') {
    const pdfContent = buffer.toString('utf8', 0, Math.min(buffer.length, 10000));
    if (/<script|\/JavaScript|\/JS/i.test(pdfContent)) {
      return {
        valid: false,
        error: 'PDF contains potentially malicious scripts',
      };
    }
  }

  return { valid: true };
}

/**
 * Get file type category
 */
export function getFileCategory(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType === 'text/csv') return 'spreadsheet';
  if (mimeType.includes('word')) return 'document';
  return 'other';
}