#!/bin/bash

# Build script for Classcastle extension
# Creates ZIP files for Chrome and Firefox

set -e

cd "$(dirname "$0")"

echo "Building Classcastle extension..."

# Clean build directories
rm -rf build/chrome build/firefox
mkdir -p build/firefox build/chrome

# Copy manifests
cp manifest-chrome.json build/chrome/manifest.json
cp manifest-firefox.json build/firefox/manifest.json

# Copy shared files
cp background.js popup.js popup.html content.js supabase.min.js build/chrome/
cp background.js popup.js popup.html content.js supabase.min.js build/firefox/

# Copy icons
cp -r icons build/chrome/
cp -r icons build/firefox/

# Create ZIP files (zip contents, not the folder itself)
cd build/chrome
zip -r ../classcastle-chrome.zip *
cd ../firefox
zip -r ../classcastle-firefox.zip *
cd ../..

echo "Build complete!"
echo "Chrome ZIP: build/classcastle-chrome.zip"
echo "Firefox ZIP: build/classcastle-firefox.zip"
