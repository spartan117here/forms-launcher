const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const iconsDir = path.join(__dirname, '..', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

/**
 * Creates the official forms-launcher app icon SVG.
 * Design:
 * - Solid purple background (#7248B9)
 * - Rounded document with folded top-right corner
 * - Artwork strictly inside central 60% safe zone for Android maskable compliance
 * - White checklist (small dots + horizontal lines)
 */
function createIconSvg({ size = 512, isFavicon = false } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}">
  <defs>
    <!-- Soft shadow for document elevation -->
    <filter id="docShadow" x="-15%" y="-15%" width="130%" height="135%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#1f0945" flood-opacity="0.45" />
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#1f0945" flood-opacity="0.25" />
    </filter>

    <!-- Translucent glass document face -->
    <linearGradient id="docGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.24" />
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0.14" />
    </linearGradient>

    <!-- Crisp illumination on folded dog-ear flap -->
    <linearGradient id="foldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.96" />
      <stop offset="50%" stop-color="#f2ebff" stop-opacity="0.92" />
      <stop offset="100%" stop-color="#d8c8fa" stop-opacity="0.88" />
    </linearGradient>

    <!-- Shadow cast underneath the fold -->
    <linearGradient id="foldShadow" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#2a0d5c" stop-opacity="0.4" />
      <stop offset="100%" stop-color="#2a0d5c" stop-opacity="0" />
    </linearGradient>
  </defs>

  <!-- Solid Purple Background (#7248B9) -->
  <rect width="512" height="512" ${isFavicon ? 'rx="112"' : ''} fill="#7248B9" />

  <!-- Document Sheet with Folded Top-Right Corner (Inside 60% safe zone [102..410]) -->
  <g filter="url(#docShadow)">
    <!-- Base Document Body -->
    <path d="M 166 120
             L 312 120
             L 374 182
             L 374 366
             A 26 26 0 0 1 348 392
             L 164 392
             A 26 26 0 0 1 138 366
             L 138 148
             A 26 26 0 0 1 166 120 Z"
          fill="url(#docGrad)"
          stroke="#ffffff"
          stroke-width="6"
          stroke-linejoin="round" />

    <!-- Corner Fold Triangle Cast Shadow -->
    <path d="M 312 122 L 312 182 L 372 182 Z"
          fill="url(#foldShadow)" />

    <!-- Folded Dog-Ear Flap with sleek rounded tip -->
    <path d="M 312 120
             L 312 166
             A 16 16 0 0 0 328 182
             L 374 182 Z"
          fill="url(#foldGrad)"
          stroke="#ffffff"
          stroke-width="3.5"
          stroke-linejoin="round" />
  </g>

  <!-- White Checklist: Small Dots + Horizontal Lines -->
  <!-- Row 1 -->
  <g>
    <circle cx="182" cy="216" r="9.5" fill="#ffffff" />
    <line x1="210" y1="216" x2="330" y2="216" stroke="#ffffff" stroke-width="13" stroke-linecap="round" />
  </g>

  <!-- Row 2 -->
  <g>
    <circle cx="182" cy="266" r="9.5" fill="#ffffff" />
    <line x1="210" y1="266" x2="330" y2="266" stroke="#ffffff" stroke-width="13" stroke-linecap="round" />
  </g>

  <!-- Row 3 -->
  <g>
    <circle cx="182" cy="316" r="9.5" fill="#ffffff" />
    <line x1="210" y1="316" x2="292" y2="316" stroke="#ffffff" stroke-width="13" stroke-linecap="round" />
  </g>

  <!-- Row 4 -->
  <g>
    <circle cx="182" cy="360" r="9.5" fill="#ffffff" />
    <line x1="210" y1="360" x2="260" y2="360" stroke="#ffffff" stroke-width="13" stroke-linecap="round" />
  </g>
</svg>`;
}

async function run() {
  console.log('Generating updated PWA icons with solid #7248B9 background...');

  // 1. favicon.svg (with slightly rounded outer container for browser tab elegance)
  const faviconSvg = createIconSvg({ size: 128, isFavicon: true });
  fs.writeFileSync(path.join(iconsDir, 'favicon.svg'), faviconSvg, 'utf8');
  console.log('✓ Created icons/favicon.svg');

  // Master SVG with solid purple background for rasterization
  const masterSvg = createIconSvg({ size: 512, isFavicon: false });

  // 2. icon-512.png (512x512)
  await sharp(Buffer.from(masterSvg))
    .resize(512, 512)
    .png()
    .toFile(path.join(iconsDir, 'icon-512.png'));
  console.log('✓ Created icons/icon-512.png');

  // 3. icon-192.png (192x192)
  await sharp(Buffer.from(masterSvg))
    .resize(192, 192)
    .png()
    .toFile(path.join(iconsDir, 'icon-192.png'));
  console.log('✓ Created icons/icon-192.png');

  // 4. icon-maskable-512.png (512x512, solid #7248B9, artwork within 60% safe zone)
  await sharp(Buffer.from(masterSvg))
    .resize(512, 512)
    .png()
    .toFile(path.join(iconsDir, 'icon-maskable-512.png'));
  console.log('✓ Created icons/icon-maskable-512.png');

  // 5. icon-maskable-192.png (192x192, solid #7248B9, artwork within 60% safe zone)
  await sharp(Buffer.from(masterSvg))
    .resize(192, 192)
    .png()
    .toFile(path.join(iconsDir, 'icon-maskable-192.png'));
  console.log('✓ Created icons/icon-maskable-192.png');

  // 6. apple-touch-icon.png (180x180)
  await sharp(Buffer.from(masterSvg))
    .resize(180, 180)
    .png()
    .toFile(path.join(iconsDir, 'apple-touch-icon.png'));
  console.log('✓ Created icons/apple-touch-icon.png');

  console.log('All icons generated successfully!');
}

run().catch((err) => {
  console.error('Failed to generate icons:', err);
  process.exit(1);
});
