// Simple script to create placeholder icons using canvas
// Run with: node create-placeholder-icons.js

const fs = require('fs');
const { createCanvas } = require('canvas');

function createIcon(size, filename) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#2F5233';
  ctx.fillRect(0, 0, size, size);

  // Castle shape (simplified)
  ctx.fillStyle = '#D98E2B';
  const padding = size * 0.2;
  const castleSize = size - (padding * 2);

  // Castle base
  ctx.fillRect(padding, size * 0.6, castleSize, size * 0.3);

  // Castle towers
  ctx.fillRect(padding, size * 0.3, size * 0.2, size * 0.4);
  ctx.fillRect(size - padding - (size * 0.2), size * 0.3, size * 0.2, size * 0.4);

  // Castle middle
  ctx.fillRect(padding + (size * 0.25), size * 0.4, size * 0.5, size * 0.3);

  // Save as PNG
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(filename, buffer);
  console.log(`Created ${filename}`);
}

// Create icons
try {
  createIcon(16, 'icons/icon16.png');
  createIcon(48, 'icons/icon48.png');
  createIcon(128, 'icons/icon128.png');
  console.log('All icons created successfully!');
} catch (error) {
  console.error('Error creating icons:', error);
  console.log('Note: This script requires the "canvas" package. Install with: npm install canvas');
}
