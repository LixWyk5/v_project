import { Router, Request, Response } from 'express';
import prisma from '../db';

const router = Router();

// Get sync status
router.get('/status', async (req: Request, res: Response) => {
    try {
        // Get counts
        const localCount = await prisma.image.count({
            where: { source: 'local' },
        });

        const serverCount = await prisma.image.count({
            where: { source: 'server' },
        });

        const totalCount = await prisma.image.count();

        // Get last sync time
        const lastSync = await prisma.syncLog.findFirst({
            where: { action: 'sync' },
            orderBy: { timestamp: 'desc' },
        });

        // Get recent sync logs
        const recentLogs = await prisma.syncLog.findMany({
            orderBy: { timestamp: 'desc' },
            take: 10,
        });

        res.json({
            status: 'ok',
            localImages: localCount,
            serverImages: serverCount,
            totalImages: totalCount,
            lastSyncTime: lastSync?.timestamp || null,
            recentLogs,
        });
    } catch (error: any) {

        res.status(500).json({ error: 'Failed to check sync status', details: error.message });
    }
});

// Pull from server with conflict resolution
router.post('/pull', async (req: Request, res: Response) => {
    try {
        const strategy = req.body.strategy || 'last_write_wins'; // Default to Last Write Wins
        const details = req.body.details || {}; // Detailed image lists from frontend
        
        // In a real implementation, this would fetch from a remote server
        // For now, we'll simulate by checking for server-sourced images

        const serverImages = await prisma.image.findMany({
            where: { source: 'server' },
        });

        const localImages = await prisma.image.findMany({
            where: { source: 'local' },
        });

        let conflictsResolved = 0;
        let pulledCount = 0;
        const conflictDetails: any[] = [];

        // Conflict resolution based on selected strategy
        for (const serverImage of serverImages) {
            const localMatch = localImages.find(
                img => img.originalName === serverImage.originalName || img.filename === serverImage.filename
            );

            if (localMatch) {
                // Conflict detected
                conflictsResolved++;
                const serverTime = new Date(serverImage.lastModified).getTime();
                const localTime = new Date(localMatch.lastModified).getTime();

                let shouldUseServer = false;
                let resolution = '';

                switch (strategy) {
                    case 'server_always_wins':
                        shouldUseServer = true;
                        resolution = 'server_wins';
                        break;
                    case 'local_always_wins':
                        shouldUseServer = false;
                        resolution = 'local_wins';
                        break;
                    case 'last_write_wins':
                    default:
                        shouldUseServer = serverTime > localTime;
                        resolution = shouldUseServer ? 'server_wins' : 'local_wins';
                        break;
                }

                if (shouldUseServer) {
                    // Update local with server version
                    await prisma.image.update({
                        where: { id: localMatch.id },
                        data: {
                            filename: serverImage.filename,
                            originalName: serverImage.originalName,
                            filePath: serverImage.filePath,
                            thumbnailPath: serverImage.thumbnailPath,
                            fileSize: serverImage.fileSize,
                            format: serverImage.format,
                            width: serverImage.width,
                            height: serverImage.height,
                            isCorrupted: serverImage.isCorrupted,
                            source: 'local', // Keep as local after sync
                            folderId: serverImage.folderId,
                            metadata: serverImage.metadata || undefined,
                            lastModified: serverImage.lastModified,
                        },
                    });
                }

                conflictDetails.push({
                    filename: serverImage.originalName,
                    resolution,
                    strategy,
                    serverTime: serverImage.lastModified,
                    localTime: localMatch.lastModified,
                });
            } else {
                // No conflict - new image from server
                pulledCount++;
            }
        }

        // Log sync action with conflict details
        const strategyNames: Record<string, string> = {
            'last_write_wins': 'Last Write Wins',
            'server_always_wins': 'Server Always Wins',
            'local_always_wins': 'Local Always Wins',
        };

        // Ensure we always save the image lists, even if they're empty
        const pullLogDetails = {
            type: 'pull',
            imagesCount: serverImages.length,
            pulledCount,
            conflictsResolved,
            conflictDetails,
            strategy: strategyNames[strategy] || strategy,
            message: `Pulled images from server with ${strategyNames[strategy] || strategy} strategy`,
            downloadedImages: Array.isArray(details.downloadedImages) ? details.downloadedImages : [],
            updatedImages: Array.isArray(details.updatedImages) ? details.updatedImages : [],
            deletedImages: Array.isArray(details.deletedImages) ? details.deletedImages : [],
        };
        
        console.log('[Sync Pull] Saving log details:', JSON.stringify(pullLogDetails, null, 2));
        
        await prisma.syncLog.create({
            data: {
                action: 'sync',
                status: 'success',
                details: pullLogDetails,
            },
        });

        res.json({
            message: 'Sync completed successfully',
            pulledImages: pulledCount,
            conflictsResolved,
            conflictDetails,
            strategy: strategyNames[strategy] || strategy,
        });
    } catch (error: any) {


        await prisma.syncLog.create({
            data: {
                action: 'sync',
                status: 'failed',
                details: { error: error.message },
            },
        });

        res.status(500).json({ error: 'Failed to sync from server', details: error.message });
    }
});

// Push to server with conflict resolution
router.post('/push', async (req: Request, res: Response) => {
    try {
        const strategy = req.body.strategy || 'last_write_wins'; // Default to Last Write Wins
        const details = req.body.details || {}; // Detailed image lists from frontend
        
        const localImages = await prisma.image.findMany({
            where: { source: 'local' },
        });

        const serverImages = await prisma.image.findMany({
            where: { source: 'server' },
        });

        let conflictsResolved = 0;
        let pushedCount = 0;
        const conflictDetails: any[] = [];

        // Conflict resolution based on selected strategy
        for (const localImage of localImages) {
            const serverMatch = serverImages.find(
                img => img.originalName === localImage.originalName || img.filename === localImage.filename
            );

            if (serverMatch) {
                // Conflict detected
                conflictsResolved++;
                const localTime = new Date(localImage.lastModified).getTime();
                const serverTime = new Date(serverMatch.lastModified).getTime();

                let shouldUseLocal = false;
                let resolution = '';

                switch (strategy) {
                    case 'server_always_wins':
                        shouldUseLocal = false;
                        resolution = 'server_wins';
                        break;
                    case 'local_always_wins':
                        shouldUseLocal = true;
                        resolution = 'local_wins';
                        break;
                    case 'last_write_wins':
                    default:
                        shouldUseLocal = localTime > serverTime;
                        resolution = shouldUseLocal ? 'local_wins' : 'server_wins';
                        break;
                }

                if (shouldUseLocal) {
                    // Update server with local version
                    await prisma.image.update({
                        where: { id: serverMatch.id },
                        data: {
                            filename: localImage.filename,
                            originalName: localImage.originalName,
                            filePath: localImage.filePath,
                            thumbnailPath: localImage.thumbnailPath,
                            fileSize: localImage.fileSize,
                            format: localImage.format,
                            width: localImage.width,
                            height: localImage.height,
                            isCorrupted: localImage.isCorrupted,
                            source: 'server', // Keep as server
                            folderId: localImage.folderId,
                            metadata: localImage.metadata || undefined,
                            lastModified: localImage.lastModified,
                        },
                    });
                }

                conflictDetails.push({
                    filename: localImage.originalName,
                    resolution,
                    strategy,
                    localTime: localImage.lastModified,
                    serverTime: serverMatch.lastModified,
                });
            } else {
                // No conflict - new image to push
                pushedCount++;
            }
        }

        // In a real implementation, this would push to a remote server
        // For now, we'll just log the action with conflict details

        const strategyNames: Record<string, string> = {
            'last_write_wins': 'Last Write Wins',
            'server_always_wins': 'Server Always Wins',
            'local_always_wins': 'Local Always Wins',
        };

        console.log('[Sync Push] Received req.body:', JSON.stringify(req.body, null, 2));
        console.log('[Sync Push] Received details:', JSON.stringify(details, null, 2));
        console.log('[Sync Push] Uploaded images:', details.uploadedImages);
        console.log('[Sync Push] Updated images:', details.updatedImages);
        console.log('[Sync Push] Deleted images:', details.deletedImages);
        
        // Ensure we always save the image lists, even if they're empty
        const logDetails = {
            type: 'push',
            imagesCount: localImages.length,
            pushedCount,
            conflictsResolved,
            conflictDetails,
            strategy: strategyNames[strategy] || strategy,
            message: `Pushed images to server with ${strategyNames[strategy] || strategy} strategy`,
            uploadedImages: Array.isArray(details.uploadedImages) ? details.uploadedImages : [],
            updatedImages: Array.isArray(details.updatedImages) ? details.updatedImages : [],
            deletedImages: Array.isArray(details.deletedImages) ? details.deletedImages : [],
        };
        
        console.log('[Sync Push] Saving log details:', JSON.stringify(logDetails, null, 2));
        
        await prisma.syncLog.create({
            data: {
                action: 'sync',
                status: 'success',
                details: logDetails,
            },
        });

        res.json({
            message: 'Push completed successfully',
            pushedImages: pushedCount,
            conflictsResolved,
            conflictDetails,
            strategy: strategyNames[strategy] || strategy,
        });
    } catch (error: any) {


        await prisma.syncLog.create({
            data: {
                action: 'sync',
                status: 'failed',
                details: { error: error.message },
            },
        });

        res.status(500).json({ error: 'Failed to push to server', details: error.message });
    }
});

// Get sync logs
router.get('/logs', async (req: Request, res: Response) => {
    try {
        const limit = parseInt(req.query.limit as string) || 50;

        const logs = await prisma.syncLog.findMany({
            orderBy: { timestamp: 'desc' },
            take: limit,
            include: {
                image: {
                    select: {
                        id: true,
                        originalName: true,
                        filename: true,
                    },
                },
            },
        });

        res.json({ logs });
    } catch (error: any) {

        res.status(500).json({ error: 'Failed to fetch sync logs', details: error.message });
    }
});

export default router;
