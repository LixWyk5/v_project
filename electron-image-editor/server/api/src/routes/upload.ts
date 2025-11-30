import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { v4 as uuidv4 } from "uuid";
import prisma from "../db";
import {
  generateThumbnail,
  getImageMetadata,
  validateImage,
  getExifData,
} from "../utils/imageUtils";

const router = Router();

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../../uploads");
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

// Separate multer instance for config files (allows JSON)
const configUpload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max for config files
  },
});

// File type validation constants
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/x-png",
  "image/tiff",
];
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".tif", ".tiff"];

// Validate file type
const isValidFileType = (file: Express.Multer.File): boolean => {
  const ext = path.extname(file.originalname).toLowerCase();
  return (
    ALLOWED_MIME_TYPES.includes(file.mimetype) ||
    ALLOWED_EXTENSIONS.includes(ext)
  );
};

// Create upload without fileFilter to avoid LIMIT_UNEXPECTED_FILE error
// We'll validate file types manually after multer processes the files
const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
  },
});

// Upload single image
router.post(
  "/single",
  upload.single("image"),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const filePath = req.file.path;
      const filename = req.file.filename;

      // Check if image is valid (corrupted images are still accepted but marked)
      const isValid = await validateImage(filePath);
      let metadata: any = null;
      let thumbnailPath: string | null = null;
      let exifData: any = null;

      if (isValid) {
        // Get metadata for valid images
        metadata = await getImageMetadata(filePath);

        // Extract EXIF data for valid images
        try {
          exifData = await getExifData(filePath);
        } catch (error) {
          // EXIF extraction may fail for some images, continue without it
          console.log(`Failed to extract EXIF for ${filename}:`, error);
        }

        // Generate thumbnail for valid images
        if (metadata) {
          const thumbnailDir = path.join(__dirname, "../../thumbnails");
          thumbnailPath = await generateThumbnail(
            filePath,
            thumbnailDir,
            filename
          );
        }
      } else {
        // For corrupted images, set default values
        metadata = {
          width: null,
          height: null,
        };
      }

      // Get or create Default folder
      let defaultFolder = await prisma.folder.findFirst({
        where: { name: "Default" },
      });

      if (!defaultFolder) {
        defaultFolder = await prisma.folder.create({
          data: { name: "Default" },
        });
      }

      // Create upload batch for single file (treat as batch of 1)
      const batchId = uuidv4();
      await prisma.uploadBatch.create({
        data: {
          batchId,
          totalFiles: 1,
          totalSize: BigInt(req.file.size),
          successCount: isValid ? 1 : 0,
          failedCount: 0,
          corruptedCount: isValid ? 0 : 1,
          folderId: defaultFolder.id,
          uploadMethod: "single",
        },
      });

      // Save to database (corrupted images are saved but marked)
      // Use actual format from metadata if available, otherwise fallback to extension
      const actualFormat = metadata?.format
        ? metadata.format.toLowerCase()
        : path.extname(req.file.originalname).substring(1).toLowerCase();

      const image = await prisma.image.create({
        data: {
          filename,
          originalName: req.file.originalname,
          filePath,
          thumbnailPath,
          fileSize: BigInt(req.file.size),
          format: actualFormat,
          width: metadata?.width || null,
          height: metadata?.height || null,
          isCorrupted: !isValid,
          source: "local",
          folderId: defaultFolder.id,
          metadata: exifData ? { exif: exifData } : undefined,
        },
      });

      // Create upload file record
      await prisma.uploadFile.create({
        data: {
          batchId,
          imageId: image.id,
          filename: image.filename,
          originalName: image.originalName,
          fileSize: image.fileSize,
          status: "success",
          isCorrupted: !isValid,
        },
      });

      // Log upload
      await prisma.syncLog.create({
        data: {
          action: "upload",
          imageId: image.id,
          status: "success",
          details: {
            filename: image.originalName,
            size: req.file.size,
            batchId,
          },
        },
      });

      res.status(201).json({
        message: "Image uploaded successfully",
        batchId,
        image: {
          ...image,
          fileSize: image.fileSize.toString(),
        },
        folder: {
          id: defaultFolder.id,
          name: defaultFolder.name,
        },
        isCorrupted: !isValid,
        corruptedCount: isValid ? 0 : 1,
      });
    } catch (error: any) {
      res
        .status(500)
        .json({ error: "Failed to upload image", details: error.message });
    }
  }
);

// Upload multiple images
router.post(
  "/multiple",
  (req, res, next) => {
    // Use any() but validate field names manually for security
    // This works around a multer bug/limitation with array() and fields()
    upload.any()(req, res, (err) => {
      if (err) {
        return res.status(400).json({
          error: "Upload failed",
          details: err.message,
          code: err.code,
        });
      }

      // Manual validation for security
      const files = (req.files as Express.Multer.File[]) || [];

      // Validate field names
      const invalidFiles = files.filter((f) => f.fieldname !== "images");
      if (invalidFiles.length > 0) {
        return res.status(400).json({
          error: "Invalid field name",
          details: `Expected field name: "images", but received: "${invalidFiles[0].fieldname}"`,
        });
      }

      // Validate file types manually
      const invalidTypeFiles = files.filter((f) => !isValidFileType(f));

      if (invalidTypeFiles.length > 0) {
        return res.status(400).json({
          error: "Invalid file type",
          details: `File "${invalidTypeFiles[0].originalname}" is not a valid image type. Only JPG, PNG, and TIF are allowed.`,
        });
      }

      next();
    });
  },
  async (req: Request, res: Response) => {
    try {
      const files = (req.files as Express.Multer.File[]) || [];

      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }

      // Get or create Default folder
      let defaultFolder = await prisma.folder.findFirst({
        where: { name: "Default" },
      });

      if (!defaultFolder) {
        defaultFolder = await prisma.folder.create({
          data: { name: "Default" },
        });
      }

      // Create upload batch for all files in this upload (create it first)
      const batchId = uuidv4();
      await prisma.uploadBatch.create({
        data: {
          batchId,
          totalFiles: files.length,
          totalSize: BigInt(0), // Will be updated later
          successCount: 0,
          failedCount: 0,
          corruptedCount: 0,
          folderId: defaultFolder.id,
          uploadMethod: "batch",
        },
      });

      let totalSize = BigInt(0);
      let successCount = 0;
      let failedCount = 0;
      let corruptedCount = 0;

      const results = {
        success: [] as any[],
        failed: [] as any[],
        corrupted: [] as string[],
      };

      for (const file of files) {
        try {
          totalSize += BigInt(file.size);
          const filePath = file.path;
          const filename = file.filename;

          // Validate image - wrap in try-catch to handle exceptions
          let isValid = false;
          try {
            isValid = await validateImage(filePath);
          } catch (error: any) {
            // If validateImage throws an error, treat as corrupted
            isValid = false;
          }

          let metadata: any = null;
          let thumbnailPath: string | null = null;
          let exifData: any = null;

          if (!isValid) {
            // Corrupted images are still accepted but marked
            metadata = {
              width: null,
              height: null,
            };
            results.corrupted.push(file.originalname);
            corruptedCount++;
          } else {
            // Get metadata for valid images
            metadata = await getImageMetadata(filePath);

            // Extract EXIF data for valid images
            try {
              exifData = await getExifData(filePath);
            } catch (error) {
              // EXIF extraction may fail for some images, continue without it
              console.log(`Failed to extract EXIF for ${filename}:`, error);
            }

            if (metadata) {
              // Generate thumbnail for valid images
              const thumbnailDir = path.join(__dirname, "../../thumbnails");
              thumbnailPath = await generateThumbnail(
                filePath,
                thumbnailDir,
                filename
              );
            }
          }

          // Save to database (corrupted images are saved but marked)
          // Use actual format from metadata if available, otherwise fallback to extension
          const actualFormat = metadata?.format
            ? metadata.format.toLowerCase()
            : path.extname(file.originalname).substring(1).toLowerCase();

          const image = await prisma.image.create({
            data: {
              filename,
              originalName: file.originalname,
              filePath,
              thumbnailPath,
              fileSize: BigInt(file.size),
              format: actualFormat,
              width: metadata?.width || null,
              height: metadata?.height || null,
              isCorrupted: !isValid,
              source: "local",
              folderId: defaultFolder.id,
              metadata: exifData ? { exif: exifData } : undefined,
            },
          });

          // Create upload file record
          await prisma.uploadFile.create({
            data: {
              batchId,
              imageId: image.id,
              filename: image.filename,
              originalName: image.originalName,
              fileSize: image.fileSize,
              status: "success",
              isCorrupted: !isValid,
            },
          });

          results.success.push({
            ...image,
            fileSize: image.fileSize.toString(),
          });

          if (isValid) {
            successCount++;
          }

          // Log upload
          await prisma.syncLog.create({
            data: {
              action: "upload",
              imageId: image.id,
              status: "success",
              details: {
                filename: image.originalName,
                batchId,
              },
            },
          });
        } catch (error: any) {
          failedCount++;
          results.failed.push({
            filename: file.originalname,
            error: error.message,
          });

          // Create upload file record for failed upload
          await prisma.uploadFile.create({
            data: {
              batchId,
              filename: file.originalname,
              originalName: file.originalname,
              fileSize: BigInt(file.size),
              status: "error",
              error: error.message,
            },
          });
        }
      }

      // Update batch with final statistics
      await prisma.uploadBatch.update({
        where: { batchId },
        data: {
          totalFiles: files.length,
          totalSize,
          successCount,
          failedCount,
          corruptedCount,
        },
      });

      res.status(201).json({
        message: "Batch upload completed",
        batchId,
        totalFiles: files.length,
        totalSize: totalSize.toString(),
        successCount,
        failedCount,
        corruptedCount,
        results,
      });
    } catch (error: any) {
      res
        .status(500)
        .json({ error: "Failed to upload images", details: error.message });
    }
  }
);

// Get upload batches
router.get("/batches", async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const batches = await prisma.uploadBatch.findMany({
      skip,
      take: limit,
      orderBy: { timestamp: "desc" },
      include: {
        folder: {
          select: {
            id: true,
            name: true,
          },
        },
        files: {
          include: {
            image: {
              select: {
                id: true,
                originalName: true,
                filename: true,
              },
            },
          },
          orderBy: { timestamp: "asc" },
        },
      },
    });

    const total = await prisma.uploadBatch.count();

    // Convert BigInt to string for JSON serialization
    const serializedBatches = batches.map((batch) => ({
      ...batch,
      totalSize: batch.totalSize.toString(),
      files: batch.files.map((file) => ({
        ...file,
        fileSize: file.fileSize.toString(),
      })),
    }));

    res.json({
      batches: serializedBatches,
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
      .json({ error: "Failed to get batches", details: error.message });
  }
});

// Upload from JSON config (batch upload from folders)
router.post(
  "/batch-config",
  (req, res, next) => {
    configUpload.single("config")(req, res, (err) => {
      if (err) {
        return res.status(400).json({
          error: "Upload failed",
          details: err.message,
          code: err.code,
        });
      }
      next();
    });
  },
  async (req: Request, res: Response) => {
    try {
      // Debug logging
      console.log("Batch config upload request received");
      console.log("req.file:", req.file ? "present" : "missing");
      console.log("req.body keys:", Object.keys(req.body || {}));
      console.log("req.files:", req.files ? "present" : "none");

      if (!req.file) {
        return res.status(400).json({
          error: "No config file uploaded",
          details: "Expected field name: 'config'",
          receivedFields: Object.keys(req.body || {}),
          receivedFiles: req.files ? "present" : "none",
        });
      }

      console.log(
        "Config file received:",
        req.file.originalname,
        req.file.mimetype
      );

      // Validate file type (should be JSON)
      const ext = path.extname(req.file.originalname).toLowerCase();
      if (ext !== ".json") {
        await fs.unlink(req.file.path).catch(() => {});
        return res.status(400).json({
          error: "Invalid file type",
          details: "Expected JSON file (.json)",
        });
      }

      // Read and parse JSON config
      let config;
      try {
        const configContent = await fs.readFile(req.file.path, "utf-8");
        config = JSON.parse(configContent);
      } catch (parseError: any) {
        await fs.unlink(req.file.path).catch(() => {});
        return res.status(400).json({
          error: "Invalid JSON format",
          details: parseError.message,
        });
      }

      if (!config.folders || !Array.isArray(config.folders)) {
        return res.status(400).json({
          error: "Invalid config format. Expected 'folders' array.",
        });
      }

      // Get or create Default folder
      let defaultFolder = await prisma.folder.findFirst({
        where: { name: "Default" },
      });

      if (!defaultFolder) {
        defaultFolder = await prisma.folder.create({
          data: { name: "Default" },
        });
      }

      const allFiles: string[] = [];

      console.log("Processing config with", config.folders.length, "folder(s)");

      // Collect files from all configured folders
      for (const folderConfig of config.folders) {
        const folderPath = folderConfig.path;
        console.log("Processing folder path:", folderPath);
        const fileTypes = folderConfig.fileTypes || [
          "jpg",
          "jpeg",
          "png",
          "tif",
          "tiff",
        ];
        const targetFolderName = folderConfig.targetFolder || "Default";

        // Get or create target folder
        let targetFolder = await prisma.folder.findFirst({
          where: { name: targetFolderName },
        });

        if (!targetFolder) {
          targetFolder = await prisma.folder.create({
            data: { name: targetFolderName },
          });
        }

        try {
          // Resolve path (support both absolute and relative)
          let resolvedPath: string;
          if (path.isAbsolute(folderPath)) {
            resolvedPath = folderPath;
            console.log("Using absolute path:", resolvedPath);
          } else {
            // For relative paths, try multiple resolution strategies
            // 1. From config file's directory (if config is in the target folder)
            const configDir = path.dirname(req.file.path);
            const fromConfigDir = path.resolve(configDir, folderPath);

            // 2. From project root (where docker-compose.yml is)
            // In Docker, the project root is typically mounted at /app
            // But we need to account for the actual project structure
            const projectRoot = path.resolve(__dirname, "../../../..");
            const fromProjectRoot = path.resolve(projectRoot, folderPath);

            // 3. From process.cwd()
            const fromCwd = path.resolve(process.cwd(), folderPath);

            console.log("Trying to resolve relative path:", folderPath);
            console.log("  - From config dir:", fromConfigDir);
            console.log("  - From project root:", fromProjectRoot);
            console.log("  - From cwd:", fromCwd);
            console.log("  - process.cwd():", process.cwd());
            console.log("  - __dirname:", __dirname);

            // Try each path in order
            resolvedPath = fromConfigDir; // Default fallback
            let found = false;
            for (const testPath of [fromConfigDir, fromProjectRoot, fromCwd]) {
              try {
                console.log("  - Testing path:", testPath);
                const stats = await fs.stat(testPath);
                if (stats.isDirectory()) {
                  resolvedPath = testPath;
                  found = true;
                  console.log("  - Found directory at:", resolvedPath);
                  break;
                } else {
                  console.log("  - Path exists but is not a directory");
                }
              } catch (err: any) {
                console.log("  - Path not accessible:", err.message);
                continue;
              }
            }
            if (!found) {
              console.log(
                "  - No valid path found, using default:",
                resolvedPath
              );
            }
          }

          // Normalize path to remove any issues with separators or trailing slashes
          resolvedPath = path.normalize(resolvedPath);

          // Check if folder exists
          console.log("Final resolved path:", resolvedPath);
          console.log(
            "Path type check - isAbsolute:",
            path.isAbsolute(resolvedPath)
          );
          console.log("Path length:", resolvedPath.length);
          console.log("Path bytes:", Buffer.from(resolvedPath).toString("hex"));
          console.log("Checking if path exists...");

          // Test path access with detailed error info
          let stats;
          try {
            // First try fs.access to check if path is accessible
            await fs.access(resolvedPath);
            console.log("Path is accessible");

            stats = await fs.stat(resolvedPath);
            console.log("Path stats:", {
              isDirectory: stats.isDirectory(),
              isFile: stats.isFile(),
              mode: stats.mode.toString(8),
            });
          } catch (statError: any) {
            console.error("fs.stat failed:", {
              path: resolvedPath,
              error: statError.message,
              code: statError.code,
              errno: statError.errno,
              stack: statError.stack,
            });
            throw statError;
          }

          if (!stats.isDirectory()) {
            console.log("Path is not a directory, skipping");
            continue;
          }

          // Read directory
          const entries = await fs.readdir(resolvedPath, {
            withFileTypes: true,
          });

          // Filter image files
          for (const entry of entries) {
            if (entry.isFile()) {
              const ext = path.extname(entry.name).toLowerCase().substring(1);
              if (fileTypes.includes(ext)) {
                const fullPath = path.join(resolvedPath, entry.name);
                allFiles.push(fullPath);
              }
            }
          }
        } catch (error: any) {
          // Skip folder if it doesn't exist or can't be read
          console.log("Error processing folder:", folderPath, error.message);
          continue;
        }
      }

      console.log("Found", allFiles.length, "image files to upload");

      if (allFiles.length === 0) {
        // Clean up uploaded config file
        await fs.unlink(req.file.path).catch(() => {});
        return res.status(400).json({
          error: "No image files found in configured folders",
          details:
            "Please check that the folder path is correct and contains image files",
        });
      }

      // Create upload batch
      const batchId = uuidv4();
      await prisma.uploadBatch.create({
        data: {
          batchId,
          totalFiles: allFiles.length,
          totalSize: BigInt(0),
          successCount: 0,
          failedCount: 0,
          corruptedCount: 0,
          folderId: defaultFolder.id,
          uploadMethod: "json",
        },
      });

      let totalSize = BigInt(0);
      let successCount = 0;
      let failedCount = 0;
      let corruptedCount = 0;

      const results = {
        success: [] as any[],
        failed: [] as any[],
        corrupted: [] as string[],
      };

      // Process each file
      for (const filePath of allFiles) {
        try {
          const stats = await fs.stat(filePath);
          totalSize += BigInt(stats.size);

          // Copy file to uploads directory
          const ext = path.extname(filePath);
          const filename = `${uuidv4()}${ext}`;
          const uploadDir = path.join(__dirname, "../../uploads");
          await fs.mkdir(uploadDir, { recursive: true });
          const destPath = path.join(uploadDir, filename);

          await fs.copyFile(filePath, destPath);

          // Validate image
          let isValid = false;
          try {
            isValid = await validateImage(destPath);
          } catch (error: any) {
            isValid = false;
          }

          let metadata: any = null;
          let thumbnailPath: string | null = null;
          let exifData: any = null;

          if (!isValid) {
            metadata = {
              width: null,
              height: null,
            };
            results.corrupted.push(path.basename(filePath));
            corruptedCount++;
          } else {
            metadata = await getImageMetadata(destPath);

            // Extract EXIF data for valid images
            try {
              exifData = await getExifData(destPath);
            } catch (error) {
              // EXIF extraction may fail for some images, continue without it
              console.log(`Failed to extract EXIF for ${filename}:`, error);
            }

            if (metadata) {
              const thumbnailDir = path.join(__dirname, "../../thumbnails");
              thumbnailPath = await generateThumbnail(
                destPath,
                thumbnailDir,
                filename
              );
            }
          }

          // Determine target folder from config
          let targetFolder = defaultFolder;
          for (const folderConfig of config.folders) {
            const resolvedPath = path.isAbsolute(folderConfig.path)
              ? folderConfig.path
              : path.resolve(process.cwd(), folderConfig.path);
            if (filePath.startsWith(resolvedPath)) {
              const folderName = folderConfig.targetFolder || "Default";
              const foundFolder = await prisma.folder.findFirst({
                where: { name: folderName },
              });
              if (foundFolder) {
                targetFolder = foundFolder;
              }
              break;
            }
          }

          // Save to database
          // Use actual format from metadata if available, otherwise fallback to extension
          const actualFormat = metadata?.format
            ? metadata.format.toLowerCase()
            : ext.substring(1).toLowerCase();

          const image = await prisma.image.create({
            data: {
              filename,
              originalName: path.basename(filePath),
              filePath: destPath,
              thumbnailPath,
              fileSize: BigInt(stats.size),
              format: actualFormat,
              width: metadata?.width || null,
              height: metadata?.height || null,
              isCorrupted: !isValid,
              source: "local",
              folderId: targetFolder.id,
              metadata: exifData ? { exif: exifData } : undefined,
            },
          });

          // Create upload file record
          await prisma.uploadFile.create({
            data: {
              batchId,
              imageId: image.id,
              filename: image.filename,
              originalName: image.originalName,
              fileSize: image.fileSize,
              status: "success",
              isCorrupted: !isValid,
            },
          });

          results.success.push({
            ...image,
            fileSize: image.fileSize.toString(),
          });

          if (isValid) {
            successCount++;
          }

          // Log upload
          await prisma.syncLog.create({
            data: {
              action: "upload",
              imageId: image.id,
              status: "success",
              details: {
                filename: image.originalName,
                batchId,
              },
            },
          });
        } catch (error: any) {
          failedCount++;
          results.failed.push({
            filename: path.basename(filePath),
            error: error.message,
          });

          // Create upload file record for failed upload
          await prisma.uploadFile.create({
            data: {
              batchId,
              filename: path.basename(filePath),
              originalName: path.basename(filePath),
              fileSize: BigInt(0),
              status: "error",
              error: error.message,
            },
          });
        }
      }

      // Update batch with final statistics
      await prisma.uploadBatch.update({
        where: { batchId },
        data: {
          totalFiles: allFiles.length,
          totalSize,
          successCount,
          failedCount,
          corruptedCount,
        },
      });

      // Clean up uploaded config file
      await fs.unlink(req.file.path).catch(() => {});

      res.status(201).json({
        message: "Batch upload from config completed",
        batchId,
        totalFiles: allFiles.length,
        totalSize: totalSize.toString(),
        successCount,
        failedCount,
        corruptedCount,
        results,
      });
    } catch (error: any) {
      res.status(500).json({
        error: "Failed to process batch config",
        details: error.message,
      });
    }
  }
);

// Get single batch with files
router.get("/batches/:batchId", async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;

    const batch = await prisma.uploadBatch.findUnique({
      where: { batchId },
      include: {
        folder: {
          select: {
            id: true,
            name: true,
          },
        },
        files: {
          include: {
            image: {
              select: {
                id: true,
                originalName: true,
                filename: true,
              },
            },
          },
          orderBy: { timestamp: "asc" },
        },
      },
    });

    if (!batch) {
      return res.status(404).json({ error: "Batch not found" });
    }

    // Convert BigInt to string for JSON serialization
    const serializedBatch = {
      ...batch,
      totalSize: batch.totalSize.toString(),
      files: batch.files.map((file) => ({
        ...file,
        fileSize: file.fileSize.toString(),
      })),
    };

    res.json(serializedBatch);
  } catch (error: any) {
    res
      .status(500)
      .json({ error: "Failed to get batch", details: error.message });
  }
});

export default router;
