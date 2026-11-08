import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function packExtension() {
  const rootDir = path.resolve(__dirname, '..');
  const distDir = path.join(rootDir, 'dist');
  const outputFile = path.join(rootDir, 'sceneforge-promptpad-v1.0.0.zip');

  if (!fs.existsSync(distDir)) {
    console.error('Error: dist directory does not exist. Run "npm run build" first.');
    process.exit(1);
  }

  const zip = new JSZip();

  function addDirectoryToZip(dirPath, zipFolder) {
    const items = fs.readdirSync(dirPath);
    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        const subFolder = zipFolder.folder(item);
        addDirectoryToZip(fullPath, subFolder);
      } else {
        const fileData = fs.readFileSync(fullPath);
        zipFolder.file(item, fileData);
      }
    }
  }

  console.log('Packaging dist/ into sceneforge-promptpad-v1.0.0.zip...');
  addDirectoryToZip(distDir, zip);

  const zipBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });

  fs.writeFileSync(outputFile, zipBuffer);
  const sizeMb = (zipBuffer.length / (1024 * 1024)).toFixed(2);
  console.log(`Success! Created: sceneforge-promptpad-v1.0.0.zip (${sizeMb} MB)`);
}

packExtension().catch((err) => {
  console.error('Packaging failed:', err);
  process.exit(1);
});

