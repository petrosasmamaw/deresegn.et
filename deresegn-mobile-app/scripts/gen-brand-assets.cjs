const fs = require('fs')
const path = require('path')
const { Resvg } = require('@resvg/resvg-js')
const sharp = require('sharp')

const root = path.join(__dirname, '..')
const svgPath = path.join(root, '../client/public/deresegn-logo.svg')
const assets = path.join(root, 'assets')
const svg = fs.readFileSync(svgPath)

async function main() {
  const logo1024 = new Resvg(svg, { fitTo: { mode: 'width', value: 1024 } }).render().asPng()
  fs.writeFileSync(path.join(assets, 'deresegn-logo.png'), logo1024)
  fs.writeFileSync(path.join(assets, 'icon.png'), logo1024)
  console.log('deresegn-logo.png + icon.png')

  const cream = { r: 244, g: 238, b: 220, alpha: 255 }
  await sharp(logo1024)
    .resize(720, 720, { fit: 'contain', background: cream })
    .extend({ top: 152, bottom: 152, left: 152, right: 152, background: cream })
    .resize(1024, 1024)
    .png()
    .toFile(path.join(assets, 'splash-icon.png'))
  console.log('splash-icon.png')

  await sharp(logo1024)
    .resize(680, 680, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({
      top: 172,
      bottom: 172,
      left: 172,
      right: 172,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .resize(1024, 1024)
    .png()
    .toFile(path.join(assets, 'android-icon-foreground.png'))
  console.log('android-icon-foreground.png')

  await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 3,
      background: { r: 244, g: 238, b: 220 },
    },
  })
    .png()
    .toFile(path.join(assets, 'android-icon-background.png'))
  console.log('android-icon-background.png')

  const monoSvg = `<?xml version="1.0"?>
<svg width="1024" height="1024" viewBox="0 0 600 600" xmlns="http://www.w3.org/2000/svg">
  <rect width="600" height="600" fill="#000000" fill-opacity="0"/>
  <g transform="translate(120 80)">
    <rect x="0" y="0" width="360" height="360" rx="52" fill="#ffffff"/>
    <path d="M70,210 L142,282 L302,122" fill="none" stroke="#000000" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`
  const mono = new Resvg(monoSvg, { fitTo: { mode: 'width', value: 1024 } }).render().asPng()
  await sharp(mono)
    .resize(680, 680, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({
      top: 172,
      bottom: 172,
      left: 172,
      right: 172,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .resize(1024, 1024)
    .png()
    .toFile(path.join(assets, 'android-icon-monochrome.png'))
  console.log('android-icon-monochrome.png')

  await sharp(logo1024).resize(48, 48).png().toFile(path.join(assets, 'favicon.png'))
  fs.copyFileSync(svgPath, path.join(assets, 'deresegn-logo.svg'))
  console.log('favicon.png + svg copy — done')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
