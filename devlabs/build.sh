#!/bin/bash

# Build script for Classcastle Dev Labs deployment

echo "Building Classcastle Dev Labs package..."

# Clean up the existing Dev Labs zip
rm -f devlabs.zip

# Create Dev Labs zip (index.html and generateapikey.html)
echo "Creating devlabs.zip..."
zip -r devlabs.zip index.html generateapikey.html

echo "Build complete!"
echo "  - devlabs.zip ready for deployment to Cloudflare Pages (devlabs.classcastle.org)"
