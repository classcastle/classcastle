#!/bin/bash

# Script to create extension icons from the logo
# Requires ImageMagick or similar tool

# Create icons directory if it doesn't exist
mkdir -p icons

# If you have ImageMagick installed, you can use:
# convert ../logo.svg -resize 16x16 icons/icon16.png
# convert ../logo.svg -resize 48x48 icons/icon48.png
# convert ../logo.svg -resize 128x128 icons/icon128.png

# For now, create simple placeholder files
echo "Creating placeholder icon files..."

# Create simple colored squares as placeholders
# You should replace these with actual icons from the logo

echo "Icon files need to be created manually or with an image conversion tool."
echo "See README.md for instructions."
