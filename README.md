# Universal Media Downloader

A unified browser extension for downloading content from multiple platforms:

- **OnlyFans** - Download photos and videos from OnlyFans
- **Coomer/Kemono** - Download content from Coomer and Kemono sites

## Features

- **Pattern-Based Site Detection**: Automatically detects sites even if domains change
- **Unified Interface**: Single extension for all supported platforms
- **Smart Domain Support**: Works with multiple domain variations (.su, .st, .cr, .party, .net, .lol, etc.)
- **Resilient to Changes**: URL structure detection ensures compatibility even when sites move domains

## Site Detection

The extension uses intelligent pattern-based detection that works even if sites change domains. See [SITE_DETECTION.md](SITE_DETECTION.md) for details on how to add new domains.

## OnlyFans Downloader

A modern, feature-rich browser extension for downloading content from OnlyFans with enhanced video detection, dynamic button updating, and comprehensive media support.

## Features

- **Smart Video Detection**: Automatically detects videos with multiple fallback methods
- **Dynamic Button Updates**: Buttons update when scrolling through images/videos in posts
- **PhotoSwipe Support**: Works with OnlyFans' image galleries and slide navigation
- **Multi-Media Posts**: Handles posts with multiple images and videos intelligently
- **Mobile Support**: Touch/swipe gesture support for mobile navigation
- **Infinite Scroll**: Automatically adds buttons to new posts as you scroll
- **Real-Time Updates**: MutationObserver ensures buttons stay synchronized with content
- **Enhanced Debugging**: Comprehensive logging and debug tools

## Installation

### OnlyFans Extension

### Method 1: Load as Unpacked Extension (Recommended)

1. **Download the Extension**
   - Download all files from this repository
   - Extract to a folder on your computer

2. **Open Chrome Extensions**
   - Open Chrome browser
   - Go to `chrome://extensions/`
   - Or navigate: Menu → More Tools → Extensions

3. **Enable Developer Mode**
   - Toggle the "Developer mode" switch in the top-right corner

4. **Load the Extension**
   - Click "Load unpacked" button
   - Select the root folder of this project (contains `manifest.json`, `content.js`, etc.)
   - The extension should now appear in your extensions list

5. **Verify Installation**
   - You should see "OnlyFans Downloader" in your extensions
   - The extension icon should appear in your browser toolbar

**Note**: The extension is now unified - it supports both OnlyFans and Coomer/Kemono in a single extension. No separate installation needed!

### Method 2: Manual Installation

1. **Create Extension Directory**
   ```bash
   mkdir onlyfans-downloader
   cd onlyfans-downloader
   ```

2. **Copy Files**
   - Copy all files from this repository to the directory
   - Ensure you have: `manifest.json`, `content.js`, `background.js`, `popup.html`, `popup.js`, and the `assets/` folder

3. **Load in Chrome**
   - Follow steps 3-5 from Method 1 above

## Usage

### Basic Usage

1. **Visit OnlyFans**
   - Go to [onlyfans.com](https://onlyfans.com)
   - Log in to your account

2. **Navigate to Content**
   - Browse to any creator's page or feed
   - Look for posts with images or videos

3. **Download Content**
   - **Blue buttons** = Download video
   - **Green buttons** = Download image
   - **"Download All" buttons** = Download all media in a post

### Advanced Features

#### Multi-Media Posts
- **Scroll through images**: Buttons update automatically for each image
- **PhotoSwipe galleries**: Navigate with arrow keys, buttons update per slide
- **Carousel navigation**: Click arrows or swipe, buttons update for visible media

#### Video Downloads
- **Multiple quality options**: Original, 720p, 240p (configure in popup)
- **Smart detection**: Automatically finds video URLs with multiple methods
- **Retry mechanism**: Automatically retries if video detection fails

#### Mobile Support
- **Touch gestures**: Swipe through images, buttons update automatically
- **Mobile navigation**: Works with OnlyFans' mobile interface

## Configuration

### Access Settings
1. Click the extension icon in your browser toolbar
2. Configure the following options:

#### Download Settings
- **Video Quality**: Choose between Original, 720p, or 240p
- **Folder Organization**: Automatically organize downloads by creator name
- **Download Queue**: Automatic queue management for bulk downloads

### Debug Mode
Open browser console (F12) to see detailed logs:

**Debug Commands:**
```javascript
// In browser console:
onlyFansDebug()           // Enhanced video element analysis
analyzeOnlyFansStructure() // OnlyFans-specific structure analysis
forceVideoDetection()      // Manual video detection trigger
refreshButtons()          // Manual button refresh
```

## Troubleshooting

### Common Issues

#### Buttons Not Appearing
1. **Refresh the page** and wait for content to load
2. **Check console** (F12) for error messages
3. **Disable other extensions** that might interfere
4. **Try the debug commands** in console

#### Video Downloads Not Working
1. **Check your subscription** - you need access to the content
2. **Try playing the video first** - some videos load dynamically
3. **Use debug commands** to see video detection info
4. **Check video quality settings** in extension popup

#### Buttons Disappear When Scrolling
1. **This is normal** - buttons update for current media
2. **Use PhotoSwipe** for better navigation experience
3. **Check console logs** to see button update activity

### Debug Steps

1. **Open Console** (F12 → Console tab)
2. **Look for logs** in the console
3. **Run debug commands** if needed
4. **Check for error messages** in red

## File Structure

```
universal-media-downloader/
├── manifest.json          # Unified extension configuration
├── content.js            # OnlyFans content script
├── content_coomer.js     # Coomer/Kemono content script
├── background.js         # Unified background service worker
├── popup.html           # Unified settings popup interface
├── popup.js             # Unified popup script
├── site_detection.js    # Pattern-based site detection utility
├── assets/              # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── app/                 # Python standalone application
│   ├── main.py
│   ├── ui.py
│   ├── requirements.txt
│   ├── templates/
│   │   └── index.html
│   └── README.md
├── SITE_DETECTION.md    # Site detection system documentation
└── README.md            # This file
```

## Privacy & Security

- **No data collection**: Extension doesn't store or transmit personal data
- **Local processing**: All operations happen locally in your browser
- **Minimal permissions**: Only requests necessary permissions for functionality
- **Open source**: Code is transparent and auditable

## Important Notes

### Legal Compliance
- **Only download content you have paid for access to**
- **Respect creators' rights and OnlyFans' terms of service**
- **This extension is for personal use only**

### Technical Limitations
- **Requires active OnlyFans subscription** to access content
- **Some videos may not be downloadable** due to DRM or technical restrictions
- **Extension works best with modern browsers** (Chrome, Edge, Firefox)

## Support

### Getting Help
1. **Check this README** for common solutions
2. **Use debug commands** in browser console
3. **Check console logs** for error messages
4. **Try refreshing the page** and reinitializing

### Debug Information
When reporting issues, include:
- **Browser version** (Chrome, Firefox, etc.)
- **Extension version** (from popup)
- **Console logs** (F12 → Console)
- **Steps to reproduce** the issue

## Updates

### Updating the Extension
1. **Download the latest version** from this repository
2. **Replace old files** with new ones
3. **Go to chrome://extensions/**
4. **Click the refresh icon** on the extension
5. **Reload OnlyFans** to apply updates

### Version History
- **v6.0.0**: Enhanced video detection, dynamic button updates (play video first to download videos), MutationObserver
- **v5.0.0**: Modern architecture, improved performance
- **v4.0.0**: Basic functionality, jQuery dependency

### Issues to fix
- Download button refreshes too often in fullscreen view making clicks on it inconsistent (try clicking the button a few times to trigger download if it doesn't work on first press)

## License

This project is provided as-is for educational and personal use. Please respect OnlyFans' terms of service and creators' rights.

---

**Note**: This extension is designed to help you download content you have already paid for access to on OnlyFans. Please use responsibly and respect the platform's terms of service. 