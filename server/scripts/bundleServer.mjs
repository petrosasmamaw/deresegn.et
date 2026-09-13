import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(__dirname, '..');
const projectRoot = path.resolve(serverRoot, '..');
const stagingDir = path.join(serverRoot, '.bundle-staging');
const zipOutputPath = path.join(projectRoot, 'deresegn-server.zip');
const serverZipPath = path.join(serverRoot, 'deresegn-server.zip');

console.log('📦 Preparing clean staging directory for Yegara Host deployment...');

if (fs.existsSync(stagingDir)) {
  fs.rmSync(stagingDir, { recursive: true, force: true });
}
fs.mkdirSync(stagingDir, { recursive: true });

// Explicit whitelist of runtime files and folders
const itemsToCopy = [
  'app.js',
  'auth.mjs',
  'auth.config.mjs',
  'drizzle.config.js',
  'package.json',
  'package-lock.json',
  '.env.production.example',
  'src',
  'scripts',
];

for (const item of itemsToCopy) {
  const srcPath = path.join(serverRoot, item);
  const destPath = path.join(stagingDir, item);
  if (fs.existsSync(srcPath)) {
    fs.cpSync(srcPath, destPath, { recursive: true });
    console.log(`  ✓ Included: ${item}`);
  }
}

// Clean any previous zip files
if (fs.existsSync(zipOutputPath)) fs.unlinkSync(zipOutputPath);
if (fs.existsSync(serverZipPath)) fs.unlinkSync(serverZipPath);

console.log('⚡ Compressing into deresegn-server.zip (excluding node_modules and local .env)...');

try {
  const tarCommand = `tar.exe -a -c -f "${serverZipPath}" -C "${stagingDir}" .`;
  execSync(tarCommand, { stdio: 'inherit' });

  // Copy to workspace root for convenience
  fs.copyFileSync(serverZipPath, zipOutputPath);

  const stats = fs.statSync(serverZipPath);
  const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
  const sizeKb = (stats.size / 1024).toFixed(1);

  console.log(`\n🎉 Success! Production zip created:`);
  console.log(`   Size: ${sizeMb > 1 ? sizeMb + ' MB' : sizeKb + ' KB'}`);
  console.log(`   Location: ${serverZipPath}`);
  console.log(`   Root shortcut: ${zipOutputPath}\n`);
} finally {
  if (fs.existsSync(stagingDir)) {
    fs.rmSync(stagingDir, { recursive: true, force: true });
  }
}
