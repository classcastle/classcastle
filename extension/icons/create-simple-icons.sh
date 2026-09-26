#!/bin/bash

# Create simple colored squares as placeholder icons
# This is a temporary solution - proper icons should be created from logo.svg

mkdir -p icons

# Create simple colored squares using ImageMagick if available
if command -v convert &> /dev/null; then
    convert -size 16x16 xc:#2F5233 icons/icon16.png
    convert -size 48x48 xc:#2F5233 icons/icon48.png
    convert -size 128x128 xc:#2F5233 icons/icon128.png
    echo "Created placeholder icons using ImageMagick"
else
    # Create empty files as placeholders
    touch icons/icon16.png icons/icon48.png icons/icon128.png
    echo "Created empty placeholder files. Please convert logo.svg to PNG icons manually."
fi
