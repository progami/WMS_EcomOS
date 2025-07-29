import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
  GetObjectCommandInput,
  PutObjectCommandInput,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Upload } from '@aws-sdk/lib-storage';
import crypto from 'crypto';
import { Readable } from 'stream';
import mime from 'mime-types';

export interface S3UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  tags?: Record<string, string>;
  cacheControl?: string;
  contentDisposition?: string;
  expiresAt?: Date; // For temporary files
}

export interface S3UploadResult {
  key: string;
  bucket: string;
  url: string;
  etag: string;
  size: number;
  contentType: string;
  versionId?: string;
}

export interface S3DownloadOptions {
  responseContentType?: string;
  responseContentDisposition?: string;
  expiresIn?: number; // seconds
}

export type FileContext = 
  | { type: 'transaction'; transactionId: string; documentType: string }
  | { type: 'export-temp'; userId: string; exportType: string }
  | { type: 'export-scheduled'; frequency: 'daily' | 'weekly' | 'monthly'; date: Date; reportType: string }
  | { type: 'template'; templateType: string }
  | { type: 'generated-invoice'; invoiceId: string; invoiceNumber: string };

export class S3Service {
  private client: S3Client;
  private bucket: string;
  private region: string;
  private urlExpiry: number;

  constructor() {
    this.region = process.env.AWS_REGION || process.env.S3_BUCKET_REGION || 'us-east-1';
    this.bucket = process.env.S3_BUCKET_NAME!;
    this.urlExpiry = parseInt(process.env.S3_PRESIGNED_URL_EXPIRY || '3600', 10);

    if (!this.bucket) {
      throw new Error('S3_BUCKET_NAME environment variable is required');
    }

    // Initialize S3 client
    // In production with EC2, this will use IAM role
    // In development, this will use AWS CLI credentials or environment variables
    const clientConfig: any = {
      region: this.region,
      useAccelerateEndpoint: process.env.S3_USE_ACCELERATED_ENDPOINT === 'true',
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    };

    // Only set explicit credentials if provided
    // Otherwise, SDK will use credential chain (IAM role, CLI, etc.)
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      clientConfig.credentials = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      };
    }

    this.client = new S3Client(clientConfig);
  }

  /**
   * Generate S3 key based on context with proper structure
   */
  generateKey(context: FileContext, filename: string): string {
    const sanitizedFilename = this.sanitizeFilename(filename);
    const timestamp = Date.now();
    const hash = crypto.randomBytes(4).toString('hex');

    switch (context.type) {
      case 'transaction': {
        // transactions/YYYY/MM/{transaction-id}/{documentType}_{timestamp}_{hash}_{filename}
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return `transactions/${year}/${month}/${context.transactionId}/${context.documentType}_${timestamp}_${hash}_${sanitizedFilename}`;
      }

      case 'export-temp': {
        // exports/temp/{user-id}/{exportType}_{timestamp}_{filename}
        return `exports/temp/${context.userId}/${context.exportType}_${timestamp}_${sanitizedFilename}`;
      }

      case 'export-scheduled': {
        // exports/scheduled/{frequency}/{YYYY-MM-DD}/{reportType}_{timestamp}_{filename}
        const dateStr = context.date.toISOString().split('T')[0];
        return `exports/scheduled/${context.frequency}/${dateStr}/${context.reportType}_${timestamp}_${sanitizedFilename}`;
      }

      case 'template': {
        // templates/{templateType}_{version}_{filename}
        const version = new Date().toISOString().split('T')[0].replace(/-/g, '');
        return `templates/${context.templateType}_v${version}_${sanitizedFilename}`;
      }

      case 'generated-invoice': {
        // generated-invoices/YYYY/MM/{invoice-id}/invoice_{invoiceNumber}_{timestamp}.pdf
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return `generated-invoices/${year}/${month}/${context.invoiceId}/invoice_${context.invoiceNumber}_${timestamp}.pdf`;
      }

      default:
        throw new Error(`Unknown file context type`);
    }
  }

  /**
   * Sanitize filename for S3
   */
  private sanitizeFilename(filename: string): string {
    return filename
      .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace special chars with underscore
      .replace(/_{2,}/g, '_') // Replace multiple underscores with single
      .replace(/^_+|_+$/g, '') // Remove leading/trailing underscores
      .toLowerCase();
  }

  /**
   * Upload file to S3 with progress tracking
   */
  async uploadFile(
    file: Buffer | Readable | File,
    key: string,
    options: S3UploadOptions = {},
    onProgress?: (progress: number) => void
  ): Promise<S3UploadResult> {
    try {
      // Convert File to Buffer if needed
      let uploadBody: Buffer | Readable;
      let fileSize: number;
      
      if (file instanceof File) {
        const arrayBuffer = await file.arrayBuffer();
        uploadBody = Buffer.from(arrayBuffer);
        fileSize = file.size;
        options.contentType = options.contentType || file.type;
      } else if (Buffer.isBuffer(file)) {
        uploadBody = file;
        fileSize = file.length;
      } else {
        uploadBody = file;
        fileSize = 0; // Will be calculated during upload
      }

      // Detect content type if not provided
      const contentType = options.contentType || 
        mime.lookup(key) || 
        'application/octet-stream';

      // Prepare metadata
      const metadata: Record<string, string> = {
        ...options.metadata,
        uploadedAt: new Date().toISOString(),
      };

      // Add expiration for temporary files
      if (options.expiresAt) {
        metadata.expiresAt = options.expiresAt.toISOString();
      }

      // Prepare upload parameters
      const uploadParams: PutObjectCommandInput = {
        Bucket: this.bucket,
        Key: key,
        Body: uploadBody,
        ContentType: contentType,
        Metadata: metadata,
        ServerSideEncryption: 'AES256',
        CacheControl: options.cacheControl || this.getCacheControl(key),
        ContentDisposition: options.contentDisposition || this.getContentDisposition(key),
      };

      // Add tags if provided
      if (options.tags) {
        uploadParams.Tagging = Object.entries(options.tags)
          .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
          .join('&');
      }

      // Use multipart upload for large files (> 5MB)
      if (fileSize > 5 * 1024 * 1024) {
        const upload = new Upload({
          client: this.client,
          params: uploadParams,
          queueSize: 4,
          partSize: 5 * 1024 * 1024,
          leavePartsOnError: false,
        });

        if (onProgress) {
          upload.on('httpUploadProgress', (progress) => {
            if (progress.loaded && progress.total) {
              onProgress((progress.loaded / progress.total) * 100);
            }
          });
        }

        const result = await upload.done();
        
        return {
          key,
          bucket: this.bucket,
          url: this.getPublicUrl(key),
          etag: result.ETag?.replace(/"/g, '') || '',
          size: fileSize,
          contentType,
          versionId: result.VersionId,
        };
      } else {
        // Use simple upload for small files
        const command = new PutObjectCommand(uploadParams);
        const result = await this.client.send(command);
        
        return {
          key,
          bucket: this.bucket,
          url: this.getPublicUrl(key),
          etag: result.ETag?.replace(/"/g, '') || '',
          size: fileSize,
          contentType,
          versionId: result.VersionId,
        };
      }
    } catch (error) {
      console.error('S3 upload failed:', error);
      throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate presigned URL for secure file access
   */
  async getPresignedUrl(
    key: string,
    operation: 'get' | 'put' = 'get',
    options: S3DownloadOptions = {}
  ): Promise<string> {
    try {
      const command = operation === 'get'
        ? new GetObjectCommand({
            Bucket: this.bucket,
            Key: key,
            ResponseContentType: options.responseContentType,
            ResponseContentDisposition: options.responseContentDisposition,
          })
        : new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
          });

      const url = await getSignedUrl(this.client, command, {
        expiresIn: options.expiresIn || this.urlExpiry,
      });

      return url;
    } catch (error) {
      console.error('Failed to generate presigned URL:', error);
      throw new Error(`Failed to generate presigned URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get public URL (for use with CloudFront if configured)
   */
  getPublicUrl(key: string): string {
    if (process.env.CLOUDFRONT_DOMAIN) {
      return `https://${process.env.CLOUDFRONT_DOMAIN}/${key}`;
    }
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }

  /**
   * Download file from S3
   */
  async downloadFile(key: string): Promise<Buffer> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.client.send(command);
      
      if (!response.Body) {
        throw new Error('No file body returned');
      }

      // Convert stream to buffer
      const stream = response.Body as Readable;
      const chunks: Buffer[] = [];
      
      return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks)));
      });
    } catch (error) {
      console.error('S3 download failed:', error);
      throw new Error(`Failed to download file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Stream file from S3
   */
  async streamFile(key: string): Promise<Readable> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.client.send(command);
      
      if (!response.Body || !(response.Body instanceof Readable)) {
        throw new Error('No stream returned from S3');
      }

      return response.Body;
    } catch (error) {
      console.error('S3 stream failed:', error);
      throw new Error(`Failed to stream file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if file exists
   */
  async fileExists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.client.send(command);
      return true;
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Delete file from S3
   */
  async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.client.send(command);
    } catch (error) {
      console.error('S3 delete failed:', error);
      throw new Error(`Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List files with prefix
   */
  async listFiles(prefix: string, maxKeys = 1000): Promise<string[]> {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
        MaxKeys: maxKeys,
      });

      const response = await this.client.send(command);
      return response.Contents?.map(item => item.Key!) || [];
    } catch (error) {
      console.error('S3 list failed:', error);
      throw new Error(`Failed to list files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Copy file within S3
   */
  async copyFile(sourceKey: string, destinationKey: string): Promise<void> {
    try {
      const command = new CopyObjectCommand({
        Bucket: this.bucket,
        CopySource: `${this.bucket}/${sourceKey}`,
        Key: destinationKey,
        ServerSideEncryption: 'AES256',
      });

      await this.client.send(command);
    } catch (error) {
      console.error('S3 copy failed:', error);
      throw new Error(`Failed to copy file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get appropriate cache control based on file type
   */
  private getCacheControl(key: string): string {
    // Templates and generated files should be cached longer
    if (key.startsWith('templates/') || key.startsWith('generated-invoices/')) {
      return 'max-age=31536000'; // 1 year
    }
    
    // Temporary exports should not be cached
    if (key.includes('/temp/')) {
      return 'no-cache, no-store, must-revalidate';
    }
    
    // Default cache for other files
    return 'max-age=86400'; // 1 day
  }

  /**
   * Get appropriate content disposition
   */
  private getContentDisposition(key: string): string {
    const filename = key.split('/').pop() || 'download';
    
    // Force download for exports
    if (key.startsWith('exports/')) {
      return `attachment; filename="${filename}"`;
    }
    
    // Inline for PDFs and images
    const ext = filename.split('.').pop()?.toLowerCase();
    if (['pdf', 'jpg', 'jpeg', 'png', 'gif'].includes(ext || '')) {
      return `inline; filename="${filename}"`;
    }
    
    // Default to attachment
    return `attachment; filename="${filename}"`;
  }

  /**
   * Clean up expired temporary files
   */
  async cleanupExpiredFiles(): Promise<number> {
    try {
      const tempPrefix = 'exports/temp/';
      const files = await this.listFiles(tempPrefix);
      let deletedCount = 0;

      for (const key of files) {
        try {
          // Get file metadata
          const headCommand = new HeadObjectCommand({
            Bucket: this.bucket,
            Key: key,
          });
          
          const response = await this.client.send(headCommand);
          const expiresAt = response.Metadata?.expiresAt;
          
          if (expiresAt) {
            const expiryDate = new Date(expiresAt);
            if (expiryDate < new Date()) {
              await this.deleteFile(key);
              deletedCount++;
            }
          } else {
            // No expiry metadata, check if file is older than 48 hours
            const lastModified = response.LastModified;
            if (lastModified) {
              const age = Date.now() - lastModified.getTime();
              if (age > 48 * 60 * 60 * 1000) { // 48 hours
                await this.deleteFile(key);
                deletedCount++;
              }
            }
          }
        } catch (error) {
          console.error(`Failed to check/delete file ${key}:`, error);
        }
      }

      return deletedCount;
    } catch (error) {
      console.error('Cleanup failed:', error);
      return 0;
    }
  }
}

// Export singleton instance
let s3Service: S3Service | null = null;

export function getS3Service(): S3Service {
  if (!s3Service) {
    s3Service = new S3Service();
  }
  return s3Service;
}

// Export type guard for file context
export function isValidFileContext(context: any): context is FileContext {
  if (!context || typeof context !== 'object' || !context.type) {
    return false;
  }

  switch (context.type) {
    case 'transaction':
      return typeof context.transactionId === 'string' && typeof context.documentType === 'string';
    case 'export-temp':
      return typeof context.userId === 'string' && typeof context.exportType === 'string';
    case 'export-scheduled':
      return ['daily', 'weekly', 'monthly'].includes(context.frequency) && 
        context.date instanceof Date && 
        typeof context.reportType === 'string';
    case 'template':
      return typeof context.templateType === 'string';
    case 'generated-invoice':
      return typeof context.invoiceId === 'string' && typeof context.invoiceNumber === 'string';
    default:
      return false;
  }
}