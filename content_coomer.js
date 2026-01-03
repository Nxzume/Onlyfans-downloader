// CoomerDL Browser Extension - Content Script
// Counts media URLs on Coomer posts

(function() {
  'use strict';
  
  // Check if we're in an iframe (e.g., animedao.site/kemono/)
  function isInIframe() {
    try {
      return window.self !== window.top;
    } catch (e) {
      return true; // If we can't access top, we're likely in an iframe
    }
  }
  
  // Check if parent page is hosting Kemono/Coomer via iframe
  function isParentHostingKemonoCoomer() {
    try {
      if (isInIframe() && window.parent && window.parent.location) {
        const parentUrl = window.parent.location.href;
        // Check if parent URL matches iframe host patterns
        return parentUrl.includes('animedao.site/kemono/') || 
               parentUrl.includes('animedao.site/coomer/') ||
               (typeof isCoomerOrKemono === 'function' && isCoomerOrKemono(parentUrl));
      }
    } catch (e) {
      // Cross-origin restriction - can't access parent
    }
    return false;
  }
  
  // Get the actual Kemono/Coomer URL from iframe or current page
  function getActualUrl() {
    // If we're in an iframe and it's from kemono/coomer, use current location
    if (isInIframe()) {
      const currentUrl = window.location.href;
      // If we're already on kemono/coomer domain, use that
      if (currentUrl.includes('kemono.') || currentUrl.includes('coomer.')) {
        return currentUrl;
      }
      // Otherwise, try to get from parent's iframe src
      try {
        const iframes = window.parent.document.querySelectorAll('iframe');
        for (const iframe of iframes) {
          const src = iframe.src || iframe.getAttribute('src');
          if (src && (src.includes('kemono.') || src.includes('coomer.'))) {
            return src;
          }
        }
      } catch (e) {
        // Cross-origin iframe, can't access parent
      }
      return currentUrl;
    }
    
    // If we're on parent page (animedao.site), check for iframe
    try {
      const iframe = document.querySelector('iframe#main-iframe, iframe[src*="kemono"], iframe[src*="coomer"]');
      if (iframe) {
        const src = iframe.src || iframe.getAttribute('src');
        if (src) {
          return src;
        }
      }
    } catch (e) {
      // Ignore errors
    }
    
    return window.location.href;
  }
  
  // Detect if we're on a Coomer/Kemono post page
  // Uses pattern-based detection from site_detection.js
  function isCoomerPost() {
    const currentUrl = window.location.href;
    
    // Priority 1: If we're in an iframe from kemono/coomer (the actual content)
    // This is the most important case - the iframe contains the real Kemono content
    if (isInIframe() && (currentUrl.includes('kemono.') || currentUrl.includes('coomer.'))) {
      // Check URL pattern and DOM elements
      const hasPostPattern = currentUrl.includes('/post/');
      const hasPostElements = document.querySelector('.post__title, .post__files, .post__content, .post-card');
      return hasPostPattern || hasPostElements !== null;
    }
    
    // Priority 2: If we're on parent page (animedao.site), the iframe has the content
    // The content script runs in the iframe automatically, so this is just for detection
    if (currentUrl.includes('animedao.site/kemono/') || currentUrl.includes('animedao.site/coomer/')) {
      const iframe = document.querySelector('iframe#main-iframe, iframe[src*="kemono"], iframe[src*="coomer"]');
      if (iframe) {
        const iframeSrc = iframe.src || iframe.getAttribute('src') || '';
        // Check if iframe URL indicates a post page
        return iframeSrc.includes('/post/');
      }
    }
    
    // Priority 3: Direct Kemono/Coomer pages
    const url = getActualUrl();
    if (typeof isCoomerOrKemono === 'function') {
      return isCoomerOrKemono(url) && url.includes('/post/');
    }
    // Fallback for older browsers or if site_detection.js didn't load
    return (url.includes('coomer.') || url.includes('kemono.')) && url.includes('/post/');
  }
  
  // Detect if we're on a Coomer/Kemono profile page
  function isCoomerProfile() {
    const currentUrl = window.location.href;
    
    // Priority 1: If we're in an iframe from kemono/coomer (the actual content)
    if (isInIframe() && (currentUrl.includes('kemono.') || currentUrl.includes('coomer.'))) {
      // Check URL pattern - profile pages have /user/ or /posts but not /post/
      const isProfileUrl = (currentUrl.includes('/user/') || currentUrl.includes('/posts')) && 
                          !currentUrl.includes('/post/');
      // Also check for profile page DOM elements (posts listing page)
      const hasProfileElements = document.querySelector('.user-header, .post-card, .post-list, [class*="user"], .card-list, article[class*="post"], .post-list__item');
      // If on /posts page (like kemono.cr/posts), it's a profile/listing page
      // Also check if we're on the main posts listing (not a single post)
      const isPostsListing = currentUrl.includes('/posts') && !currentUrl.includes('/post/');
      return isProfileUrl || isPostsListing || (hasProfileElements !== null && !document.querySelector('.post__title'));
    }
    
    // Priority 2: If we're on parent page (animedao.site), check iframe src
    if (currentUrl.includes('animedao.site/kemono/') || currentUrl.includes('animedao.site/coomer/')) {
      const iframe = document.querySelector('iframe#main-iframe, iframe[src*="kemono"], iframe[src*="coomer"]');
      if (iframe) {
        const iframeSrc = iframe.src || iframe.getAttribute('src') || '';
        // Profile pages: /user/ or /posts but not /post/
        return (iframeSrc.includes('/user/') || iframeSrc.includes('/posts')) && 
               !iframeSrc.includes('/post/');
      }
    }
    
    // Priority 3: Direct Kemono/Coomer pages
    const url = getActualUrl();
    if (typeof isCoomerOrKemono === 'function') {
      return isCoomerOrKemono(url) && url.includes('/user/') && !url.includes('/post/');
    }
    // Fallback
    return (url.includes('coomer.') || url.includes('kemono.')) && 
           url.includes('/user/') && 
           !url.includes('/post/');
  }
  
  // Validate and normalize a media URL
  function validateMediaUrl(url) {
    if (!url) return null;
    
    let fullUrl = url;
    if (!url.startsWith('http')) {
      if (url.startsWith('//')) {
        fullUrl = 'https:' + url;
      } else if (url.startsWith('/')) {
        fullUrl = window.location.origin + url;
      } else {
        fullUrl = window.location.origin + '/' + url;
      }
    }
    
    const urlPath = fullUrl.split('?')[0].split('#')[0];
    const endsWithExt = /\.(jpg|jpeg|png|gif|webp|mp4|webm|mov|mkv|m4v|avi|flv|wmv|zip|rar|7z)$/i.test(urlPath);
    // More flexible CDN detection - works with any TLD
    const isDataPath = fullUrl.includes('/data/') || 
                      /^https?:\/\/[n0-9]+\.(coomer|kemono)\./.test(fullUrl) ||
                      (typeof isCoomerKemonoCdn === 'function' && isCoomerKemonoCdn(fullUrl));
    const isExcluded = fullUrl.includes('.html') || 
                       fullUrl.includes('.htm') ||
                       fullUrl.includes('/api/') || 
                       fullUrl.includes('/post/') ||
                       fullUrl.includes('/user/') ||
                       !endsWithExt ||
                       !isDataPath;
    
    if (isExcluded || !endsWithExt || !isDataPath) {
      return null;
    }
    
    // Double-check: ensure the URL path ends with extension
    const pathParts = urlPath.split('/');
    const lastPart = pathParts[pathParts.length - 1];
    if (lastPart && /\.(jpg|jpeg|png|gif|webp|mp4|webm|mov|mkv|m4v|avi|flv|wmv|zip|rar|7z)$/i.test(lastPart)) {
      return fullUrl;
    }
    
    return null;
  }
  
  // Count media URLs currently on the page
  function countMediaUrls() {
    try {
      const mediaUrls = new Set(); // Use Set to avoid duplicates
      
      // Find all file links
      try {
        const fileLinks = document.querySelectorAll('.post__files a.fileThumb, .post__files a[href*="/data/"], .post__files a.image-link');
        fileLinks.forEach(link => {
          try {
            const href = link.getAttribute('href');
            const validUrl = validateMediaUrl(href);
            if (validUrl) {
              mediaUrls.add(validUrl);
            }
          } catch (e) {
            // Ignore errors
          }
        });
      } catch (e) {
        // Ignore errors
      }
      
      // Find all video elements
      try {
        const videoElements = document.querySelectorAll('.post__files video, .post__video, video.js-fluid-player');
        videoElements.forEach(video => {
          try {
            // Check video src
            const videoSrc = video.getAttribute('src');
            const validUrl = validateMediaUrl(videoSrc);
            if (validUrl) {
              mediaUrls.add(validUrl);
            }
            
            // Check source elements inside video
            const sources = video.querySelectorAll('source');
            sources.forEach(source => {
              const sourceSrc = source.getAttribute('src');
              const validSourceUrl = validateMediaUrl(sourceSrc);
              if (validSourceUrl) {
                mediaUrls.add(validSourceUrl);
              }
            });
          } catch (e) {
            // Ignore errors
          }
        });
      } catch (e) {
        // Ignore errors
      }
      
      return mediaUrls.size;
    } catch (error) {
      return 0;
    }
  }
  
  // Get all media URLs from the page (returns array)
  function getMediaUrls() {
    try {
      const mediaUrls = new Set();
      
      const fileLinks = document.querySelectorAll('.post__files a.fileThumb, .post__files a[href*="/data/"], .post__files a.image-link');
      fileLinks.forEach(link => {
        try {
          const href = link.getAttribute('href');
          if (href) {
            let fullUrl = href;
            if (!href.startsWith('http')) {
              if (href.startsWith('//')) {
                fullUrl = 'https:' + href;
              } else if (href.startsWith('/')) {
                fullUrl = window.location.origin + href;
              } else {
                fullUrl = window.location.origin + '/' + href;
              }
            }
            
            const urlPath = fullUrl.split('?')[0].split('#')[0];
            const endsWithExt = /\.(jpg|jpeg|png|gif|webp|mp4|webm|mov|mkv|m4v|avi|flv|wmv|zip|rar|7z)$/i.test(urlPath);
            // More flexible CDN detection - works with any TLD
    const isDataPath = fullUrl.includes('/data/') || 
                      /^https?:\/\/[n0-9]+\.(coomer|kemono)\./.test(fullUrl) ||
                      (typeof isCoomerKemonoCdn === 'function' && isCoomerKemonoCdn(fullUrl));
            const isExcluded = fullUrl.includes('.html') || 
                                 fullUrl.includes('.htm') ||
                                 fullUrl.includes('/api/') || 
                                 fullUrl.includes('/post/') ||
                                 fullUrl.includes('/user/') ||
                                 !endsWithExt ||
                                 !isDataPath;
            
            if (!isExcluded && endsWithExt && isDataPath) {
              const pathParts = urlPath.split('/');
              const lastPart = pathParts[pathParts.length - 1];
              if (lastPart && /\.(jpg|jpeg|png|gif|webp|mp4|webm|mov|mkv|m4v|avi|flv|wmv|zip|rar|7z)$/i.test(lastPart)) {
                mediaUrls.add(fullUrl);
              }
            }
          }
        } catch (e) {
          // Ignore errors
        }
      });
      
      return Array.from(mediaUrls);
    } catch (error) {
      return [];
    }
  }
  
  // Add download button to an element
  function addDownloadButtonToElement(element, mediaUrl) {
    try {
      // Check if button already exists
      if (element.parentElement && element.parentElement.querySelector('.coomerdl-download-btn')) {
        return;
      }
      
      const validUrl = validateMediaUrl(mediaUrl);
      if (!validUrl) {
        return;
      }
      
      // Create download button
      const downloadBtn = document.createElement('button');
      downloadBtn.className = 'coomerdl-download-btn';
      downloadBtn.textContent = '⬇ Download';
      downloadBtn.style.cssText = `
        position: absolute;
        bottom: 5px;
        right: 5px;
        background: #4a9eff;
        color: white;
        border: none;
        padding: 4px 8px;
        border-radius: 3px;
        font-size: 11px;
        cursor: pointer;
        z-index: 1000;
        font-family: Arial, sans-serif;
        box-shadow: 0 2px 5px rgba(0,0,0,0.3);
        transition: background 0.2s;
      `;
      
      downloadBtn.addEventListener('mouseenter', () => {
        downloadBtn.style.background = '#357abd';
      });
      
      downloadBtn.addEventListener('mouseleave', () => {
        downloadBtn.style.background = '#4a9eff';
      });
      
      downloadBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Send message to background script to download
        chrome.runtime.sendMessage({
          action: 'downloadSingle',
          url: validUrl
        }).then(response => {
          if (response && response.success) {
            downloadBtn.textContent = '✓ Downloaded';
            downloadBtn.style.background = '#2d5016';
            setTimeout(() => {
              downloadBtn.textContent = '⬇ Download';
              downloadBtn.style.background = '#4a9eff';
            }, 2000);
          } else {
            downloadBtn.textContent = '✗ Failed';
            downloadBtn.style.background = '#d32f2f';
            setTimeout(() => {
              downloadBtn.textContent = '⬇ Download';
              downloadBtn.style.background = '#4a9eff';
            }, 2000);
          }
        }).catch(err => {
          console.error('Download error:', err);
          downloadBtn.textContent = '✗ Error';
          downloadBtn.style.background = '#d32f2f';
        });
      });
      
      // Find the parent container
      let container = element.closest('figure') || 
                     element.closest('.post__thumbnail') || 
                     element.closest('.fluid_video_wrapper') ||
                     element.parentElement;
      
      if (container) {
        // Make container relative positioned if not already
        const containerStyle = window.getComputedStyle(container);
        if (containerStyle.position === 'static') {
          container.style.position = 'relative';
        }
        container.appendChild(downloadBtn);
      }
    } catch (e) {
      console.error('[COOMERDL] Error adding download button:', e);
    }
  }
  
  // Add download buttons to each media file (on post pages)
  function addDownloadButtons() {
    if (!isCoomerPost()) {
      return;
    }
    
    // Remove existing buttons to avoid duplicates
    document.querySelectorAll('.coomerdl-download-btn').forEach(btn => btn.remove());
    
    // Find all file links and add download buttons
    const fileLinks = document.querySelectorAll('.post__files a.fileThumb, .post__files a[href*="/data/"], .post__files a.image-link');
    fileLinks.forEach(link => {
      const href = link.getAttribute('href');
      if (href) {
        addDownloadButtonToElement(link, href);
      }
    });
    
    // Find all video elements and add download buttons
    const videoElements = document.querySelectorAll('.post__files video, .post__video, video.js-fluid-player');
    videoElements.forEach(video => {
      // Check video src first
      const videoSrc = video.getAttribute('src');
      if (videoSrc) {
        addDownloadButtonToElement(video, videoSrc);
      } else {
        // Check source elements inside video
        const sources = video.querySelectorAll('source');
        sources.forEach(source => {
          const sourceSrc = source.getAttribute('src');
          if (sourceSrc) {
            addDownloadButtonToElement(video, sourceSrc);
            return; // Only add one button per video
          }
        });
      }
    });
  }
  
  
  // Create or update visual indicator (also acts as download button)
  // Use closure to persist state
  (function() {
    let isDownloading = false;
    let originalText = '';
    
    window.updateIndicator = function(count) {
      let indicator = document.getElementById('coomerdl-indicator');
      
      if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'coomerdl-indicator';
        indicator.style.cssText = `
          position: fixed;
          top: 10px;
          right: 10px;
          background: #4a9eff;
          color: white;
          padding: 8px 12px;
          border-radius: 5px;
          font-size: 12px;
          z-index: 10000;
          font-family: Arial, sans-serif;
          box-shadow: 0 2px 10px rgba(0,0,0,0.3);
          cursor: pointer;
          transition: all 0.3s ease;
          user-select: none;
        `;
        document.body.appendChild(indicator);
        
        // Store original text on hover
        indicator.addEventListener('mouseenter', () => {
          if (!isDownloading && count > 0) {
            originalText = indicator.textContent;
            indicator.textContent = '⬇ Download All';
            indicator.style.background = '#357abd';
          }
        });
        
        indicator.addEventListener('mouseleave', () => {
          if (!isDownloading) {
            indicator.textContent = originalText || `📥 ${count} media`;
            indicator.style.background = count > 0 ? '#4a9eff' : '#888';
          }
        });
        
        // Add click handler to download all media
        indicator.addEventListener('click', async () => {
          if (isDownloading || count === 0) return;
          
          isDownloading = true;
          indicator.textContent = 'Downloading...';
          indicator.style.background = '#f39c12';
          indicator.style.cursor = 'wait';
          
          try {
            // Get settings from storage (same as popup)
            let settings = {
              downloadImages: true,
              downloadVideos: true,
              downloadCompressed: true,
              downloadFolder: 'Downloads/CoomerDL',
              separatePosts: true
            };
            
            try {
              const storedSettings = await chrome.storage.local.get([
                'downloadImages',
                'downloadVideos',
                'downloadCompressed',
                'downloadFolder',
                'separatePosts'
              ]);
              
              if (storedSettings.downloadImages !== undefined) {
                settings.downloadImages = storedSettings.downloadImages;
              }
              if (storedSettings.downloadVideos !== undefined) {
                settings.downloadVideos = storedSettings.downloadVideos;
              }
              if (storedSettings.downloadCompressed !== undefined) {
                settings.downloadCompressed = storedSettings.downloadCompressed;
              }
              if (storedSettings.downloadFolder) {
                settings.downloadFolder = storedSettings.downloadFolder;
              }
              if (storedSettings.separatePosts !== undefined) {
                settings.separatePosts = storedSettings.separatePosts;
              }
            } catch (e) {
              console.error('[COOMERDL] Error loading settings:', e);
            }
            
            // Send current page URL to background script to download all media
            const response = await chrome.runtime.sendMessage({
              action: 'download',
              url: window.location.href,
              type: 'page',
              settings: settings
            });
            
            if (response && response.success) {
              indicator.textContent = '✓ Downloaded!';
              indicator.style.background = '#2d5016';
              setTimeout(() => {
                if (indicator && indicator.parentNode) {
                  const newCount = countMediaUrls();
                  indicator.textContent = `📥 ${newCount} media`;
                  indicator.style.background = '#4a9eff';
                  indicator.style.cursor = 'pointer';
                  isDownloading = false;
                  originalText = '';
                }
              }, 3000);
            } else {
              const errorMsg = response && response.message ? response.message.substring(0, 20) : 'Failed';
              indicator.textContent = `✗ ${errorMsg}`;
              indicator.style.background = '#d32f2f';
              setTimeout(() => {
                if (indicator && indicator.parentNode) {
                  const newCount = countMediaUrls();
                  indicator.textContent = `📥 ${newCount} media`;
                  indicator.style.background = '#4a9eff';
                  indicator.style.cursor = 'pointer';
                  isDownloading = false;
                  originalText = '';
                }
              }, 3000);
            }
          } catch (error) {
            console.error('[COOMERDL] Download error:', error);
            indicator.textContent = '✗ Error';
            indicator.style.background = '#d32f2f';
            setTimeout(() => {
              if (indicator && indicator.parentNode) {
                const newCount = countMediaUrls();
                indicator.textContent = `📥 ${newCount} media`;
                indicator.style.background = '#4a9eff';
                indicator.style.cursor = 'pointer';
                isDownloading = false;
                originalText = '';
              }
            }, 3000);
          }
        });
      }
      
      // Update text and style (only if not downloading)
      if (!isDownloading) {
        if (count > 0) {
          indicator.textContent = `📥 ${count} media`;
          indicator.style.background = '#4a9eff';
          indicator.style.cursor = 'pointer';
          originalText = indicator.textContent;
        } else {
          indicator.textContent = '📥 Loading...';
          indicator.style.background = '#888';
          indicator.style.cursor = 'default';
        }
      }
    };
  })();
  
  // Update count periodically
  function updateCount() {
    // Check both post and profile pages (for animedao.site support)
    if (isCoomerPost() || isCoomerProfile()) {
      const count = countMediaUrls();
      updateIndicator(count);
      // Add download buttons to media files
      addDownloadButtons();
    } else {
      // Remove indicator if not on a post/profile page
      const indicator = document.getElementById('coomerdl-indicator');
      if (indicator) {
        indicator.remove();
      }
    }
  }
  
  // Handle iframe case (animedao.site/kemono/)
  function checkIframeContent() {
    try {
      const currentUrl = window.location.href;
      
      // If we're inside the iframe (on kemono.cr/coomer), this is where the content script actually works
      if (isInIframe() && (currentUrl.includes('kemono.') || currentUrl.includes('coomer.'))) {
        console.log('[COOMERDL] Running inside Kemono/Coomer iframe:', currentUrl);
        // The content script is active here - this is the important instance
        // Download buttons will appear in this iframe content
        return;
      }
      
      // If we're on animedao.site parent page, detect the iframe
      // Note: The content script in the iframe handles the actual content
      if ((currentUrl.includes('animedao.site/kemono/') || currentUrl.includes('animedao.site/coomer/')) && !isInIframe()) {
        const iframe = document.querySelector('iframe#main-iframe, iframe[src*="kemono"], iframe[src*="coomer"]');
        if (iframe) {
          console.log('[COOMERDL] Detected Kemono/Coomer iframe on parent page:', iframe.src);
          console.log('[COOMERDL] Content script will run automatically in iframe (kemono.cr is in manifest matches)');
          
          // Wait for iframe to load
          iframe.addEventListener('load', () => {
            setTimeout(() => {
              // The content script runs in the iframe automatically (via manifest matches)
              // The iframe content will have its own instance of the content script
              console.log('[COOMERDL] Iframe loaded - content script should be active in iframe now');
            }, 1000);
          });
        }
      }
    } catch (e) {
      // Cross-origin restrictions - this is expected for iframes from different origins
      // The content script will still run in the iframe due to manifest matches
      console.log('[COOMERDL] Cross-origin iframe detected (expected behavior)');
    }
  }
  
  // Initial count on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      checkIframeContent();
      if (isCoomerPost() || isCoomerProfile()) {
        setTimeout(updateCount, 1000);
      }
    });
  } else {
    checkIframeContent();
    if (isCoomerPost() || isCoomerProfile()) {
      setTimeout(updateCount, 1000);
    }
  }
  
  // Update count when DOM changes (debounced)
  let updateTimeout = null;
  const observer = new MutationObserver(() => {
    if (updateTimeout) {
      clearTimeout(updateTimeout);
    }
    updateTimeout = setTimeout(() => {
      if (isCoomerPost() || isCoomerProfile()) {
        updateCount();
      }
    }, 500);
  });
  
  // Observe if on post/profile page
  if ((isCoomerPost() || isCoomerProfile()) && document.body) {
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
  
  // Update count periodically
  setInterval(() => {
    if (isCoomerPost() || isCoomerProfile()) {
      updateCount();
    }
  }, 2000);
  
  // Listen for URL changes
  let lastUrl = location.href;
  setInterval(() => {
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      if (isCoomerPost() || isCoomerProfile()) {
        setTimeout(() => {
          if (document.body) {
            observer.observe(document.body, {
              childList: true,
              subtree: true
            });
          }
          updateCount();
        }, 500);
      } else {
        observer.disconnect();
        const indicator = document.getElementById('coomerdl-indicator');
        if (indicator) {
          indicator.remove();
        }
      }
    }
  }, 1000);
})();

