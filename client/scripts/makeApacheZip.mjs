/**
 * Zip dist/ contents for Apache public_html with forward-slash entry paths.
 * Usage: node scripts/makeApacheZip.mjs
 */
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(__dirname, '..');
const distDir = path.join(clientRoot, 'dist');
const outZip = path.join(clientRoot, 'archive.zip');

function walk(dir, base = dir, files = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, base, files);
    else files.push(path.relative(base, full));
  }
  return files;
}

/** CRC32 for ZIP */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function u16(n) {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n, 0);
  return b;
}
function u32(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n >>> 0, 0);
  return b;
}

function dosDateTime(d = new Date()) {
  const dosTime = (d.getSeconds() >> 1) | (d.getMinutes() << 5) | (d.getHours() << 11);
  const dosDate = d.getDate() | ((d.getMonth() + 1) << 5) | ((d.getFullYear() - 1980) << 9);
  return { dosTime, dosDate };
}

function createZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const { dosTime, dosDate } = dosDateTime();

  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const compressed = zlib.deflateRawSync(data, { level: 9 });
    const crc = crc32(data);
    const method = 8; // deflate

    const localHeader = Buffer.concat([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(method),
      u16(dosTime),
      u16(dosDate),
      u32(crc),
      u32(compressed.length),
      u32(data.length),
      u16(nameBuf.length),
      u16(0),
      nameBuf,
    ]);

    const central = Buffer.concat([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(method),
      u16(dosTime),
      u16(dosDate),
      u32(crc),
      u32(compressed.length),
      u32(data.length),
      u16(nameBuf.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      nameBuf,
    ]);

    localParts.push(localHeader, compressed);
    centralParts.push(central);
    offset += localHeader.length + compressed.length;
  }

  const centralDir = Buffer.concat(centralParts);
  const localData = Buffer.concat(localParts);
  const end = Buffer.concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(centralDir.length),
    u32(localData.length),
    u16(0),
  ]);

  return Buffer.concat([localData, centralDir, end]);
}

if (!fs.existsSync(path.join(distDir, 'index.html'))) {
  console.error('dist/index.html missing — run production build first');
  process.exit(1);
}

const htaccessSrc = path.join(clientRoot, 'deploy', 'htaccess-public_html');
fs.copyFileSync(htaccessSrc, path.join(distDir, '.htaccess'));

const relFiles = walk(distDir);
const hasAssets = relFiles.some((e) => e.split(path.sep).join('/').startsWith('assets/'));
if (!hasAssets) {
  console.error('dist/assets missing');
  process.exit(1);
}

const entries = relFiles
  .map((rel) => {
    const name = rel.split(path.sep).join('/'); // force forward slashes
    const data = fs.readFileSync(path.join(distDir, rel));
    return { name, data };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

const zipBuf = createZip(entries);
if (fs.existsSync(outZip)) fs.unlinkSync(outZip);
fs.writeFileSync(outZip, zipBuf);

// Verify by reading central directory names heuristically via unzip parse
function listZipNames(buf) {
  const names = [];
  let i = 0;
  while (i < buf.length - 4) {
    const sig = buf.readUInt32LE(i);
    if (sig === 0x02014b50) {
      const nameLen = buf.readUInt16LE(i + 28);
      const extraLen = buf.readUInt16LE(i + 30);
      const commentLen = buf.readUInt16LE(i + 32);
      const name = buf.subarray(i + 46, i + 46 + nameLen).toString('utf8');
      names.push(name);
      i += 46 + nameLen + extraLen + commentLen;
      continue;
    }
    if (sig === 0x06054b50) break;
    i += 1;
  }
  return names;
}

const names = listZipNames(zipBuf);
const bad = names.filter((n) => n.includes('\\'));
console.log('--- ZIP VERIFY ---');
console.log('path:', outZip);
console.log('count:', names.length);
console.log('backslash_bad:', bad.length);
console.log('has index.html:', names.includes('index.html'));
console.log('has .htaccess:', names.includes('.htaccess'));
console.log('has assets/:', names.some((n) => n.startsWith('assets/')));
console.log('entries:');
for (const n of names) console.log(' ', n);

if (bad.length || !names.includes('index.html') || !names.includes('.htaccess')) {
  process.exit(1);
}

// Confirm API URL baked into JS bundle
const jsFiles = relFiles.filter((f) => f.split(path.sep).join('/').startsWith('assets/') && f.endsWith('.js'));
let baked = false;
for (const f of jsFiles) {
  const text = fs.readFileSync(path.join(distDir, f), 'utf8');
  if (text.includes('deresegn-et.onrender.com')) {
    baked = true;
    break;
  }
}
console.log('api_url_baked:', baked);
if (!baked) {
  console.error('Production API URL not found in built JS');
  process.exit(1);
}
console.log('OK archive.zip ready');
