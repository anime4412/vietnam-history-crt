const https = require('https');
const fs = require('fs');
const path = require('path');

function fetchUrl(url, destPath) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    https.get(url, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location, destPath).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        console.error(`Failed ${url}: ${res.statusCode}`);
        return resolve(false);
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        fs.writeFileSync(destPath, buf);
        console.log(`Downloaded ${path.basename(destPath)} (${buf.length} bytes)`);
        resolve(buf.toString('utf8'));
      });
    }).on('error', reject);
  });
}

const CDN_BASE = 'https://cdn.jsdelivr.net/npm/three@0.169.0/';
const filesToFetch = [
  { url: CDN_BASE + 'build/three.module.js', local: 'vendor/three/three.module.js' },
  { url: CDN_BASE + 'examples/jsm/loaders/GLTFLoader.js', local: 'vendor/three/addons/loaders/GLTFLoader.js' },
  { url: CDN_BASE + 'examples/jsm/controls/OrbitControls.js', local: 'vendor/three/addons/controls/OrbitControls.js' },
  { url: CDN_BASE + 'examples/jsm/postprocessing/EffectComposer.js', local: 'vendor/three/addons/postprocessing/EffectComposer.js' },
  { url: CDN_BASE + 'examples/jsm/postprocessing/RenderPass.js', local: 'vendor/three/addons/postprocessing/RenderPass.js' },
  { url: CDN_BASE + 'examples/jsm/postprocessing/UnrealBloomPass.js', local: 'vendor/three/addons/postprocessing/UnrealBloomPass.js' },
  { url: CDN_BASE + 'examples/jsm/postprocessing/ShaderPass.js', local: 'vendor/three/addons/postprocessing/ShaderPass.js' },
  { url: CDN_BASE + 'examples/jsm/postprocessing/OutputPass.js', local: 'vendor/three/addons/postprocessing/OutputPass.js' },
  { url: CDN_BASE + 'examples/jsm/lights/RectAreaLightUniformsLib.js', local: 'vendor/three/addons/lights/RectAreaLightUniformsLib.js' },
  { url: CDN_BASE + 'examples/jsm/postprocessing/Pass.js', local: 'vendor/three/addons/postprocessing/Pass.js' },
  { url: CDN_BASE + 'examples/jsm/postprocessing/MaskPass.js', local: 'vendor/three/addons/postprocessing/MaskPass.js' },
  { url: CDN_BASE + 'examples/jsm/shaders/CopyShader.js', local: 'vendor/three/addons/shaders/CopyShader.js' },
  { url: CDN_BASE + 'examples/jsm/shaders/LuminosityHighPassShader.js', local: 'vendor/three/addons/shaders/LuminosityHighPassShader.js' },
  { url: CDN_BASE + 'examples/jsm/shaders/OutputShader.js', local: 'vendor/three/addons/shaders/OutputShader.js' },
  { url: CDN_BASE + 'examples/jsm/shaders/ColorCorrectionShader.js', local: 'vendor/three/addons/shaders/ColorCorrectionShader.js' }
];

async function main() {
  for (const item of filesToFetch) {
    await fetchUrl(item.url, path.join(__dirname, item.local));
  }
  console.log('All Three.js vendor files downloaded locally!');
}

main().catch(console.error);
