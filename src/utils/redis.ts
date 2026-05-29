import Redis from 'ioredis';
import config from '../config';
import logger from './logger';

const redis = new Redis(config.redis.url, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  }
});

redis.on('connect', () => {
  logger.info('Redis connected');
});

redis.on('error', (err) => {
  logger.error('Redis error', err);
});

export class UploadProgressTracker {
  private readonly prefix = 'upload:progress:';
  private readonly sessionPrefix = 'upload:session:';
  private readonly expiry = 3600; // 1 hour

  async setProgress(
    sessionId: string, 
    fileId: string, 
    progress: number,
    status: string,
    stage: string,
    message?: string
  ): Promise<void> {
    const key = `${this.prefix}${fileId}`;
    const data = JSON.stringify({
      sessionId,
      fileId,
      progress,
      status,
      stage,
      message,
      timestamp: Date.now()
    });
    await redis.setex(key, this.expiry, data);
  }

  async getProgress(fileId: string): Promise<any | null> {
    const key = `${this.prefix}${fileId}`;
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  async setSessionStatus(
    sessionId: string, 
    status: any
  ): Promise<void> {
    const key = `${this.sessionPrefix}${sessionId}`;
    await redis.setex(key, this.expiry, JSON.stringify(status));
  }

  async getSessionStatus(sessionId: string): Promise<any | null> {
    const key = `${this.sessionPrefix}${sessionId}`;
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  async deleteProgress(fileId: string): Promise<void> {
    await redis.del(`${this.prefix}${fileId}`);
  }

  async incrementSessionCounter(
    sessionId: string, 
    field: 'completed' | 'failed'
  ): Promise<number> {
    const key = `${this.sessionPrefix}${sessionId}:counter`;
    return await redis.hincrby(key, field, 1);
  }

  async getSessionCounters(sessionId: string): Promise<{completed: number, failed: number}> {
    const key = `${this.sessionPrefix}${sessionId}:counter`;
    const counters = await redis.hgetall(key);
    return {
      completed: parseInt(counters.completed || '0'),
      failed: parseInt(counters.failed || '0')
    };
  }
}

export const progressTracker = new UploadProgressTracker();
export default redis;
