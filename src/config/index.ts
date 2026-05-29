import dotenv from 'dotenv';

dotenv.config();

export const config = {
  server: {
    port: parseInt(process.env.PORT || '5000'),
    wsPort: parseInt(process.env.WS_PORT || '8080'),
    env: process.env.NODE_ENV || 'development',
    apiKey: process.env.API_KEY || 'default-api-key',
    jwtSecret: process.env.JWT_SECRET || 'default-jwt-secret'
  },
  
  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/fileupload'
  },
  
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  },
  
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    bucket: process.env.AWS_S3_BUCKET || '',
    endpoint: process.env.AWS_S3_ENDPOINT,
    forcePathStyle: process.env.NODE_ENV === 'development'
  },
  
  clamav: {
    host: process.env.CLAMAV_HOST || 'localhost',
    port: parseInt(process.env.CLAMAV_PORT || '3310'),
    timeout: parseInt(process.env.CLAMAV_TIMEOUT || '60000')
  },
  
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '104857600'), // 100MB
    maxFilesPerUpload: parseInt(process.env.MAX_FILES_PER_UPLOAD || '10'),
    allowedMimeTypes: (process.env.ALLOWED_MIME_TYPES || 
      'image/jpeg,image/png,image/gif,image/webp,application/pdf').split(','),
    uploadDir: process.env.UPLOAD_DIR || './uploads',
    tempDir: process.env.TEMP_DIR || './temp'
  },
  
  cdn: {
    baseUrl: process.env.CDN_BASE_URL || ''
  },
  
  processing: {
    thumbnail: {
      width: 300,
      height: 300,
      quality: 80,
      fit: 'cover' as const
    },
    image: {
      maxWidth: 2048,
      maxHeight: 2048,
      quality: 90
    }
  },
  
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
  }
};

export default config;
