import { Router } from 'express';
import { uploadController } from '../controllers/upload.controller';
import { uploadMiddleware, handleMulterError } from '../middleware/upload.middleware';

const router = Router();

// Session management
router.post('/sessions', uploadController.createSession);
router.get('/sessions/:sessionId/status', uploadController.getSessionStatus);

// File upload
router.post(
  '/upload/:sessionId',
  uploadMiddleware.array('files', 10),
  handleMulterError,
  uploadController.uploadFiles
);

// Direct S3 upload (for large files)
router.post('/presigned-url', uploadController.generatePresignedUrl);

// File management
router.get('/files/:fileId', uploadController.getFile);
router.get('/files/:fileId/progress', uploadController.getProgress);
router.delete('/files/:fileId', uploadController.deleteFile);

export default router;
