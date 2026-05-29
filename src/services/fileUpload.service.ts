import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { query, transaction } from '../utils/database';
import { progressTracker } from '../utils/redis';
import { s3Service } from './s3.service';
import { virusScanner } from './virusScanner.service';
import { imageProcessor } from './imageProcessor.service';
import { MulterFile, FileRecord, UploadSession } from '../types';
import logger from '../utils/logger';
import config from '../config';

class FileUploadService {
  async createUploadSession(userId?: string, metadata?: Record<string, any>): Promise<string> {
    const sessionId = uuidv4();
    
    await query(
      `INSERT INTO upload_sessions (id, user_id, metadata) VALUES ($1, $2, $3)`,
      [sessionId, userId || null, JSON.stringify(metadata || {})]
    );

    logger.info('Upload session created', { sessionId, userId });
    return sessionId;
  }

  async processFile(
    file: MulterFile,
    sessionId: string,
    userId?: string,
    onProgress?: (progress: number, stage: string) => void
  ): Promise<FileRecord> {
    const fileId = uuidv4();
    const checksum = await this.calculateChecksum(file.path);
    
    // Create file record
    const result = await query(
      `INSERT INTO files (
        id, original_name, file_name, mime_type, size, path, 
        upload_session_id, uploaded_by, checksum, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending') RETURNING *`,
      [
        fileId,
        file.originalname,
        file.filename,
        file.mimetype,
        file.size,
        file.path,
        sessionId,
        userId || null,
        checksum
      ]
    );

    const fileRecord = result.rows[0];
    
    // Start processing pipeline
    try {
      // 1. Virus Scan (0-20%)
      await this.updateProgress(fileId, sessionId, 10, 'scanning', 'Virus scanning...');
      const scanResult = await virusScanner.scanFile(file.path);
      
      await query(
        `UPDATE files SET 
          scan_status = $1, 
          virus_scan_result = $2,
          status = CASE WHEN $1 = 'infected' THEN 'quarantined' ELSE 'scanning' END
        WHERE id = $3`,
        [
          scanResult.isInfected ? 'infected' : 'clean',
          JSON.stringify(scanResult),
          fileId
        ]
      );

      if (scanResult.isInfected) {
        await this.updateProgress(fileId, sessionId, 100, 'quarantined', 'File quarantined - virus detected');
        throw new Error('Virus detected - file quarantined');
      }

      // 2. Image Processing (20-50%)
      let thumbnailPath: string | undefined;
      let thumbnailS3Key: string | undefined;
      
      if (imageProcessor.isImage(file.mimetype)) {
        await this.updateProgress(fileId, sessionId, 30, 'processing', 'Processing image...');
        
        try {
          const dimensions = await imageProcessor.getDimensions(file.path);
          await query(
            `UPDATE files SET width = $1, height = $2 WHERE id = $3`,
            [dimensions.width, dimensions.height, fileId]
          );

          // Generate thumbnail
          thumbnailPath = await imageProcessor.generateThumbnail(
            file.path,
            config.upload.tempDir
          );
          
          await this.updateProgress(fileId, sessionId, 40, 'processing', 'Thumbnail generated');
        } catch (err) {
          logger.warn('Image processing failed', { fileId, error: err });
        }
      } else {
        await query(
          `UPDATE files SET processing_status = 'not_required' WHERE id = $1`,
          [fileId]
        );
      }

      // 3. Upload to S3 (50-90%)
      await this.updateProgress(fileId, sessionId, 50, 'uploading', 'Uploading to cloud storage...');
      
      const s3Key = s3Service.generateKey(file.originalname);
      const s3Result = await s3Service.uploadFile(
        file.path,
        s3Key,
        file.mimetype,
        (progress) => {
          const totalProgress = 50 + Math.round(progress * 0.4);
          this.updateProgress(fileId, sessionId, totalProgress, 'uploading', `Uploading: ${progress}%`);
        }
      );

      // Upload thumbnail if exists
      if (thumbnailPath) {
        thumbnailS3Key = s3Service.generateThumbnailKey(s3Key);
        await s3Service.uploadFile(thumbnailPath, thumbnailS3Key, 'image/jpeg');
      }

      // 4. Update database with S3 info (90-100%)
      await this.updateProgress(fileId, sessionId, 90, 'finalizing', 'Finalizing...');
      
      await query(
        `UPDATE files SET 
          s3_key = $1,
          s3_bucket = $2,
          cdn_url = $3,
          thumbnail_path = $4,
          thumbnail_s3_key = $5,
          status = 'completed',
          scan_status = 'clean',
          processing_status = COALESCE($6, 'completed'),
          completed_at = NOW(),
          progress = 100
        WHERE id = $7`,
        [
          s3Result.key,
          s3Result.bucket,
          s3Service.getCdnUrl(s3Result.key),
          thumbnailPath || null,
          thumbnailS3Key || null,
          thumbnailPath ? 'completed' : null,
          fileId
        ]
      );

      // Update session counter
      await progressTracker.incrementSessionCounter(sessionId, 'completed');
      
      await this.updateProgress(fileId, sessionId, 100, 'completed', 'Upload complete');

      logger.info('File processed successfully', { fileId, s3Key: s3Result.key });

      // Cleanup temp files
      await this.cleanupTempFiles(file.path, thumbnailPath);

      return {
        ...fileRecord,
        s3Key: s3Result.key,
        s3Bucket: s3Result.bucket,
        cdnUrl: s3Service.getCdnUrl(s3Result.key),
        status: 'completed'
      } as FileRecord;

    } catch (error) {
      await this.handleProcessingError(fileId, sessionId, error);
      throw error;
    }
  }

  private async updateProgress(
    fileId: string, 
    sessionId: string, 
    progress: number, 
    stage: string,
    message?: string
  ): Promise<void> {
    await progressTracker.setProgress(
      sessionId, 
      fileId, 
      progress, 
      progress === 100 ? 'completed' : 'processing',
      stage,
      message
    );
  }

  private async handleProcessingError(
    fileId: string, 
    sessionId: string, 
    error: any
  ): Promise<void> {
    await query(
      `UPDATE files SET 
        status = 'failed',
        failed_at = NOW(),
        fail_reason = $1
      WHERE id = $2`,
      [error.message || 'Unknown error', fileId]
    );

    await progressTracker.incrementSessionCounter(sessionId, 'failed');
    await progressTracker.setProgress(
      sessionId, 
      fileId, 
      0, 
      'failed',
      'Error',
      error.message
    );

    logger.error('File processing failed', { fileId, error: error.message });
  }

  private async calculateChecksum(filePath: string): Promise<string> {
    const hash = crypto.createHash('sha256');
    const data = await fs.readFile(filePath);
    hash.update(data);
    return hash.digest('hex');
  }

  private async cleanupTempFiles(mainPath?: string, thumbnailPath?: string): Promise<void> {
    try {
      if (mainPath) await fs.unlink(mainPath).catch(() => {});
      if (thumbnailPath) await fs.unlink(thumbnailPath).catch(() => {});
    } catch (error) {
      logger.warn('Failed to cleanup temp files', { error });
    }
  }

  async getFileById(fileId: string): Promise<FileRecord | null> {
    const result = await query(
      `SELECT * FROM files WHERE id = $1 AND is_deleted = FALSE`,
      [fileId]
    );
    return result.rows[0] || null;
  }

  async getFilesBySession(sessionId: string): Promise<FileRecord[]> {
    const result = await query(
      `SELECT * FROM files WHERE upload_session_id = $1 AND is_deleted = FALSE ORDER BY uploaded_at DESC`,
      [sessionId]
    );
    return result.rows;
  }

  async deleteFile(fileId: string, userId?: string): Promise<void> {
    const file = await this.getFileById(fileId);
    if (!file) throw new Error('File not found');

    await transaction(async (client) => {
      // Soft delete
      await client.query(
        `UPDATE files SET is_deleted = TRUE, deleted_at = NOW() WHERE id = $1`,
        [fileId]
      );

      // Delete from S3
      if (file.s3Key) {
        await s3Service.deleteFile(file.s3Key);
      }
      if (file.thumbnailS3Key) {
        await s3Service.deleteFile(file.thumbnailS3Key);
      }
    });

    logger.info('File deleted', { fileId, userId });
  }
}

export const fileUploadService = new FileUploadService();
export default fileUploadService;
