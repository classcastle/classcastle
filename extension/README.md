# Classcastle Browser Extension

A Chrome/Firefox extension that allows teachers to navigate student browsers in real-time.

## Installation

### Chrome/Edge:
1. Open the browser and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked"
4. Select this `extension` folder

### Firefox:
1. Open the browser and navigate to `about:debugging`
2. Click "This Firefox"
3. Click "Load Temporary Add-on"
4. Select this `extension` folder

## Features

- **Room Joining**: Students can join a classroom by entering the room code and their name
- **Real-time Navigation**: Teacher can navigate all student browsers to a URL with one click
- **Online Status**: Extension keeps student status updated in real-time
- **Local Storage**: Session persists across browser restarts

## Icon Setup

The extension requires icon files in the `icons/` folder:
- `icon16.png` - 16x16 pixels
- `icon48.png` - 48x48 pixels
- `icon128.png` - 128x128 pixels

To create icons from the logo:
1. Use the `logo.svg` from the parent directory
2. Convert to PNG at the required sizes using any image editor
3. Place in the `icons/` folder

## Configuration

The extension is pre-configured with the Supabase credentials:
- URL: `https://hduyofdbpspjcuwvackd.supabase.co`
- Key: `sb_publishable_zI1zwUpMhbnU1cMwRJBTug_or6athhK`

## How It Works

1. **Background Script**: Handles Supabase subscriptions and URL navigation
2. **Popup**: Allows students to join/leave rooms
3. **Content Script**: Runs on every page for potential in-page features
4. **Storage**: Uses chrome.storage.local to persist session

## Security

- Extension only navigates tabs when directed by the teacher
- Students can leave the room at any time
- Room codes are validated before joining
- Only active rooms can be joined
