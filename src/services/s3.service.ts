import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import path from 'path';
import config from '../config';
import logger from '../utils/logger';
import { S3UploadResult, PresignedUrlResponse } from '../types';

class S3Service {
  private client: S3Client;
  private bucket: string;

  constructor() {
    this.client = new S3Client({
      region: config.aws.region,
      credentials: {
        accessKeyId: config.aws.accessKeyId,
        secretAccessKey: config.aws.secretAccessKey
      },
      endpoint: config.aws.endpoint,
      forcePathStyle: config.aws.forcePathStyle
    });
    this.bucket = config.aws.bucket;
  }

  async uploadFile(
    localPath: string, 
    key: string,
    contentType: string,
    onProgress?: (progress: number) => void
  ): Promise<S3UploadResult> {
    try {
      const fileStream = createReadStream(localPath);
      const stats = await stat(localPath);
      const fileSize = stats.size;

      // Track upload progress
      let uploadedBytes = 0;
      if (onProgress) {
        fileStream.on('data', (chunk) => {
          uploadedBytes += chunk.length;
          const progress = Math.round((uploadedBytes / fileSize) * 100);
          onProgress(progress);
        });
      }

      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: fileStream,
        ContentType: contentType,
        Metadata: {
          'original-name': path.basename(localPath),
          'uploaded-at': new Date().toISOString()
        }
      });

      const result = await this.client.send(command);

      logger.info('File uploaded to S3', { 
        key, 
        bucket: this.bucket,
        size: fileSize,
        etag: result.ETag 
      });

      return {
        key,
        bucket: this.bucket,
        location: `https://${this.bucket}.s3.${config.aws.region}.amazonaws.com/${key}`,
        etag: result.ETag || '',
        size: fileSize
      };
    } catch (error) {
      logger.error('S3 upload failed', { key, error });
      throw error;
    }
  }

  async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key
      });

      await this.client.send(command);
      logger.info('File deleted from S3', { key, bucket: this.bucket });
    } catch (error) {
      logger.error('S3 delete failed', { key, error });
      throw error;
    }
  }

  async generatePresignedUrl(
    key: string, 
    contentType: string,
    expiresIn: number = 300
  ): Promise<PresignedUrlResponse> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType
      });

      const url = await getSignedUrl(this.client, command, { expiresIn });

      return {
        url,
        key,
        expiresIn
      };
    } catch (error) {
      logger.error('Presigned URL generation failed', { key, error });
      throw error;
    }
  }

  generateKey(originalName: string, folder: string = 'uploads'): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const extension = path.extname(originalName);
    const baseName = path.basename(originalName, extension)
      .replace(/[^a-zA-Z0-9]/g, '-')
      .substring(0, 50);
    
    return `${folder}/${timestamp}-${random}-${baseName}${extension}`;
  }

  generateThumbnailKey(originalKey: string): string {
    const extension = path.extname(originalKey);
    const baseName = originalKey.substring(0, originalKey.lastIndexOf('.'));
    return `${baseName}-thumb${extension}`;
  }

  getCdnUrl(key: string): string {
    if (config.cdn.baseUrl) {
      return `${config.cdn.baseUrl}/${key}`;
    }
    return `https://${this.bucket}.s3.${config.aws.region}.amazonaws.com/${key}`;
  }
}

export const s3Service = new S3Service();
export default s3Service;
