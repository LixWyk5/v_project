const https = require('https');
const fs = require('fs');
const path = require('path');

// PNG icon URLs from Voyis website (these are more likely to download successfully)
const icons = [
    { name: 'voyis-icon.png', url: 'https://voyis.com/wp-content/uploads/2023/07/cropped-voyis-yellow-icon-192x192.png' },
    { name: 'rov-skid.png', url: 'https://voyis.com/wp-content/uploads/2021/06/rov-skid-01-e1624648998562.png' },
];

const outputDir = path.join(__dirname, '../src/renderer/public/icons');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// Download function with proper headers
function downloadIcon(iconUrl, filename) {
    return new Promise((resolve, reject) => {
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'image/png,image/*,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': 'https://voyis.com/',
                'Connection': 'keep-alive',
            }
        };

        https.get(iconUrl, options, (response) => {
            if (response.statusCode === 200) {
                const filePath = path.join(outputDir, filename);
                const fileStream = fs.createWriteStream(filePath);

                response.pipe(fileStream);

                fileStream.on('finish', () => {
                    fileStream.close();
                    console.log(`✅ Downloaded: ${filename} (${response.headers['content-length']} bytes)`);
                    resolve();
                });
            } else if (response.statusCode === 301 || response.statusCode === 302) {
                // Handle redirects
                console.log(`↪️  Redirect for ${filename} to: ${response.headers.location}`);
                downloadIcon(response.headers.location, filename).then(resolve).catch(reject);
            } else {
                console.log(`❌ Failed to download ${filename}: HTTP ${response.statusCode}`);
                reject(new Error(`HTTP ${response.statusCode}`));
            }
        }).on('error', (err) => {
            console.log(`❌ Error downloading ${filename}:`, err.message);
            reject(err);
        });
    });
}

// Download all icons with delay
async function downloadAll() {
    console.log('🔽 Starting PNG icon downloads from Voyis...\n');

    for (const icon of icons) {
        try {
            await downloadIcon(icon.url, icon.name);
            // Add delay between requests to be polite
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
            // Continue even if one fails
        }
    }

    console.log('\n✅ Download process completed!');
    console.log(`📁 Icons saved to: ${outputDir}`);
}

downloadAll();
