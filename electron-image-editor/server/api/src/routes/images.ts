import { Router, Request, Response } from "express";
import prisma from "../db";
import fs from "fs/promises";
import path from "path";
import { getExifData, generateThumbnail } from "../utils/imageUtils";

const router = Router();

// Get all images with pagination and filters
router.get("/", async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 100;
    const format = req.query.format as string;
    const source = req.query.source as string;
    const search = req.query.search as string;
    const folderId = req.query.folderId as string;
    const status = req.query.status as string; // 'all', 'normal', 'corrupted'
    const hasExif = req.query.hasExif as string; // 'true' to filter images with EXIF data
    console.log('[GET /images] Query params:', { format, status, hasExif, page, limit, folderId, search, source });

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    // Handle format filter: jpg should match both 'jpg' and 'jpeg', tif should match both 'tif' and 'tiff'
    if (format) {
      const lowerFormat = format.toLowerCase();
      console.log(`[GET /images] Processing format filter: '${format}' (lower: '${lowerFormat}')`);

      if (lowerFormat === 'jpg') {
        console.log('[GET /images] Applying JPG/JPEG filter (extension only)');
        where.OR = [
          { filename: { endsWith: '.jpg', mode: 'insensitive' } },
          { filename: { endsWith: '.jpeg', mode: 'insensitive' } }
        ];
      } else if (lowerFormat === 'tif') {
        console.log('[GET /images] Applying TIF/TIFF filter (extension only)');
        where.OR = [
          { filename: { endsWith: '.tif', mode: 'insensitive' } },
          { filename: { endsWith: '.tiff', mode: 'insensitive' } }
        ];
      } else if (lowerFormat === 'png') {
        console.log('[GET /images] Applying PNG filter (extension only)');
        where.OR = [
          { filename: { endsWith: '.png', mode: 'insensitive' } }
        ];
      } else {
        console.log(`[GET /images] Applying simple format filter: ${format}`);
        where.format = format;
      }
    }
    if (source) where.source = source;
    if (search) {
      // If we already have OR from format filter, we need to combine them
      if (where.OR) {
        // Combine format OR with search OR
        const formatOr = where.OR;
        delete where.OR;
        where.AND = [
          { OR: formatOr },
          {
            OR: [
              { originalName: { contains: search, mode: "insensitive" } },
              { filename: { contains: search, mode: "insensitive" } },
            ]
          }
        ];
      } else {
        where.OR = [
          { originalName: { contains: search, mode: "insensitive" } },
          { filename: { contains: search, mode: "insensitive" } },
        ];
      }
    }

    // Filter by status (corrupted/normal)
    if (status === "corrupted") {
      where.isCorrupted = true;
    } else if (status === "normal") {
      where.isCorrupted = false;
    }

    // Filter by EXIF data presence
    // Note: Prisma JSON filtering is limited, so we'll filter after fetching
    // This flag will be used to filter results in memory

    // Filter by folder
    if (folderId !== undefined && folderId !== null && folderId !== "") {
      // If folderId is explicitly 'null' string, show all images
      if (folderId !== "null") {
        // Filter by specific folder
        where.folderId = parseInt(folderId);
      }
    }

    console.log('[GET /images] Where clause:', JSON.stringify(where, null, 2));
    // Get total count
    // If filtering by EXIF, we need to count after filtering
    let total: number;
    if (hasExif === "true") {
      // For EXIF filter, we need to count all matching images first, then filter
      const whereForExif = { ...where };
      delete whereForExif.metadata;

      const allMatchingImages = await prisma.image.findMany({
        where: whereForExif,
        take: 1000, // Limit to reasonable number for counting
      });
      const filteredImages = allMatchingImages.filter((img) => {
        const metadata = img.metadata as any;
        if (!metadata || !metadata.exif) return false;
        const exif = metadata.exif;
        return !!(exif.make || exif.model || exif.dateTimeOriginal ||
          exif.iso || exif.fNumber || exif.exposureTime ||
          exif.focalLength || exif.gpsLatitude || exif.gpsLongitude ||
          exif.software);
      });
      total = filteredImages.length;
    } else {
      total = await prisma.image.count({ where });
    }

    // Get images first (we'll filter by EXIF in memory if needed)
    let images: any[] = [];
    if (hasExif === "true") {
      // For EXIF filter, fetch all matching images (without metadata filter in where clause)
      // We need to remove metadata-related filters from where clause
      const whereForExif = { ...where };
      // Remove any metadata filters that might interfere
      delete whereForExif.metadata;

      // Fetch a larger batch to filter in memory
      const allMatchingImages = await prisma.image.findMany({
        where: whereForExif,
        skip: 0,
        take: 1000, // Fetch up to 1000 images for filtering
        orderBy: { uploadDate: "desc" },
      });

      // Filter by EXIF data presence
      images = allMatchingImages.filter((img) => {
        const metadata = img.metadata as any;
        if (!metadata || !metadata.exif) return false;
        const exif = metadata.exif;
        // Check if exif has any meaningful content
        const hasContent = !!(exif.make || exif.model || exif.dateTimeOriginal ||
          exif.iso || exif.fNumber || exif.exposureTime ||
          exif.focalLength || exif.gpsLatitude || exif.gpsLongitude ||
          exif.software);
        return hasContent;
      });

      // Apply pagination after filtering
      images = images.slice(skip, skip + limit);
    } else {
      // Normal fetch without EXIF filter
      images = await prisma.image.findMany({
        where,
        skip,
        take: limit,
        orderBy: { uploadDate: "desc" },
      });
    }

    // Check and regenerate thumbnails for all images (in parallel for better performance)
    const thumbnailDir = path.join(__dirname, "../../thumbnails");
    await Promise.all(images.map(async (img) => {
      try {
        // Skip corrupted images or if file doesn't exist
        if (img.isCorrupted || !img.filePath) {
          return;
        }

        // Check if thumbnail exists and is accessible
        let thumbnailExists = false;
        if (img.thumbnailPath) {
          try {
            await fs.access(img.thumbnailPath);
            thumbnailExists = true;
          } catch {
            // Thumbnail file doesn't exist
            thumbnailExists = false;
          }
        }

        // Check if original image file exists
        let imageExists = false;
        try {
          await fs.access(img.filePath);
          imageExists = true;
        } catch {
          // Image file doesn't exist, skip thumbnail generation
          return;
        }

        // Regenerate thumbnail if it doesn't exist or is missing
        if (!thumbnailExists && imageExists) {
          try {
            const newThumbnailPath = await generateThumbnail(
              img.filePath,
              thumbnailDir,
              img.filename
            );

            // Update database with new thumbnail path
            await prisma.image.update({
              where: { id: img.id },
              data: { thumbnailPath: newThumbnailPath },
            });

            // Update the image object for response
            img.thumbnailPath = newThumbnailPath;
            console.log(`[GET /images] Regenerated thumbnail for image ${img.id}: ${img.filename}`);
          } catch (thumbError: any) {
            console.error(`[GET /images] Failed to regenerate thumbnail for image ${img.id}: ${thumbError.message}`);
            // Continue with other images even if one fails
          }
        }
      } catch (error: any) {
        console.error(`[GET /images] Error checking thumbnail for image ${img.id}: ${error.message}`);
        // Continue with other images even if one fails
      }
    }));

    // Convert BigInt to string for JSON serialization
    const serializedImages = images.map((img) => ({
      ...img,
      fileSize: img.fileSize.toString(),
    }));

    // Log result statistics
    const corruptedCount = serializedImages.filter(img => img.isCorrupted).length;
    const normalCount = serializedImages.filter(img => !img.isCorrupted).length;
    console.log(`[GET /images] Returning ${serializedImages.length} images (${normalCount} normal, ${corruptedCount} corrupted)`);

    res.json({
      images: serializedImages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    res
      .status(500)
      .json({ error: "Failed to fetch images", details: error.message });
  }
});

// Get single image by ID
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);

    const image = await prisma.image.findUnique({
      where: { id },
      include: {
        syncLogs: {
          orderBy: { timestamp: "desc" },
          take: 10,
        },
      },
    });

    if (!image) {
      return res.status(404).json({ error: "Image not found" });
    }

    // Get EXIF data if requested
    let exifData = null;
    if (req.query.includeExif === "true") {
      // First try to get EXIF from database (updated EXIF)
      if (image.metadata && typeof image.metadata === 'object' && 'exif' in image.metadata) {
        exifData = (image.metadata as any).exif;
      }
      // If no EXIF in database, try from file (original EXIF)
      if (!exifData || Object.keys(exifData).length === 0) {
        try {
          exifData = await getExifData(image.filePath);
        } catch (error) {
          // If file read fails, keep exifData as null
          exifData = null;
        }
      }
    }

    res.json({
      ...image,
      fileSize: image.fileSize.toString(),
      exif: exifData,
    });
  } catch (error: any) {
    res
      .status(500)
      .json({ error: "Failed to fetch image", details: error.message });
  }
});

// Get EXIF data for image
router.get("/:id/exif", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);

    const image = await prisma.image.findUnique({
      where: { id },
    });

    if (!image) {
      return res.status(404).json({ error: "Image not found" });
    }

    // First try to get EXIF from database (updated EXIF)
    let exifData = null;
    if (image.metadata && typeof image.metadata === 'object' && 'exif' in image.metadata) {
      exifData = (image.metadata as any).exif;
    }

    // If no EXIF in database, try from file (original EXIF)
    if (!exifData || Object.keys(exifData).length === 0) {
      try {
        exifData = await getExifData(image.filePath);
      } catch (error) {
        // If file read fails, keep exifData as null
        exifData = null;
      }
    }

    res.json({
      imageId: id,
      exif: exifData,
    });
  } catch (error: any) {
    res
      .status(500)
      .json({ error: "Failed to fetch EXIF data", details: error.message });
  }
});

// Get image file
router.get("/:id/file", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);

    const image = await prisma.image.findUnique({
      where: { id },
    });

    if (!image) {
      return res.status(404).json({ error: "Image not found" });
    }

    // Verify file exists before serving
    try {
      await fs.access(image.filePath);
    } catch (err: any) {
      return res.status(404).json({ 
        error: "Image file not found", 
        details: `File path: ${image.filePath}. The file may have been moved or deleted.` 
      });
    }

    res.sendFile(path.resolve(image.filePath));
  } catch (error: any) {
    res
      .status(500)
      .json({ error: "Failed to serve image", details: error.message });
  }
});

// Get thumbnail
router.get("/:id/thumbnail", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);

    const image = await prisma.image.findUnique({
      where: { id },
    });

    if (!image) {
      return res.status(404).json({ error: "Image not found" });
    }

    // If thumbnail doesn't exist, try to regenerate it
    if (!image.thumbnailPath) {
      // Try to regenerate thumbnail if original file exists
      if (image.filePath && !image.isCorrupted) {
        try {
          await fs.access(image.filePath);
          const thumbnailDir = path.join(__dirname, "../../thumbnails");
          const newThumbnailPath = await generateThumbnail(
            image.filePath,
            thumbnailDir,
            image.filename
          );
          
          // Update database
          await prisma.image.update({
            where: { id },
            data: { thumbnailPath: newThumbnailPath },
          });
          
          return res.sendFile(path.resolve(newThumbnailPath));
        } catch (thumbError: any) {
          return res.status(404).json({ 
            error: "Thumbnail not found and failed to generate", 
            details: thumbError.message 
          });
        }
      }
      return res.status(404).json({ error: "Thumbnail not found" });
    }

    // Verify thumbnail file exists
    try {
      await fs.access(image.thumbnailPath);
    } catch (err: any) {
      // Thumbnail file doesn't exist, try to regenerate
      if (image.filePath && !image.isCorrupted) {
        try {
          await fs.access(image.filePath);
          const thumbnailDir = path.join(__dirname, "../../thumbnails");
          const newThumbnailPath = await generateThumbnail(
            image.filePath,
            thumbnailDir,
            image.filename
          );
          
          // Update database
          await prisma.image.update({
            where: { id },
            data: { thumbnailPath: newThumbnailPath },
          });
          
          return res.sendFile(path.resolve(newThumbnailPath));
        } catch (thumbError: any) {
          return res.status(404).json({ 
            error: "Thumbnail not found and failed to regenerate", 
            details: thumbError.message 
          });
        }
      }
      return res.status(404).json({ 
        error: "Thumbnail file not found", 
        details: `Thumbnail path: ${image.thumbnailPath}` 
      });
    }

    res.sendFile(path.resolve(image.thumbnailPath));
  } catch (error: any) {
    res
      .status(500)
      .json({ error: "Failed to serve thumbnail", details: error.message });
  }
});

// Update image metadata
router.put("/:id/metadata", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { metadata } = req.body;

    const image = await prisma.image.update({
      where: { id },
      data: { metadata },
    });

    await prisma.syncLog.create({
      data: {
        action: "update",
        imageId: id,
        status: "success",
        details: { type: "metadata_update" },
      },
    });

    res.json({
      message: "Metadata updated successfully",
      image: {
        ...image,
        fileSize: image.fileSize.toString(),
      },
    });
  } catch (error: any) {
    res
      .status(500)
      .json({ error: "Failed to update metadata", details: error.message });
  }
});

// Update image details (rename)
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { originalName } = req.body;

    if (!originalName) {
      return res.status(400).json({ error: "originalName is required" });
    }

    // 1. Get current image
    const currentImage = await prisma.image.findUnique({ where: { id } });
    if (!currentImage) {
      return res.status(404).json({ error: "Image not found" });
    }

    // 2. Determine new filename and path
    // Keep the same extension - force use original file extension
    const ext = path.extname(currentImage.filename);
    
    // Remove any extension from user input to ensure original extension is preserved
    let nameWithoutExt = originalName.trim();
    const userLastDotIndex = nameWithoutExt.lastIndexOf('.');
    if (userLastDotIndex > 0) {
      // User included an extension, remove it to prevent extension changes
      nameWithoutExt = nameWithoutExt.substring(0, userLastDotIndex);
    }
    
    // Sanitize new name to be safe for filesystem (for actual file)
    const safeName = nameWithoutExt.replace(/[^a-z0-9\-_ ]/gi, "_").trim();
    const newFilename = `${safeName}${ext}`;
    // For originalName, use the cleaned name (without extension removal) but ensure correct extension
    // This preserves user's desired name while ensuring extension matches
    const cleanNameWithoutExt = nameWithoutExt.trim();
    const newOriginalName = `${cleanNameWithoutExt}${ext}`;
    const newFilePath = path.join(
      path.dirname(currentImage.filePath),
      newFilename
    );

    // 3. Verify original file exists before renaming
    try {
      await fs.access(currentImage.filePath);
    } catch (err: any) {
      return res.status(404).json({ 
        error: "Original image file not found", 
        details: `File path: ${currentImage.filePath}` 
      });
    }

    // 4. Rename file on disk if name changed
    let updatedThumbnailPath: string | null = currentImage.thumbnailPath;
    
    if (newFilename !== currentImage.filename) {
      // Check if target file already exists
      let targetFilePath = newFilePath;
      let targetFilename = newFilename;
      let targetOriginalName = newOriginalName;
      
      try {
        await fs.access(newFilePath);
        // If we get here, file exists. Append timestamp to make unique
        const timestamp = Date.now();
        targetFilename = `${safeName}_${timestamp}${ext}`;
        targetOriginalName = `${cleanNameWithoutExt}_${timestamp}${ext}`;
        targetFilePath = path.join(
          path.dirname(currentImage.filePath),
          targetFilename
        );
      } catch (err: any) {
        if (err.code !== "ENOENT") {
          // Other error (e.g. permission)
          throw err;
        }
        // File doesn't exist, safe to use newFilePath
      }

      // Perform file rename
      try {
        await fs.rename(currentImage.filePath, targetFilePath);

        // Regenerate thumbnail with new filename
        const thumbnailDir = path.join(__dirname, "../../thumbnails");
        try {
          // Delete old thumbnail if it exists
          if (currentImage.thumbnailPath) {
            try {
              await fs.unlink(currentImage.thumbnailPath);
            } catch {
              // Ignore errors when deleting old thumbnail
            }
          }
          
          // Generate new thumbnail
          updatedThumbnailPath = await generateThumbnail(
            targetFilePath,
            thumbnailDir,
            targetFilename
          );
        } catch (thumbError: any) {
          console.error(`[RENAME] Failed to regenerate thumbnail: ${thumbError.message}`);
          // Continue even if thumbnail generation fails
          updatedThumbnailPath = null;
        }

        // Get file's actual modification time from disk
        // lastModified should reflect file content modification time, not metadata changes like renaming
        let fileMtime: Date;
        try {
          const fileStats = await fs.stat(targetFilePath);
          fileMtime = fileStats.mtime;
        } catch {
          // If we can't get file stats, keep the original lastModified
          const currentImageData = await prisma.image.findUnique({ where: { id } });
          fileMtime = currentImageData?.lastModified || new Date();
        }

        // Update DB with new name and thumbnail path
        // Keep the file's actual modification time (don't update lastModified for rename)
          await prisma.image.update({
            where: { id },
            data: {
            originalName: targetOriginalName,
            filename: targetFilename,
            filePath: targetFilePath,
            thumbnailPath: updatedThumbnailPath,
            lastModified: fileMtime, // Use file's actual modification time, not rename time
            },
          });
      } catch (renameError: any) {
        return res.status(500).json({ 
          error: "Failed to rename file", 
          details: renameError.message 
        });
      }
    } else {
      // Just update originalName if filename happens to match (unlikely but possible)
      // Still ensure extension matches
      await prisma.image.update({
        where: { id },
        data: { originalName: newOriginalName },
      });
    }

    // 5. Create Sync Log (wrapped in try-catch to prevent 500 if logging fails)
    try {
      await prisma.syncLog.create({
        data: {
          action: "update",
          imageId: id,
          status: "success",
          details: {
            type: "rename",
            from: currentImage.originalName,
            to: originalName,
          },
        },
      });
    } catch (logError) {
      // Continue, don't fail the request just because logging failed
    }

    // 6. Return updated image - fetch fresh from database to ensure all fields are correct
    const updatedImage = await prisma.image.findUnique({ 
      where: { id },
      include: {
        folder: true,
      }
    });
    
    if (!updatedImage) {
      return res.status(404).json({ error: "Image not found after update" });
    }
    
    // Verify the file actually exists at the new path
    try {
      await fs.access(updatedImage.filePath);
      console.log(`[RENAME] Successfully renamed image ${id}, new path: ${updatedImage.filePath}`);
    } catch (fileError: any) {
      console.error(`[RENAME] ERROR: Updated file path does not exist: ${updatedImage.filePath}`);
      console.error(`[RENAME] Original path was: ${currentImage.filePath}`);
      return res.status(500).json({ 
        error: "File rename failed - file not found at new path", 
        details: `Expected path: ${updatedImage.filePath}, Original path: ${currentImage.filePath}` 
      });
    }
    
    res.json({
      message: "Image updated successfully",
      image: {
        ...updatedImage,
        fileSize: updatedImage?.fileSize.toString(),
      },
    });
  } catch (error: any) {
    // Return the actual error message for debugging
    res
      .status(500)
      .json({ error: "Failed to update image", details: error.message });
  }
});

// Move image to folder
router.put("/:id/move", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { folderId } = req.body;

    // Verify folder exists if folderId is provided
    if (folderId) {
      const folder = await prisma.folder.findUnique({
        where: { id: parseInt(folderId) },
      });
      if (!folder) {
        return res.status(404).json({ error: "Folder not found" });
      }
    }

    const image = await prisma.image.update({
      where: { id },
      data: {
        folderId: folderId ? parseInt(folderId) : null,
      },
    });

    res.json({
      message: "Image moved successfully",
      image: {
        ...image,
        fileSize: image.fileSize.toString(),
      },
    });
  } catch (error: any) {
    res
      .status(500)
      .json({ error: "Failed to move image", details: error.message });
  }
});

// Delete image
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);

    const image = await prisma.image.findUnique({
      where: { id },
    });

    if (!image) {
      return res.status(404).json({ error: "Image not found" });
    }

    // Delete files
    try {
      await fs.unlink(image.filePath);
      if (image.thumbnailPath) {
        await fs.unlink(image.thumbnailPath);
      }
    } catch (fileError) { }

    // Delete from database
    await prisma.image.delete({
      where: { id },
    });

    // Only create a separate delete log if this is not part of a sync operation
    // Check if this delete is part of a sync by checking the query parameter
    const isSyncOperation = req.query.isSyncOperation === 'true';

    console.log('[Delete Image] isSyncOperation:', isSyncOperation);
    console.log('[Delete Image] query params:', req.query);
    console.log('[Delete Image] image:', image.originalName);

    if (!isSyncOperation) {
      await prisma.syncLog.create({
        data: {
          action: "delete",
          status: "success",
          details: { filename: image.originalName },
        },
      });
    }

    res.json({ message: "Image deleted successfully" });
  } catch (error: any) {
    res
      .status(500)
      .json({ error: "Failed to delete image", details: error.message });
  }
});

// Preview image filter (temporary, not saved to database)
router.post("/:id/filter/preview", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { filter, sourceTempFilename } = req.body;

    if (
      !filter ||
      !["sharpen", "blur", "greyscale", "negate", "normalize"].includes(filter)
    ) {
      return res.status(400).json({
        error:
          "Invalid filter. Allowed: sharpen, blur, greyscale, negate, normalize",
      });
    }

    const image = await prisma.image.findUnique({
      where: { id },
    });

    if (!image) {
      return res.status(404).json({ error: "Image not found" });
    }

    // Check if image is corrupted
    if (image.isCorrupted) {
      return res
        .status(400)
        .json({ error: "Cannot apply filter to corrupted image" });
    }

    const { applyImageFilter } = require("../utils/imageUtils");
    const { v4: uuidv4 } = require("uuid");

    // Determine source file (original or previous preview)
    const tempDir = path.join(__dirname, "../../temp");
    let sourcePath: string;
    if (sourceTempFilename) {
      sourcePath = path.join(tempDir, sourceTempFilename);
      try {
        await fs.access(sourcePath);
      } catch (error) {
        return res.status(404).json({ error: "Source preview not found" });
      }
    } else {
      sourcePath = image.filePath;
      try {
        await fs.access(sourcePath);
      } catch (error) {
        return res.status(404).json({ error: "Image file not found on disk" });
      }
    }

    // Generate temporary filename for preview
    const ext = path.extname(image.filename);
    const tempFilename = `preview_${uuidv4()}${ext}`;
    await fs.mkdir(tempDir, { recursive: true });
    const previewPath = path.join(tempDir, tempFilename);

    // Apply filter
    try {
      console.log(`[FILTER PREVIEW] Applying ${filter} filter to image ${id}`);
      console.log(`[FILTER PREVIEW] Source path: ${sourcePath}`);
      console.log(`[FILTER PREVIEW] Preview path: ${previewPath}`);
      await applyImageFilter(sourcePath, previewPath, filter);
      console.log(`[FILTER PREVIEW] Filter applied successfully`);
    } catch (filterError: any) {
      console.error(`[FILTER PREVIEW] Error applying filter:`, filterError);
      console.error(`[FILTER PREVIEW] Error message:`, filterError?.message);
      console.error(`[FILTER PREVIEW] Error stack:`, filterError?.stack);
      try {
        await fs.unlink(previewPath).catch(() => { });
      } catch { }
      return res.status(500).json({
        error: "Failed to apply filter",
        details: filterError.message || "Unknown error during image processing",
      });
    }

    // Return preview URL (temporary file)
    res.json({
      previewUrl: `/api/images/preview/${tempFilename}`,
      tempFilename,
      filter,
    });
  } catch (error: any) {
    res
      .status(500)
      .json({ error: "Failed to preview filter", details: error.message });
  }
});

// Upload preview file (for client-side processed images like watermark)
router.post("/preview/upload", async (req: Request, res: Response) => {
  try {
    const multer = require('multer');
    const { v4: uuidv4 } = require("uuid");
    const tempDir = path.join(__dirname, "../../temp");
    await fs.mkdir(tempDir, { recursive: true });

    const tempStorage = multer.diskStorage({
      destination: tempDir,
      filename: (req: any, file: any, cb: any) => {
        const tempFilename = `preview_${uuidv4()}${path.extname(file.originalname || '.jpg')}`;
        cb(null, tempFilename);
      },
    });

    const tempUpload = multer({ storage: tempStorage }).single('preview');

    tempUpload(req, res, async (err: any) => {
      if (err) {
        return res.status(400).json({ error: "Failed to upload preview", details: err.message });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No preview file uploaded" });
      }

      res.json({
        tempFilename: req.file.filename,
        previewUrl: `/api/images/preview/${req.file.filename}`,
      });
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to upload preview", details: error.message });
  }
});

// Serve preview image
router.get("/preview/:filename", async (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    if (!filename.startsWith("preview_") && !filename.startsWith("watermark_")) {
      return res.status(400).json({ error: "Invalid preview filename" });
    }
    const previewPath = path.join(__dirname, "../../temp", filename);
    res.sendFile(path.resolve(previewPath));
  } catch (error: any) {
    res.status(404).json({ error: "Preview not found" });
  }
});

// Save filter preview (as new copy or replace original)
router.post("/:id/filter/save", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { tempFilename, filter, saveAsCopy } = req.body;

    if (!tempFilename || !filter) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const image = await prisma.image.findUnique({
      where: { id },
    });

    if (!image) {
      return res.status(404).json({ error: "Image not found" });
    }

    const tempDir = path.join(__dirname, "../../temp");
    const previewPath = path.join(tempDir, tempFilename);

    // Check if preview file exists
    try {
      await fs.access(previewPath);
    } catch (error) {
      return res.status(404).json({ error: "Preview file not found" });
    }

    const {
      getImageMetadata,
      generateThumbnail,
    } = require("../utils/imageUtils");
    const { v4: uuidv4 } = require("uuid");

    const ext = path.extname(image.filename);
    const uploadDir = path.dirname(image.filePath);

    if (saveAsCopy) {
      // Save as new copy
      const newFilename = `${uuidv4()}${ext}`;
      const newPath = path.join(uploadDir, newFilename);

      await fs.copyFile(previewPath, newPath);

      const metadata = await getImageMetadata(newPath);
      if (!metadata) {
        await fs.unlink(newPath);
        return res
          .status(500)
          .json({ error: "Failed to read filtered image metadata" });
      }

      const thumbnailDir = path.join(__dirname, "../../thumbnails");
      const thumbnailPath = await generateThumbnail(
        newPath,
        thumbnailDir,
        newFilename
      );

      const stats = await fs.stat(newPath);
      const defaultFolder = await prisma.folder.findFirst({
        where: { name: "Default" },
      });

      // Use actual format from metadata instead of extension
      const actualFormat = metadata.format
        ? metadata.format.toLowerCase()
        : path.extname(newFilename).substring(1).toLowerCase();

      const filteredImage = await prisma.image.create({
        data: {
          filename: newFilename,
          originalName: `${path.parse(image.originalName).name
            }_${filter}${ext}`,
          filePath: newPath,
          thumbnailPath,
          fileSize: BigInt(stats.size),
          format: actualFormat,
          width: metadata.width,
          height: metadata.height,
          isCorrupted: false,
          source: "local",
          folderId: defaultFolder?.id || image.folderId,
        },
      });

      await prisma.syncLog.create({
        data: {
          action: "filter",
          imageId: filteredImage.id,
          status: "success",
          details: {
            originalImageId: id,
            filter,
          },
        },
      });

      // Clean up preview
      await fs.unlink(previewPath).catch(() => { });

      res.status(201).json({
        message: "Filter saved as new copy",
        image: {
          ...filteredImage,
          fileSize: filteredImage.fileSize.toString(),
        },
      });
    } else {
      // Replace original
      const backupPath = `${image.filePath}.backup_${Date.now()}`;
      await fs.copyFile(image.filePath, backupPath);

      try {
        await fs.copyFile(previewPath, image.filePath);

        const metadata = await getImageMetadata(image.filePath);
        if (!metadata) {
          await fs.copyFile(backupPath, image.filePath);
          await fs.unlink(backupPath);
          return res
            .status(500)
            .json({ error: "Failed to read filtered image metadata" });
        }

        const thumbnailDir = path.join(__dirname, "../../thumbnails");
        const thumbnailPath = await generateThumbnail(
          image.filePath,
          thumbnailDir,
          image.filename
        );

        const stats = await fs.stat(image.filePath);
          // Use file's actual modification time from disk, not current time
          const fileMtime = stats.mtime;

        const updatedImage = await prisma.image.update({
          where: { id },
          data: {
            thumbnailPath,
            fileSize: BigInt(stats.size),
            width: metadata.width,
            height: metadata.height,
              lastModified: fileMtime, // Use actual file modification time
          },
        });

        await prisma.syncLog.create({
          data: {
            action: "filter",
            imageId: id,
            status: "success",
            details: {
              filter,
              replaced: true,
            },
          },
        });

        // Clean up preview and backup
        await fs.unlink(previewPath).catch(() => { });
        await fs.unlink(backupPath).catch(() => { });

        res.json({
          message: "Filter applied to original image",
          image: {
            ...updatedImage,
            fileSize: updatedImage.fileSize.toString(),
          },
        });
      } catch (error: any) {
        // Restore backup on error
        await fs.copyFile(backupPath, image.filePath).catch(() => { });
        await fs.unlink(backupPath).catch(() => { });
        throw error;
      }
    }
  } catch (error: any) {
    res
      .status(500)
      .json({ error: "Failed to save filter", details: error.message });
  }
});

// Apply image filter (legacy - kept for backward compatibility, but now creates preview)
router.post("/:id/filter", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { filter } = req.body;

    if (
      !filter ||
      !["sharpen", "blur", "greyscale", "negate", "normalize"].includes(filter)
    ) {
      return res.status(400).json({
        error:
          "Invalid filter. Allowed: sharpen, blur, greyscale, negate, normalize",
      });
    }

    const image = await prisma.image.findUnique({
      where: { id },
    });

    if (!image) {
      return res.status(404).json({ error: "Image not found" });
    }

    // Check if image is corrupted - cannot apply filters to corrupted images
    if (image.isCorrupted) {
      return res
        .status(400)
        .json({ error: "Cannot apply filter to corrupted image" });
    }

    // Check if file exists
    try {
      await fs.access(image.filePath);
    } catch (error) {
      return res.status(404).json({ error: "Image file not found on disk" });
    }

    const {
      applyImageFilter,
      getImageMetadata,
      generateThumbnail,
    } = require("../utils/imageUtils");
    const { v4: uuidv4 } = require("uuid");

    // Generate new filename for filtered image
    const ext = path.extname(image.filename);
    const newFilename = `${uuidv4()}${ext}`;
    const uploadDir = path.dirname(image.filePath);
    const filteredPath = path.join(uploadDir, newFilename);

    // Apply filter with error handling
    try {
      await applyImageFilter(image.filePath, filteredPath, filter);
    } catch (filterError: any) {
      // Clean up if filter failed
      try {
        await fs.unlink(filteredPath).catch(() => { });
      } catch { }
      return res.status(500).json({
        error: "Failed to apply filter",
        details: filterError.message || "Unknown error during image processing",
      });
    }

    // Get metadata
    const metadata = await getImageMetadata(filteredPath);
    if (!metadata) {
      await fs.unlink(filteredPath);
      return res
        .status(500)
        .json({ error: "Failed to read filtered image metadata" });
    }

    // Generate thumbnail
    const thumbnailDir = path.join(__dirname, "../../thumbnails");
    const thumbnailPath = await generateThumbnail(
      filteredPath,
      thumbnailDir,
      newFilename
    );

    // Get file size
    const stats = await fs.stat(filteredPath);

    // Get Default folder
    const defaultFolder = await prisma.folder.findFirst({
      where: { name: "Default" },
    });

    // Use actual format from metadata instead of extension
    const actualFormat = metadata.format
      ? metadata.format.toLowerCase()
      : path.extname(newFilename).substring(1).toLowerCase();

    // Create new image record
    const filteredImage = await prisma.image.create({
      data: {
        filename: newFilename,
        originalName: `${path.parse(image.originalName).name}_${filter}${ext}`,
        filePath: filteredPath,
        thumbnailPath,
        fileSize: BigInt(stats.size),
        format: actualFormat,
        width: metadata.width,
        height: metadata.height,
        isCorrupted: false,
        source: "local",
        folderId: defaultFolder?.id || image.folderId,
      },
    });

    // Log filter action
    await prisma.syncLog.create({
      data: {
        action: "filter",
        imageId: filteredImage.id,
        status: "success",
        details: {
          originalImageId: id,
          filter,
        },
      },
    });

    res.status(201).json({
      message: "Filter applied successfully",
      image: {
        ...filteredImage,
        fileSize: filteredImage.fileSize.toString(),
      },
    });
  } catch (error: any) {
    res
      .status(500)
      .json({ error: "Failed to apply filter", details: error.message });
  }
});

// Preview crop operation
router.post("/:id/crop/preview", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { x, y, width, height, sourceTempFilename } = req.body;

    if (
      x === undefined ||
      y === undefined ||
      width === undefined ||
      height === undefined
    ) {
      return res
        .status(400)
        .json({ error: "Missing crop parameters: x, y, width, height" });
    }

    const image = await prisma.image.findUnique({
      where: { id },
    });

    if (!image) {
      return res.status(404).json({ error: "Image not found" });
    }

    if (image.isCorrupted) {
      return res.status(400).json({ error: "Cannot crop corrupted image" });
    }

    const { cropImage } = require("../utils/imageUtils");
    const { v4: uuidv4 } = require("uuid");

    // Determine source file
    const tempDir = path.join(__dirname, "../../temp");
    let sourcePath: string;
    if (sourceTempFilename) {
      sourcePath = path.join(tempDir, sourceTempFilename);
      try {
        await fs.access(sourcePath);
      } catch (error) {
        return res.status(404).json({ error: "Source preview not found" });
      }
    } else {
      sourcePath = image.filePath;
      try {
        await fs.access(sourcePath);
      } catch (error) {
        return res.status(404).json({ error: "Image file not found on disk" });
      }
    }

    // Generate temporary filename for preview - preserve original format
    const ext = path.extname(image.filename);
    const tempFilename = `preview_${uuidv4()}${ext}`;
    await fs.mkdir(tempDir, { recursive: true });
    const previewPath = path.join(tempDir, tempFilename);

    // Perform crop
    try {
      console.log(`[CROP PREVIEW] Starting crop for image ${id}, format: ${image.format}`);
      console.log(`[CROP PREVIEW] Source: ${sourcePath}, Output: ${previewPath}`);
      console.log(`[CROP PREVIEW] Crop params: x=${x}, y=${y}, width=${width}, height=${height}`);
      await cropImage(sourcePath, previewPath, x, y, width, height);
      console.log(`[CROP PREVIEW] Crop completed successfully`);
    } catch (cropError: any) {
      console.error(`[CROP PREVIEW] Crop failed:`, cropError);
      try {
        await fs.unlink(previewPath).catch(() => { });
      } catch { }
      return res.status(500).json({
        error: "Failed to crop image",
        details: cropError.message || "Unknown error during image processing",
      });
    }

    res.json({
      previewUrl: `/api/images/preview/${tempFilename}`,
      tempFilename,
    });
  } catch (error: any) {
    res
      .status(500)
      .json({ error: "Failed to preview crop", details: error.message });
  }
});

// Preview rotate operation
router.post("/:id/rotate/preview", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { direction, sourceTempFilename } = req.body;

    if (!direction || !["left", "right"].includes(direction)) {
      return res
        .status(400)
        .json({ error: "Invalid direction. Allowed: left, right" });
    }

    const image = await prisma.image.findUnique({
      where: { id },
    });

    if (!image) {
      return res.status(404).json({ error: "Image not found" });
    }

    if (image.isCorrupted) {
      return res.status(400).json({ error: "Cannot rotate corrupted image" });
    }

    const { rotateImage } = require("../utils/imageUtils");
    const { v4: uuidv4 } = require("uuid");

    // Determine source file
    const tempDir = path.join(__dirname, "../../temp");
    let sourcePath: string;
    if (sourceTempFilename) {
      sourcePath = path.join(tempDir, sourceTempFilename);
      try {
        await fs.access(sourcePath);
      } catch (error) {
        return res.status(404).json({ error: "Source preview not found" });
      }
    } else {
      sourcePath = image.filePath;
      try {
        await fs.access(sourcePath);
      } catch (error) {
        return res.status(404).json({ error: "Image file not found on disk" });
      }
    }

    // Generate temporary filename for preview
    const ext = path.extname(image.filename);
    const tempFilename = `preview_${uuidv4()}${ext}`;
    await fs.mkdir(tempDir, { recursive: true });
    const previewPath = path.join(tempDir, tempFilename);

    // Perform rotate (90 degrees)
    const angle = direction === "left" ? -90 : 90;
    try {
      console.log(`[ROTATE PREVIEW] Starting rotate for image ${id}, format: ${image.format}`);
      console.log(`[ROTATE PREVIEW] Source: ${sourcePath}, Output: ${previewPath}`);
      console.log(`[ROTATE PREVIEW] Direction: ${direction}, Angle: ${angle}`);
      await rotateImage(sourcePath, previewPath, angle);
      console.log(`[ROTATE PREVIEW] Rotate completed successfully`);
    } catch (rotateError: any) {
      console.error(`[ROTATE PREVIEW] Rotate failed:`, rotateError);
      try {
        await fs.unlink(previewPath).catch(() => { });
      } catch { }
      return res.status(500).json({
        error: "Failed to rotate image",
        details: rotateError.message || "Unknown error during image processing",
      });
    }

    res.json({
      previewUrl: `/api/images/preview/${tempFilename}`,
      tempFilename,
    });
  } catch (error: any) {
    res
      .status(500)
      .json({ error: "Failed to preview rotate", details: error.message });
  }
});

// Save all operations
router.post("/:id/operations/save", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { tempFilename, operations, saveAsCopy } = req.body;

    if (!tempFilename || !operations || operations.length === 0) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const image = await prisma.image.findUnique({
      where: { id },
    });

    if (!image) {
      return res.status(404).json({ error: "Image not found" });
    }

    const tempDir = path.join(__dirname, "../../temp");
    const previewPath = path.join(tempDir, tempFilename);

    // Check if preview file exists
    try {
      await fs.access(previewPath);
    } catch (error) {
      return res.status(404).json({ error: "Preview file not found" });
    }

    const {
      getImageMetadata,
      generateThumbnail,
    } = require("../utils/imageUtils");
    const { v4: uuidv4 } = require("uuid");

    const ext = path.extname(image.filename);
    const uploadDir = path.dirname(image.filePath);

    if (saveAsCopy) {
      // Save as new copy
      const newFilename = `${uuidv4()}${ext}`;
      const newPath = path.join(uploadDir, newFilename);

      await fs.copyFile(previewPath, newPath);

      const metadata = await getImageMetadata(newPath);
      if (!metadata) {
        await fs.unlink(newPath);
        return res.status(500).json({ error: "Failed to read image metadata" });
      }

      const thumbnailDir = path.join(__dirname, "../../thumbnails");
      const thumbnailPath = await generateThumbnail(
        newPath,
        thumbnailDir,
        newFilename
      );

      const stats = await fs.stat(newPath);
      const defaultFolder = await prisma.folder.findFirst({
        where: { name: "Default" },
      });

      // Use actual format from metadata instead of extension
      const actualFormat = metadata.format
        ? metadata.format.toLowerCase()
        : path.extname(newFilename).substring(1).toLowerCase();

      const newImage = await prisma.image.create({
        data: {
          filename: newFilename,
          originalName: `${path.parse(image.originalName).name}_edited${ext}`,
          filePath: newPath,
          thumbnailPath,
          fileSize: BigInt(stats.size),
          format: actualFormat,
          width: metadata.width,
          height: metadata.height,
          isCorrupted: false,
          source: "local",
          folderId: defaultFolder?.id || image.folderId,
        },
      });

      // Determine action based on operations (crop, rotate, or filter)
      const actionTypes = operations.map((op: any) => op.type);
      const primaryAction = actionTypes.includes('crop') ? 'crop' :
        actionTypes.includes('rotate') ? 'crop' :
          actionTypes.includes('filter') ? 'filter' : 'filter';

      await prisma.syncLog.create({
        data: {
          action: primaryAction,
          imageId: newImage.id,
          status: "success",
          details: {
            originalImageId: id,
            operations,
          },
        },
      });

      // Clean up preview
      await fs.unlink(previewPath).catch(() => { });

      res.status(201).json({
        message: "Operations saved as new copy",
        image: {
          ...newImage,
          fileSize: newImage.fileSize.toString(),
        },
      });
    } else {
      // Replace original
      const backupPath = `${image.filePath}.backup_${Date.now()}`;
      await fs.copyFile(image.filePath, backupPath);

      try {
        await fs.copyFile(previewPath, image.filePath);

        const metadata = await getImageMetadata(image.filePath);
        if (!metadata) {
          await fs.copyFile(backupPath, image.filePath);
          await fs.unlink(backupPath);
          return res
            .status(500)
            .json({ error: "Failed to read image metadata" });
        }

        const thumbnailDir = path.join(__dirname, "../../thumbnails");
        const thumbnailPath = await generateThumbnail(
          image.filePath,
          thumbnailDir,
          image.filename
        );

        const stats = await fs.stat(image.filePath);
          // Use file's actual modification time from disk, not current time
          const fileMtime = stats.mtime;

        const updatedImage = await prisma.image.update({
          where: { id },
          data: {
            thumbnailPath,
            fileSize: BigInt(stats.size),
            width: metadata.width,
            height: metadata.height,
              lastModified: fileMtime, // Use actual file modification time
          },
        });

        // Determine action based on operations (crop, rotate, filter, or watermark)
        const actionTypes = operations.map((op: any) => op.type);
        const primaryAction = actionTypes.includes('crop') ? 'crop' :
          actionTypes.includes('rotate') ? 'crop' :
            actionTypes.includes('watermark') ? 'update' :
            actionTypes.includes('filter') ? 'filter' : 'filter';

        await prisma.syncLog.create({
          data: {
            action: primaryAction,
            imageId: id,
            status: "success",
            details: {
              operations,
              replaced: true,
            },
          },
        });

        // Clean up preview and backup
        await fs.unlink(previewPath).catch(() => { });
        await fs.unlink(backupPath).catch(() => { });

        res.json({
          message: "Operations applied to original image",
          image: {
            ...updatedImage,
            fileSize: updatedImage.fileSize.toString(),
          },
        });
      } catch (error: any) {
        // Restore backup on error
        await fs.copyFile(backupPath, image.filePath).catch(() => { });
        await fs.unlink(backupPath).catch(() => { });
        throw error;
      }
    }
  } catch (error: any) {
    res
      .status(500)
      .json({ error: "Failed to save operations", details: error.message });
  }
});

// Crop image
router.post("/:id/crop", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { x, y, width, height } = req.body;

    if (
      x === undefined ||
      y === undefined ||
      width === undefined ||
      height === undefined
    ) {
      return res
        .status(400)
        .json({ error: "Missing crop parameters: x, y, width, height" });
    }

    const image = await prisma.image.findUnique({
      where: { id },
    });

    if (!image) {
      return res.status(404).json({ error: "Image not found" });
    }

    // Import crop function
    const { cropImage } = require("../utils/imageUtils");
    const { v4: uuidv4 } = require("uuid");

    // Generate new filename for cropped image - preserve original format
    const ext = path.extname(image.filename);
    const newFilename = `${uuidv4()}${ext}`;
    const uploadDir = path.dirname(image.filePath);
    const croppedPath = path.join(uploadDir, newFilename);

    // Perform crop
    await cropImage(image.filePath, croppedPath, x, y, width, height);

    // Get metadata of cropped image
    const {
      getImageMetadata,
      generateThumbnail,
    } = require("../utils/imageUtils");
    const metadata = await getImageMetadata(croppedPath);
    if (!metadata) {
      await fs.unlink(croppedPath);
      return res
        .status(500)
        .json({ error: "Failed to read cropped image metadata" });
    }

    // Determine actual format from metadata (not extension)
    // This handles cases where TIF conversion failed and file is actually PNG
    let actualFormat = metadata.format || path.extname(newFilename).substring(1).toLowerCase();
    if (actualFormat === 'tiff') {
      actualFormat = 'tif';
    }

    // Generate thumbnail
    const thumbnailDir = path.join(__dirname, "../../thumbnails");
    const thumbnailPath = await generateThumbnail(
      croppedPath,
      thumbnailDir,
      newFilename
    );

    // Get file size
    const stats = await fs.stat(croppedPath);

    // Get Default folder
    const defaultFolder = await prisma.folder.findFirst({
      where: { name: "Default" },
    });

    // Create new image record for cropped image
    const croppedImage = await prisma.image.create({
      data: {
        filename: newFilename,
        originalName: `${path.parse(image.originalName).name}_cropped${ext}`,
        filePath: croppedPath,
        thumbnailPath,
        fileSize: BigInt(stats.size),
        format: actualFormat,
        width: metadata.width,
        height: metadata.height,
        isCorrupted: false,
        source: "local",
        folderId: defaultFolder?.id || image.folderId,
      },
    });

    // Log crop action
    await prisma.syncLog.create({
      data: {
        action: "crop",
        imageId: croppedImage.id,
        status: "success",
        details: {
          originalImageId: id,
          cropArea: { x, y, width, height },
        },
      },
    });

    res.status(201).json({
      message: "Image cropped successfully",
      image: {
        ...croppedImage,
        fileSize: croppedImage.fileSize.toString(),
      },
    });
  } catch (error: any) {
    res
      .status(500)
      .json({ error: "Failed to crop image", details: error.message });
  }
});

// Get statistics
router.get("/stats/summary", async (req: Request, res: Response) => {
  try {
    const totalImages = await prisma.image.count();
    const totalSize = await prisma.image.aggregate({
      _sum: { fileSize: true },
    });
    const corruptedCount = await prisma.image.count({
      where: { isCorrupted: true },
    });

    const formatStats = await prisma.image.groupBy({
      by: ["format"],
      _count: true,
    });

    res.json({
      totalImages,
      totalSize: totalSize._sum.fileSize?.toString() || "0",
      corruptedCount,
      formatStats,
    });
  } catch (error: any) {
    res
      .status(500)
      .json({ error: "Failed to fetch statistics", details: error.message });
  }
});

export default router;
