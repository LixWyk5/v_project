
import * as path from 'path';
import * as fs from 'fs';

async function testRename() {
    const originalName = "Test Image Name";
    const filename = "test_image.png";
    const ext = path.extname(filename);

    console.log(`Original: ${originalName}`);
    console.log(`Filename: ${filename}`);
    console.log(`Ext: ${ext}`);

    const safeName = originalName.replace(/[^a-z0-9\-_ ]/gi, "_").trim();
    console.log(`SafeName: '${safeName}'`);

    const newFilename = `${safeName}${ext}`;
    console.log(`NewFilename: '${newFilename}'`);

    const currentFilePath = path.resolve('./test_image.png');
    const newFilePath = path.join(path.dirname(currentFilePath), newFilename);

    console.log(`Current Path: ${currentFilePath}`);
    console.log(`New Path: ${newFilePath}`);

    // Simulate file creation
    fs.writeFileSync(currentFilePath, 'dummy content');
    console.log('Created dummy file');

    try {
        if (fs.existsSync(newFilePath)) {
            fs.unlinkSync(newFilePath);
        }

        fs.renameSync(currentFilePath, newFilePath);
        console.log('Rename successful');

        if (fs.existsSync(newFilePath)) {
            console.log('New file exists');
        } else {
            console.error('New file MISSING!');
        }

        if (fs.existsSync(currentFilePath)) {
            console.error('Old file still exists!');
        } else {
            console.log('Old file gone');
        }

    } catch (e) {
        console.error('Rename failed:', e);
    } finally {
        // Cleanup
        if (fs.existsSync(newFilePath)) fs.unlinkSync(newFilePath);
        if (fs.existsSync(currentFilePath)) fs.unlinkSync(currentFilePath);
    }
}

testRename();
