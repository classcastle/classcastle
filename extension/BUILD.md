# Extension Build Instructions

This extension uses separate manifest files for Chrome and Firefox to ensure full compatibility with both browsers.

## Files

- `manifest-chrome.json` - Manifest v3 for Chrome (service worker)
- `manifest-firefox.json` - Manifest v2 for Firefox (event page)
- `background.js` - Shared background script (auto-detects manifest version)
- `popup.js` - Shared popup script
- `popup.html` - Shared popup HTML
- `content.js` - Content script for Firefox (also works in Chrome)
- `supabase.min.js` - Supabase client library

## Quick Build (ZIP files)

Pre-built ZIP files are available in the `build/` folder:

- `build/classcastle-chrome.zip` - Ready to load in Chrome
- `build/classcastle-firefox.zip` - Ready to load in Firefox

### Loading ZIP in Chrome

1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Unzip `classcastle-chrome.zip` to a temporary folder
5. Select the unzipped folder

**Note:** The ZIP contains the extension files directly (not wrapped in a folder). When you unzip it, the files will be in the folder you select.

### Loading ZIP in Firefox

1. Open `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Select `classcastle-firefox.zip` directly

**Note:** The ZIP contains the extension files directly (not wrapped in a folder), which is what Firefox expects.

## Manual Build

### Building for Chrome

1. Copy `manifest-chrome.json` to `manifest.json`:
   ```bash
   cp manifest-chrome.json manifest.json
   ```

2. Load the extension in Chrome:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the extension folder

### Building for Firefox

1. Copy `manifest-firefox.json` to `manifest.json`:
   ```bash
   cp manifest-firefox.json manifest.json
   ```

2. Load the extension in Firefox:
   - Open `about:debugging#/runtime/this-firefox`
   - Click "Load Temporary Add-on"
   - Select the `manifest.json` file

## Rebuilding ZIP Files

### Using the build script (recommended)

```bash
cd extension
./build.sh
```

### Manual build

To rebuild the ZIP files after making changes:

```bash
cd extension
mkdir -p build/firefox build/chrome
cp manifest-chrome.json build/chrome/manifest.json
cp manifest-firefox.json build/firefox/manifest.json
cp background.js popup.js popup.html content.js supabase.min.js build/chrome/
cp background.js popup.js popup.html content.js supabase.min.js build/firefox/
cp -r icons build/chrome/
cp -r icons build/firefox/
cd build/chrome
zip -r ../classcastle-chrome.zip *
cd ../firefox
zip -r ../classcastle-firefox.zip *
cd ../..
```

**Important:** ZIP the contents of the folders, not the folders themselves. Firefox requires the ZIP to contain the extension files directly at the root level.

## Testing Both Browsers

To quickly switch between browsers during development:

```bash
# For Chrome
cp manifest-chrome.json manifest.json

# For Firefox
cp manifest-firefox.json manifest.json
```

## Differences Between Manifests

### Chrome (manifest v3)
- Uses `service_worker` for background script
- Uses `action` instead of `browser_action`
- Uses `externally_connectable` for cross-origin messaging
- Requires `host_permissions` instead of `permissions` for network access
- No `tabs` permission needed (service worker has limited tab access)

### Firefox (manifest v2)
- Uses event page (`persistent: false`) for background script
- Uses `browser_action`
- Uses content script for cross-origin messaging (no `externally_connectable`)
- Uses `permissions` for network access
- Requires `tabs` permission for tab manipulation
- Uses `browser_specific_settings.gecko` for extension ID

## Shared Code

The background script automatically detects the manifest version:

```javascript
const isManifestV3 = api.runtime.getManifest().manifest_version === 3;
```

This allows the same code to work with both manifest formats, adjusting behavior as needed (e.g., whether to use `externally_connectable` or content script messaging).

## Version Bumping

When updating the extension:
1. Update the version in both `manifest-chrome.json` and `manifest-firefox.json`
2. Update the version in `BUILD.md` for documentation
3. Commit both manifest files together
