// Create base64-encoded PNG icons for the extension
// This creates simple colored squares as placeholders

function createSimpleIcon(size, color) {
  // Create a simple colored square as a PNG
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Fill with color
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, size, size);

  // Add a simple castle shape
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

  return canvas.toDataURL('image/png');
}

// Generate icons
const sizes = [16, 48, 128];
const color = '#2F5233';

sizes.forEach(size => {
  const dataUrl = createSimpleIcon(size, color);
  console.log(`// icon${size}.png`);
  console.log(`const icon${size} = "${dataUrl}";`);
  console.log();
});
