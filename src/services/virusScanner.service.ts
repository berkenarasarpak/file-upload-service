import NodeClam from 'clamscan';
import { createReadStream } from 'fs';
import config from '../config';
import logger from '../utils/logger';
import { VirusScanResult } from '../types';

class VirusScannerService {
  private clamscan: NodeClam | null = null;
  private isInitialized = false;

  async initialize(): Promise<void> {
    try {
      this.clamscan = await new NodeClam().init({
        clamdscan: {
          host: config.clamav.host,
          port: config.clamav.port,
          timeout: config.clamav.timeout,
          localFallback: true
        },
        preference: 'clamdscan'
      });
      
      this.isInitialized = true;
      logger.info('ClamAV scanner initialized');
    } catch (error) {
      logger.error('Failed to initialize ClamAV', error);
      this.isInitialized = false;
      // Don't throw - allow service to work without virus scanning in dev
    }
  }

  async scanFile(filePath: string): Promise<VirusScanResult> {
    if (!this.isInitialized || !this.clamscan) {
      logger.warn('ClamAV not initialized, skipping scan');
      return {
        isInfected: false,
        viruses: [],
        scannedAt: new Date()
      };
    }

    try {
      const stream = createReadStream(filePath);
      const result = await this.clamscan.scanStream(stream);

      const scanResult: VirusScanResult = {
        isInfected: result.isInfected,
        viruses: result.viruses || [],
        scannedAt: new Date(),
        scannerVersion: result.version
      };

      if (result.isInfected) {
        logger.warn('Virus detected', { 
          filePath, 
          viruses: result.viruses 
        });
      } else {
        logger.info('File is clean', { filePath });
      }

      return scanResult;
    } catch (error) {
      logger.error('Virus scan failed', { filePath, error });
      return {
        isInfected: false,
        viruses: [],
        scannedAt: new Date()
      };
    }
  }

  async scanBuffer(buffer: Buffer): Promise<VirusScanResult> {
    if (!this.isInitialized || !this.clamscan) {
      return {
        isInfected: false,
        viruses: [],
        scannedAt: new Date()
      };
    }

    try {
      const result = await this.clamscan.scanBuffer(buffer);

      return {
        isInfected: result.isInfected,
        viruses: result.viruses || [],
        scannedAt: new Date(),
        scannerVersion: result.version
      };
    } catch (error) {
      logger.error('Buffer scan failed', error);
      return {
        isInfected: false,
        viruses: [],
        scannedAt: new Date()
      };
    }
  }

  isReady(): boolean {
    return this.isInitialized;
  }
}

export const virusScanner = new VirusScannerService();
export default virusScanner;
