import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';

const prisma = new PrismaClient();

async function main() {
    // Clean up any existing images before seeding
    await prisma.image.deleteMany();

    const sampleImages = [
        {
            filename: 'sample_image_1.png',
            originalName: 'Voyis Sample Image 1',
            sourcePath: '../sample_images/image.png'
        },
        {
            filename: 'sample_image_2.png',
            originalName: 'Voyis Sample Image 2',
            sourcePath: '../sample_images/icon.png'
        }
    ];

    const uploadsDir = path.join(__dirname, '../uploads');
    const thumbnailsDir = path.join(__dirname, '../thumbnails');

    // Ensure directories exist
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
    }
    if (!fs.existsSync(thumbnailsDir)) {
        fs.mkdirSync(thumbnailsDir, { recursive: true });
    }

    for (const sample of sampleImages) {
        const sourceFile = path.join(__dirname, sample.sourcePath);
        const targetFile = path.join(uploadsDir, sample.filename);
        const thumbnailFile = path.join(thumbnailsDir, `thumb_${sample.filename}`);

        // Check if image already exists in database
        const existing = await prisma.image.findUnique({
            where: { filename: sample.filename }
        });

        if (existing) {
            console.log(`⏭️  Skipping ${sample.filename} (already exists)`);
            continue;
        }

        // Copy file to uploads directory
        if (fs.existsSync(sourceFile)) {
            fs.copyFileSync(sourceFile, targetFile);
            console.log(`📁 Copied ${sample.filename} to uploads`);

            // Get image metadata
            const metadata = await sharp(targetFile).metadata();
            const stats = fs.statSync(targetFile);

            // Generate thumbnail
            await sharp(targetFile)
                .resize(300, 300, { fit: 'inside' })
                .toFile(thumbnailFile);
            console.log(`🖼️  Generated thumbnail for ${sample.filename}`);

            // Insert into database
            await prisma.image.create({
                data: {
                    filename: sample.filename,
                    originalName: sample.originalName,
                    filePath: `/app/uploads/${sample.filename}`,
                    thumbnailPath: `/app/thumbnails/thumb_${sample.filename}`,
                    fileSize: BigInt(stats.size),
                    format: metadata.format || 'png',
                    width: metadata.width || null,
                    height: metadata.height || null,
                    isCorrupted: false,
                    source: 'local',
                    metadata: {
                        space: metadata.space,
                        channels: metadata.channels,
                        depth: metadata.depth,
                        density: metadata.density,
                        hasAlpha: metadata.hasAlpha
                    }
                }
            });

            console.log(`✅ Seeded ${sample.filename} to database`);
        } else {
            console.log(`⚠️  Source file not found: ${sourceFile}`);
        }
    }

    console.log('🎉 Database seed completed!');
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
