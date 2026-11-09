#!/bin/bash

# Build script for Classcastle Dev Labs deployment

echo "Building Classcastle Dev Labs packages..."

# Clean up existing deployment archives
rm -f devlabs.zip api.zip

# Create Dev Labs zip (landing page, legacy docs, and API key page)
echo "Creating devlabs.zip..."
zip -r devlabs.zip index.html legacy-api.html generateapikey.html

# Create API zip for Netlify deployment
echo "Creating api.zip..."
zip -r api.zip api

echo "Build complete!"
echo "  - devlabs.zip ready for deployment to Cloudflare Pages (devlabs.classcastle.org)"
echo "  - api.zip ready for API deployment"
