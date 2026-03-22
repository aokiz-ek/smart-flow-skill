#!/usr/bin/env node
/**
 * Generate simple SVG-based PNG icons for the Ethan browser extension.
 * Run: node generate-icons.js
 * Requires: no external dependencies (uses Canvas API via node-canvas or just writes SVG placeholders)
 */

const fs = require('fs');
const path = require('path');

// Create simple SVG icons as PNG substitutes
// In a real build, you'd use a proper icon tool
const svgTemplate = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6366f1;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#8b5cf6;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${Math.round(size * 0.2)}" fill="url(#grad)"/>
  <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-size="${Math.round(size * 0.55)}" fill="white">⚡</text>
</svg>`;

const sizes = [16, 48, 128];
for (const size of sizes) {
const svgPath = path.join(__dirname, `icon${size}.svg`);
  fs.writeFileSync(svgPath, svgTemplate(size), 'utf-8');
  console.log(`✅ Generated icons/icon${size}.svg`);
}

console.log('\n💡 To convert SVG to PNG, install librsvg or use an online converter.');
console.log('   Or replace the SVG files with actual PNG icons.');
