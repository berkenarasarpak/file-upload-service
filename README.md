# File Upload Service

**Enterprise-grade file upload microservice** with virus scanning, image processing, cloud storage (S3), and real-time progress tracking via WebSocket.

## 🎯 Why This Impresses Recruiters

- **Security First** - ClamAV virus scanning, file type validation, SHA256 checksums
- **Cloud Native** - AWS S3 integration, CDN support, Docker containerization
- **Real-Time** - WebSocket progress updates, Redis caching
- **Production Ready** - Rate limiting, error handling, structured logging
- **Scalable Architecture** - PostgreSQL, Redis, Microservices pattern

## ✨ Features

### File Processing Pipeline
1. **Virus Scanning** - ClamAV integration, quarantine infected files
2. **Image Processing** - Sharp.js for resize/thumbnails/WebP optimization
3. **Cloud Upload** - AWS S3 with streaming upload and progress tracking
4. **Metadata Extraction** - Dimensions, EXIF, checksums

### Supported Files
- **Images:** JPEG, PNG, GIF, WebP (with automatic thumbnail generation)
- **Documents:** PDF, DOC, DOCX
- **Max Size:** 100MB per file
- **Max Files:** 10 per upload session

### Real-Time Features
- **WebSocket Progress** - Live upload status (0-100%)
- **Redis Caching** - Session state and progress tracking
- **Background Processing** - Non-blocking upload pipeline

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Client (Web/Mobile)                   │
└────────────────────────┬────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
┌───────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐
│   REST API   │  │  WebSocket  │  │ Direct S3   │
│  /api/v1/*   │  │  /ws        │  │ Presigned   │
└───────┬──────┘  └──────┬──────┘  └──────┬──────┘
        │                │                │
        └────────────────┼────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│              Express.js + TypeScript                      │
│  ┌────────────┬────────────┬────────────┬─────────────┐  │
│  │   Multer   │   Sharp    │  ClamAV   │ AWS SDK     │  │
│  │   Upload   │  Process   │   Scan    │ S3 Client   │  │
│  └────────────┴────────────┴────────────┴─────────────┘  │
└────────────────────────┬────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
┌───────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐
│  PostgreSQL  │  │    Redis    │  │    S3       │
│   (metadata) │  │  (progress) │  │  (storage)  │
└──────────────┘  └─────────────┘  └─────────────┘
```

## 📋 Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis 7+
- ClamAV (optional, for virus scanning)
- AWS S3 bucket (or local S3-compatible like MinIO)

## 🛠️ Installation

### 1. Clone & Install

```bash
git clone <repository-url>
cd file-upload-service
npm install
```

### 2. Setup Database

```bash
# Create PostgreSQL database
psql -U postgres -c "CREATE DATABASE fileupload;"

# Run schema
psql -U postgres -d fileupload -f database.sql
```

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env with your credentials
```

### 4. Start Services

```bash
# Start Redis
docker run -d -p 6379:6379 redis:7-alpine

# Start ClamAV (optional)
docker run -d -p 3310:3310 clamav/clamav:latest

# Start server
npm run dev
```

### 5. Docker Compose (Recommended)

```bash
docker-compose up -d
```

## 📡 API Endpoints

### Sessions
```http
POST /api/v1/sessions
Content-Type: application/json

{
  "userId": "user-123",
  "metadata": { "source": "web" }
}

Response:
{
  "success": true,
  "data": {
    "sessionId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### Upload Files
```http
POST /api/v1/upload/:sessionId
Content-Type: multipart/form-data

files: [File1, File2, ...]

Response:
{
  "success": true,
  "data": {
    "sessionId": "...",
    "totalFiles": 2,
    "successful": 2,
    "failed": 0,
    "files": [
      {
        "success": true,
        "file": {
          "id": "...",
          "originalName": "photo.jpg",
          "cdnUrl": "https://cdn.example.com/...",
          "status": "completed"
        }
      }
    ]
  }
}
```

### Check Progress
```http
GET /api/v1/files/:fileId/progress

Response:
{
  "success": true,
  "data": {
    "sessionId": "...",
    "fileId": "...",
    "progress": 75,
    "status": "processing",
    "stage": "Uploading to cloud storage..."
  }
}
```

### Presigned URL (Direct S3 Upload)
```http
POST /api/v1/presigned-url
Content-Type: application/json

{
  "filename": "large-video.mp4",
  "contentType": "video/mp4"
}

Response:
{
  "success": true,
  "data": {
    "url": "https://bucket.s3.amazonaws.com/...",
    "key": "uploads/1234567890-xyz-large-video.mp4",
    "expiresIn": 300
  }
}
```

## 🔌 WebSocket API

### Connect
```javascript
const ws = new WebSocket('ws://localhost:5000/ws?clientId=user-123');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data.type, data.data);
};
```

### Subscribe to File Progress
```javascript
ws.send(JSON.stringify({
  type: 'subscribe',
  fileId: '550e8400-e29b-41d4-a716-446655440000'
}));
```

### Progress Update Events
```javascript
{
  type: 'progress',
  data: {
    sessionId: '...',
    fileId: '...',
    progress: 65,
    status: 'processing',
    stage: 'Generating thumbnail...',
    timestamp: 1699012345678
  }
}
```

## 🔄 Processing Pipeline

```
┌─────────────┐
│   Upload    │ ← Multer saves to temp
└──────┬──────┘
       │
┌──────▼──────┐
│ Virus Scan  │ ← ClamAV (0-20%)
└──────┬──────┘
       │
┌──────▼──────┐
│  Process    │ ← Sharp resize (20-50%)
│   Image     │
└──────┬──────┘
       │
┌──────▼──────┐
│  Upload S3  │ ← Streaming upload (50-90%)
└──────┬──────┘
       │
┌──────▼──────┐
│  Complete   │ ← Save to DB (90-100%)
└─────────────┘
```

## 📁 Project Structure

```
file-upload-service/
├── src/
│   ├── config/           # Configuration
│   ├── controllers/      # Route handlers
│   ├── middleware/       # Upload middleware
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   │   ├── fileUpload.service.ts
│   │   ├── s3.service.ts
│   │   ├── virusScanner.service.ts
│   │   └── imageProcessor.service.ts
│   ├── types/           # TypeScript types
│   └── utils/           # Database, Redis, WebSocket
│       ├── database.ts
│       ├── redis.ts
│       └── websocket.ts
├── uploads/             # Temp upload directory
├── temp/                # Processing temp directory
├── database.sql         # PostgreSQL schema
├── docker-compose.yml   # Full stack setup
├── Dockerfile
└── README.md
```

## 🐳 Docker Compose Setup

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "5000:5000"
    environment:
      - DATABASE_URL=postgresql://postgres:password@db:5432/fileupload
      - REDIS_URL=redis://redis:6379
      - CLAMAV_HOST=clamav
    depends_on:
      - db
      - redis
      - clamav

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=fileupload
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine

  clamav:
    image: clamav/clamav:latest
    ports:
      - "3310:3310"

volumes:
  postgres_data:
```

## 🔐 Security Features

- **Virus Scanning:** All files scanned with ClamAV
- **File Type Validation:** Whitelist MIME types
- **Size Limits:** Configurable max file size
- **Checksum Verification:** SHA256 for integrity
- **Rate Limiting:** Prevent abuse (100 req/15min)
- **Helmet:** Security headers
- **CORS:** Configurable origin whitelist

## 📊 Database Schema

### files table
- Metadata (name, size, mime type)
- S3 storage paths
- Processing status
- Virus scan results
- Soft delete support

### upload_sessions table
- Session tracking
- Progress counters
- User association

### file_processing_queue table
- Background job queue
- Retry logic
- Priority support

## 🧪 Testing

```bash
# Install dependencies
npm install

# Run in dev mode
npm run dev

# Upload test
curl -X POST \
  -F "files=@test-image.jpg" \
  http://localhost:5000/api/v1/upload/test-session

# Check health
 curl http://localhost:5000/health
```

## 📈 Performance

- **Streaming Uploads:** Memory-efficient for large files
- **Redis Caching:** Fast progress lookups
- **Image Optimization:** WebP conversion reduces size by 30-80%
- **Thumbnail Generation:** 300x300 preview images
- **Parallel Processing:** Multiple files simultaneously

## 📝 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | - |
| `REDIS_URL` | Redis connection string | - |
| `AWS_S3_BUCKET` | S3 bucket name | - |
| `AWS_ACCESS_KEY_ID` | AWS credentials | - |
| `AWS_SECRET_ACCESS_KEY` | AWS credentials | - |
| `CLAMAV_HOST` | ClamAV server host | localhost |
| `MAX_FILE_SIZE` | Max upload size (bytes) | 104857600 |
| `UPLOAD_DIR` | Temp upload directory | ./uploads |

## 🚀 Deployment

### AWS EC2 + S3
```bash
# Build
docker build -t file-upload-service .

# Push to ECR
aws ecr push...

# Deploy with ECS/Fargate
```

### Kubernetes
```bash
kubectl apply -f k8s/
```

## 📄 License

MIT License - use this in your portfolio!

---

**Built for showcasing enterprise backend engineering skills**

- Node.js + TypeScript
- PostgreSQL + Redis
- AWS S3
- ClamAV Virus Scanning
- Sharp Image Processing
- WebSocket Real-Time
- Docker + Docker Compose
