# Extension Icons

This directory should contain the following PNG files:
- icon16.png (16x16 pixels)
- icon48.png (48x48 pixels)
- icon128.png (128x128 pixels)

## Creating Icons

You can create these icons from the logo.svg in the parent directory using:

### Using ImageMagick:
```bash
convert ../../logo.svg -resize 16x16 icon16.png
convert ../../logo.svg -resize 48x48 icon48.png
convert ../../logo.svg -resize 128x128 icon128.png
```

### Using Online Tools:
- https://cloudconvert.com/svg-to-png
- https://convertio.co/svg-png/

### Using Figma/Canva:
1. Import logo.svg
2. Export as PNG at the required sizes

## Temporary Solution

For testing, you can use any PNG images as placeholders until proper icons are created.
