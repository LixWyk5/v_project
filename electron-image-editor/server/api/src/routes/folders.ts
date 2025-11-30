import { Router, Request, Response } from 'express';
import prisma from '../db';

const router = Router();

// Get all folders (flat list for now, hierarchy can be built on frontend)
router.get('/', async (req: Request, res: Response) => {
    try {
        const folders = await prisma.folder.findMany({
            orderBy: { name: 'asc' },
            include: {
                _count: {
                    select: { images: true }
                }
            }
        });
        res.json(folders);
    } catch (error: any) {

        res.status(500).json({ error: 'Failed to fetch folders', details: error.message });
    }
});

// Create folder
router.post('/', async (req: Request, res: Response) => {
    try {
        const { name, parentId } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Folder name is required' });
        }

        const folder = await prisma.folder.create({
            data: {
                name,
                parentId: parentId ? parseInt(parentId) : null
            }
        });

        res.json(folder);
    } catch (error: any) {

        res.status(500).json({ error: 'Failed to create folder', details: error.message });
    }
});

// Update folder (rename/move)
router.put('/:id', async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        const { name, parentId } = req.body;

        const folder = await prisma.folder.update({
            where: { id },
            data: {
                name,
                parentId: parentId !== undefined ? (parentId ? parseInt(parentId) : null) : undefined
            }
        });

        res.json(folder);
    } catch (error: any) {

        res.status(500).json({ error: 'Failed to update folder', details: error.message });
    }
});

// Delete folder
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id);

        // Check if folder has images or subfolders
        const folder = await prisma.folder.findUnique({
            where: { id },
            include: {
                _count: {
                    select: { images: true, children: true }
                }
            }
        });

        if (!folder) {
            return res.status(404).json({ error: 'Folder not found' });
        }

        if (folder._count.images > 0 || folder._count.children > 0) {
            // For simplicity, prevent deletion if not empty for now
            // Or we could implement cascade delete or move to root
            return res.status(400).json({ error: 'Cannot delete non-empty folder' });
        }

        await prisma.folder.delete({
            where: { id }
        });

        res.json({ message: 'Folder deleted successfully' });
    } catch (error: any) {

        res.status(500).json({ error: 'Failed to delete folder', details: error.message });
    }
});

export default router;
