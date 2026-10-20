#!/bin/bash

# Build script for Classcastle Dev Labs and API deployment

echo "Building Classcastle deployment packages..."

# Clean up existing zip files
rm -f api.zip devlabs.zip

# Create API zip (contents of api/ folder)
echo "Creating api.zip..."
cd api
zip -r ../api.zip .
cd ..

# Create Dev Labs zip (index.html and generateapikey.html)
echo "Creating devlabs.zip..."
zip -r devlabs.zip index.html generateapikey.html

echo "Build complete!"
echo "  - api.zip ready for deployment to api.classcastle.org"
echo "  - devlabs.zip ready for deployment to devlabs.classcastle.org"
