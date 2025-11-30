import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import multer from 'multer';
import uploadRoutes from './routes/upload';
import imagesRoutes from './routes/images';
import syncRoutes from './routes/sync';
import foldersRoutes from './routes/folders';
import prisma from './db';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {

  next();
});

// Health check endpoint
app.get('/api/health', async (req: Request, res: Response) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      status: 'ok',
      message: 'Image Editor API is running',
      timestamp: new Date().toISOString(),
      database: 'connected',
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      message: 'Service unavailable',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
    });
  }
});

// API routes
app.use('/api/upload', uploadRoutes);
app.use('/api/images', imagesRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/folders', foldersRoutes);

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'Image Editor API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /api/health',
      upload: {
        single: 'POST /api/upload/single',
        multiple: 'POST /api/upload/multiple',
      },
      images: {
        list: 'GET /api/images',
        get: 'GET /api/images/:id',
        file: 'GET /api/images/:id/file',
        thumbnail: 'GET /api/images/:id/thumbnail',
        updateMetadata: 'PUT /api/images/:id/metadata',
        delete: 'DELETE /api/images/:id',
        stats: 'GET /api/images/stats/summary',
      },
      sync: {
        status: 'GET /api/sync/status',
        pull: 'POST /api/sync/pull',
        push: 'POST /api/sync/push',
        logs: 'GET /api/sync/logs',
      },
      folders: {
        list: 'GET /api/folders',
        create: 'POST /api/folders',
        update: 'PUT /api/folders/:id',
        delete: 'DELETE /api/folders/:id',
      }
    },
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  // Handle Multer errors
  if (err instanceof multer.MulterError) {
    console.error('Multer error:', err);
    return res.status(400).json({ error: err.message });
  }
  
  // Handle file filter errors
  if (err.message && err.message.includes('Invalid file type')) {
    console.error('File filter error:', err);
    return res.status(400).json({ error: err.message });
  }
  
  console.error('Unhandled error:', err);
  console.error('Error stack:', err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {

  await prisma.$disconnect();
  process.exit(0);
});

// Start server
app.listen(PORT, async () => {




  // Initialize Default Folder
  try {
    let defaultFolder = await prisma.folder.findFirst({
      where: { name: 'Default' }
    });

    if (!defaultFolder) {

      defaultFolder = await prisma.folder.create({
        data: { name: 'Default' }
      });

    }

    // Note: Existing images (e.g., sample images) will remain in root (folderId = null)
    // Only newly uploaded images will be assigned to Default folder
  } catch (error) {

  }
});

export default app;
