import sharp from 'sharp';
import path from 'path';
import { promises as fs } from 'fs';
import config from '../config';
import logger from '../utils/logger';
import { ImageDimensions, ThumbnailOptions } from '../types';

class ImageProcessorService {
  async getDimensions(imagePath: string): Promise<ImageDimensions> {
    const metadata = await sharp(imagePath).metadata();
    return {
      width: metadata.width || 0,
      height: metadata.height || 0
    };
  }

  async resize(
    inputPath: string, 
    outputPath: string, 
    options: { width?: number; height?: number; quality?: number }
  ): Promise<void> {
    try {
      const { width, height, quality = config.processing.image.quality } = options;
      
      await sharp(inputPath)
        .resize(width, height, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality, progressive: true })
        .toFile(outputPath);

      logger.info('Image resized', { inputPath, outputPath, width, height });
    } catch (error) {
      logger.error('Image resize failed', { inputPath, error });
      throw error;
    }
  }

  async generateThumbnail(
    inputPath: string,
    outputDir: string,
    options: ThumbnailOptions = config.processing.thumbnail
  ): Promise<string> {
    try {
      const fileName = path.basename(inputPath, path.extname(inputPath));
      const thumbnailPath = path.join(outputDir, `${fileName}-thumb.jpg`);

      await sharp(inputPath)
        .resize(options.width, options.height, {
          fit: options.fit,
          position: 'center'
        })
        .jpeg({ 
          quality: options.quality, 
          progressive: true 
        })
        .toFile(thumbnailPath);

      logger.info('Thumbnail generated', { 
        inputPath, 
        thumbnailPath,
        width: options.width,
        height: options.height 
      });

      return thumbnailPath;
    } catch (error) {
      logger.error('Thumbnail generation failed', { inputPath, error });
      throw error;
    }
  }

  async optimizeForWeb(inputPath: string, outputPath: string): Promise<void> {
    try {
      const metadata = await sharp(inputPath).metadata();
      
      let pipeline = sharp(inputPath);
      
      // Resize if too large
      if ((metadata.width && metadata.width > config.processing.image.maxWidth) ||
          (metadata.height && metadata.height > config.processing.image.maxHeight)) {
        pipeline = pipeline.resize(
          config.processing.image.maxWidth,
          config.processing.image.maxHeight,
          { fit: 'inside', withoutEnlargement: true }
        );
      }

      // Convert to WebP for better compression
      await pipeline
        .webp({ 
          quality: config.processing.image.quality,
          effort: 6
        })
        .toFile(outputPath);

      logger.info('Image optimized', { inputPath, outputPath });
    } catch (error) {
      logger.error('Image optimization failed', { inputPath, error });
      throw error;
    }
  }

  async extractMetadata(imagePath: string): Promise<Record<string, any>> {
    try {
      const metadata = await sharp(imagePath).metadata();
      return {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: metadata.size,
        hasAlpha: metadata.hasAlpha,
        density: metadata.density,
        space: metadata.space,
        channels: metadata.channels,
        depth: metadata.depth,
        exif: metadata.exif ? 'present' : 'absent',
        icc: metadata.icc ? 'present' : 'absent',
        iptc: metadata.iptc ? 'present' : 'absent',
        xmp: metadata.xmp ? 'present' : 'absent'
      };
    } catch (error) {
      logger.error('Metadata extraction failed', { imagePath, error });
      return {};
    }
  }

  isImage(mimeType: string): boolean {
    return mimeType.startsWith('image/');
  }

  isValidImage(imagePath: string): Promise<boolean> {
    return sharp(imagePath)
      .metadata()
      .then(() => true)
      .catch(() => false);
  }
}

export const imageProcessor = new ImageProcessorService();
export default imageProcessor;
