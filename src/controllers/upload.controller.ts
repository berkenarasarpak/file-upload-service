import { Request, Response } from 'express';
import { fileUploadService } from '../services/fileUpload.service';
import { progressTracker } from '../utils/redis';
import { s3Service } from '../services/s3.service';
import { MulterFile } from '../types';
import logger from '../utils/logger';

export class UploadController {
  async createSession(req: Request, res: Response) {
    try {
      const { userId, metadata } = req.body;
      const sessionId = await fileUploadService.createUploadSession(userId, metadata);
      
      res.status(201).json({
        success: true,
        data: { sessionId }
      });
    } catch (error) {
      logger.error('Create session failed', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'SESSION_CREATE_FAILED',
          message: 'Failed to create upload session'
        }
      });
    }
  }

  async uploadFiles(req: Request, res: Response) {
    try {
      const { sessionId } = req.params;
      const userId = req.body.userId || req.headers['x-user-id'];
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'NO_FILES',
            message: 'No files provided'
          }
        });
      }

      // Process files in background
      const processedFiles = await Promise.all(
        files.map(async (file) => {
          try {
            const result = await fileUploadService.processFile(
              file as MulterFile,
              sessionId,
              userId as string
            );
            return { success: true, file: result };
          } catch (error: any) {
            return { success: false, error: error.message, originalName: file.originalname };
          }
        })
      );

      const successful = processedFiles.filter(p => p.success);
      const failed = processedFiles.filter(p => !p.success);

      res.status(200).json({
        success: true,
        data: {
          sessionId,
          totalFiles: files.length,
          successful: successful.length,
          failed: failed.length,
          files: processedFiles
        }
      });
    } catch (error) {
      logger.error('Upload failed', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'UPLOAD_FAILED',
          message: 'File upload failed'
        }
      });
    }
  }

  async getProgress(req: Request, res: Response) {
    try {
      const { fileId } = req.params;
      const progress = await progressTracker.getProgress(fileId);

      if (!progress) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Progress not found'
          }
        });
      }

      res.json({
        success: true,
        data: progress
      });
    } catch (error) {
      logger.error('Get progress failed', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'PROGRESS_ERROR',
          message: 'Failed to get progress'
        }
      });
    }
  }

  async getSessionStatus(req: Request, res: Response) {
    try {
      const { sessionId } = req.params;
      const [status, counters, files] = await Promise.all([
        progressTracker.getSessionStatus(sessionId),
        progressTracker.getSessionCounters(sessionId),
        fileUploadService.getFilesBySession(sessionId)
      ]);

      res.json({
        success: true,
        data: {
          sessionId,
          counters,
          files,
          status
        }
      });
    } catch (error) {
      logger.error('Get session status failed', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'SESSION_STATUS_ERROR',
          message: 'Failed to get session status'
        }
      });
    }
  }

  async getFile(req: Request, res: Response) {
    try {
      const { fileId } = req.params;
      const file = await fileUploadService.getFileById(fileId);

      if (!file) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'FILE_NOT_FOUND',
            message: 'File not found'
          }
        });
      }

      res.json({
        success: true,
        data: file
      });
    } catch (error) {
      logger.error('Get file failed', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'FILE_ERROR',
          message: 'Failed to get file'
        }
      });
    }
  }

  async deleteFile(req: Request, res: Response) {
    try {
      const { fileId } = req.params;
      const userId = req.body.userId || req.headers['x-user-id'];

      await fileUploadService.deleteFile(fileId, userId as string);

      res.json({
        success: true,
        message: 'File deleted successfully'
      });
    } catch (error: any) {
      logger.error('Delete file failed', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'DELETE_FAILED',
          message: error.message || 'Failed to delete file'
        }
      });
    }
  }

  async generatePresignedUrl(req: Request, res: Response) {
    try {
      const { filename, contentType } = req.body;
      
      const key = s3Service.generateKey(filename);
      const presignedData = await s3Service.generatePresignedUrl(key, contentType);

      res.json({
        success: true,
        data: presignedData
      });
    } catch (error) {
      logger.error('Generate presigned URL failed', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'PRESIGNED_URL_ERROR',
          message: 'Failed to generate upload URL'
        }
      });
    }
  }
}

export const uploadController = new UploadController();
