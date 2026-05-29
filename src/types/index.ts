export interface FileRecord {
  id: string;
  originalName: string;
  fileName: string;
  mimeType: string;
  size: number;
  path?: string;
  s3Key?: string;
  s3Bucket?: string;
  cdnUrl?: string;
  thumbnailPath?: string;
  thumbnailS3Key?: string;
  status: FileStatus;
  scanStatus: ScanStatus;
  processingStatus: ProcessingStatus;
  width?: number;
  height?: number;
  duration?: number;
  checksum?: string;
  metadata: Record<string, any>;
  virusScanResult?: VirusScanResult;
  uploadSessionId?: string;
  uploadedBy?: string;
  uploadedAt: Date;
  processedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  failReason?: string;
  progress: number;
  isDeleted: boolean;
  deletedAt?: Date;
}

export type FileStatus = 
  | 'pending' 
  | 'scanning' 
  | 'processing' 
  | 'uploading' 
  | 'completed' 
  | 'failed' 
  | 'quarantined';

export type ScanStatus = 
  | 'pending' 
  | 'scanning' 
  | 'clean' 
  | 'infected' 
  | 'error';

export type ProcessingStatus = 
  | 'pending' 
  | 'processing' 
  | 'completed' 
  | 'failed' 
  | 'not_required';

export interface VirusScanResult {
  isInfected: boolean;
  viruses: string[];
  scannedAt: Date;
  scannerVersion?: string;
}

export interface UploadSession {
  id: string;
  userId?: string;
  totalFiles: number;
  completedFiles: number;
  failedFiles: number;
  status: 'active' | 'completed' | 'failed' | 'cancelled';
  createdAt: Date;
  completedAt?: Date;
  metadata: Record<string, any>;
}

export interface FileProcessingJob {
  id: string;
  fileId: string;
  operation: ProcessingOperation;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  priority: number;
  attempts: number;
  maxAttempts: number;
  result?: Record<string, any>;
  errorMessage?: string;
  createdAt: Date;
  processedAt?: Date;
}

export type ProcessingOperation = 
  | 'virus_scan' 
  | 'image_resize' 
  | 'thumbnail_generate' 
  | 'video_transcode' 
  | 'metadata_extract' 
  | 'upload_s3';

export interface UploadProgress {
  sessionId: string;
  fileId: string;
  fileName: string;
  progress: number;
  status: FileStatus;
  stage: string;
  message?: string;
  timestamp: number;
}

export interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination: string;
  filename: string;
  path: string;
  buffer: Buffer;
}

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface ThumbnailOptions {
  width: number;
  height: number;
  quality?: number;
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
}

export interface S3UploadResult {
  key: string;
  bucket: string;
  location: string;
  etag: string;
  size: number;
}

export interface PresignedUrlResponse {
  url: string;
  key: string;
  expiresIn: number;
  fields?: Record<string, string>;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    timestamp: string;
  };
}
