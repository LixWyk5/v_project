import sharp from "sharp";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";
import * as ExifReader from "exifreader";

const execAsync = promisify(exec);

export async function generateThumbnail(
    inputPath: string,
    outputDir: string,
    filename: string,
    size: number = 300
): Promise<string> {
    try {
        // Ensure output directory exists
        await fs.mkdir(outputDir, { recursive: true });

        const thumbnailFilename = `thumb_${filename}`;
        const thumbnailPath = path.join(outputDir, thumbnailFilename);

        // Generate thumbnail
        await sharp(inputPath)
            .resize(size, size, {
        fit: "inside",
                withoutEnlargement: true,
            })
            .jpeg({ quality: 80 })
            .toFile(thumbnailPath);

        return thumbnailPath;
    } catch (error) {
        throw error;
    }
}

export async function getImageMetadata(filePath: string) {
    try {
        const metadata = await sharp(filePath).metadata();
        return {
            width: metadata.width,
            height: metadata.height,
            format: metadata.format,
            size: metadata.size,
        };
    } catch (error) {
    return null;
  }
}

export async function getExifData(filePath: string): Promise<any> {
  try {
    const fileBuffer = await fs.readFile(filePath);
    const tags = ExifReader.load(fileBuffer);

    // Extract relevant EXIF data
    const exifData: any = {};

    if (tags["Make"]) exifData.make = tags["Make"].description;
    if (tags["Model"]) exifData.model = tags["Model"].description;
    if (tags["DateTimeOriginal"])
      exifData.dateTimeOriginal = tags["DateTimeOriginal"].description;
    if (tags["ISO"]) exifData.iso = tags["ISO"].value;
    if (tags["FNumber"]) exifData.fNumber = tags["FNumber"].description;
    if (tags["ExposureTime"])
      exifData.exposureTime = tags["ExposureTime"].description;
    if (tags["FocalLength"])
      exifData.focalLength = tags["FocalLength"].description;
    if (tags["GPSLatitude"])
      exifData.gpsLatitude = tags["GPSLatitude"].description;
    if (tags["GPSLongitude"])
      exifData.gpsLongitude = tags["GPSLongitude"].description;
    if (tags["Orientation"]) exifData.orientation = tags["Orientation"].value;
    if (tags["Software"]) exifData.software = tags["Software"].description;

    return exifData;
  } catch (error) {
    // EXIF data may not be present in all images
        return null;
    }
}

export async function validateImage(filePath: string): Promise<boolean> {
    try {
        await sharp(filePath).metadata();
        return true;
    } catch (error) {
        return false;
    }
}

export async function cropImage(
  inputPath: string,
  outputPath: string,
  x: number,
  y: number,
  width: number,
  height: number
): Promise<void> {
  try {
    // Get input image metadata to determine format
    const metadata = await sharp(inputPath).metadata();
    const inputFormat = metadata.format;
    const ext = path.extname(outputPath).toLowerCase();
    
    let pipeline = sharp(inputPath).extract({ left: x, top: y, width, height });
    
    // Handle TIF format - use ImageMagick command line for reliable TIF processing
    // ImageMagick has better TIF support than Sharp
    if (ext === '.tif' || ext === '.tiff' || inputFormat === 'tiff' || inputFormat === 'tif') {
      console.log(`[TIF CROP] Processing TIF image: ${inputPath} -> ${outputPath}`);
      console.log(`[TIF CROP] Crop params: x=${x}, y=${y}, width=${width}, height=${height}`);
      
      // Use ImageMagick command line directly (magick command)
      // Geometry format: WxH+X+Y (width x height +x +y)
      const geometry = `${width}x${height}+${x}+${y}`;
      const command = `magick "${inputPath}" -crop ${geometry} -compress LZW "${outputPath}"`;
      
      return execAsync(command)
        .then(() => {
          console.log('[TIF CROP] ImageMagick crop completed, verifying output...');
          // Verify the output file is valid
          return sharp(outputPath).metadata();
        })
        .then((metadata) => {
          console.log('[TIF CROP] Output verified successfully:', metadata);
        })
        .catch((magickError: any) => {
          console.error('[TIF CROP] ImageMagick command failed:', magickError);
          console.error('[TIF CROP] stderr:', magickError.stderr);
          console.error('[TIF CROP] stdout:', magickError.stdout);
          // Fallback to Sharp if ImageMagick fails
          // For TIF files, Sharp may have issues, so we'll use a more reliable approach:
          // 1. Read with Sharp (which can handle most TIF variants)
          // 2. Extract to PNG (reliable format)
          // 3. Convert PNG back to TIF using Sharp with explicit options
          console.log('[TIF CROP] Falling back to Sharp processing...');
          return sharp(inputPath)
            .extract({ left: x, top: y, width, height })
            .toBuffer()
            .then((buffer) => {
              // Write as PNG first to ensure we have valid image data
              const tempPngPath = outputPath + '.tmp.png';
              return fs.writeFile(tempPngPath, buffer)
                .then(() => {
                  // Now convert PNG to TIF with explicit options
                  return sharp(tempPngPath)
                    .tiff({ 
                      compression: 'lzw',
                      quality: 100,
                      predictor: 'horizontal'
                    })
                    .toFile(outputPath);
                })
                .then(() => {
                  // Verify the output
                  return sharp(outputPath).metadata();
                })
                .then((metadata) => {
                  console.log('[TIF CROP] Sharp fallback successful, output metadata:', metadata);
                  // Clean up temp file
                  return fs.unlink(tempPngPath).catch(() => {});
                });
            })
            .catch((fallbackError: any) => {
              console.error('[TIF CROP] Sharp fallback failed:', fallbackError);
              // Last resort: save as PNG but keep TIF extension
              // This ensures the file is at least readable
              return sharp(inputPath)
                .extract({ left: x, top: y, width, height })
                .png()
                .toFile(outputPath + '.tmp.png')
                .then(() => {
                  return fs.copyFile(outputPath + '.tmp.png', outputPath);
                })
                .then(() => {
                  return fs.unlink(outputPath + '.tmp.png').catch(() => {});
                })
                .then(() => {
                  console.warn('[TIF CROP] Saved as PNG format (with TIF extension) due to conversion failure');
                })
                .catch((finalError: any) => {
                  throw new Error(`Failed to process TIF image: ${finalError?.message || 'Unknown error'}`);
                });
            });
        });
    } else if (ext === '.png') {
      await pipeline.png().toFile(outputPath);
    } else if (ext === '.jpg' || ext === '.jpeg') {
      await pipeline.jpeg({ quality: 90 }).toFile(outputPath);
    } else {
      // For other formats, use default behavior
      await pipeline.toFile(outputPath);
    }
  } catch (error) {
    throw error;
  }
}

export async function validate4KQuality(filePath: string): Promise<boolean> {
  try {
    const metadata = await sharp(filePath).metadata();
    // 4K requires both width >= 3840 AND height >= 2160
    // This prevents accepting images that are too wide but too short (e.g., 4000x800)
    // or too tall but too narrow (e.g., 800x4000)
    if (metadata.width && metadata.height) {
      const minWidth = 3840;
      const minHeight = 2160;
      return metadata.width >= minWidth && metadata.height >= minHeight;
    }
    return false;
  } catch (error) {
    return false;
  }
}

// Apply image filters/effects using Sharp (Native Addon)
export async function applyImageFilter(
  inputPath: string,
  outputPath: string,
  filter: "sharpen" | "blur" | "greyscale" | "negate" | "normalize"
): Promise<void> {
  try {
    console.log(`[APPLY FILTER] Starting filter application: ${filter}`);
    console.log(`[APPLY FILTER] Input: ${inputPath}, Output: ${outputPath}`);
    
    const metadata = await sharp(inputPath).metadata();
    const inputFormat = metadata.format;
    const ext = path.extname(outputPath).toLowerCase();
    
    console.log(`[APPLY FILTER] Image metadata:`, {
      width: metadata.width,
      height: metadata.height,
      format: inputFormat,
      size: metadata.size,
    });
    
    // Check image dimensions - if too large, resize first to prevent memory issues
    const maxDimension = 4096; // Maximum dimension for processing
    let shouldResize = false;
    let resizeWidth: number | undefined;
    let resizeHeight: number | undefined;
    
    if (metadata.width && metadata.height) {
      if (metadata.width > maxDimension || metadata.height > maxDimension) {
        shouldResize = true;
        const aspectRatio = metadata.width / metadata.height;
        if (metadata.width > metadata.height) {
          resizeWidth = maxDimension;
          resizeHeight = Math.round(maxDimension / aspectRatio);
        } else {
          resizeHeight = maxDimension;
          resizeWidth = Math.round(maxDimension * aspectRatio);
        }
        console.log(`[APPLY FILTER] Image too large, resizing to: ${resizeWidth}x${resizeHeight}`);
      }
    }
    
    // Build filter pipeline
    let filterPipeline = sharp(inputPath);
    
    // Resize if needed before applying filter
    if (shouldResize && resizeWidth && resizeHeight) {
      filterPipeline = filterPipeline.resize(resizeWidth, resizeHeight, {
        fit: 'inside',
        withoutEnlargement: true
      });
    }
    
    switch (filter) {
      case "sharpen":
        filterPipeline = filterPipeline.sharpen();
        break;
      case "blur":
        filterPipeline = filterPipeline.blur(5);
        break;
      case "greyscale":
        filterPipeline = filterPipeline.greyscale();
        break;
      case "negate":
        filterPipeline = filterPipeline.negate();
        break;
      case "normalize":
        filterPipeline = filterPipeline.normalize();
        break;
    }

    // Handle TIF format - convert to PNG for processing, then back to TIF
    // Prioritize actual format over extension to avoid format mismatch
    // Only treat as TIF if the actual format is TIF (not just extension)
    const isTifFormat = inputFormat === 'tiff' || inputFormat === 'tif';
    
    console.log(`[APPLY FILTER] Format check: inputFormat=${inputFormat}, ext=${ext}, isTifFormat=${isTifFormat}`);
    
    if (isTifFormat) {
      const buildPipeline = () => {
        let p = sharp(inputPath);
        
        // Resize if needed before applying filter
        if (shouldResize && resizeWidth && resizeHeight) {
          p = p.resize(resizeWidth, resizeHeight, {
            fit: 'inside',
            withoutEnlargement: true
          });
        }
        
        switch (filter) {
          case "sharpen": p = p.sharpen(); break;
          case "blur": p = p.blur(5); break;
          case "greyscale": p = p.greyscale(); break;
          case "negate": p = p.negate(); break;
          case "normalize": p = p.normalize(); break;
        }
        return p;
      };
      
      const tempPngPath = outputPath + '.tmp.png';
      try {
        // Step 1: Apply filter and convert to PNG
        await buildPipeline().png().toFile(tempPngPath);
        
        // Step 2: Convert PNG back to TIF
        let tifConverted = false;
        
        try {
          await sharp(tempPngPath).toFormat('tiff').toFile(outputPath);
          const testImage = sharp(outputPath);
          const outputMetadata = await testImage.metadata();
          const stats = await fs.stat(outputPath);
          if (stats.size > 0 && outputMetadata && outputMetadata.width && outputMetadata.height) {
            await testImage.resize(1, 1).toBuffer();
            tifConverted = true;
          }
        } catch (error1) {
          const tiffOptions = [{}, { compression: 'none' as const }, { compression: 'lzw' as const }];
          for (const options of tiffOptions) {
            try {
              await sharp(tempPngPath).tiff(options).toFile(outputPath);
              const testImage = sharp(outputPath);
              const outputMetadata = await testImage.metadata();
              const stats = await fs.stat(outputPath);
              if (stats.size > 0 && outputMetadata && outputMetadata.width && outputMetadata.height) {
                await testImage.resize(1, 1).toBuffer();
                tifConverted = true;
                break;
              }
            } catch (error) {
              continue;
            }
          }
        }
        
        if (!tifConverted) {
          await fs.copyFile(tempPngPath, outputPath);
        }
        await fs.unlink(tempPngPath).catch(() => {});
      } catch (error) {
        await fs.unlink(tempPngPath).catch(() => {});
        try {
          await buildPipeline().tiff({ compression: 'none', quality: 100 }).toFile(outputPath);
          await sharp(outputPath).metadata();
        } catch (finalError: any) {
          throw new Error(`Failed to process TIF image: ${finalError?.message || 'Unknown error'}`);
        }
      }
    } else {
      // Use actual format instead of extension for output
      console.log(`[APPLY FILTER] Using actual format (${inputFormat}) for output, extension is ${ext}`);
      if (inputFormat === 'png') {
        console.log(`[APPLY FILTER] Outputting as PNG`);
        await filterPipeline.png().toFile(outputPath);
      } else if (inputFormat === 'jpeg' || inputFormat === 'jpg') {
        console.log(`[APPLY FILTER] Outputting as JPEG (but extension is ${ext})`);
        await filterPipeline.jpeg({ quality: 90 }).toFile(outputPath);
      } else if (inputFormat === 'webp') {
        console.log(`[APPLY FILTER] Outputting as WebP`);
        await filterPipeline.webp({ quality: 90 }).toFile(outputPath);
      } else {
        // Fallback: use extension or default format
        console.log(`[APPLY FILTER] Using fallback format based on extension ${ext}`);
        if (ext === '.png') {
          await filterPipeline.png().toFile(outputPath);
        } else if (ext === '.jpg' || ext === '.jpeg') {
          await filterPipeline.jpeg({ quality: 90 }).toFile(outputPath);
        } else {
          await filterPipeline.toFile(outputPath);
        }
      }
    }
    
    console.log(`[APPLY FILTER] Filter applied successfully to ${outputPath}`);
  } catch (error: any) {
    console.error(`[APPLY FILTER] Error:`, error);
    console.error(`[APPLY FILTER] Error message:`, error?.message);
    console.error(`[APPLY FILTER] Error stack:`, error?.stack);
    throw error;
  }
}

// Rotate image
export async function rotateImage(
  inputPath: string,
  outputPath: string,
  angle: number
): Promise<void> {
  try {
    const metadata = await sharp(inputPath).metadata();
    const inputFormat = metadata.format;
    const ext = path.extname(outputPath).toLowerCase();
    
    // Handle TIF format - use ImageMagick command line for reliable TIF processing
    if (ext === '.tif' || ext === '.tiff' || inputFormat === 'tiff' || inputFormat === 'tif') {
      console.log(`[TIF ROTATE] Processing TIF image: ${inputPath} -> ${outputPath}`);
      console.log(`[TIF ROTATE] Angle: ${angle}`);
      const command = `magick "${inputPath}" -rotate ${angle} -background white -compress LZW "${outputPath}"`;
      return execAsync(command)
        .then(() => {
          console.log('[TIF ROTATE] ImageMagick rotate completed, verifying output...');
          return sharp(outputPath).metadata();
        })
        .then((metadata) => {
          console.log('[TIF ROTATE] Output verified successfully:', metadata);
        })
        .catch((magickError: any) => {
          console.error('[TIF ROTATE] ImageMagick command failed:', magickError);
          console.error('[TIF ROTATE] stderr:', magickError.stderr);
          console.error('[TIF ROTATE] stdout:', magickError.stdout);
          // Fallback to Sharp
          console.log('[TIF ROTATE] Falling back to Sharp processing...');
          return sharp(inputPath)
            .rotate(angle)
            .toBuffer()
            .then((buffer) => {
              const tempPngPath = outputPath + '.tmp.png';
              return fs.writeFile(tempPngPath, buffer)
                .then(() => {
                  return sharp(tempPngPath)
                    .tiff({ 
                      compression: 'lzw',
                      quality: 100,
                      predictor: 'horizontal'
                    })
                    .toFile(outputPath);
                })
                .then(() => {
                  return sharp(outputPath).metadata();
                })
                .then((metadata) => {
                  console.log('[TIF ROTATE] Sharp fallback successful, output metadata:', metadata);
                  return fs.unlink(tempPngPath).catch(() => {});
                });
            })
            .catch((fallbackError: any) => {
              console.error('[TIF ROTATE] Sharp fallback failed:', fallbackError);
              // Last resort: save as PNG but keep TIF extension
              return sharp(inputPath)
                .rotate(angle)
                .png()
                .toFile(outputPath + '.tmp.png')
                .then(() => {
                  return fs.copyFile(outputPath + '.tmp.png', outputPath);
                })
                .then(() => {
                  return fs.unlink(outputPath + '.tmp.png').catch(() => {});
                })
                .then(() => {
                  console.warn('[TIF ROTATE] Saved as PNG format (with TIF extension) due to conversion failure');
                })
                .catch((finalError: any) => {
                  throw new Error(`Failed to process TIF image: ${finalError?.message || 'Unknown error'}`);
                });
            });
        });
    } else if (ext === '.png') {
      await sharp(inputPath).rotate(angle).png().toFile(outputPath);
    } else if (ext === '.jpg' || ext === '.jpeg') {
      await sharp(inputPath).rotate(angle).jpeg({ quality: 90 }).toFile(outputPath);
    } else {
      await sharp(inputPath).rotate(angle).toFile(outputPath);
    }
  } catch (error) {
    throw error;
  }
}

// Resize image with quality preservation
export async function resizeImage(
  inputPath: string,
  outputPath: string,
  width: number,
  height: number,
  quality: number = 90
): Promise<void> {
  try {
    await sharp(inputPath)
      .resize(width, height, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality })
      .toFile(outputPath);
  } catch (error) {
    throw error;
  }
}
