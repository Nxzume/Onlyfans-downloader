# Site Detection System

## Overview

The extension now uses a **pattern-based detection system** instead of hardcoded domain checks. This makes it resilient to domain changes - if Coomer or Kemono moves to a new domain, the extension will still work as long as the URL structure remains the same.

## Supported Sites

- **Direct Sites**: coomer.su, coomer.st, kemono.su, kemono.cr, and other TLDs (.party, .net, .lol)
- **Iframe Hosts**: Sites that embed Kemono/Coomer content via iframe
  - **animedao.site/kemono/** - Embeds kemono.cr/posts in an iframe
  - The content script automatically runs inside the iframe (since kemono.cr is in manifest matches)
  - Download buttons appear directly in the iframe content

## How It Works

### Pattern-Based Detection

Instead of checking for specific domains like `coomer.su` or `kemono.cr`, the system detects sites by their URL structure:

- **Coomer/Kemono**: Detects URLs matching patterns like:
  - `/service/user/username`
  - `/service/user/username/post/id`
  - `/api/v1/service/user/username`
  - `/data/...` (media paths)

- **OnlyFans**: Detects URLs matching patterns like:
  - `/api2/v2/...` (API endpoints)
  - `onlyfans.com/12345/` (user ID pattern)

### Domain List

The system maintains a list of known domains in `site_detection.js`, but **pattern matching takes priority**. This means:

1. If a URL matches a known domain → Site detected
2. If a URL matches the URL structure pattern → Site detected (even if domain is unknown)
3. If neither matches → Not detected

## Adding New Domains

### Method 1: Update `site_detection.js`

Edit the `SITE_CONFIG` object in `site_detection.js`:

```javascript
const SITE_CONFIG = {
  coomer: {
    domains: [
      'coomer.su', 
      'coomer.st', 
      'coomer.party',  // Add new domains here
      'coomer.net',
      'coomer.lol',
      'coomer.newdomain.com'  // ← Add new domain
    ],
    // ... rest of config
  },
  kemono: {
    domains: [
      'kemono.su',
      'kemono.cr',
      'kemono.party',
      'kemono.net',
      'kemono.lol',
      'kemono.newdomain.com'  // ← Add new domain
    ],
    // ... rest of config
  }
};
```

### Method 2: Update `manifest.json`

Add the new domain to the content scripts and host permissions:

```json
{
  "content_scripts": [
    {
      "matches": [
        "https://coomer.newdomain.com/*",
        "https://*.coomer.newdomain.com/*"
      ],
      "js": ["site_detection.js", "content_coomer.js"]
    }
  ],
  "host_permissions": [
    "https://coomer.newdomain.com/*",
    "https://*.coomer.newdomain.com/*"
  ]
}
```

**Note**: After updating `manifest.json`, you need to reload the extension in Chrome.

## How Detection Works in Code

### Background Script (`background.js`)

```javascript
importScripts('site_detection.js');

// Check if URL is Coomer/Kemono
if (isCoomerOrKemono(url)) {
  // Handle Coomer/Kemono download
}

// Check if URL is OnlyFans
if (isOnlyFans(url)) {
  // Handle OnlyFans download
}

// Detect specific site
const site = detectSite(url); // Returns 'coomer', 'kemono', 'onlyfans', or null
```

### Popup Script (`popup.js`)

```javascript
// site_detection.js is loaded in popup.html
const detectedSite = detectSite(tab.url);
if (detectedSite === 'coomer' || detectedSite === 'kemono') {
  // Show Coomer settings
}
```

### Content Script (`content_coomer.js`)

```javascript
// site_detection.js is loaded before content_coomer.js in manifest.json
function isCoomerPost() {
  const url = window.location.href;
  if (typeof isCoomerOrKemono === 'function') {
    return isCoomerOrKemono(url) && url.includes('/post/');
  }
  // Fallback if site_detection.js didn't load
  return (url.includes('coomer.') || url.includes('kemono.')) && url.includes('/post/');
}
```

## Benefits

1. **Resilient to domain changes**: Works even if sites move to new domains
2. **Easy to update**: Just add new domains to the config
3. **Pattern-based fallback**: If domain isn't recognized, pattern matching still works
4. **Future-proof**: URL structure is more stable than domain names

## Testing New Domains

If a site moves to a new domain:

1. **Test pattern matching**: The extension should work automatically if URL structure is the same
2. **Add domain to config**: Update `site_detection.js` for better performance
3. **Update manifest**: Add domain to `manifest.json` for permissions
4. **Reload extension**: Restart the extension to apply manifest changes

## Troubleshooting

**Extension not working on new domain?**

1. Check if URL structure matches known patterns (e.g., `/service/user/username`)
2. Verify domain is added to `site_detection.js`
3. Ensure domain is in `manifest.json` host_permissions
4. Check browser console for errors
5. Reload the extension after making changes

**Pattern matching not working?**

- Verify URL structure matches the patterns in `SITE_CONFIG`
- Check that `site_detection.js` is loaded before scripts that use it
- Look for JavaScript errors in console

