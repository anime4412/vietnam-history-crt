const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE = 'https://felixrieseberg.com/assets/scene/885e250c/';

function fetchFile(relPath) {
  return new Promise((resolve, reject) => {
    const fullUrl = new URL(relPath, BASE).href;
    const localPath = path.join(__dirname, relPath);
    fs.mkdirSync(path.dirname(localPath), { recursive: true });

    https.get(fullUrl, (res) => {
      if (res.statusCode !== 200) {
        console.warn(`Failed ${relPath}: ${res.statusCode}`);
        return resolve(null);
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        fs.writeFileSync(localPath, buf);
        console.log(`Saved ${relPath} (${buf.length} bytes)`);
        resolve(buf.toString('utf8'));
      });
    }).on('error', err => {
      console.warn(`Error ${relPath}:`, err.message);
      resolve(null);
    });
  });
}

const queue = [
  'city/variants/depth.js',
  'city/lib/night.js',
  'notepad/notepad.js',
  'winframe/winframe.js',
  'credits/credits.js',
  'pccase/case.js',
  'vcrdoor/vcrdoor.js',
  'cdplayer/cdplayer.js',
  'calc/calc.js',
  'pckeys/pckeys.js',
  'coffee/coffee.js',
  'clock/clock.js',
  'touch/touch.js'
];

const seen = new Set(queue);

async function downloadAll() {
  while (queue.length > 0) {
    const item = queue.shift();
    const content = await fetchFile(item);
    if (!content) continue;

    // Check for nested relative imports
    const subImports = content.match(/(?:from|import)\s*\(?\s*["'](\.[^"']+)["']/g) || [];
    for (const imp of subImports) {
      const match = imp.match(/["'](\.[^"']+)["']/);
      if (match) {
        const resolved = path.normalize(path.join(path.dirname(item), match[1])).replace(/\\/g, '/');
        if (!seen.has(resolved) && !resolved.includes('three')) {
          seen.add(resolved);
          queue.push(resolved);
          console.log(`Discovered sub-import: ${resolved}`);
        }
      }
    }
  }
  console.log('Finished downloading scene modules!');
}

downloadAll();
