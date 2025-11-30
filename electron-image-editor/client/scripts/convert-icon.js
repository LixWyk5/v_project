const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const svgPath = path.join(__dirname, '../src/renderer/public/voyis-icon.svg');
const outputPath = path.join(__dirname, '../resources/icon.png');

// Ensure resources directory exists
const resourcesDir = path.join(__dirname, '../resources');
if (!fs.existsSync(resourcesDir)) {
    fs.mkdirSync(resourcesDir, { recursive: true });
}

// Convert SVG to PNG
sharp(svgPath)
    .resize(512, 512)
    .png()
    .toFile(outputPath)
    .then(() => {
        console.log('✅ Icon converted successfully!');
        console.log(`   Output: ${outputPath}`);
    })
    .catch(err => {
        console.error('❌ Error converting icon:', err);
        process.exit(1);
    });
