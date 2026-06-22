const fs = require('fs');
const path = require('path');

const imgDir = path.resolve(__dirname, 'img');
const manifestPath = path.join(imgDir, 'manifest.json');
const allowedExtensions = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.mp4', '.webm', '.ogg']);

function isAllowedFile(file) {
  const ext = path.extname(file).toLowerCase();
  return allowedExtensions.has(ext);
}

function generateManifest() {
  const files = fs.readdirSync(imgDir).filter(file => {
    if (file === 'manifest.json') return false;
    if (file.startsWith('.')) return false;
    return isAllowedFile(file);
  }).sort((a,b) => a.localeCompare(b, undefined, {sensitivity: 'base'}));
  fs.writeFileSync(manifestPath, JSON.stringify(files, null, 2) + '\n', 'utf8');
  console.log(`Generated ${files.length} entries in img/manifest.json`);
  files.forEach(file => console.log(` - ${file}`));
}

try {
  generateManifest();
} catch (err) {
  console.error('Failed to generate img/manifest.json:', err.message || err);
  process.exit(1);
}
