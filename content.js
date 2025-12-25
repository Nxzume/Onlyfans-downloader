/**
 * OnlyFans Downloader - Content Script
 * Modern, well-structured content script for OnlyFans media downloading
 */

class OnlyFansDownloader {
  constructor() {
    this.mediaStore = new Map();
    this.videoStore = new Map();
    this.imageStore = new Map();
    this.networkVideoUrls = new Map(); // Store video URLs captured from network requests
    this.videoJsMonitors = {}; // Store interval IDs for video.js player monitoring
    this.settings = {
      quality: 'full',
      autoCreateFolder: true
    };
    this.uniqueClass = this.generateUniqueClass();
    this.observer = null;
    this.isInitialized = false;
    this.photoSwipeButtonInteracting = false;
    this.photoSwipeUpdateTimeout = null;
    this.refreshButtonsTimeout = null;
    this.matchVideoUrlTimeout = null;
  }

  /**
   * Initialize the downloader
   */
  async initialize() {
    try {
      await this.loadSettings();
      this.setupEventListeners();
      this.setupVideoLoadHandler();
      // this.startObserving(); // Disabled - using setupMutationObserver instead
      
      // Setup MutationObserver for content detection and PhotoSwipe
      this.setupMutationObserver();
      
      // Setup infinite scroll and lazy loading handlers
      this.setupInfiniteScrollHandling();
      this.setupIntersectionObserver();
      
      // Wait for the SPA to load actual content
      this.waitForContent();
      
      // Setup dynamic button updating for multi-media posts
      this.setupDynamicButtonUpdating();
      this.setupMultiMediaPostHandling();
      this.setupImageCarouselHandling();
      this.setupSwipeHandling();
      this.setupDirectImageClickHandling();
      this.setupThumbnailNavigationHandling();
      this.setupMediaTypeChangeDetection();
      
      // Setup network interception to capture video URLs from CDN requests
      this.setupNetworkInterception();
      
      this.isInitialized = true;
      console.log('OnlyFans Downloader initialized successfully');
    } catch (error) {
      console.error('Failed to initialize OnlyFans Downloader:', error);
    }
  }

  /**
   * Wait for OnlyFans SPA content to load
   */
  waitForContent() {
    console.log('⏳ Waiting for OnlyFans content to load...');
    
    // Check if we're on a content page
    const checkForContent = () => {
      // Look for OnlyFans content indicators
      const hasPosts = document.querySelectorAll('.b-post').length > 0;
      const hasMessages = document.querySelectorAll('.b-chat__message').length > 0;
      const hasVideos = document.querySelectorAll('video').length > 0;
      const hasImages = document.querySelectorAll('img.b-post__media__img').length > 0;
      
      if (hasPosts || hasMessages || hasVideos || hasImages) {
        console.log('✅ OnlyFans content detected, starting downloader...');
        this.injectDownloadButtons();
        this.setupPhotoSwipeHandler();
        this.createFloatingDownloadButton();
        
        // Setup multi-media post handling
        this.setupMultiMediaPostHandling();
        this.setupImageCarouselHandling();
        this.setupSwipeHandling();
        this.setupDirectImageClickHandling();
        this.setupThumbnailNavigationHandling();
        
        return true;
      }
      
      return false;
    };
    
    // Try immediately
    if (checkForContent()) {
      return;
    }
    
    // If not found, wait and retry
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds
    
    const retry = () => {
      attempts++;
      console.log(`⏳ Content check attempt ${attempts}/${maxAttempts}...`);
      
      if (checkForContent()) {
        return;
      }
      
      if (attempts < maxAttempts) {
        setTimeout(retry, 1000);
      } else {
        console.log('⚠️ Content not detected after 30 seconds, but continuing...');
        // Still try to inject buttons in case content loads later
        this.injectDownloadButtons();
        this.setupPhotoSwipeHandler();
        this.createFloatingDownloadButton();
        
        // Setup multi-media post handling
        this.setupMultiMediaPostHandling();
        this.setupImageCarouselHandling();
        this.setupSwipeHandling();
        this.setupDirectImageClickHandling();
        this.setupThumbnailNavigationHandling();
      }
    };
    
    setTimeout(retry, 2000); // Start checking after 2 seconds
  }

  /**
   * Load user settings from storage
   */
  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get({
        quality: 'full',
        autoCreateFolder: true
      });
      this.settings = result;
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  /**
   * Generate unique CSS class for download buttons
   */
  generateUniqueClass() {
    return `of-downloader-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Setup message listener for API data
   */
  setupEventListeners() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'apiData') {
        this.processApiData(message.data, message.isForDm);
      }
      sendResponse({ received: true });
    });

    // Listen for route changes in the SPA
    this.setupRouteChangeDetection();
  }

  /**
   * Setup route change detection for OnlyFans SPA
   */
  setupRouteChangeDetection() {
    // Listen for URL changes
    let currentUrl = window.location.href;
    
    const checkForRouteChange = () => {
      if (window.location.href !== currentUrl) {
        console.log('🔄 Route changed, reinitializing downloader...');
        currentUrl = window.location.href;
        
        // Cleanup existing observers
        this.cleanupObservers();
        
        // Clear existing buttons
        const existingButtons = document.querySelectorAll(`.${this.uniqueClass}`);
        existingButtons.forEach(btn => btn.remove());
        
        // Remove floating button
        const floatingButton = document.querySelector('#of-downloader-floating-btn');
        if (floatingButton) {
          floatingButton.remove();
        }
        
        // Wait a bit then reinitialize
        setTimeout(() => {
          this.setupMutationObserver();
          this.waitForContent();
        }, 1000);
      }
    };
    
    // Check for route changes every second
    setInterval(checkForRouteChange, 1000);
    
    // Also listen for popstate events
    window.addEventListener('popstate', () => {
      console.log('🔄 Browser navigation detected...');
      
      // Cleanup existing observers
      this.cleanupObservers();
      
      setTimeout(() => {
        this.setupMutationObserver();
        this.waitForContent();
      }, 1000);
    });
  }

  /**
   * Setup popup event listeners (called from popup.js)
   */
  setupPopupEventListeners() {
    // Quality selection
    const qualityInputs = document.querySelectorAll('input[name="segmented"]');
    qualityInputs.forEach(input => {
      input.addEventListener('change', (e) => {
        this.handleQualityChange(e.target.value);
      });
    });

    // Folder organization checkbox
    const folderCheckbox = document.getElementById('folder');
    if (folderCheckbox) {
      folderCheckbox.addEventListener('change', (e) => {
        this.handleFolderChange(e.target.checked);
      });
    }
  }

  /**
   * Process API data and store media URLs
   */
  processApiData(data, isForDm) {
    try {
      const store = isForDm ? this.videoStore : this.mediaStore;
      
      if (Array.isArray(data)) {
        data.forEach(item => this.processMediaItem(item, store));
      } else if (data.id && Array.isArray(data.media)) {
        this.processMediaItem(data, store);
      }
    } catch (error) {
      console.error('Error processing API data:', error);
    }
  }

  /**
   * Process individual media item
   */
  processMediaItem(item, store) {
    if (item.id) {
      store.set(item.id, item);
    }

    if (Array.isArray(item.media)) {
      item.media.forEach(media => {
        if (media.type === 'video') {
          this.processVideoMedia(media);
        } else {
          this.processImageMedia(media);
        }
      });
    }
  }

  /**
   * Process video media and store quality options
   */
  processVideoMedia(media) {
    const videoMap = {};
    
    if (media.source?.source) {
      videoMap.full = media.source.source;
    }
    
    if (media.videoSources) {
      if (media.videoSources[240]) videoMap[240] = media.videoSources[240];
      if (media.videoSources[720]) videoMap[720] = media.videoSources[720];
    }

    // Store video URLs by preview images
    const previews = [media.preview, media.squarePreview, media.thumb].filter(Boolean);
    previews.forEach(preview => {
      if (preview) {
        this.imageStore.set(this.cleanUrl(preview), videoMap);
      }
    });
  }

  /**
   * Process image media
   */
  processImageMedia(media) {
    const previews = [media.preview, media.squarePreview, media.thumb].filter(Boolean);
    previews.forEach(preview => {
      if (preview && media.src) {
        this.imageStore.set(this.cleanUrl(preview), media.src);
      }
    });
  }

  /**
   * Clean URL by removing query parameters
   */
  cleanUrl(url) {
    return url ? url.split('?')[0] : url;
  }

  /**
   * Start observing DOM changes
   */
  startObserving() {
    this.observer = new MutationObserver((mutations) => {
      let shouldUpdate = false;
      let hasNewContent = false;
      
      mutations.forEach((mutation) => {
        // Check for new nodes being added
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Check if this is OnlyFans content
              if (node.classList?.contains('b-post') || 
                  node.classList?.contains('b-chat__message') ||
                  node.querySelector?.('.b-post') ||
                  node.querySelector?.('.b-chat__message') ||
                  node.querySelector?.('video') ||
                  node.querySelector?.('img.b-post__media__img')) {
                hasNewContent = true;
                console.log('🆕 New OnlyFans content detected:', node);
              }
            }
          });
        }
        
        // Check for attribute changes that might indicate content loading
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          const targetElement = mutation.target;
          if (targetElement.classList?.contains('b-post') || 
              targetElement.classList?.contains('b-chat__message') ||
              targetElement.classList?.contains('video-wrapper')) {
            shouldUpdate = true;
          }
        }
      });

      // If we detected new content, inject buttons immediately
      if (hasNewContent) {
        console.log('🚀 New content detected, injecting download buttons...');
        this.injectDownloadButtons();
        this.setupPhotoSwipeHandler();
      } else if (shouldUpdate) {
        this.debounce(this.injectDownloadButtons.bind(this), 500)();
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });
  }

  /**
   * Debounce function to prevent excessive calls
   */
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  /**
   * Inject download buttons into posts
   */
  injectDownloadButtons() {
    // Handle feed posts
    this.handleFeedPosts();
    
    // Handle chat messages
    this.handleChatMessages();
    
    // Handle video players
    this.handleVideoPlayers();
  }

  /**
   * Handle feed posts
   */
  handleFeedPosts() {
    const posts = document.querySelectorAll('.b-post');
    
    posts.forEach(post => {
      // Check for videos first (they take priority)
      const videoWrappers = post.querySelectorAll('.video-wrapper');
      const videoJsPlayers = post.querySelectorAll('.video-js, [class*="videoPlayer-"]');
      const videos = post.querySelectorAll('video');
      
      let hasVideo = false;
      let videoUrl = null;
      
      // Try to extract video URL from wrappers
      if (videoWrappers.length > 0) {
        for (const wrapper of videoWrappers) {
          videoUrl = this.extractVideoUrl(wrapper, post);
          if (videoUrl) {
            hasVideo = true;
            break;
          }
        }
      }
      
      // If no URL from wrappers, try video.js players
      if (!videoUrl && videoJsPlayers.length > 0) {
        for (const player of videoJsPlayers) {
          videoUrl = this.extractVideoUrlFromVideoJsPlayer(player);
          if (videoUrl) {
            hasVideo = true;
            break;
          }
        }
      }
      
      // If still no URL, try direct video elements
      if (!videoUrl && videos.length > 0) {
        for (const video of videos) {
          videoUrl = this.extractVideoUrlFromElement(video);
          if (videoUrl) {
            hasVideo = true;
            break;
          }
        }
      }
      
      // If still no URL, check network-captured URLs
      if (!videoUrl && (videoWrappers.length > 0 || videoJsPlayers.length > 0 || videos.length > 0)) {
        const postId = post.getAttribute('data-id') || post.id;
        if (postId) {
          for (const [cleanUrl, data] of this.networkVideoUrls.entries()) {
            if (data.url.includes(postId)) {
              videoUrl = data.url;
              hasVideo = true;
              console.log('✅ Using network-captured video URL for post:', postId);
              break;
            }
          }
        }
      }
      
      // If we have a video, create video button (even if image buttons exist)
      if (hasVideo && videoUrl) {
        const existingVideoButton = post.querySelector(`.${this.uniqueClass} button`);
        let hasVideoButton = false;
        
        // Check if existing button is for video
        if (existingVideoButton) {
          const buttonText = existingVideoButton.textContent || '';
          if (buttonText.includes('Video') || buttonText.includes('video') || buttonText.includes('🎬')) {
            hasVideoButton = true;
          }
        }
        
        if (!hasVideoButton) {
          const container = videoWrappers[0] || videoJsPlayers[0] || videos[0]?.closest('.video-wrapper, .video-js') || post;
          this.createVideoDownloadButton(container, videoUrl);
        }
      }
      
      // Handle images (only if no button exists yet)
      const existingButton = post.querySelector(`.${this.uniqueClass}`);
      if (!existingButton) {
        const mediaToDownload = this.extractMediaFromPost(post);
        
        if (mediaToDownload.length > 0) {
          const buttonContainer = this.createDownloadButtonContainer(mediaToDownload);
          const toolsContainer = post.querySelector('.b-post__tools');
          
          if (toolsContainer) {
            toolsContainer.appendChild(buttonContainer);
          }
        }
      }
      
      // Set up Swiper listeners for posts with carousels
      if (post.querySelector('.swiper')) {
        this.setupSwiperListenersForPost(post);
      }
    });
  }

  /**
   * Handle chat messages
   */
  handleChatMessages() {
    const messages = document.querySelectorAll('.b-chat__message');
    
    messages.forEach(message => {
      if (message.querySelector(`.${this.uniqueClass}`)) return;
      
      const mediaToDownload = this.extractMediaFromMessage(message);
      
      if (mediaToDownload.length > 0) {
        const buttonContainer = this.createDownloadButtonContainer(mediaToDownload);
        const bodyContainer = message.querySelector('.b-chat__message__body');
        
        if (bodyContainer) {
          bodyContainer.appendChild(buttonContainer);
        }
      }
    });
  }

  /**
   * Enhanced video player detection based on OnlyFans HTML structure
   */
  handleVideoPlayers() {
    console.log('🎬 Enhanced video player detection starting...');
    
    // Method 1: Handle traditional video wrappers
    const videoWrappers = document.querySelectorAll('.video-wrapper');
    this.processVideoWrappers(videoWrappers);
    
    // Method 2: Handle OnlyFans-specific video players with dimension classes
    const dimensionVideoPlayers = document.querySelectorAll('[class*="videoPlayer-"][class*="-dimensions"]');
    this.processDimensionVideoPlayers(dimensionVideoPlayers);
    
    // Method 3: Handle video.js players
    const videoJsPlayers = document.querySelectorAll('.video-js, .vjs-fluid');
    this.processVideoJsPlayers(videoJsPlayers);
    
    // Method 4: Handle standalone video elements
    const standaloneVideos = document.querySelectorAll('video:not(.video-wrapper video):not(.video-js video)');
    this.processStandaloneVideos(standaloneVideos);
    
    // Method 5: Handle any video elements with specific data attributes
    const dataAttributeVideos = document.querySelectorAll('video[data-src], video[data-video], video[data-url]');
    this.processDataAttributeVideos(dataAttributeVideos);
  }

  /**
   * Process traditional video wrappers
   */
  processVideoWrappers(videoWrappers) {
    console.log(`📦 Processing ${videoWrappers.length} video wrappers`);
    
    videoWrappers.forEach(wrapper => {
      const videoUrl = this.extractVideoUrl(wrapper, wrapper.closest('.b-post'));
      if (!videoUrl) {
        console.log('⚠️ No video URL found for wrapper, will retry later');
        setTimeout(() => {
          this.retryVideoExtraction(wrapper);
        }, 2000);
        return;
      }
      
      this.createVideoDownloadButton(wrapper, videoUrl);
    });
  }

  /**
   * Process OnlyFans dimension-specific video players
   */
  processDimensionVideoPlayers(dimensionPlayers) {
    console.log(`📐 Processing ${dimensionPlayers.length} dimension video players`);
    
    dimensionPlayers.forEach(player => {
      // Extract video URL using enhanced methods
      const videoUrl = this.extractVideoUrlFromDimensionPlayer(player);
      if (!videoUrl) {
        console.log('⚠️ No video URL found for dimension player, will retry later');
        setTimeout(() => {
          this.retryDimensionPlayerExtraction(player);
        }, 2000);
        return;
      }
      
      this.createVideoDownloadButton(player, videoUrl);
    });
  }

  /**
   * Process video.js players
   */
  processVideoJsPlayers(videoJsPlayers) {
    console.log(`🎥 Processing ${videoJsPlayers.length} video.js players`);
    
    videoJsPlayers.forEach(player => {
      const videoUrl = this.extractVideoUrlFromVideoJsPlayer(player);
      if (!videoUrl) {
        console.log('⚠️ No video URL found for video.js player, will retry later');
        setTimeout(() => {
          this.retryVideoJsPlayerExtraction(player);
        }, 2000);
        return;
      }
      
      this.createVideoDownloadButton(player, videoUrl);
    });
  }

  /**
   * Process standalone video elements
   */
  processStandaloneVideos(standaloneVideos) {
    console.log(`🎬 Processing ${standaloneVideos.length} standalone videos`);
    
    standaloneVideos.forEach(video => {
      const videoUrl = this.extractVideoUrlFromElement(video);
      if (!videoUrl) {
        console.log('⚠️ No video URL found for standalone video, will retry later');
        setTimeout(() => {
          this.retryVideoExtraction(video.parentElement);
        }, 2000);
        return;
      }
      
      const parent = video.parentElement;
      if (parent && !parent.querySelector(`.${this.uniqueClass}`)) {
        this.createVideoDownloadButton(parent, videoUrl);
      }
    });
  }

  /**
   * Process videos with data attributes
   */
  processDataAttributeVideos(dataAttributeVideos) {
    console.log(`🔗 Processing ${dataAttributeVideos.length} data attribute videos`);
    
    dataAttributeVideos.forEach(video => {
      const videoUrl = this.extractVideoUrlFromDataAttributes(video);
      if (!videoUrl) {
        console.log('⚠️ No video URL found for data attribute video, will retry later');
        setTimeout(() => {
          this.retryDataAttributeVideoExtraction(video);
        }, 2000);
        return;
      }
      
      const parent = video.parentElement;
      if (parent && !parent.querySelector(`.${this.uniqueClass}`)) {
        this.createVideoDownloadButton(parent, videoUrl);
      }
    });
  }

  /**
   * Retry video extraction for a specific element
   */
  retryVideoExtraction(element) {
    console.log('🔄 Retrying video extraction for:', element);
    
    if (element.classList.contains('video-wrapper')) {
      const videoUrl = this.extractVideoUrl(element, element.closest('.b-post'));
      if (videoUrl) {
        console.log('✅ Found video URL on retry:', videoUrl);
        this.createVideoDownloadButton(element, videoUrl);
      }
    } else {
      // Handle standalone video
      const video = element.querySelector('video');
      if (video) {
        const videoUrl = this.extractVideoUrlFromElement(video);
        if (videoUrl) {
          console.log('✅ Found video URL on retry:', videoUrl);
          this.createVideoDownloadButton(element, videoUrl);
        }
      }
    }
  }

  /**
   * Extract media URLs from a post
   */
  extractMediaFromPost(post) {
    const mediaToDownload = [];
    const creatorUsername = this.getCreatorUsername(post);
    
    // Extract all images (old working approach)
      const images = post.querySelectorAll('img.b-post__media__img');
      images.forEach(img => {
        if (img.src) {
          mediaToDownload.push([img.src, creatorUsername, 'download']);
        }
      });
    
    // Also check for videos (keep video download fix)
    const videoWrappers = post.querySelectorAll('div.video-wrapper');
    videoWrappers.forEach(wrapper => {
      const videoUrl = this.extractVideoUrl(wrapper, post);
      if (videoUrl) {
        mediaToDownload.push([videoUrl, creatorUsername, 'download video']);
      }
    });
    
    return mediaToDownload;
  }

  /**
   * Check if an image is likely a video thumbnail/preview
   */
  isVideoThumbnail(img, videoWrappers) {
    const imgSrc = img.src;
    
    // Check if this image is near a video wrapper
    for (const wrapper of videoWrappers) {
      const wrapperRect = wrapper.getBoundingClientRect();
      const imgRect = img.getBoundingClientRect();
      
      // If image is close to video wrapper, it's likely a thumbnail
      const distance = Math.abs(wrapperRect.top - imgRect.top) + Math.abs(wrapperRect.left - imgRect.left);
      if (distance < 100) {
        return true;
      }
    }
    
    // Check if image filename suggests it's a thumbnail
    if (imgSrc.includes('thumb') || imgSrc.includes('preview') || imgSrc.includes('small')) {
      return true;
    }
    
    return false;
  }

  /**
   * Extract video URL from video wrapper with multiple fallback methods
   */
  extractVideoUrl(wrapper, post) {
    // Method 1: Try to get from video.js player instance (this is where the actual URLs are stored)
    const videoJsPlayer = wrapper.querySelector('.video-js');
    if (videoJsPlayer && videoJsPlayer.id) {
      try {
        // Access video.js player instance - try multiple methods
        let player = null;
        if (typeof videojs !== 'undefined') {
          try {
            player = videojs(videoJsPlayer.id);
          } catch (e) {
            // Try alternative access methods
            try {
              player = videojs.getPlayer ? videojs.getPlayer(videoJsPlayer.id) : null;
            } catch (e2) {
              player = videoJsPlayer.player || videoJsPlayer.videojs || videoJsPlayer.__player;
            }
          }
        }
        
        if (player) {
          console.log('✅ Found video.js player instance:', player);
          
          // Method 1a: Try httpSourceSelector plugin (OnlyFans uses this)
          if (player.httpSourceSelector) {
            try {
              const sources = player.httpSourceSelector.sources;
              if (sources && sources.length > 0) {
                console.log('📹 Found sources from httpSourceSelector:', sources);
                // Prefer original quality
                for (const src of sources) {
                  if (src.src && !src.src.startsWith('blob:')) {
                    if (src.label === 'original' || src.label === 'Original' || src.label === 'auto') {
                      console.log('✅ Using source from httpSourceSelector:', src.src);
                      return src.src;
                    }
                  }
                }
                // Fallback to first non-blob source
                for (const src of sources) {
                  if (src.src && !src.src.startsWith('blob:')) {
                    console.log('✅ Using first source from httpSourceSelector:', src.src);
                    return src.src;
                  }
                }
              }
            } catch (e) {
              console.log('⚠️ Error accessing httpSourceSelector:', e);
            }
          }
          
          // Method 1b: Try currentSources method
          if (player.currentSources) {
            try {
              const sources = player.currentSources();
              if (sources && sources.length > 0) {
                console.log('📹 Found sources from currentSources():', sources);
                // Prefer original quality
                for (const src of sources) {
                  if (src.src && !src.src.startsWith('blob:')) {
                    if (src.label === 'original' || src.label === 'Original') {
                      console.log('✅ Using source from currentSources:', src.src);
                      return src.src;
                    }
                  }
                }
                // Fallback to first non-blob source
                for (const src of sources) {
                  if (src.src && !src.src.startsWith('blob:')) {
                    console.log('✅ Using first source from currentSources:', src.src);
                    return src.src;
                  }
                }
              }
            } catch (e) {
              console.log('⚠️ Error accessing currentSources:', e);
            }
          }
          
          // Method 1c: Try src() method (returns current source object)
          if (player.src) {
            try {
              const srcObj = typeof player.src === 'function' ? player.src() : player.src;
              if (srcObj) {
                // src() can return an object or string
                const srcUrl = typeof srcObj === 'string' ? srcObj : (srcObj.src || srcObj.url);
                if (srcUrl && !srcUrl.startsWith('blob:')) {
                  console.log('✅ Using source from src():', srcUrl);
                  return srcUrl;
                }
              }
            } catch (e) {
              console.log('⚠️ Error accessing src():', e);
            }
          }
          
          // Method 1d: Try currentSrc method
          if (player.currentSrc) {
            try {
              const currentSrc = player.currentSrc();
              if (currentSrc && !currentSrc.startsWith('blob:')) {
                console.log('✅ Using source from currentSrc():', currentSrc);
                return currentSrc;
              }
            } catch (e) {
              console.log('⚠️ Error accessing currentSrc:', e);
            }
          }
          
          // Method 1e: Try to access player's internal cache/source list
          if (player.cache_ && player.cache_.sources) {
            try {
              const cachedSources = player.cache_.sources;
              if (cachedSources && cachedSources.length > 0) {
                console.log('📹 Found sources from player cache:', cachedSources);
                for (const src of cachedSources) {
                  if (src.src && !src.src.startsWith('blob:')) {
                    if (src.label === 'original' || src.label === 'Original') {
                      console.log('✅ Using source from cache:', src.src);
                      return src.src;
                    }
                  }
                }
                for (const src of cachedSources) {
                  if (src.src && !src.src.startsWith('blob:')) {
                    console.log('✅ Using first source from cache:', src.src);
                    return src.src;
                  }
                }
              }
            } catch (e) {
              console.log('⚠️ Error accessing player cache:', e);
            }
          }
          
          // Method 1f: Try to get from quality selector menu items
          const sourceSelector = videoJsPlayer.querySelector('.vjs-http-source-selector');
          if (sourceSelector) {
            const menuItems = sourceSelector.querySelectorAll('.vjs-menu-item');
            for (const item of menuItems) {
              const text = item.textContent.trim().toLowerCase();
              if (text === 'original') {
                // Try to get the source URL from the menu item
                const sourceUrl = item.getAttribute('data-src') || item.dataset.src;
                if (sourceUrl && !sourceUrl.startsWith('blob:')) {
                  console.log('✅ Using source from menu item:', sourceUrl);
                  return sourceUrl;
                }
              }
            }
          }
          
          // Method 1g: Try to access sources from player's tech (video element)
          if (player.tech_ && player.tech_.src) {
            try {
              const techSrc = player.tech_.src();
              if (techSrc && !techSrc.startsWith('blob:')) {
                console.log('✅ Using source from tech:', techSrc);
                return techSrc;
              }
            } catch (e) {
              console.log('⚠️ Error accessing tech src:', e);
            }
          }
        } else {
          console.log('⚠️ Could not access video.js player instance');
        }
      } catch (e) {
        console.log('⚠️ Error accessing video.js player:', e);
      }
    }
    
    // Method 2: Try to get from video source element (fallback)
    const video = wrapper.querySelector('video.vjs-tech');
    if (video) {
      const source = video.querySelector('source[label="original"]');
      if (source && source.src && !source.src.startsWith('blob:')) {
        return source.src;
      }
      
      // Try any source element (skip blob URLs)
      const allSources = video.querySelectorAll('source');
      for (const source of allSources) {
        if (source.src && !source.src.startsWith('blob:')) {
          return source.src;
        }
      }
      
      // Skip blob URLs for video src
      if (video.src && !video.src.startsWith('blob:')) {
        return video.src;
      }
    }

    // Method 3: Try to get from API data (mediaStore)
    const postId = post?.getAttribute('data-id');
    if (postId && this.mediaStore.has(postId)) {
      const postData = this.mediaStore.get(postId);
      const mediaList = postData.media || [];
      
      for (const media of mediaList) {
        if (media.type === 'video') {
          const qualityMap = {
            full: media.source?.source,
            240: media.videoSources?.[240],
            720: media.videoSources?.[720]
          };
          
          const videoUrl = qualityMap[this.settings.quality] || qualityMap.full;
          if (videoUrl) {
            return videoUrl;
          }
        }
      }
    }

    // Method 4: Try to get from network-captured URLs
    if (postId) {
      for (const [cleanUrl, data] of this.networkVideoUrls.entries()) {
        if (data.url.includes(postId)) {
          console.log('✅ Using network-captured video URL for post:', postId);
          return data.url;
        }
      }
    }

    return null;
  }

  /**
   * Extract media URLs from a chat message
   */
  extractMediaFromMessage(message) {
    const mediaToDownload = [];
    const creatorUsername = this.getCreatorUsername(message);
    
    const mediaContainer = message.querySelector('.b-chat__message__media');
    if (!mediaContainer) return mediaToDownload;
    
    // Extract images
    const images = mediaContainer.querySelectorAll('img');
    images.forEach(img => {
      if (img.src) {
        mediaToDownload.push([img.src, creatorUsername, 'download']);
      }
    });
    
    // Extract videos with improved logic
    const videos = mediaContainer.querySelectorAll('video');
    videos.forEach(video => {
      const videoUrl = this.extractVideoUrlFromElement(video);
      if (videoUrl) {
        mediaToDownload.push([videoUrl, creatorUsername, 'download video']);
      }
    });
    
    return mediaToDownload;
  }

  /**
   * Extract video URL from video element
   */
  extractVideoUrlFromElement(video) {
    // Method 1: Try to get from video.js player instance (actual URLs are stored here)
    const videoJsPlayer = video.closest('.video-js');
    if (videoJsPlayer && videoJsPlayer.id) {
      try {
        let player = null;
        if (typeof videojs !== 'undefined') {
          try {
            player = videojs(videoJsPlayer.id);
          } catch (e) {
            try {
              player = videojs.getPlayer ? videojs.getPlayer(videoJsPlayer.id) : null;
            } catch (e2) {
              player = videoJsPlayer.player || videoJsPlayer.videojs || videoJsPlayer.__player;
            }
          }
        }
        
        if (player) {
          console.log('✅ Found video.js player instance in extractVideoUrlFromElement');
          
          // Method 1a: Try httpSourceSelector plugin (OnlyFans uses this)
          if (player.httpSourceSelector) {
            try {
              const sources = player.httpSourceSelector.sources;
              if (sources && sources.length > 0) {
                // Prefer original quality
                for (const src of sources) {
                  if (src.src && !src.src.startsWith('blob:')) {
                    if (src.label === 'original' || src.label === 'Original' || src.label === 'auto') {
                      return src.src;
                    }
                  }
                }
                // Fallback to first non-blob source
                for (const src of sources) {
                  if (src.src && !src.src.startsWith('blob:')) {
                    return src.src;
                  }
                }
              }
            } catch (e) {
              console.log('⚠️ Error accessing httpSourceSelector:', e);
            }
          }
          
          // Method 1b: Try currentSources method
          if (player.currentSources) {
            try {
              const sources = player.currentSources();
              if (sources && sources.length > 0) {
                // Prefer original quality
                for (const src of sources) {
                  if (src.src && !src.src.startsWith('blob:')) {
                    if (src.label === 'original' || src.label === 'Original') {
                      return src.src;
                    }
                  }
                }
                // Fallback to first non-blob source
                for (const src of sources) {
                  if (src.src && !src.src.startsWith('blob:')) {
                    return src.src;
                  }
                }
              }
            } catch (e) {
              console.log('⚠️ Error accessing currentSources:', e);
            }
          }
          
          // Method 1c: Try src() method
          if (player.src) {
            try {
              const srcObj = typeof player.src === 'function' ? player.src() : player.src;
              if (srcObj) {
                const srcUrl = typeof srcObj === 'string' ? srcObj : (srcObj.src || srcObj.url);
                if (srcUrl && !srcUrl.startsWith('blob:')) {
                  return srcUrl;
                }
              }
            } catch (e) {
              console.log('⚠️ Error accessing src():', e);
            }
          }
          
          // Method 1d: Try currentSrc method
          if (player.currentSrc) {
            try {
              const currentSrc = player.currentSrc();
              if (currentSrc && !currentSrc.startsWith('blob:')) {
                return currentSrc;
              }
            } catch (e) {
              console.log('⚠️ Error accessing currentSrc:', e);
            }
          }
        }
      } catch (e) {
        console.log('⚠️ Error accessing video.js player:', e);
      }
    }
    
    // Method 2: Try source element with original label (skip blob URLs)
    const source = video.querySelector('source[label="original"]');
    if (source && source.src && !source.src.startsWith('blob:')) {
      return source.src;
    }
    
    // Method 3: Try any source element (skip blob URLs)
    const allSources = video.querySelectorAll('source');
    for (const source of allSources) {
      if (source.src && !source.src.startsWith('blob:')) {
        return source.src;
      }
    }
    
    // Method 4: Try video src directly (skip blob URLs)
    if (video.src && !video.src.startsWith('blob:')) {
      return video.src;
    }
    
    // Method 5: Check data attributes (skip blob URLs)
    const dataSrc = video.getAttribute('data-src');
    if (dataSrc && !dataSrc.startsWith('blob:')) return dataSrc;
    
    const dataVideo = video.getAttribute('data-video');
    if (dataVideo && !dataVideo.startsWith('blob:')) return dataVideo;
    
    return null;
  }

  /**
   * Get creator username from element context
   */
  getCreatorUsername(element) {
    // Try to get from username element
    const usernameElement = element.querySelector('.g-user-username');
    if (usernameElement) {
      return usernameElement.textContent.trim().replace('@', '');
    }
    
    // Try to get from page title (for DMs)
    const pageTitle = document.querySelector('h1.g-page-title');
    if (pageTitle) {
      return pageTitle.textContent.trim();
    }
    
    // Fallback to URL path
    const pathParts = window.location.pathname.split('/');
    return pathParts[1] || 'unknown_creator';
  }

  /**
   * Create download button container
   */
  createDownloadButtonContainer(mediaToDownload) {
    const container = document.createElement('div');
    container.className = this.uniqueClass;
    container.style.cssText = 'margin: 10px 0; display: flex; gap: 5px; flex-wrap: wrap; position: relative; z-index: 2000; pointer-events: auto;';
    
    // Group media by type and create smart buttons
    const mediaGroups = this.groupMediaByType(mediaToDownload);
    
    mediaGroups.forEach(group => {
      const button = this.createSmartDownloadButton(group);
      container.appendChild(button);
    });
    
    return container;
  }

  /**
   * Group media by type for smart button creation
   */
  groupMediaByType(mediaToDownload) {
    const groups = {
      video: [],
      image: [],
      mixed: []
    };
    
    mediaToDownload.forEach(([url, creator, type]) => {
      if (type.includes('video')) {
        groups.video.push([url, creator, type]);
      } else {
        groups.image.push([url, creator, type]);
      }
    });
    
    // If we have both videos and images, create a mixed group
    if (groups.video.length > 0 && groups.image.length > 0) {
      groups.mixed = [...groups.video, ...groups.image];
      groups.video = [];
      groups.image = [];
    }
    
    // Return non-empty groups
    return Object.values(groups).filter(group => group.length > 0);
  }

  /**
   * Create smart download button that adapts to content type
   */
  createSmartDownloadButton(mediaGroup) {
    const button = document.createElement('button');
    const isVideo = mediaGroup.some(([url, creator, type]) => type.includes('video'));
    const isMixed = mediaGroup.length > 1;
    
    // Set button text based on content type
    if (isMixed) {
      button.textContent = `📥 Download All (${mediaGroup.length})`;
    } else if (isVideo) {
      button.textContent = '🎬 Download Video';
    } else {
      button.textContent = '📷 Download Image';
    }
    
    button.style.cssText = `
      padding: 8px 12px;
      background-color: ${isVideo ? '#007bff' : '#28a745'};
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      transition: background-color 0.2s;
      position: relative;
      z-index: 2001;
      pointer-events: auto;
      user-select: none;
    `;
    
    button.addEventListener('mouseenter', () => {
      button.style.backgroundColor = isVideo ? '#0056b3' : '#218838';
    });
    
    button.addEventListener('mouseleave', () => {
      button.style.backgroundColor = isVideo ? '#007bff' : '#28a745';
    });
    
    button.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      
      // Prevent PhotoSwipe from handling this click
      if (e.cancelBubble !== undefined) {
        e.cancelBubble = true;
      }
      
      // Prevent any default browser behavior
      if (e.defaultPrevented === false) {
        e.preventDefault();
      }
      
      try {
        button.textContent = '⏳ Downloading...';
        button.disabled = true;
        
        let successCount = 0;
        let failCount = 0;
        
        // Download all media in the group
        for (const [url, creator, type] of mediaGroup) {
          try {
            // Validate URL before attempting download
            if (!url || typeof url !== 'string' || url.trim() === '') {
              console.error('❌ Invalid URL in media group:', url);
              failCount++;
              continue;
            }
            
            await this.downloadMedia(url, creator, type);
            successCount++;
          } catch (error) {
            console.error(`❌ Failed to download ${url}:`, error);
            failCount++;
            // Don't throw - continue with other downloads
          }
        }
        
        // Update button text based on results
        if (failCount === 0) {
        button.textContent = '✅ Downloaded';
        } else if (successCount > 0) {
          button.textContent = `⚠️ ${successCount} downloaded, ${failCount} failed`;
        } else {
          button.textContent = '❌ All downloads failed';
        }
        
        setTimeout(() => {
          if (isMixed) {
            button.textContent = `📥 Download All (${mediaGroup.length})`;
          } else if (isVideo) {
            button.textContent = '🎬 Download Video';
          } else {
            button.textContent = '📷 Download Image';
          }
          button.disabled = false;
        }, 2000);
      } catch (error) {
        console.error('❌ Download failed:', error);
        button.textContent = '❌ Failed';
        setTimeout(() => {
          if (isMixed) {
            button.textContent = `📥 Download All (${mediaGroup.length})`;
          } else if (isVideo) {
            button.textContent = '🎬 Download Video';
          } else {
            button.textContent = '📷 Download Image';
          }
          button.disabled = false;
        }, 2000);
      }
      
      // Return false to prevent any navigation
      return false;
    });
    
    return button;
  }

  /**
   * Download media file
   */
  async downloadMedia(url, creator, type) {
    // Validate URL before attempting download
    if (!url || typeof url !== 'string') {
      console.error('❌ Invalid URL provided:', url);
      throw new Error('Invalid URL provided');
    }
    
    // Trim whitespace
    url = url.trim();
    
    // Prevent empty URLs
    if (url === '') {
      console.error('❌ Empty URL provided');
      throw new Error('Empty URL provided');
    }
    
    // Prevent URLs that might cause page navigation
    if (url.includes('javascript:') || url.startsWith('data:')) {
      console.error('❌ Unsafe URL detected:', url);
      throw new Error('Unsafe URL detected');
    }
    
    // Try to convert relative URLs to absolute URLs
    let finalUrl = url;
    try {
      // If URL is relative, try to make it absolute
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        // Try to resolve relative URL
        finalUrl = new URL(url, window.location.origin).href;
        console.log('🔄 Converted relative URL to absolute:', finalUrl);
      } else {
        // Validate absolute URL
        const urlObj = new URL(url);
        if (!['http:', 'https:'].includes(urlObj.protocol)) {
          console.error('❌ Invalid URL protocol:', urlObj.protocol, 'Full URL:', url);
          throw new Error('Invalid URL protocol');
        }
        finalUrl = url;
      }
    } catch (e) {
      // If URL validation fails, log the actual URL for debugging
      console.error('❌ URL validation failed:', {
        originalUrl: url,
        error: e.message,
        urlLength: url.length,
        urlPreview: url.substring(0, 200)
      });
      // Still try to download - the browser might handle it
      finalUrl = url;
    }
    
    // Log the download attempt
    console.log('📥 Attempting to download:', {
      url: finalUrl.substring(0, 150) + (finalUrl.length > 150 ? '...' : ''),
      creator,
      type,
      urlLength: finalUrl.length
    });
    
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage([finalUrl, creator, type], (response) => {
        if (chrome.runtime.lastError) {
            console.error('❌ Download error:', {
              error: chrome.runtime.lastError.message,
              url: finalUrl.substring(0, 150),
              creator,
              type
            });
          reject(new Error(chrome.runtime.lastError.message));
        } else {
            console.log('✅ Download request sent successfully');
          resolve(response);
        }
      });
      } catch (error) {
        console.error('❌ Error sending download message:', {
          error: error.message,
          url: finalUrl.substring(0, 150),
          stack: error.stack
        });
        reject(error);
      }
    });
  }

  /**
   * Setup PhotoSwipe handler with dynamic button updating
   */
  setupPhotoSwipeHandler() {
    const checkPhotoSwipe = () => {
      const viewer = document.querySelector('.pswp--open');
      if (!viewer) {
        setTimeout(checkPhotoSwipe, 1000);
        return;
      }
      
      // Use the new update method which handles bottom bar
      this.updatePhotoSwipeButtons();
      
        setTimeout(checkPhotoSwipe, 1000);
    };
    
    setTimeout(checkPhotoSwipe, 1000);
  }

  /**
   * Setup dynamic button updating for posts with multiple media
   */
  setupDynamicButtonUpdating() {
    console.log('🔄 Setting up dynamic button updating for multi-media posts...');
    
    // Listen for PhotoSwipe events
    document.addEventListener('click', (event) => {
      const target = event.target;
      
      // Check if PhotoSwipe was opened
      if (target.closest('.b-post__media__img') || target.closest('.b-post__media__video')) {
        console.log('🖼️ PhotoSwipe opened, setting up dynamic updates...');
        setTimeout(() => {
          this.setupPhotoSwipeDynamicUpdates();
        }, 500);
      }
    });
    
    // Listen for PhotoSwipe navigation
    document.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        const viewer = document.querySelector('.pswp--open');
        if (viewer) {
          console.log('🔄 PhotoSwipe navigation detected, updating buttons...');
          setTimeout(() => {
            this.updatePhotoSwipeButtons();
          }, 100);
        }
      }
    });
    
    // Listen for PhotoSwipe slide changes
    this.observePhotoSwipeChanges();
  }

  /**
   * Setup PhotoSwipe dynamic updates
   */
  setupPhotoSwipeDynamicUpdates() {
    const checkPhotoSwipe = () => {
      const viewer = document.querySelector('.pswp--open');
      if (!viewer) {
        return;
      }
      
      // Update buttons immediately
      this.updatePhotoSwipeButtons();
      
      // Set up observer for slide changes
      this.observePhotoSwipeSlideChanges(viewer);
      
      // Check for PhotoSwipe close and reset observer
      const checkClose = () => {
        if (!document.querySelector('.pswp--open')) {
          console.log('🖼️ PhotoSwipe closed, resetting observer');
          // Reset observer so it can be set up again next time
          if (this.photoSwipeSlideObserver) {
            this.photoSwipeSlideObserver.disconnect();
            this.photoSwipeSlideObserver = null;
          }
          // Reset interaction flag
          this.photoSwipeButtonInteracting = false;
          return;
        }
        setTimeout(checkClose, 1000);
      };
      
      setTimeout(checkClose, 1000);
    };
    
    setTimeout(checkPhotoSwipe, 100);
  }

  /**
   * Observe PhotoSwipe changes
   */
  observePhotoSwipeChanges() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (node.classList.contains('pswp--open')) {
                console.log('🖼️ PhotoSwipe opened, setting up dynamic updates...');
                setTimeout(() => {
                  this.setupPhotoSwipeDynamicUpdates();
                }, 500);
              }
            }
          });
        }
      });
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Observe PhotoSwipe slide changes
   */
  observePhotoSwipeSlideChanges(viewer) {
    // Only observe if not already observing
    if (this.photoSwipeSlideObserver) {
      return;
    }
    
    const slideObserver = new MutationObserver((mutations) => {
      // Don't update if user is interacting with buttons
      if (this.photoSwipeButtonInteracting) {
        return;
      }
      
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'aria-hidden') {
          const slide = mutation.target;
          if (slide.getAttribute('aria-hidden') === 'false') {
            // Increased delay to prevent flickering
            setTimeout(() => {
              this.updatePhotoSwipeButtons();
            }, 300);
          }
        }
      });
    });
    
    slideObserver.observe(viewer, {
      attributes: true,
      subtree: true,
      attributeFilter: ['aria-hidden']
    });
    
    this.photoSwipeSlideObserver = slideObserver;
  }

  /**
   * Update PhotoSwipe buttons for current slide
   */
  updatePhotoSwipeButtons() {
    // Don't update if user is interacting with buttons
    if (this.photoSwipeButtonInteracting) {
      return;
    }
    
    // Debounce to prevent rapid updates
    if (this.photoSwipeUpdateTimeout) {
      clearTimeout(this.photoSwipeUpdateTimeout);
    }
    
    this.photoSwipeUpdateTimeout = setTimeout(() => {
      this._updatePhotoSwipeButtonsInternal();
    }, 300);
  }

  /**
   * Internal method to update PhotoSwipe buttons
   */
  _updatePhotoSwipeButtonsInternal() {
    // Don't update if user is interacting with buttons
    if (this.photoSwipeButtonInteracting) {
      return;
    }
    
    const viewer = document.querySelector('.pswp--open');
    if (!viewer) {
      return;
    }
    
    // Clean up any old buttons from top bar (if they exist from previous version)
    const topBar = viewer.querySelector('.pswp__top-bar');
    if (topBar) {
      const oldButtons = topBar.querySelectorAll(`.${this.uniqueClass}`);
      oldButtons.forEach(btn => btn.remove());
    }
    
    // Get or create bottom bar container for buttons
    let bottomBar = viewer.querySelector('.pswp__bottom-bar');
    if (!bottomBar) {
      // Create bottom bar if it doesn't exist
      bottomBar = document.createElement('div');
      bottomBar.className = 'pswp__bottom-bar';
      bottomBar.style.cssText = `
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        padding: 15px 20px;
        background: linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%);
        z-index: 2000;
        pointer-events: none;
        display: flex;
        justify-content: center;
        align-items: center;
      `;
      
      const uiContainer = viewer.querySelector('.pswp__ui');
      if (uiContainer) {
        uiContainer.appendChild(bottomBar);
      } else {
        viewer.appendChild(bottomBar);
      }
    }
    
    // Get current slide
      const activeSlide = viewer.querySelector('.pswp__item[aria-hidden="false"]');
      if (!activeSlide) {
        return;
      }
      
    // Extract media URL from current slide
      let mediaUrl = null;
      let buttonLabel = 'download';
    let creatorUsername = 'unknown_creator';
    
    // Try to get creator username from the original post
    const postElement = this.findOriginalPostFromPhotoSwipe(viewer);
    if (postElement) {
      creatorUsername = this.getCreatorUsername(postElement);
    }
    
    // Check for video in current slide
      const videoSource = activeSlide.querySelector('source[label="original"]');
      if (videoSource) {
        mediaUrl = videoSource.getAttribute('src');
        buttonLabel = 'download video';
      } else {
      // Check for image in current slide
        const image = activeSlide.querySelector('img');
        if (image) {
          mediaUrl = image.getAttribute('src');
        }
      }
      
    if (!mediaUrl) {
      console.log('⚠️ No media URL found in current PhotoSwipe slide');
      return;
    }
    
    // Check if button already exists with the same URL
    const existingButtons = bottomBar.querySelectorAll(`.${this.uniqueClass}`);
    let needsUpdate = true;
    
    if (existingButtons.length > 0) {
      // Check if existing button has the same URL
      const existingButton = existingButtons[0].querySelector('button');
      if (existingButton) {
        // Store current URL in data attribute to compare
        const existingUrl = existingButton.getAttribute('data-media-url');
        if (existingUrl === mediaUrl) {
          // Same URL, don't recreate
          needsUpdate = false;
        }
      }
    }
    
    if (!needsUpdate) {
      return;
    }
    
    // Remove existing download buttons only if we need to update
    existingButtons.forEach(btn => btn.remove());
    
    console.log('✅ Found media URL in PhotoSwipe slide:', mediaUrl);
    const downloadData = [[mediaUrl, creatorUsername, buttonLabel]];
        const buttonContainer = this.createDownloadButtonContainer(downloadData);
        buttonContainer.classList.add(this.uniqueClass);
    
    // Store media URL in button for comparison
    const buttons = buttonContainer.querySelectorAll('button');
    buttons.forEach(btn => {
      btn.setAttribute('data-media-url', mediaUrl);
    });
    
    // Add PhotoSwipe-specific styling for better visibility and clickability
    // Use setProperty to ensure styles are applied correctly
    buttonContainer.style.setProperty('position', 'relative', 'important');
    buttonContainer.style.setProperty('z-index', '2001', 'important');
    buttonContainer.style.setProperty('pointer-events', 'auto', 'important');
    buttonContainer.style.setProperty('display', 'flex', 'important');
    buttonContainer.style.setProperty('gap', '5px', 'important');
    buttonContainer.style.setProperty('justify-content', 'center', 'important');
    
    // Ensure all buttons inside are clickable and add interaction handlers
    buttons.forEach(btn => {
      btn.style.setProperty('position', 'relative', 'important');
      btn.style.setProperty('z-index', '2002', 'important');
      btn.style.setProperty('pointer-events', 'auto', 'important');
      btn.style.setProperty('cursor', 'pointer', 'important');
      
      // Prevent updates when user is interacting with button
      btn.addEventListener('mouseenter', () => {
        this.photoSwipeButtonInteracting = true;
      });
      
      btn.addEventListener('mouseleave', () => {
        // Small delay before allowing updates again
        setTimeout(() => {
          this.photoSwipeButtonInteracting = false;
        }, 200);
      });
      
      btn.addEventListener('mousedown', () => {
        this.photoSwipeButtonInteracting = true;
      });
      
      btn.addEventListener('mouseup', () => {
        setTimeout(() => {
          this.photoSwipeButtonInteracting = false;
        }, 200);
      });
    });
    
    // Append to bottom bar (center aligned)
    bottomBar.appendChild(buttonContainer);
  }

  /**
   * Find original post element from PhotoSwipe
   */
  findOriginalPostFromPhotoSwipe(viewer) {
    // Try to find the original post by looking for data attributes or classes
    const slides = viewer.querySelectorAll('.pswp__item');
    for (const slide of slides) {
      const img = slide.querySelector('img');
      if (img) {
        // Try to find the original post by matching image src
        const posts = document.querySelectorAll('.b-post');
        for (const post of posts) {
          const postImages = post.querySelectorAll('img.b-post__media__img');
          for (const postImg of postImages) {
            if (postImg.src === img.src) {
              return post;
            }
          }
        }
      }
    }
    
    // Fallback: try to get from URL or page context
    const pathParts = window.location.pathname.split('/');
    return pathParts[1] ? document.querySelector(`[data-username="${pathParts[1]}"]`) : null;
  }

  /**
   * Setup multi-media post handling
   */
  setupMultiMediaPostHandling() {
    console.log('📸 Setting up multi-media post handling...');
    
    // Handle posts with multiple images/videos
    const posts = document.querySelectorAll('.b-post');
    posts.forEach(post => {
      const mediaItems = post.querySelectorAll('.b-post__media__img, .b-post__media__video');
      
      if (mediaItems.length > 1) {
        console.log(`📸 Found post with ${mediaItems.length} media items`);
        
        // Add click handlers to each media item
        mediaItems.forEach((mediaItem, index) => {
          mediaItem.addEventListener('click', () => {
            console.log(`🖼️ Media item ${index + 1} clicked`);
            setTimeout(() => {
              this.updateButtonsForCurrentMediaItem(mediaItem, post);
            }, 500);
          });
        });
        
        // Add navigation handlers for PhotoSwipe
        this.setupPhotoSwipeNavigationHandling(post);
      }
    });
  }

  /**
   * Update buttons for current media item
   */
  updateButtonsForCurrentMediaItem(mediaItem, post) {
    const viewer = document.querySelector('.pswp--open');
    if (!viewer) {
      return;
    }
    
    console.log('🔄 Updating buttons for current media item...');
    
    // Get current slide index
    const currentSlide = viewer.querySelector('.pswp__item[aria-hidden="false"]');
    if (!currentSlide) {
      return;
    }
    
    // Find the corresponding media item in the original post
    const mediaItems = post.querySelectorAll('.b-post__media__img, .b-post__media__video');
    const currentIndex = Array.from(mediaItems).findIndex(item => {
      const img = item.querySelector('img');
      const slideImg = currentSlide.querySelector('img');
      return img && slideImg && img.src === slideImg.src;
    });
    
    if (currentIndex !== -1) {
      console.log(`📸 Current media item index: ${currentIndex + 1}/${mediaItems.length}`);
      
      // Update buttons based on current media item
      this.updateButtonsForMediaIndex(post, currentIndex, mediaItems.length);
    }
  }

  /**
   * Update buttons for specific media index
   */
  updateButtonsForMediaIndex(post, currentIndex, totalItems) {
    const mediaItems = post.querySelectorAll('.b-post__media__img, .b-post__media__video');
    const currentItem = mediaItems[currentIndex];
    
    if (!currentItem) {
      return;
    }
    
    // Remove existing buttons
    const existingButtons = post.querySelectorAll(`.${this.uniqueClass}`);
    existingButtons.forEach(btn => btn.remove());
    
    const creatorUsername = this.getCreatorUsername(post);
    const downloadData = [];
    
    // Extract current item's media URL
    let mediaUrl = null;
    let buttonLabel = 'download';
    
    if (currentItem.classList.contains('b-post__media__video')) {
      // Handle video
      const video = currentItem.querySelector('video');
      if (video) {
        mediaUrl = this.extractVideoUrlFromElement(video);
        buttonLabel = 'download video';
      }
    } else {
      // Handle image - get the actual visible image
      const img = currentItem.querySelector('img');
      if (img) {
        // Try to get the full-size image URL (not thumbnail)
        mediaUrl = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src');
      }
    }
    
    // Always add current item
    if (mediaUrl) {
      downloadData.push([mediaUrl, creatorUsername, buttonLabel]);
    }
    
    // If multiple items, also add "Download All" option
    if (totalItems > 1) {
      // Get all media for "Download All" button
      const allMedia = this.extractMediaFromPost(post);
      if (allMedia.length > 1) {
        // Create a combined array for "Download All" - group all media together
        const allMediaGroup = allMedia.map(([url, creator, type]) => [url, creator, type]);
        // Add as a separate group so it creates a "Download All" button
        downloadData.push(...allMediaGroup);
      }
    }
    
    if (downloadData.length > 0) {
      const buttonContainer = this.createDownloadButtonContainer(downloadData);
      
      // Add button to the post's tools container (same location as image buttons)
      const toolsContainer = post.querySelector('.b-post__tools');
      if (toolsContainer) {
        toolsContainer.appendChild(buttonContainer);
        console.log(`✅ Updated buttons in tools container for media item ${currentIndex + 1}/${totalItems}`);
      } else {
        // Fallback: append to post if tools container doesn't exist
        post.appendChild(buttonContainer);
        console.log(`✅ Updated buttons in post (no tools container) for media item ${currentIndex + 1}/${totalItems}`);
      }
    }
  }

  /**
   * Setup PhotoSwipe navigation handling
   */
  setupPhotoSwipeNavigationHandling(post) {
    // Listen for PhotoSwipe navigation events
    document.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        const viewer = document.querySelector('.pswp--open');
        if (viewer) {
          setTimeout(() => {
            this.handlePhotoSwipeNavigation(post);
          }, 100);
        }
      }
    });
    
    // Listen for PhotoSwipe slide changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'aria-hidden') {
          const slide = mutation.target;
          if (slide.getAttribute('aria-hidden') === 'false') {
            setTimeout(() => {
              this.handlePhotoSwipeNavigation(post);
            }, 100);
          }
        }
      });
    });
    
    // Start observing when PhotoSwipe opens
    document.addEventListener('click', (event) => {
      if (event.target.closest('.b-post__media__img') || event.target.closest('.b-post__media__video')) {
        setTimeout(() => {
          const viewer = document.querySelector('.pswp--open');
          if (viewer) {
            observer.observe(viewer, {
              attributes: true,
              subtree: true,
              attributeFilter: ['aria-hidden']
            });
          }
        }, 500);
      }
    });
  }

  /**
   * Handle PhotoSwipe navigation
   */
  handlePhotoSwipeNavigation(post) {
    const viewer = document.querySelector('.pswp--open');
    if (!viewer) {
      return;
    }
    
    const currentSlide = viewer.querySelector('.pswp__item[aria-hidden="false"]');
    if (!currentSlide) {
      return;
    }
    
    // Find current slide index
    const slides = viewer.querySelectorAll('.pswp__item');
    const currentIndex = Array.from(slides).findIndex(slide => slide === currentSlide);
    
    if (currentIndex !== -1) {
      console.log(`🔄 PhotoSwipe navigation: slide ${currentIndex + 1}/${slides.length}`);
      this.updateButtonsForMediaIndex(post, currentIndex, slides.length);
    }
  }

  /**
   * Setup video load handler for dynamically loaded videos
   */
  setupVideoLoadHandler() {
    // Listen for video load events
    document.addEventListener('load', (event) => {
      if (event.target.tagName === 'VIDEO') {
        console.log('🎬 Video loaded:', event.target);
        this.handleVideoLoad(event.target);
      }
    }, true);

    // Listen for video play events
    document.addEventListener('play', (event) => {
      if (event.target.tagName === 'VIDEO') {
        console.log('▶️ Video started playing:', event.target);
        this.handleVideoPlay(event.target);
      }
    }, true);
    
    // Listen for video pause events to stop monitoring
    document.addEventListener('pause', (event) => {
      if (event.target.tagName === 'VIDEO') {
        const videoJsPlayer = event.target.closest('.video-js');
        if (videoJsPlayer && videoJsPlayer.id && this.videoJsMonitors) {
          const playerId = videoJsPlayer.id;
          if (this.videoJsMonitors[playerId]) {
            clearInterval(this.videoJsMonitors[playerId]);
            delete this.videoJsMonitors[playerId];
            console.log('⏸️ Stopped monitoring video.js player:', playerId);
          }
        }
      }
    }, true);
    
    // Listen for video ended events to stop monitoring
    document.addEventListener('ended', (event) => {
      if (event.target.tagName === 'VIDEO') {
        const videoJsPlayer = event.target.closest('.video-js');
        if (videoJsPlayer && videoJsPlayer.id && this.videoJsMonitors) {
          const playerId = videoJsPlayer.id;
          if (this.videoJsMonitors[playerId]) {
            clearInterval(this.videoJsMonitors[playerId]);
            delete this.videoJsMonitors[playerId];
            console.log('⏹️ Stopped monitoring video.js player (ended):', playerId);
          }
        }
      }
    }, true);

    // Listen for click events on play buttons
    document.addEventListener('click', (event) => {
      const target = event.target;
      if (target.classList.contains('vjs-play-control') || 
          target.closest('.vjs-play-control') ||
          target.classList.contains('play-button') ||
          target.textContent.includes('Play')) {
        console.log('▶️ Play button clicked, checking for videos');
        setTimeout(() => {
          this.forceVideoDetection();
        }, 1000);
      }
    }, true);
    
    // Listen for clicks on images that might reveal videos
    document.addEventListener('click', (event) => {
      const target = event.target;
      const clickedImage = target.closest('img.b-post__media__img');
      
      if (clickedImage) {
        const post = clickedImage.closest('.b-post');
        if (post) {
          console.log('🖼️ Image clicked, checking for video activation...');
          // Wait a bit for video to appear after click
          setTimeout(() => {
            this.refreshButtonsOnMediaChange(post);
          }, 500);
        }
      }
    }, true);
  }

  /**
   * Check video.js player sources when video is played
   */
  checkVideoJsPlayerSources(videoJsPlayer) {
    if (!videoJsPlayer || !videoJsPlayer.id) {
      return;
    }
    
    try {
      if (typeof videojs !== 'undefined') {
        const player = videojs(videoJsPlayer.id);
        if (player) {
          let foundUrl = null;
          
          // Check httpSourceSelector sources
          if (player.httpSourceSelector && player.httpSourceSelector.sources) {
            const sources = player.httpSourceSelector.sources;
            for (const src of sources) {
              if (src.src && !src.src.startsWith('blob:') && this.isVideoCdnUrl(src.src)) {
                foundUrl = src.src;
                console.log('✅ Found video URL from video.js player sources:', foundUrl);
                break;
              }
            }
          }
          
          // Also check currentSrc
          if (!foundUrl && player.currentSrc) {
            const currentSrc = player.currentSrc();
            if (currentSrc && !currentSrc.startsWith('blob:') && this.isVideoCdnUrl(currentSrc)) {
              foundUrl = currentSrc;
              console.log('✅ Found video URL from video.js player currentSrc:', foundUrl);
            }
          }
          
          // If we found a URL, update or create button
          if (foundUrl) {
            this.captureVideoUrl(foundUrl);
            
            const post = videoJsPlayer.closest('.b-post');
            if (post) {
              // Try to update existing button first
              const updated = this.updateVideoDownloadButton(post, foundUrl);
              
              if (!updated) {
                // No existing button, try to match and create
                setTimeout(() => {
                  this.matchVideoUrlToPost(foundUrl);
                }, 500);
              }
            }
          }
        }
      }
    } catch (e) {
      console.log('⚠️ Error checking video.js player sources:', e);
    }
  }

  /**
   * Force video detection by checking all video elements
   */
  forceVideoDetection() {
    console.log('🔍 Force detecting videos...');
    
    const allVideos = document.querySelectorAll('video');
    allVideos.forEach(video => {
      console.log('🔍 Checking video:', video);
      console.log('Video src:', video.src);
      console.log('Video sources:', Array.from(video.querySelectorAll('source')).map(s => s.src));
      
      const videoUrl = this.extractVideoUrlFromElement(video);
      if (videoUrl) {
        console.log('✅ Found video URL on force detection:', videoUrl);
        
        // Find the appropriate parent container (video wrapper, player, etc.)
        const parent = video.closest('.video-wrapper, .video-js, [class*="videoPlayer-"]') || video.parentElement;
        if (parent) {
          this.createVideoDownloadButton(parent, videoUrl);
        }
      }
    });
  }

  /**
   * Handle video load event
   */
  handleVideoLoad(video) {
    // Wait a bit for video to fully load and get actual source
    setTimeout(() => {
      let videoUrl = this.extractVideoUrlFromElement(video);
      
      // If still no URL, try to get from the video element's currentSrc after it loads
      if (!videoUrl || videoUrl.startsWith('blob:')) {
        // Wait for video metadata to load
        if (video.readyState >= 1) {
          // Try to get from network - check if video has loaded a real source
          const currentSrc = video.currentSrc || video.src;
          if (currentSrc && !currentSrc.startsWith('blob:')) {
            videoUrl = currentSrc;
            console.log('✅ Got video URL from currentSrc after load:', videoUrl);
          }
        }
      }
      
      if (!videoUrl || videoUrl.startsWith('blob:')) {
        // Still no URL, try accessing player instance again
        const videoJsPlayer = video.closest('.video-js');
        if (videoJsPlayer && videoJsPlayer.id) {
          try {
            if (typeof videojs !== 'undefined') {
              const player = videojs(videoJsPlayer.id);
              if (player) {
                // Try all methods again now that video is loaded
                if (player.httpSourceSelector && player.httpSourceSelector.sources) {
                  const sources = player.httpSourceSelector.sources;
                  if (sources && sources.length > 0) {
                    for (const src of sources) {
                      if (src.src && !src.src.startsWith('blob:')) {
                        videoUrl = src.src;
                        console.log('✅ Got video URL from player after load:', videoUrl);
                        break;
                      }
                    }
                  }
                }
              }
            }
          } catch (e) {
            console.log('⚠️ Error accessing player on video load:', e);
          }
        }
      }
      
      if (!videoUrl || videoUrl.startsWith('blob:')) {
        return; // Still no valid URL
      }
      
      // Find the appropriate parent container (video wrapper, player, etc.)
      const parent = video.closest('.video-wrapper, .video-js, [class*="videoPlayer-"]') || video.parentElement;
      if (parent) {
        // Check if button already exists in the post
        const post = parent.closest('.b-post');
        if (post && !post.querySelector(`.${this.uniqueClass}`)) {
          this.createVideoDownloadButton(parent, videoUrl);
        } else if (!post) {
          // If no post found, still try to add button
          this.createVideoDownloadButton(parent, videoUrl);
        }
      }
    }, 500); // Wait 500ms for video to load
  }

  /**
   * Update existing video download button with new URL
   */
  updateVideoDownloadButton(post, newVideoUrl) {
    if (!newVideoUrl || newVideoUrl.startsWith('blob:')) {
      return false;
    }
    
    const existingButtons = post.querySelectorAll(`.${this.uniqueClass} button`);
    let updated = false;
    
    existingButtons.forEach(btn => {
      const buttonText = btn.textContent || '';
      if (buttonText.includes('Video') || buttonText.includes('video') || buttonText.includes('🎬')) {
        // Check if the button already has this URL
        const buttonContainer = btn.closest(`.${this.uniqueClass}`);
        if (buttonContainer) {
          const onclick = btn.getAttribute('onclick') || '';
          const dataUrl = btn.getAttribute('data-url') || buttonContainer.getAttribute('data-url') || '';
          const cleanNewUrl = newVideoUrl.split('?')[0];
          const cleanOldUrl = (onclick.match(/https?:\/\/[^\s"']+/) || [dataUrl])[0]?.split('?')[0] || '';
          
          // Only update if URL is different
          if (cleanOldUrl && cleanOldUrl !== cleanNewUrl) {
            console.log('🔄 Updating existing video button with new streaming URL');
            
            // Update the button's onclick handler
            btn.setAttribute('onclick', `window.downloadMedia('${newVideoUrl}')`);
            btn.setAttribute('data-url', newVideoUrl);
            if (buttonContainer) {
              buttonContainer.setAttribute('data-url', newVideoUrl);
            }
            
            // Update button text to indicate it's been updated
            if (!buttonText.includes('🔄')) {
              btn.textContent = buttonText.replace(/🎬|Video|video/, '🎬 Video');
            }
            
            updated = true;
          } else if (!cleanOldUrl) {
            // Button exists but has no URL, update it
            btn.setAttribute('onclick', `window.downloadMedia('${newVideoUrl}')`);
            btn.setAttribute('data-url', newVideoUrl);
            if (buttonContainer) {
              buttonContainer.setAttribute('data-url', newVideoUrl);
            }
            updated = true;
          }
        }
      }
    });
    
    return updated;
  }

  /**
   * Continuously monitor video.js player sources during playback
   */
  monitorVideoJsPlayerSources(videoJsPlayer) {
    if (!videoJsPlayer || !videoJsPlayer.id) {
      return;
    }
    
    // Clear any existing monitoring for this player
    const playerId = videoJsPlayer.id;
    if (this.videoJsMonitors && this.videoJsMonitors[playerId]) {
      clearInterval(this.videoJsMonitors[playerId]);
    }
    
    if (!this.videoJsMonitors) {
      this.videoJsMonitors = {};
    }
    
    // Monitor every 1 second while video is playing
    const monitorInterval = setInterval(() => {
      try {
        if (typeof videojs !== 'undefined') {
          const player = videojs(playerId);
          if (player && !player.paused()) {
            // Video is playing, check for source changes
            let currentUrl = null;
            
            // Check httpSourceSelector sources
            if (player.httpSourceSelector && player.httpSourceSelector.sources) {
              const sources = player.httpSourceSelector.sources;
              for (const src of sources) {
                if (src.src && !src.src.startsWith('blob:') && this.isVideoCdnUrl(src.src)) {
                  currentUrl = src.src;
                  break;
                }
              }
            }
            
            // Check currentSrc
            if (!currentUrl && player.currentSrc) {
              const currentSrc = player.currentSrc();
              if (currentSrc && !currentSrc.startsWith('blob:') && this.isVideoCdnUrl(currentSrc)) {
                currentUrl = currentSrc;
              }
            }
            
            // If we found a URL, try to update the button
            if (currentUrl) {
              const post = videoJsPlayer.closest('.b-post');
              if (post) {
                this.captureVideoUrl(currentUrl);
                const updated = this.updateVideoDownloadButton(post, currentUrl);
                if (!updated) {
                  // Button doesn't exist or couldn't be updated, try to create one
                  setTimeout(() => {
                    this.matchVideoUrlToPost(currentUrl);
                  }, 500);
                }
              }
            }
          } else if (player && player.paused()) {
            // Video is paused, stop monitoring
            clearInterval(monitorInterval);
            if (this.videoJsMonitors) {
              delete this.videoJsMonitors[playerId];
            }
          }
        }
      } catch (e) {
        // Player might have been removed, stop monitoring
        clearInterval(monitorInterval);
        if (this.videoJsMonitors) {
          delete this.videoJsMonitors[playerId];
        }
      }
    }, 1000);
    
    this.videoJsMonitors[playerId] = monitorInterval;
  }

  /**
   * Handle video play event
   */
  handleVideoPlay(video) {
    console.log('▶️ Video started playing:', video);
    
    // Find the post containing this video
    const post = video.closest('.b-post');
    if (!post) {
      console.log('⚠️ No post found for playing video');
      return;
    }
    
    // Start monitoring video.js player sources if applicable
    const videoJsPlayer = video.closest('.video-js');
    if (videoJsPlayer && videoJsPlayer.id) {
      console.log('🎥 Starting continuous monitoring of video.js player sources');
      this.monitorVideoJsPlayerSources(videoJsPlayer);
      
      // Also check immediately
      setTimeout(() => {
        this.checkVideoJsPlayerSources(videoJsPlayer);
      }, 500);
    }
    
    // Try multiple methods to get the video URL (whether button exists or not)
    console.log('▶️ Video playing, attempting to extract streaming URL...');
    
    // Method 1: Try to extract from video.js player
    let videoUrl = null;
    if (videoJsPlayer) {
      videoUrl = this.extractVideoUrlFromVideoJsPlayer(videoJsPlayer);
    }
    
    // Method 2: Try to extract from video element directly
    if (!videoUrl || videoUrl.startsWith('blob:')) {
      videoUrl = this.extractVideoUrlFromElement(video);
    }
    
    // Method 3: Check networkVideoUrls for recently captured URLs
    if (!videoUrl || videoUrl.startsWith('blob:')) {
      const postId = post.getAttribute('data-id') || post.id || post.getAttribute('id');
      if (postId) {
        // Check all captured URLs for this post
        for (const [cleanUrl, data] of this.networkVideoUrls.entries()) {
          // Check if URL contains post ID or if it was captured recently (within last 10 seconds)
          const isRecent = (Date.now() - data.timestamp) < 10000;
          if (isRecent && (data.url.includes(postId) || this.isVideoCdnUrl(data.url))) {
            videoUrl = data.url;
            console.log('✅ Found video URL from network capture:', videoUrl);
            break;
          }
        }
      }
      
      // If still no URL, try to match any recently captured video URL to this post
      if (!videoUrl || videoUrl.startsWith('blob:')) {
        const videoWrapper = post.querySelector('.video-wrapper');
        const videoJsPlayer2 = post.querySelector('.video-js');
        if (videoWrapper || videoJsPlayer2) {
          // Get the most recently captured video URL (within last 5 seconds)
          let mostRecentUrl = null;
          let mostRecentTime = 0;
          for (const [cleanUrl, data] of this.networkVideoUrls.entries()) {
            if ((Date.now() - data.timestamp) < 5000 && data.timestamp > mostRecentTime) {
              mostRecentTime = data.timestamp;
              mostRecentUrl = data.url;
            }
          }
          if (mostRecentUrl) {
            videoUrl = mostRecentUrl;
            console.log('✅ Using most recently captured video URL:', videoUrl);
          }
        }
      }
    }
    
    // If we found a valid URL, update or create the button
    if (videoUrl && !videoUrl.startsWith('blob:')) {
      // Try to update existing button first
      const updated = this.updateVideoDownloadButton(post, videoUrl);
      
      if (!updated) {
        // No existing button or couldn't update, create new one
        const container = video.closest('.video-wrapper, .video-js') || post;
        console.log('✅ Creating video download button with streaming URL:', videoUrl.substring(0, 100) + '...');
        this.createVideoDownloadButton(container, videoUrl);
      } else {
        console.log('✅ Updated existing video button with streaming URL');
      }
    } else {
      // Still no URL, wait a bit and try again (video might still be loading)
      console.log('⚠️ No streaming URL found yet, will retry...');
      setTimeout(() => {
        this.handleVideoPlay(video);
      }, 2000);
    }
  }

  /**
   * Create floating download all button
   */
  createFloatingDownloadButton() {
    setTimeout(() => {
      const existingButton = document.querySelector('#of-downloader-floating-btn');
      if (existingButton) return;
      
      const button = document.createElement('button');
      button.id = 'of-downloader-floating-btn';
      button.textContent = '📥 Download All';
      button.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 12px 16px;
        font-size: 14px;
        background-color: #007bff;
        color: white;
        border: none;
        border-radius: 6px;
        z-index: 9999;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        transition: all 0.2s;
      `;
      
      button.addEventListener('mouseenter', () => {
        button.style.backgroundColor = '#0056b3';
        button.style.transform = 'translateY(-2px)';
      });
      
      button.addEventListener('mouseleave', () => {
        button.style.backgroundColor = '#007bff';
        button.style.transform = 'translateY(0)';
      });
      
      button.addEventListener('click', async () => {
        try {
          button.textContent = '⏳ Collecting...';
          button.disabled = true;
          
          const links = this.collectAllDownloadLinks();
          
          if (links.length === 0) {
            button.textContent = '❌ No media found';
            setTimeout(() => {
              button.textContent = '📥 Download All';
              button.disabled = false;
            }, 2000);
            return;
          }
          
          button.textContent = `⏳ Downloading ${links.length}...`;
          
          for (let i = 0; i < links.length; i++) {
            const [url, creator, type] = links[i];
            try {
              await this.downloadMedia(url, creator, type);
              button.textContent = `⏳ Downloaded ${i + 1}/${links.length}`;
            } catch (error) {
              console.error(`Failed to download ${url}:`, error);
            }
          }
          
          button.textContent = `✅ Downloaded ${links.length} files`;
          setTimeout(() => {
            button.textContent = '📥 Download All';
            button.disabled = false;
          }, 3000);
        } catch (error) {
          console.error('Bulk download failed:', error);
          button.textContent = '❌ Download failed';
          setTimeout(() => {
            button.textContent = '📥 Download All';
            button.disabled = false;
          }, 3000);
        }
      });

      // Add right-click context menu for refresh
      button.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.refreshDownloadButtons();
        button.textContent = '🔄 Refreshed';
        setTimeout(() => {
          button.textContent = '📥 Download All';
        }, 1000);
      });
      
      document.body.appendChild(button);
    }, 2000);
  }

  /**
   * Refresh download buttons manually
   */
  refreshDownloadButtons() {
    console.log('🔄 Manually refreshing download buttons...');
    
    // Remove all existing download buttons
    const existingButtons = document.querySelectorAll(`.${this.uniqueClass}`);
    existingButtons.forEach(btn => btn.remove());
    
    // Re-inject download buttons
    this.injectDownloadButtons();
    
    console.log('✅ Download buttons refreshed');
  }

  /**
   * Collect all download links from the page
   */
  collectAllDownloadLinks() {
    const links = [];
    
    // Collect from posts
    const posts = document.querySelectorAll('.b-post');
    posts.forEach(post => {
      const mediaToDownload = this.extractMediaFromPost(post);
      links.push(...mediaToDownload);
    });
    
    // Collect from chat messages
    const messages = document.querySelectorAll('.b-chat__message');
    messages.forEach(message => {
      const mediaToDownload = this.extractMediaFromMessage(message);
      links.push(...mediaToDownload);
    });
    
    return links;
  }

  /**
   * Enhanced debug method to analyze OnlyFans video player structure
   */
  debugVideoElements() {
    console.log('🔍 === ENHANCED VIDEO DEBUG INFO ===');
    
    // Check for video elements
    const videos = document.querySelectorAll('video');
    console.log(`Found ${videos.length} video elements on page`);
    
    videos.forEach((video, index) => {
      console.log(`Video ${index + 1}:`, {
        src: video.src,
        sources: Array.from(video.querySelectorAll('source')).map(s => ({
          src: s.src,
          label: s.getAttribute('label'),
          type: s.getAttribute('type')
        })),
        dataAttributes: {
          'data-src': video.getAttribute('data-src'),
          'data-video': video.getAttribute('data-video'),
          'data-url': video.getAttribute('data-url'),
          'data-source': video.getAttribute('data-source')
        },
        parent: video.parentElement?.className,
        parentDataAttributes: {
          'data-src': video.parentElement?.getAttribute('data-src'),
          'data-video': video.parentElement?.getAttribute('data-video')
        }
      });
    });
    
    // Check for video wrappers
    const videoWrappers = document.querySelectorAll('.video-wrapper');
    console.log(`Found ${videoWrappers.length} video wrappers on page`);
    
    videoWrappers.forEach((wrapper, index) => {
      console.log(`Video Wrapper ${index + 1}:`, {
        className: wrapper.className,
        dataAttributes: {
          'data-src': wrapper.getAttribute('data-src'),
          'data-video': wrapper.getAttribute('data-video')
        },
        hasVideo: !!wrapper.querySelector('video'),
        hasVideoJsTech: !!wrapper.querySelector('.vjs-tech')
      });
    });
    
    // Check for dimension-specific video players
    const dimensionPlayers = document.querySelectorAll('[class*="videoPlayer-"][class*="-dimensions"]');
    console.log(`Found ${dimensionPlayers.length} dimension video players on page`);
    
    dimensionPlayers.forEach((player, index) => {
      console.log(`Dimension Player ${index + 1}:`, {
        className: player.className,
        dataAttributes: {
          'data-src': player.getAttribute('data-src'),
          'data-video': player.getAttribute('data-video')
        },
        hasVideo: !!player.querySelector('video'),
        hasVideoJsTech: !!player.querySelector('.vjs-tech'),
        hasSource: !!player.querySelector('source')
      });
    });
    
    // Check for video.js players
    const videoJsPlayers = document.querySelectorAll('.video-js, .vjs-fluid');
    console.log(`Found ${videoJsPlayers.length} video.js players on page`);
    
    videoJsPlayers.forEach((player, index) => {
      console.log(`Video.js Player ${index + 1}:`, {
        className: player.className,
        dataAttributes: {
          'data-src': player.getAttribute('data-src'),
          'data-video': player.getAttribute('data-video')
        },
        hasVideo: !!player.querySelector('video'),
        hasVideoJsTech: !!player.querySelector('.vjs-tech'),
        hasSource: !!player.querySelector('source'),
        sources: Array.from(player.querySelectorAll('source')).map(s => ({
          src: s.src,
          label: s.getAttribute('label'),
          type: s.getAttribute('type')
        }))
      });
    });
    
    // Check for data attribute videos
    const dataAttributeVideos = document.querySelectorAll('video[data-src], video[data-video], video[data-url]');
    console.log(`Found ${dataAttributeVideos.length} videos with data attributes on page`);
    
    dataAttributeVideos.forEach((video, index) => {
      console.log(`Data Attribute Video ${index + 1}:`, {
        src: video.src,
        dataAttributes: {
          'data-src': video.getAttribute('data-src'),
          'data-video': video.getAttribute('data-video'),
          'data-url': video.getAttribute('data-url'),
          'data-source': video.getAttribute('data-source')
        },
        parent: video.parentElement?.className,
        parentDataAttributes: {
          'data-src': video.parentElement?.getAttribute('data-src'),
          'data-video': video.parentElement?.getAttribute('data-video')
        }
      });
    });
    
    // Check for video.js tech elements
    const videoJsTechElements = document.querySelectorAll('.vjs-tech');
    console.log(`Found ${videoJsTechElements.length} video.js tech elements on page`);
    
    videoJsTechElements.forEach((tech, index) => {
      console.log(`Video.js Tech ${index + 1}:`, {
        src: tech.src,
        sources: Array.from(tech.querySelectorAll('source')).map(s => ({
          src: s.src,
          label: s.getAttribute('label'),
          type: s.getAttribute('type')
        })),
        parent: tech.parentElement?.className
      });
    });
    
    // Check for source elements with specific labels
    const originalSources = document.querySelectorAll('source[label="original"]');
    console.log(`Found ${originalSources.length} source elements with "original" label`);
    
    originalSources.forEach((source, index) => {
      console.log(`Original Source ${index + 1}:`, {
        src: source.src,
        label: source.getAttribute('label'),
        type: source.getAttribute('type'),
        parent: source.parentElement?.className
      });
    });
    
    // Check for any source elements
    const allSources = document.querySelectorAll('source');
    console.log(`Found ${allSources.length} total source elements on page`);
    
    allSources.forEach((source, index) => {
      console.log(`Source ${index + 1}:`, {
        src: source.src,
        label: source.getAttribute('label'),
        type: source.getAttribute('type'),
        parent: source.parentElement?.className
      });
    });
    
    // Check for CSS classes that might indicate video players
    const videoPlayerClasses = document.querySelectorAll('[class*="videoPlayer"], [class*="vjs-"], [class*="video-js"]');
    console.log(`Found ${videoPlayerClasses.length} elements with video player classes`);
    
    videoPlayerClasses.forEach((element, index) => {
      console.log(`Video Player Class Element ${index + 1}:`, {
        className: element.className,
        tagName: element.tagName,
        hasVideo: !!element.querySelector('video'),
        hasSource: !!element.querySelector('source')
      });
    });
    
    console.log('🔍 === END ENHANCED DEBUG INFO ===');
  }

  /**
   * Analyze OnlyFans-specific HTML structure patterns
   */
  analyzeOnlyFansStructure() {
    console.log('🔍 === ONLYFANS STRUCTURE ANALYSIS ===');
    
    // Check for dimension-specific CSS classes
    const dimensionStyles = document.querySelectorAll('style[class*="vjs-styles-dimensions"]');
    console.log(`Found ${dimensionStyles.length} dimension style elements`);
    
    dimensionStyles.forEach((style, index) => {
      console.log(`Dimension Style ${index + 1}:`, {
        className: style.className,
        content: style.textContent.substring(0, 200) + '...'
      });
    });
    
    // Check for video player dimension classes
    const dimensionClasses = document.querySelectorAll('[class*="videoPlayer-"][class*="-dimensions"]');
    console.log(`Found ${dimensionClasses.length} elements with video player dimension classes`);
    
    dimensionClasses.forEach((element, index) => {
      const classes = element.className.split(' ');
      const dimensionClass = classes.find(cls => cls.includes('videoPlayer-') && cls.includes('-dimensions'));
      
      console.log(`Dimension Class Element ${index + 1}:`, {
        className: element.className,
        dimensionClass: dimensionClass,
        tagName: element.tagName,
        hasVideo: !!element.querySelector('video'),
        hasVideoJs: !!element.querySelector('.vjs-tech'),
        hasSource: !!element.querySelector('source'),
        dataAttributes: {
          'data-src': element.getAttribute('data-src'),
          'data-video': element.getAttribute('data-video'),
          'data-url': element.getAttribute('data-url')
        }
      });
    });
    
    // Check for video.js fluid elements
    const fluidElements = document.querySelectorAll('.vjs-fluid');
    console.log(`Found ${fluidElements.length} video.js fluid elements`);
    
    fluidElements.forEach((element, index) => {
      console.log(`Fluid Element ${index + 1}:`, {
        className: element.className,
        tagName: element.tagName,
        hasVideo: !!element.querySelector('video'),
        hasVideoJs: !!element.querySelector('.vjs-tech'),
        hasSource: !!element.querySelector('source'),
        dataAttributes: {
          'data-src': element.getAttribute('data-src'),
          'data-video': element.getAttribute('data-video')
        }
      });
    });
    
    // Check for video.js default styles
    const defaultStyles = document.querySelectorAll('style[class*="vjs-styles-defaults"]');
    console.log(`Found ${defaultStyles.length} video.js default style elements`);
    
    defaultStyles.forEach((style, index) => {
      console.log(`Default Style ${index + 1}:`, {
        className: style.className,
        content: style.textContent.substring(0, 200) + '...'
      });
    });
    
    // Check for specific video player IDs from the HTML
    const specificPlayerIds = ['videoPlayer-3941380727', 'videoPlayer-3916772495'];
    specificPlayerIds.forEach(id => {
      const element = document.querySelector(`[class*="${id}"]`);
      if (element) {
        console.log(`Found specific player ${id}:`, {
          className: element.className,
          tagName: element.tagName,
          hasVideo: !!element.querySelector('video'),
          hasVideoJs: !!element.querySelector('.vjs-tech'),
          hasSource: !!element.querySelector('source')
        });
      } else {
        console.log(`Specific player ${id} not found`);
      }
    });
    
    // Check for OnlyFans-specific video player structure
    const onlyFansVideoStructure = {
      videoWrappers: document.querySelectorAll('.video-wrapper').length,
      videoJsPlayers: document.querySelectorAll('.video-js').length,
      fluidPlayers: document.querySelectorAll('.vjs-fluid').length,
      techElements: document.querySelectorAll('.vjs-tech').length,
      dimensionPlayers: document.querySelectorAll('[class*="videoPlayer-"][class*="-dimensions"]').length,
      sourceElements: document.querySelectorAll('source').length,
      originalSources: document.querySelectorAll('source[label="original"]').length
    };
    
    console.log('OnlyFans Video Structure Summary:', onlyFansVideoStructure);
    
    // Check for video player patterns in the DOM
    const videoPlayerPatterns = {
      'video-wrapper': document.querySelectorAll('.video-wrapper').length,
      'video-js': document.querySelectorAll('.video-js').length,
      'vjs-fluid': document.querySelectorAll('.vjs-fluid').length,
      'vjs-tech': document.querySelectorAll('.vjs-tech').length,
      'videoPlayer-*-dimensions': document.querySelectorAll('[class*="videoPlayer-"][class*="-dimensions"]').length,
      'source[label="original"]': document.querySelectorAll('source[label="original"]').length,
      'video[data-src]': document.querySelectorAll('video[data-src]').length,
      'video[data-video]': document.querySelectorAll('video[data-video]').length
    };
    
    console.log('Video Player Patterns:', videoPlayerPatterns);
    
    console.log('🔍 === END ONLYFANS STRUCTURE ANALYSIS ===');
  }

  /**
   * Extract video URL from dimension-specific player
   */
  extractVideoUrlFromDimensionPlayer(player) {
    console.log('🔍 Extracting video URL from dimension player:', player);
    
    // Method 1: Look for video elements within the player
    const videos = player.querySelectorAll('video');
    for (const video of videos) {
      const videoUrl = this.extractVideoUrlFromElement(video);
      if (videoUrl) {
        console.log('✅ Found video URL in dimension player:', videoUrl);
        return videoUrl;
      }
    }
    
    // Method 2: Check for video.js tech elements
    const videoJsTech = player.querySelector('.vjs-tech');
    if (videoJsTech) {
      const videoUrl = this.extractVideoUrlFromElement(videoJsTech);
      if (videoUrl) {
        console.log('✅ Found video URL in video.js tech:', videoUrl);
        return videoUrl;
      }
    }
    
    // Method 3: Check data attributes on the player itself
    const dataSrc = player.getAttribute('data-src');
    if (dataSrc && dataSrc.includes('http')) {
      console.log('✅ Found video URL in player data-src:', dataSrc);
      return dataSrc;
    }
    
    const dataVideo = player.getAttribute('data-video');
    if (dataVideo && dataVideo.includes('http')) {
      console.log('✅ Found video URL in player data-video:', dataVideo);
      return dataVideo;
    }
    
    // Method 4: Look for any source elements
    const sources = player.querySelectorAll('source');
    for (const source of sources) {
      if (source.src && source.src.includes('http')) {
        console.log('✅ Found video URL in source element:', source.src);
        return source.src;
      }
    }
    
    console.log('❌ No video URL found in dimension player');
    return null;
  }

  /**
   * Extract video URL from video.js player
   */
  extractVideoUrlFromVideoJsPlayer(player) {
    console.log('🔍 Extracting video URL from video.js player:', player);
    
    // Method 1: Try to access the actual video.js player instance (this is where real URLs are)
    // First, find the actual video.js player element (not placeholder)
    const actualPlayer = player.classList.contains('video-js') && !player.classList.contains('video-js-placeholder-wrapper') 
      ? player 
      : player.closest('.video-js') || player.querySelector('.video-js');
    
    const playerElement = actualPlayer || player;
    const playerId = playerElement.id;
    
    if (playerId) {
      try {
        let playerInstance = null;
        
        // Check if videojs is available
        if (typeof videojs !== 'undefined') {
          try {
            playerInstance = videojs(playerId);
            console.log('✅ Accessed player via videojs(id):', playerId);
          } catch (e) {
            try {
              playerInstance = videojs.getPlayer ? videojs.getPlayer(playerId) : null;
              if (playerInstance) {
                console.log('✅ Accessed player via videojs.getPlayer(id):', playerId);
              }
            } catch (e2) {
              playerInstance = playerElement.player || playerElement.videojs || playerElement.__player;
              if (playerInstance) {
                console.log('✅ Accessed player via element property');
              }
            }
          }
        }
        
        // Also try accessing from window.videojs if available
        if (!playerInstance && window.videojs) {
          try {
            playerInstance = window.videojs(playerId);
            if (playerInstance) {
              console.log('✅ Accessed player via window.videojs(id):', playerId);
            }
          } catch (e) {
            // Ignore
          }
        }
        
        if (playerInstance) {
          console.log('✅ Found video.js player instance in extractVideoUrlFromVideoJsPlayer');
          
          // Check if player is ready (sources might not be loaded yet)
          const isReady = playerInstance.readyState && playerInstance.readyState() >= 1;
          if (!isReady) {
            console.log('⚠️ Player not ready yet, sources may not be loaded');
          }
          
          // Try httpSourceSelector plugin (OnlyFans uses this)
          if (playerInstance.httpSourceSelector) {
            try {
              // Try different ways to access sources
              let sources = null;
              if (playerInstance.httpSourceSelector.sources) {
                sources = playerInstance.httpSourceSelector.sources;
              } else if (playerInstance.httpSourceSelector.getSources) {
                sources = playerInstance.httpSourceSelector.getSources();
              } else if (playerInstance.httpSourceSelector.options && playerInstance.httpSourceSelector.options.sources) {
                sources = playerInstance.httpSourceSelector.options.sources;
              }
              
              if (sources && sources.length > 0) {
                console.log('📹 Found sources from httpSourceSelector:', sources);
                for (const src of sources) {
                  if (src.src && !src.src.startsWith('blob:')) {
                    if (src.label === 'original' || src.label === 'Original' || src.label === 'auto') {
                      console.log('✅ Found source from httpSourceSelector:', src.src);
                      return src.src;
                    }
                  }
                }
                for (const src of sources) {
                  if (src.src && !src.src.startsWith('blob:')) {
                    console.log('✅ Found first source from httpSourceSelector:', src.src);
                    return src.src;
                  }
                }
              }
            } catch (e) {
              console.log('⚠️ Error accessing httpSourceSelector:', e);
            }
          }
          
          // Try currentSources
          if (playerInstance.currentSources) {
            try {
              const sources = playerInstance.currentSources();
              if (sources && sources.length > 0) {
                for (const src of sources) {
                  if (src.src && !src.src.startsWith('blob:')) {
                    if (src.label === 'original' || src.label === 'Original') {
                      console.log('✅ Found source from currentSources:', src.src);
                      return src.src;
                    }
                  }
                }
                for (const src of sources) {
                  if (src.src && !src.src.startsWith('blob:')) {
                    console.log('✅ Found first source from currentSources:', src.src);
                    return src.src;
                  }
                }
              }
            } catch (e) {
              console.log('⚠️ Error with currentSources:', e);
            }
          }
          
          // Try src() method
          if (playerInstance.src) {
            try {
              const srcObj = typeof playerInstance.src === 'function' ? playerInstance.src() : playerInstance.src;
              if (srcObj) {
                const srcUrl = typeof srcObj === 'string' ? srcObj : (srcObj.src || srcObj.url);
                if (srcUrl && !srcUrl.startsWith('blob:')) {
                  console.log('✅ Found source from src():', srcUrl);
                  return srcUrl;
                }
              }
            } catch (e) {
              console.log('⚠️ Error with src():', e);
            }
          }
          
          // Try currentSrc
          if (playerInstance.currentSrc) {
            try {
              const currentSrc = playerInstance.currentSrc();
              if (currentSrc && !currentSrc.startsWith('blob:')) {
                console.log('✅ Found source from currentSrc():', currentSrc);
                return currentSrc;
              }
            } catch (e) {
              console.log('⚠️ Error with currentSrc:', e);
            }
          }
        }
      } catch (e) {
        console.log('⚠️ Error accessing video.js player instance:', e);
      }
    }
    
    // Method 2: Try to get URLs from quality selector menu items (they might have the URLs)
    const sourceSelector = player.querySelector('.vjs-http-source-selector');
    if (sourceSelector) {
      const menuItems = sourceSelector.querySelectorAll('.vjs-menu-item');
      console.log('📹 Found quality selector with', menuItems.length, 'items');
      
      for (const item of menuItems) {
        const text = item.textContent.trim().toLowerCase();
        if (text === 'original') {
          // Try multiple ways to get the URL from menu item
          let sourceUrl = item.getAttribute('data-src') || 
                         item.dataset.src || 
                         item.getAttribute('data-url') ||
                         item.dataset.url;
          
          // Also check if the item has a click handler that sets the source
          if (!sourceUrl && item.onclick) {
            // Try to extract from onclick handler
            const onclickStr = item.getAttribute('onclick') || item.onclick.toString();
            const urlMatch = onclickStr.match(/https?:\/\/[^\s"']+/);
            if (urlMatch) {
              sourceUrl = urlMatch[0];
            }
          }
          
          if (sourceUrl && !sourceUrl.startsWith('blob:')) {
            console.log('✅ Found source from quality selector menu (original):', sourceUrl);
            return sourceUrl;
          }
        }
      }
      
      // If original not found, try any menu item
      for (const item of menuItems) {
        const sourceUrl = item.getAttribute('data-src') || 
                         item.dataset.src || 
                         item.getAttribute('data-url') ||
                         item.dataset.url;
        if (sourceUrl && !sourceUrl.startsWith('blob:')) {
          console.log('✅ Found source from quality selector menu:', sourceUrl);
          return sourceUrl;
        }
      }
    }
    
    // Method 3: Fallback - Look for video.js tech element
    const videoJsTech = player.querySelector('.vjs-tech');
    if (videoJsTech) {
      const videoUrl = this.extractVideoUrlFromElement(videoJsTech);
      if (videoUrl) {
        console.log('✅ Found video URL in video.js tech:', videoUrl);
        return videoUrl;
      }
    }
    
    // Method 3: Fallback - Look for any video element
    const videos = player.querySelectorAll('video');
    for (const video of videos) {
      const videoUrl = this.extractVideoUrlFromElement(video);
      if (videoUrl) {
        console.log('✅ Found video URL in video.js player video:', videoUrl);
        return videoUrl;
      }
    }
    
    // Method 4: Fallback - Check for source elements with specific labels
    const originalSource = player.querySelector('source[label="original"]');
    if (originalSource && originalSource.src && !originalSource.src.startsWith('blob:')) {
      console.log('✅ Found original source in video.js player:', originalSource.src);
      return originalSource.src;
    }
    
    // Method 5: Fallback - Check any source element
    const allSources = player.querySelectorAll('source');
    for (const source of allSources) {
      if (source.src && !source.src.startsWith('blob:')) {
        console.log('✅ Found source in video.js player:', source.src);
        return source.src;
      }
    }
    
    console.log('❌ No video URL found in video.js player');
    return null;
  }

  /**
   * Extract video URL from data attributes
   */
  extractVideoUrlFromDataAttributes(video) {
    console.log('🔍 Extracting video URL from data attributes:', video);
    
    // Check common data attributes
    const dataAttributes = ['data-src', 'data-video', 'data-url', 'data-source'];
    
    for (const attr of dataAttributes) {
      const value = video.getAttribute(attr);
      if (value && value.includes('http')) {
        console.log(`✅ Found video URL in ${attr}:`, value);
        return value;
      }
    }
    
    // Also check parent elements for data attributes
    let parent = video.parentElement;
    let depth = 0;
    while (parent && depth < 3) {
      for (const attr of dataAttributes) {
        const value = parent.getAttribute(attr);
        if (value && value.includes('http')) {
          console.log(`✅ Found video URL in parent ${attr}:`, value);
          return value;
        }
      }
      parent = parent.parentElement;
      depth++;
    }
    
    console.log('❌ No video URL found in data attributes');
    return null;
  }

  /**
   * Create video download button
   */
  createVideoDownloadButton(container, videoUrl) {
    if (!videoUrl || videoUrl.startsWith('blob:')) {
      console.log('⚠️ Invalid video URL, skipping button creation:', videoUrl);
      return;
    }
    
    // Find the parent post element
    const post = container.closest('.b-post');
    if (!post) {
      console.log('⚠️ No post found for video button, appending to container');
      const creatorUsername = this.getCreatorUsername(container);
      const downloadData = [[videoUrl, creatorUsername, 'download video']];
      const buttonContainer = this.createDownloadButtonContainer(downloadData);
      container.appendChild(buttonContainer);
      return;
    }
    
    // Check if a video button already exists
    const existingButtons = post.querySelectorAll(`.${this.uniqueClass} button`);
    let videoButtonExists = false;
    const cleanVideoUrl = videoUrl.split('?')[0]; // URL without query params for comparison
    
    existingButtons.forEach(btn => {
      // Check if this button is for a video
      const buttonText = btn.textContent || '';
      if (buttonText.includes('Video') || buttonText.includes('video') || buttonText.includes('🎬')) {
        videoButtonExists = true;
        // Try to check if it's the same URL (optional, for logging)
        const buttonContainer = btn.closest(`.${this.uniqueClass}`);
        if (buttonContainer) {
          const onclick = btn.getAttribute('onclick') || '';
          const dataUrl = btn.getAttribute('data-url') || buttonContainer.getAttribute('data-url') || '';
          
          // Check if URL matches (compare base URL without query params)
          if ((onclick && onclick.includes(cleanVideoUrl)) || 
              (dataUrl && dataUrl.includes(cleanVideoUrl))) {
            console.log('✅ Found existing video button with matching URL');
          }
        }
      }
    });
    
    if (videoButtonExists) {
      console.log('⚠️ Video button already exists, skipping');
      return;
    }
    
    // If no video button exists, proceed to create one (even if image buttons exist)
    const creatorUsername = this.getCreatorUsername(post);
    const downloadData = [[videoUrl, creatorUsername, 'download video']];
    
    // Remove existing video buttons (but keep image buttons if they exist)
    // Only remove buttons that are specifically for videos
    const allButtons = post.querySelectorAll(`.${this.uniqueClass} button`);
    allButtons.forEach(btn => {
      const buttonText = btn.textContent || '';
      if (buttonText.includes('Video') || buttonText.includes('video') || buttonText.includes('🎬')) {
        // Remove the button and its container if it's the only button
        const container = btn.closest(`.${this.uniqueClass}`);
        if (container) {
          const otherButtons = container.querySelectorAll('button');
          if (otherButtons.length === 1) {
            // Only button in container, remove container
            container.remove();
          } else {
            // Multiple buttons, just remove this one
            btn.remove();
          }
        } else {
          btn.remove();
        }
      }
    });
    
    // Always add button to the post's tools container (same location as image buttons)
    const buttonContainer = this.createDownloadButtonContainer(downloadData);
    const toolsContainer = post.querySelector('.b-post__tools');
    
    if (toolsContainer) {
      // Make sure tools container is visible
      if (toolsContainer.style.display === 'none') {
        toolsContainer.style.display = '';
      }
      
      // Check if there's already a button container in tools, if so append to it
      const existingContainer = toolsContainer.querySelector(`.${this.uniqueClass}`);
      if (existingContainer) {
        // Append video button to existing container
        const videoButton = buttonContainer.querySelector('button');
        if (videoButton) {
          existingContainer.appendChild(videoButton);
          console.log('✅ Added video download button to existing container');
        }
      } else {
        toolsContainer.appendChild(buttonContainer);
        console.log('✅ Created video download button in tools container for:', videoUrl.substring(0, 100) + '...');
      }
    } else {
      // Fallback: try to find or create tools container
      console.log('⚠️ Tools container not found, looking for alternative location...');
      
      // Try to find post header or actions area
      const postHeader = post.querySelector('.b-post__header');
      const postActions = post.querySelector('.b-post__actions, .b-post__footer');
      
      if (postHeader) {
        postHeader.appendChild(buttonContainer);
        console.log('✅ Created video download button in post header');
      } else if (postActions) {
        postActions.appendChild(buttonContainer);
        console.log('✅ Created video download button in post actions');
      } else {
        // Last resort: append to post
        post.appendChild(buttonContainer);
        console.log('✅ Created video download button in post (no tools container)');
      }
    }
  }

  /**
   * Retry extraction for dimension players
   */
  retryDimensionPlayerExtraction(player) {
    console.log('🔄 Retrying dimension player extraction for:', player);
    
    const videoUrl = this.extractVideoUrlFromDimensionPlayer(player);
    if (videoUrl) {
      console.log('✅ Found video URL on retry:', videoUrl);
      this.createVideoDownloadButton(player, videoUrl);
    }
  }

  /**
   * Retry extraction for video.js players
   */
  retryVideoJsPlayerExtraction(player) {
    console.log('🔄 Retrying video.js player extraction for:', player);
    
    const videoUrl = this.extractVideoUrlFromVideoJsPlayer(player);
    if (videoUrl) {
      console.log('✅ Found video URL on retry:', videoUrl);
      this.createVideoDownloadButton(player, videoUrl);
    }
  }

  /**
   * Retry extraction for data attribute videos
   */
  retryDataAttributeVideoExtraction(video) {
    console.log('🔄 Retrying data attribute video extraction for:', video);
    
    const videoUrl = this.extractVideoUrlFromDataAttributes(video);
    if (videoUrl) {
      console.log('✅ Found video URL on retry:', videoUrl);
      const parent = video.parentElement;
      if (parent) {
        this.createVideoDownloadButton(parent, videoUrl);
      }
    }
  }

  /**
   * Setup image carousel/slider handling within posts
   */
  setupImageCarouselHandling() {
    console.log('🖼️ Setting up image carousel handling...');
    
    // Handle posts with image carousels/sliders
    const posts = document.querySelectorAll('.b-post');
    posts.forEach(post => {
      const carouselContainer = post.querySelector('.b-post__media__carousel, .b-post__media__slider, [class*="carousel"], [class*="slider"]');
      
      if (carouselContainer) {
        console.log('🖼️ Found image carousel in post');
        
        // Observe carousel changes
        const carouselObserver = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' || mutation.type === 'childList') {
              setTimeout(() => {
                this.updateButtonsForCurrentCarouselItem(post, carouselContainer);
              }, 100);
            }
          });
        });
        
        carouselObserver.observe(carouselContainer, {
          attributes: true,
          childList: true,
          subtree: true
        });
        
        // Listen for carousel navigation events
        carouselContainer.addEventListener('click', (event) => {
          if (event.target.closest('[class*="nav"], [class*="arrow"], [class*="prev"], [class*="next"]')) {
            setTimeout(() => {
              this.updateButtonsForCurrentCarouselItem(post, carouselContainer);
            }, 200);
          }
        });
        
        // Listen for keyboard navigation
        carouselContainer.addEventListener('keydown', (event) => {
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            setTimeout(() => {
              this.updateButtonsForCurrentCarouselItem(post, carouselContainer);
            }, 200);
          }
        });
      }
    });
  }

  /**
   * Update buttons for current carousel item
   */
  updateButtonsForCurrentCarouselItem(post, carouselContainer) {
    // Find the currently visible/active item
    const activeItem = carouselContainer.querySelector('[class*="active"], [class*="current"], [style*="display: block"], [style*="opacity: 1"]');
    
    if (!activeItem) {
      // Try alternative selectors for active items
      const visibleItems = carouselContainer.querySelectorAll('img:not([style*="display: none"]), video:not([style*="display: none"])');
      if (visibleItems.length > 0) {
        const firstVisible = visibleItems[0];
        this.updateButtonsForMediaElement(post, firstVisible);
      }
      return;
    }
    
    this.updateButtonsForMediaElement(post, activeItem);
  }

  /**
   * Update buttons for specific media element
   */
  updateButtonsForMediaElement(post, mediaElement) {
    // Remove existing buttons
    const existingButtons = post.querySelectorAll(`.${this.uniqueClass}`);
    existingButtons.forEach(btn => btn.remove());
    
    // Extract media URL
    let mediaUrl = null;
    let buttonLabel = 'download';
    
    if (mediaElement.tagName === 'VIDEO') {
      mediaUrl = this.extractVideoUrlFromElement(mediaElement);
      buttonLabel = 'download video';
    } else if (mediaElement.tagName === 'IMG') {
      mediaUrl = mediaElement.src;
    } else {
      // Check for video or image within the element
      const video = mediaElement.querySelector('video');
      if (video) {
        mediaUrl = this.extractVideoUrlFromElement(video);
        buttonLabel = 'download video';
      } else {
        const img = mediaElement.querySelector('img');
        if (img) {
          mediaUrl = img.src;
        }
      }
    }
    
    if (mediaUrl) {
      const creatorUsername = this.getCreatorUsername(post);
      const downloadData = [[mediaUrl, creatorUsername, buttonLabel]];
      const buttonContainer = this.createDownloadButtonContainer(downloadData);
      
      // Add button to the post's tools container (same location as image buttons)
      const toolsContainer = post.querySelector('.b-post__tools');
      if (toolsContainer) {
        toolsContainer.appendChild(buttonContainer);
        console.log('✅ Updated buttons in tools container for current carousel item:', mediaUrl);
      } else {
        // Fallback: append to post if tools container doesn't exist
        post.appendChild(buttonContainer);
        console.log('✅ Updated buttons in post (no tools container) for current carousel item:', mediaUrl);
      }
    }
  }

  /**
   * Setup swipe/touch handling for mobile carousels
   */
  setupSwipeHandling() {
    console.log('📱 Setting up swipe handling for mobile carousels...');
    
    let startX = 0;
    let startY = 0;
    let currentPost = null;
    
    // Listen for touch events on posts
    document.addEventListener('touchstart', (event) => {
      const post = event.target.closest('.b-post');
      if (post) {
        currentPost = post;
        startX = event.touches[0].clientX;
        startY = event.touches[0].clientY;
      }
    });
    
    document.addEventListener('touchend', (event) => {
      if (!currentPost) return;
      
      const endX = event.changedTouches[0].clientX;
      const endY = event.changedTouches[0].clientY;
      
      const deltaX = endX - startX;
      const deltaY = endY - startY;
      
      // Check if it's a horizontal swipe (more horizontal than vertical)
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
        console.log('📱 Horizontal swipe detected, updating buttons...');
        setTimeout(() => {
          this.updateButtonsForCurrentCarouselItem(currentPost, currentPost.querySelector('.b-post__media__carousel, .b-post__media__slider'));
        }, 300);
      }
      
      currentPost = null;
    });
  }

  /**
   * Setup direct image click handling within posts
   */
  setupDirectImageClickHandling() {
    console.log('🖼️ Setting up direct image click handling...');
    
    // Handle direct clicks on images in posts
    document.addEventListener('click', (event) => {
      const target = event.target;
      
      // Check if clicked on an image in a post
      if (target.tagName === 'IMG' && target.closest('.b-post')) {
        const post = target.closest('.b-post');
        const allImages = post.querySelectorAll('img.b-post__media__img');
        
        if (allImages.length > 1) {
          console.log('🖼️ Direct image click detected in multi-image post');
          
          // Find the clicked image index
          const clickedIndex = Array.from(allImages).indexOf(target);
          
          if (clickedIndex !== -1) {
            console.log(`🖼️ Clicked image ${clickedIndex + 1}/${allImages.length}`);
            
            // Update buttons for the clicked image
            setTimeout(() => {
              this.updateButtonsForClickedImage(post, target, clickedIndex, allImages.length);
            }, 100);
          }
        }
      }
    });
  }

  /**
   * Update buttons for clicked image
   */
  updateButtonsForClickedImage(post, clickedImage, imageIndex, totalImages) {
    // Remove existing buttons
    const existingButtons = post.querySelectorAll(`.${this.uniqueClass}`);
    existingButtons.forEach(btn => btn.remove());
    
    // Extract media URL from clicked image
    let mediaUrl = clickedImage.src;
    let buttonLabel = 'download';
    
    // Check if this image is associated with a video
    const videoContainer = clickedImage.closest('.b-post__media__video');
    if (videoContainer) {
      const video = videoContainer.querySelector('video');
      if (video) {
        const videoUrl = this.extractVideoUrlFromElement(video);
        if (videoUrl) {
          mediaUrl = videoUrl;
          buttonLabel = 'download video';
        }
      }
    }
    
    if (mediaUrl) {
      const creatorUsername = this.getCreatorUsername(post);
      const downloadData = [[mediaUrl, creatorUsername, buttonLabel]];
      const buttonContainer = this.createDownloadButtonContainer(downloadData);
      
      // Add button to the post's tools container (same location as image buttons)
      const toolsContainer = post.querySelector('.b-post__tools');
      if (toolsContainer) {
        toolsContainer.appendChild(buttonContainer);
        console.log(`✅ Updated buttons in tools container for clicked image ${imageIndex + 1}/${totalImages}:`, mediaUrl);
      } else {
        // Fallback: append to post if tools container doesn't exist
        post.appendChild(buttonContainer);
        console.log(`✅ Updated buttons in post (no tools container) for clicked image ${imageIndex + 1}/${totalImages}:`, mediaUrl);
      }
    }
  }

  /**
   * Setup thumbnail navigation handling
   */
  setupThumbnailNavigationHandling() {
    console.log('🖼️ Setting up thumbnail navigation handling...');
    
    // Handle thumbnail clicks in image galleries
    document.addEventListener('click', (event) => {
      const target = event.target;
      
      // Check if clicked on a thumbnail
      if (target.closest('[class*="thumb"], [class*="nav"], [class*="dot"]')) {
        const post = target.closest('.b-post');
        if (post) {
          console.log('🖼️ Thumbnail navigation detected');
          
          setTimeout(() => {
            this.updateButtonsForCurrentThumbnail(post);
          }, 200);
        }
      }
    });
  }

  /**
   * Update buttons for current thumbnail
   */
  updateButtonsForCurrentThumbnail(post) {
    // Find the currently active/selected thumbnail
    const activeThumbnail = post.querySelector('[class*="thumb"][class*="active"], [class*="nav"][class*="active"], [class*="dot"][class*="active"]');
    
    if (activeThumbnail) {
      // Find the corresponding main image/video
      const thumbnailIndex = this.getThumbnailIndex(activeThumbnail, post);
      const mainMedia = this.getMainMediaByIndex(post, thumbnailIndex);
      
      if (mainMedia) {
        this.updateButtonsForMediaElement(post, mainMedia);
      }
    }
  }

  /**
   * Get thumbnail index
   */
  getThumbnailIndex(thumbnail, post) {
    const allThumbnails = post.querySelectorAll('[class*="thumb"], [class*="nav"], [class*="dot"]');
    return Array.from(allThumbnails).indexOf(thumbnail);
  }

  /**
   * Get main media by index
   */
  getMainMediaByIndex(post, index) {
    const allMedia = post.querySelectorAll('img.b-post__media__img, .b-post__media__video');
    return allMedia[index] || null;
  }

  /**
   * Setup media type change detection (image to video)
   */
  setupMediaTypeChangeDetection() {
    console.log('🔄 Setting up media type change detection...');
    
    // Watch for video elements appearing in posts (when images transform to videos)
    const mediaChangeObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Check if a video element was added
              if (node.tagName === 'VIDEO' || node.querySelector?.('video')) {
                const post = node.closest('.b-post');
                if (post) {
                  console.log('🎬 Video element detected in post, refreshing buttons...');
                  setTimeout(() => {
                    this.refreshButtonsOnMediaChange(post);
                  }, 300);
                }
              }
              
              // Check if video player containers were added
              if (node.classList?.contains('video-wrapper') ||
                  node.classList?.contains('video-js') ||
                  node.classList?.contains('vjs-fluid') ||
                  (node.className && typeof node.className === 'string' && 
                   (node.className.includes('videoPlayer-') || node.className.includes('vjs-')))) {
                const post = node.closest('.b-post');
                if (post) {
                  console.log('🎬 Video player container detected in post, refreshing buttons...');
                  setTimeout(() => {
                    this.refreshButtonsOnMediaChange(post);
                  }, 300);
                }
              }
            }
          });
        }
        
        // Don't watch video attribute changes - they cause infinite refresh loops
        // Only watch for when video elements are added to the DOM
      });
    });
    
    // Observe all posts for video elements appearing (only childList, not attributes)
    // Watching video attributes causes infinite refresh loops
    mediaChangeObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false  // Don't watch attributes - only watch for new elements
    });
    
    // Store observer reference
    this.mediaChangeObserver = mediaChangeObserver;
    
    console.log('✅ Media type change detection setup complete');
  }

  /**
   * Setup network interception to capture video URLs from CDN requests
   * This intercepts fetch, XHR, and monitors Performance API
   * Made more selective to avoid rate limiting
   */
  setupNetworkInterception() {
    console.log('🌐 Setting up network interception for video URLs...');
    
    // Debounce for captureVideoUrl to prevent rapid calls
    let captureDebounceTimeout = null;
    const debouncedCapture = (url) => {
      if (captureDebounceTimeout) {
        clearTimeout(captureDebounceTimeout);
      }
      captureDebounceTimeout = setTimeout(() => {
        this.captureVideoUrl(url);
      }, 500); // 500ms debounce
    };
    
    // Method 1: Intercept fetch() calls - ONLY for video CDN requests
    const originalFetch = window.fetch;
    const downloaderInstance = this; // Store reference to this instance
    window.fetch = async (...args) => {
      const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || args[0]);
      
      // Only intercept actual video CDN requests (very specific pattern)
      if (url && downloaderInstance.isVideoCdnUrl(url)) {
        console.log('📹 Intercepted video URL from fetch:', url);
        debouncedCapture(url);
      }
      
      try {
        const response = await originalFetch.apply(window, args);
        return response;
      } catch (error) {
        throw error;
      }
    };
    
    // Method 2: Intercept XMLHttpRequest - ONLY for video CDN requests
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;
    
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
      this._ofUrl = url;
      return originalXHROpen.apply(this, [method, url, ...rest]);
    };
    
    XMLHttpRequest.prototype.send = function(...args) {
      if (this._ofUrl) {
        const downloader = window.onlyFansDownloaderInstance;
        if (downloader && downloader.isVideoCdnUrl(this._ofUrl)) {
          console.log('📹 Intercepted video URL from XHR:', this._ofUrl);
          debouncedCapture(this._ofUrl);
        }
      }
      return originalXHRSend.apply(this, args);
    };
    
    // Method 3: Monitor Performance API for network resources (less frequent)
    this.setupPerformanceMonitoring();
    
    // Method 4: Monitor video element's network activity (passive only)
    this.setupVideoNetworkMonitoring();
    
    console.log('✅ Network interception setup complete');
  }

  /**
   * Check if URL is a video CDN URL (more specific to avoid false positives)
   */
  isVideoCdnUrl(url) {
    if (!url || typeof url !== 'string') return false;
    
    // Only match actual OnlyFans CDN video URLs (very specific patterns)
    const videoCdnPatterns = [
      /cdn\d*\.onlyfans\.com.*\/\d+\/videos\/.*\.mp4/i,
      /cdn\d*\.onlyfans\.com.*\/videos\/.*\.mp4/i,
      /cdn\d*\.onlyfans\.com.*\/\d+\/videos\/.*\.m3u8/i,
      /cdn\d*\.onlyfans\.com.*\/files\/.*\.mp4/i,
      /cdn\d*\.onlyfans\.com.*\/\d+\/.*\.mp4/i,
      /cdn\d*\.onlyfans\.com.*\/.*\.m3u8/i
    ];
    
    return videoCdnPatterns.some(pattern => pattern.test(url));
  }
  
  /**
   * Check if URL is a video URL (broader check for other contexts)
   */
  isVideoUrl(url) {
    if (!url || typeof url !== 'string') return false;
    
    // Check for OnlyFans CDN video URLs (more specific)
    const videoPatterns = [
      /cdn\d*\.onlyfans\.com.*\.mp4/i,
      /cdn\d*\.onlyfans\.com.*\/videos\//i,
      /cdn\d*\.onlyfans\.com.*\/\d+\/videos\//i,
      /\.mp4(\?|$)/i,
      /\.m3u8(\?|$)/i
    ];
    
    return videoPatterns.some(pattern => pattern.test(url));
  }

  /**
   * Capture and store video URL, then try to match it to a post
   * Debounced to prevent rate limiting
   */
  captureVideoUrl(url) {
    if (!url || url.startsWith('blob:')) return;
    
    // Clean URL (remove query params for matching)
    const cleanUrl = url.split('?')[0];
    
    // Store the URL (update timestamp if already exists, or add new entry)
    const existingData = this.networkVideoUrls.get(cleanUrl);
    if (!existingData) {
      this.networkVideoUrls.set(cleanUrl, {
        url: url,
        timestamp: Date.now()
      });
      console.log('💾 Stored new video URL:', cleanUrl);
    } else {
      // Update timestamp to mark as recently captured
      existingData.timestamp = Date.now();
      existingData.url = url; // Update URL in case query params changed
      console.log('🔄 Updated video URL timestamp:', cleanUrl);
      
      // If URL was already stored, try to update buttons immediately for all posts with videos
      // This helps when the streaming URL changes
      const posts = document.querySelectorAll('.b-post');
      for (const post of posts) {
        const videoWrapper = post.querySelector('.video-wrapper');
        const videoJsPlayer = post.querySelector('.video-js');
        const videos = post.querySelectorAll('video');
        
        if (videoWrapper || videoJsPlayer || videos.length > 0) {
          // Check if any video in this post is currently playing
          let isPlaying = false;
          videos.forEach(video => {
            if (!video.paused && !video.ended) {
              isPlaying = true;
            }
          });
          
          // If video is playing, try to update button immediately
          if (isPlaying) {
            this.updateVideoDownloadButton(post, url);
          }
        }
      }
    }
    
    // Try to match immediately (less debounce for active video loading)
    if (this.matchVideoUrlTimeout) {
      clearTimeout(this.matchVideoUrlTimeout);
    }
    this.matchVideoUrlTimeout = setTimeout(() => {
      this.matchVideoUrlToPost(url);
    }, 500); // Reduced from 1000ms to 500ms for faster matching
  }

  /**
   * Try to match captured video URL to a post and update buttons
   */
  matchVideoUrlToPost(videoUrl) {
    if (!videoUrl || videoUrl.startsWith('blob:')) {
      return;
    }
    
    console.log('🔍 Matching video URL to post:', videoUrl.substring(0, 100) + '...');
    
    // Find all posts with video elements
    const posts = document.querySelectorAll('.b-post');
    
    // First, try to match by post ID
    let matchedPost = null;
    for (const post of posts) {
      const postId = post.getAttribute('data-id') || post.id || post.getAttribute('id');
      if (postId && videoUrl.includes(postId)) {
        matchedPost = post;
        console.log('✅ Matched video URL to post by ID:', postId);
        break;
      }
    }
    
    // If no ID match, try to match by finding posts with videos that don't have buttons
    if (!matchedPost) {
      for (const post of posts) {
        const videoWrapper = post.querySelector('.video-wrapper');
        const videoJsPlayer = post.querySelector('.video-js');
        const videos = post.querySelectorAll('video');
        
        if (videoWrapper || videoJsPlayer || videos.length > 0) {
          // Check if this post already has a video button
          const existingButtons = post.querySelectorAll(`.${this.uniqueClass} button`);
          let hasVideoButton = false;
          
          existingButtons.forEach(btn => {
            const buttonText = btn.textContent || '';
            if (buttonText.includes('Video') || buttonText.includes('video') || buttonText.includes('🎬')) {
              hasVideoButton = true;
            }
          });
          
          // If no video button exists, this might be the post
          if (!hasVideoButton) {
            // Check if any video in this post is currently playing or has blob URL
            let hasBlobVideo = false;
            videos.forEach(video => {
              if (video.src && video.src.startsWith('blob:')) {
                hasBlobVideo = true;
              }
            });
            
            // If this post has a blob video, it's likely the one
            if (hasBlobVideo) {
              matchedPost = post;
              console.log('✅ Matched video URL to post with blob video');
              break;
            }
          }
        }
      }
    }
    
    // If we found a matching post, update or create the button
    if (matchedPost) {
      // Try to update existing button first
      const updated = this.updateVideoDownloadButton(matchedPost, videoUrl);
      
      if (!updated) {
        // No existing button, create new one
        const videoWrapper = matchedPost.querySelector('.video-wrapper');
        const videoJsPlayer = matchedPost.querySelector('.video-js');
        const videos = matchedPost.querySelectorAll('video');
        const container = videoWrapper || videoJsPlayer || videos[0]?.closest('.video-wrapper, .video-js') || matchedPost;
        console.log('✅ Creating video download button for matched post');
        this.createVideoDownloadButton(container, videoUrl);
      } else {
        console.log('✅ Updated existing video button for matched post');
      }
    } else {
      // No direct match found, try to match to any post with video that doesn't have a button
      console.log('⚠️ No direct match found, trying to match to any post with video...');
      for (const post of posts) {
        const videoWrapper = post.querySelector('.video-wrapper');
        const videoJsPlayer = post.querySelector('.video-js');
        const videos = post.querySelectorAll('video');
        
        if (videoWrapper || videoJsPlayer || videos.length > 0) {
          const existingButtons = post.querySelectorAll(`.${this.uniqueClass} button`);
          let hasVideoButton = false;
          
          existingButtons.forEach(btn => {
            const buttonText = btn.textContent || '';
            if (buttonText.includes('Video') || buttonText.includes('video') || buttonText.includes('🎬')) {
              hasVideoButton = true;
            }
          });
          
          // Try to update existing button first
          const updated = this.updateVideoDownloadButton(post, videoUrl);
          
          if (!updated && !hasVideoButton) {
            // No existing button, create new one
            const container = videoWrapper || videoJsPlayer || videos[0]?.closest('.video-wrapper, .video-js') || post;
            console.log('✅ Creating video download button for post with video (no direct match)');
            this.createVideoDownloadButton(container, videoUrl);
            break; // Only create one button per URL
          } else if (updated) {
            console.log('✅ Updated existing video button for post with video');
            break;
          }
        }
      }
    }
  }

  /**
   * Setup Performance API monitoring for network resources
   * Less frequent to avoid rate limiting
   */
  setupPerformanceMonitoring() {
    // Track processed entries to avoid duplicates
    const processedEntries = new Set();
    
    // Monitor network resources using Performance API
    const checkPerformanceEntries = () => {
      try {
        const entries = performance.getEntriesByType('resource');
        
        entries.forEach(entry => {
          // Only process video CDN URLs and avoid duplicates
          if (entry.name && this.isVideoCdnUrl(entry.name) && !processedEntries.has(entry.name)) {
            processedEntries.add(entry.name);
            console.log('📹 Found video URL from Performance API:', entry.name);
            this.captureVideoUrl(entry.name);
          }
        });
      } catch (e) {
        console.log('⚠️ Error checking performance entries:', e);
      }
    };
    
    // Check less frequently (every 5 seconds instead of 2)
    setInterval(checkPerformanceEntries, 5000);
    
    // Also check when new entries are added (with debouncing)
    let observerDebounceTimeout = null;
    const performanceObserver = new PerformanceObserver((list) => {
      if (observerDebounceTimeout) {
        clearTimeout(observerDebounceTimeout);
      }
      observerDebounceTimeout = setTimeout(() => {
        list.getEntries().forEach(entry => {
          // Only process video CDN URLs and avoid duplicates
          if (entry.name && this.isVideoCdnUrl(entry.name) && !processedEntries.has(entry.name)) {
            processedEntries.add(entry.name);
            console.log('📹 Found video URL from Performance Observer:', entry.name);
            this.captureVideoUrl(entry.name);
          }
        });
      }, 1000); // Debounce observer calls
    });
    
    try {
      performanceObserver.observe({ entryTypes: ['resource'] });
    } catch (e) {
      console.log('⚠️ Performance Observer not supported:', e);
    }
  }

  /**
   * Monitor video element's network activity
   * Passive monitoring only - doesn't interfere with video loading
   */
  setupVideoNetworkMonitoring() {
    // Track processed video sources to avoid duplicates
    const processedVideoSources = new Set();
    
    // Listen for video elements loading (passive only)
    document.addEventListener('loadedmetadata', (event) => {
      if (event.target.tagName === 'VIDEO') {
        const video = event.target;
        const src = video.currentSrc || video.src;
        
        // Only process video CDN URLs and avoid duplicates
        if (src && this.isVideoCdnUrl(src) && !src.startsWith('blob:') && !processedVideoSources.has(src)) {
          processedVideoSources.add(src);
          console.log('📹 Found video URL from loadedmetadata:', src);
          this.captureVideoUrl(src);
          
          // Immediately try to match to post
          const post = video.closest('.b-post');
          if (post) {
            setTimeout(() => {
              this.matchVideoUrlToPost(src);
            }, 500);
          }
        }
      }
    }, true);
    
    // Listen for video source changes (passive only)
    document.addEventListener('loadstart', (event) => {
      if (event.target.tagName === 'VIDEO') {
        const video = event.target;
        const src = video.currentSrc || video.src;
        
        // Only process video CDN URLs and avoid duplicates
        if (src && this.isVideoCdnUrl(src) && !src.startsWith('blob:') && !processedVideoSources.has(src)) {
          processedVideoSources.add(src);
          console.log('📹 Found video URL from loadstart:', src);
          this.captureVideoUrl(src);
          
          // Immediately try to match to post
          const post = video.closest('.b-post');
          if (post) {
            setTimeout(() => {
              this.matchVideoUrlToPost(src);
            }, 500);
          }
        }
      }
    }, true);
    
    // Listen for canplay event (video is ready to play)
    document.addEventListener('canplay', (event) => {
      if (event.target.tagName === 'VIDEO') {
        const video = event.target;
        const src = video.currentSrc || video.src;
        
        // Also check video.js player sources
        const videoJsPlayer = video.closest('.video-js');
        if (videoJsPlayer && videoJsPlayer.id) {
          setTimeout(() => {
            this.checkVideoJsPlayerSources(videoJsPlayer);
          }, 500);
        }
        
        // Check if we have a captured URL for this video
        if (src && src.startsWith('blob:')) {
          // Video is using blob URL, check if we have the actual CDN URL
          const post = video.closest('.b-post');
          if (post) {
            const postId = post.getAttribute('data-id') || post.id || post.getAttribute('id');
            if (postId) {
              // Look for recently captured URLs
              for (const [cleanUrl, data] of this.networkVideoUrls.entries()) {
                const isRecent = (Date.now() - data.timestamp) < 10000;
                if (isRecent && (data.url.includes(postId) || this.isVideoCdnUrl(data.url))) {
                  console.log('📹 Found matching video URL for blob video:', data.url);
                  const updated = this.updateVideoDownloadButton(post, data.url);
                  if (!updated) {
                    setTimeout(() => {
                      this.matchVideoUrlToPost(data.url);
                    }, 500);
                  }
                  break;
                }
              }
            }
          }
        } else if (src && !src.startsWith('blob:') && this.isVideoCdnUrl(src)) {
          // Video has a real CDN URL, update button
          const post = video.closest('.b-post');
          if (post) {
            this.captureVideoUrl(src);
            const updated = this.updateVideoDownloadButton(post, src);
            if (!updated) {
              setTimeout(() => {
                this.matchVideoUrlToPost(src);
              }, 500);
            }
          }
        }
      }
    }, true);
  }

  /**
   * Refresh buttons when media type changes (image to video)
   * Only updates buttons, never modifies video elements
   */
  refreshButtonsOnMediaChange(post) {
    // Debounce to prevent rapid calls
    if (this.refreshButtonsTimeout) {
      clearTimeout(this.refreshButtonsTimeout);
    }
    
    this.refreshButtonsTimeout = setTimeout(() => {
      console.log('🔄 Refreshing buttons for media type change in post:', post);
      
      // Check for videos first (they take priority)
      // Only read from video elements, never modify them
      const videos = post.querySelectorAll('video');
      const videoWrappers = post.querySelectorAll('.video-wrapper');
      const videoPlayers = post.querySelectorAll('.video-js, [class*="videoPlayer-"]');
      
      let hasVideos = false;
      let foundVideoUrl = false;
      
      // Check if any videos are actually present and visible
      // Only extract URLs, never modify video elements
      videos.forEach(video => {
        // Only read from video, never modify
        const videoUrl = this.extractVideoUrlFromElement(video);
        if (videoUrl) {
          hasVideos = true;
          foundVideoUrl = true;
          const parent = video.closest('.video-wrapper, .video-js, [class*="videoPlayer-"]') || video.parentElement;
          if (parent) {
            // Check if button already exists - don't recreate if it does
            const existingButton = post.querySelector(`.${this.uniqueClass}`);
            if (!existingButton) {
              // Only create button if it doesn't exist, don't touch video
              this.createVideoDownloadButton(parent, videoUrl);
            }
          }
        }
      });
      
      // Also check video wrappers and players
      if ((videoWrappers.length > 0 || videoPlayers.length > 0) && !foundVideoUrl) {
        // Try to extract from wrappers
        videoWrappers.forEach(wrapper => {
          const videoUrl = this.extractVideoUrl(wrapper, post);
          if (videoUrl) {
            foundVideoUrl = true;
            const existingButton = post.querySelector(`.${this.uniqueClass}`);
            if (!existingButton) {
              this.createVideoDownloadButton(wrapper, videoUrl);
            }
          }
        });
        
        // If still no URL, check networkVideoUrls for this post
        if (!foundVideoUrl) {
          const postId = post.getAttribute('data-id') || post.id;
          if (postId) {
            // Check if we have a captured video URL for this post
            for (const [cleanUrl, data] of this.networkVideoUrls.entries()) {
              if (data.url.includes(postId)) {
                foundVideoUrl = true;
                const existingButton = post.querySelector(`.${this.uniqueClass}`);
                if (!existingButton) {
                  console.log('✅ Using captured network video URL for post:', postId);
                  this.createVideoDownloadButton(videoWrappers[0] || videoPlayers[0], data.url);
                }
                break;
              }
            }
          }
        }
      }
      
      // Only remove and recreate buttons if we found a video URL and button doesn't exist
      // OR if we're switching from images to videos
      const existingButtons = post.querySelectorAll(`.${this.uniqueClass}`);
      if (foundVideoUrl && existingButtons.length === 0) {
        // Button should have been created above, but if not, try one more time
        if (videoWrappers.length > 0 || videoPlayers.length > 0) {
          this.handleVideoPlayers();
        }
      } else if (!hasVideos && !foundVideoUrl) {
        // No videos found, check for images
        const mediaToDownload = this.extractMediaFromPost(post);
        if (mediaToDownload.length > 0) {
          // Only remove buttons if we're switching to images
          existingButtons.forEach(btn => btn.remove());
          
          const buttonContainer = this.createDownloadButtonContainer(mediaToDownload);
          const toolsContainer = post.querySelector('.b-post__tools');
          
          if (toolsContainer) {
            toolsContainer.appendChild(buttonContainer);
            console.log('✅ Refreshed image buttons in tools container');
          } else {
            post.appendChild(buttonContainer);
            console.log('✅ Refreshed image buttons in post (no tools container)');
          }
        }
      } else if (foundVideoUrl && existingButtons.length > 0) {
        console.log('✅ Video button already exists, keeping it');
      } else {
        console.log('⚠️ No video URL found, keeping existing buttons');
      }
    }, 300); // Debounce delay
  }

  /**
   * Setup comprehensive MutationObserver for dynamic content
   */
  setupMutationObserver() {
    console.log('👁️ Setting up MutationObserver for content detection...');
    
    const mainObserver = new MutationObserver((mutations) => {
      let shouldUpdate = false;
      let hasNewContent = false;
      
      mutations.forEach((mutation) => {
        // Check for new nodes being added
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Check if this is OnlyFans content
              if (node.classList?.contains('b-post') || 
                  node.classList?.contains('b-chat__message') ||
                  node.querySelector?.('.b-post') ||
                  node.querySelector?.('.b-chat__message') ||
                  node.querySelector?.('video') ||
                  node.querySelector?.('img.b-post__media__img')) {
                hasNewContent = true;
                console.log('🆕 New OnlyFans content detected:', node);
              }
              
              // Check if PhotoSwipe was opened
              if (node.classList && node.classList.contains('pswp--open')) {
                console.log('🖼️ PhotoSwipe opened, setting up dynamic updates...');
                setTimeout(() => {
                  this.setupPhotoSwipeDynamicUpdates();
                }, 500);
              }
            }
          });
        }
        
        // Check for attribute changes that might indicate content loading
        if (mutation.type === 'attributes') {
          const target = mutation.target;
          
          // Check for PhotoSwipe slide changes
          if (target.classList && target.classList.contains('pswp__item') && 
              mutation.attributeName === 'aria-hidden' && 
              target.getAttribute('aria-hidden') === 'false') {
            console.log('🖼️ PhotoSwipe slide changed, updating buttons...');
            setTimeout(() => this.updatePhotoSwipeButtons(), 100);
          }
          
          // Check for general content changes
          if (mutation.attributeName === 'class') {
            if (target.classList?.contains('b-post') || 
                target.classList?.contains('b-chat__message') ||
                target.classList?.contains('video-wrapper')) {
              shouldUpdate = true;
            }
            // Check for active/current class changes in carousels (swipe detection)
            if (target.classList && (target.classList.contains('active') || target.classList.contains('current'))) {
              const post = target.closest('.b-post');
              if (post) {
                console.log('🔄 Active item changed in post, updating buttons...');
                setTimeout(() => {
                  this.updateButtonsForVisibleImage(post);
                }, 200);
              }
            }
            // Check for Swiper slide changes (swiper-slide-active class)
            if (target.classList && target.classList.contains('swiper-slide-active')) {
              const post = target.closest('.b-post');
              if (post) {
                console.log('🔄 Swiper slide changed in post, updating buttons...');
                setTimeout(() => {
                  this.updateButtonsForVisibleImage(post);
                }, 200);
              }
            }
          }
        }
      });

      // If we detected new content, inject buttons immediately
      if (hasNewContent) {
        console.log('🚀 New content detected, injecting download buttons...');
        this.injectDownloadButtons();
        this.setupPhotoSwipeHandler();
      } else if (shouldUpdate) {
        this.debounce(this.injectDownloadButtons.bind(this), 500)();
      }
    });
    
    // Observe for all content changes
    mainObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'aria-hidden', 'style'],
      attributeOldValue: true
    });
    
    // Store observer reference for cleanup
    this.mainObserver = mainObserver;
    
    console.log('✅ MutationObserver setup complete');
  }

  /**
   * Update buttons for currently visible image in a post
   */
  updateButtonsForVisibleImage(post) {
    // First, try to find the active Swiper slide
    const swiper = post.querySelector('.swiper');
    if (swiper) {
      const activeSlide = swiper.querySelector('.swiper-slide-active');
      if (activeSlide) {
        const activeImage = activeSlide.querySelector('img.b-post__media__img');
        if (activeImage) {
          const allImages = post.querySelectorAll('img.b-post__media__img');
          const currentIndex = Array.from(allImages).indexOf(activeImage);
          if (currentIndex !== -1) {
            console.log(`🔄 Swiper slide active, updating buttons for image ${currentIndex + 1}/${allImages.length}`);
            this.updateButtonsForMediaIndex(post, currentIndex, allImages.length);
            return;
          }
        }
      }
    }
    
    // Fallback: Find the currently visible image (not hidden)
    const visibleImages = post.querySelectorAll('img.b-post__media__img:not([style*="display: none"])');
    const allImages = post.querySelectorAll('img.b-post__media__img');
    
    if (visibleImages.length === 0 || allImages.length === 0) {
      return;
    }
    
    // Get the first visible image (current one being viewed)
    const currentImage = visibleImages[0];
    const currentIndex = Array.from(allImages).indexOf(currentImage);
    
    if (currentIndex !== -1) {
      console.log(`🔄 Updating buttons for visible image ${currentIndex + 1}/${allImages.length}`);
      this.updateButtonsForMediaIndex(post, currentIndex, allImages.length);
    }
  }

  /**
   * Handle new post being added
   */
  handleNewPost(postElement) {
    console.log('📝 Processing new post:', postElement);
    
    // Add download buttons to the new post
    const mediaToDownload = this.extractMediaFromPost(postElement);
    if (mediaToDownload.length > 0) {
      const buttonContainer = this.createDownloadButtonContainer(mediaToDownload);
      
      // Add button to the post's tools container (same location as image buttons)
      const toolsContainer = postElement.querySelector('.b-post__tools');
      if (toolsContainer) {
        toolsContainer.appendChild(buttonContainer);
        console.log('✅ Added buttons to new post in tools container');
      } else {
        // Fallback: append to post if tools container doesn't exist
        postElement.appendChild(buttonContainer);
        console.log('✅ Added buttons to new post (no tools container)');
      }
    }
    
    // Setup multi-media handling for the new post
    this.setupMultiMediaHandlingForPost(postElement);
  }

  /**
   * Handle new media being added
   */
  handleNewMedia(mediaElement) {
    console.log('🖼️ Processing new media:', mediaElement);
    
    // Find the parent post
    const post = mediaElement.closest('.b-post');
    if (post) {
      // Update buttons for the post
      const mediaToDownload = this.extractMediaFromPost(post);
      if (mediaToDownload.length > 0) {
        // Remove existing buttons
        const existingButtons = post.querySelectorAll(`.${this.uniqueClass}`);
        existingButtons.forEach(btn => btn.remove());
        
        // Add new buttons
        const buttonContainer = this.createDownloadButtonContainer(mediaToDownload);
        
        // Add button to the post's tools container (same location as image buttons)
        const toolsContainer = post.querySelector('.b-post__tools');
        if (toolsContainer) {
          toolsContainer.appendChild(buttonContainer);
          console.log('✅ Updated buttons in tools container for new media');
        } else {
          // Fallback: append to post if tools container doesn't exist
          post.appendChild(buttonContainer);
          console.log('✅ Updated buttons in post (no tools container) for new media');
        }
      }
    }
  }

  /**
   * Handle media navigation (carousel, slider, etc.)
   */
  handleMediaNavigation(navigatedElement) {
    console.log('🔄 Processing media navigation:', navigatedElement);
    
    // Find the parent post
    const post = navigatedElement.closest('.b-post');
    if (!post) return;
    
    // Find the currently active/visible media
    const activeMedia = this.findActiveMediaInPost(post);
    if (activeMedia) {
      this.updateButtonsForMediaElement(post, activeMedia);
      console.log('✅ Updated buttons for navigated media');
    }
  }

  /**
   * Find currently active media in a post
   */
  findActiveMediaInPost(post) {
    // Look for active carousel items
    const activeCarouselItem = post.querySelector('[class*="active"][class*="carousel"], [class*="current"][class*="carousel"]');
    if (activeCarouselItem) {
      return activeCarouselItem;
    }
    
    // Look for active slider items
    const activeSliderItem = post.querySelector('[class*="active"][class*="slider"], [class*="current"][class*="slider"]');
    if (activeSliderItem) {
      return activeSliderItem;
    }
    
    // Look for visible media (not hidden)
    const visibleMedia = post.querySelector('img.b-post__media__img:not([style*="display: none"]), video:not([style*="display: none"])');
    if (visibleMedia) {
      return visibleMedia;
    }
    
    // Look for first media item as fallback
    const firstMedia = post.querySelector('img.b-post__media__img, video');
    return firstMedia;
  }

  /**
   * Setup multi-media handling for a specific post
   */
  setupMultiMediaHandlingForPost(post) {
    const mediaItems = post.querySelectorAll('.b-post__media__img, .b-post__media__video');
    
    if (mediaItems.length > 1) {
      console.log(`📸 Setting up multi-media handling for post with ${mediaItems.length} items`);
      
      // Set up Swiper event listeners if Swiper is present
      this.setupSwiperListenersForPost(post);
      
      // Add click handlers to each media item
      mediaItems.forEach((mediaItem, index) => {
        mediaItem.addEventListener('click', () => {
          console.log(`🖼️ Media item ${index + 1} clicked in post`);
          setTimeout(() => {
            this.updateButtonsForCurrentMediaItem(mediaItem, post);
          }, 100);
        });
      });
    }
  }

  /**
   * Set up Swiper event listeners for a post with carousel
   */
  setupSwiperListenersForPost(post) {
    const swiper = post.querySelector('.swiper');
    if (!swiper) {
      return;
    }
    
    // Try to get Swiper instance from the element
    // Swiper stores its instance on the element
    let swiperInstance = null;
    if (swiper.swiper) {
      swiperInstance = swiper.swiper;
    } else if (swiper.__swiper__) {
      swiperInstance = swiper.__swiper__;
    } else {
      // Try to find Swiper instance by checking for swiper property on parent
      const parent = swiper.parentElement;
      if (parent && parent.swiper) {
        swiperInstance = parent.swiper;
      }
    }
    
    if (swiperInstance) {
      console.log('✅ Found Swiper instance, setting up slide change listener');
      swiperInstance.on('slideChange', () => {
        console.log('🔄 Swiper slide changed via event');
        setTimeout(() => {
          this.updateButtonsForVisibleImage(post);
        }, 200);
      });
    } else {
      // Fallback: Listen for transitionend events on swiper-wrapper
      const swiperWrapper = swiper.querySelector('.swiper-wrapper');
      if (swiperWrapper) {
        swiperWrapper.addEventListener('transitionend', () => {
          console.log('🔄 Swiper transition ended');
          setTimeout(() => {
            this.updateButtonsForVisibleImage(post);
          }, 100);
        });
      }
    }
  }

  /**
   * Debounced processing of content changes
   */
  debouncedProcessContentChanges() {
    if (this.contentChangeTimeout) {
      clearTimeout(this.contentChangeTimeout);
    }
    
    this.contentChangeTimeout = setTimeout(() => {
      console.log('🔄 Processing content changes...');
      
      // Re-inject buttons for all posts
      this.injectDownloadButtons();
      
      // Re-setup multi-media handling
      this.setupMultiMediaPostHandling();
      this.setupImageCarouselHandling();
      this.setupDirectImageClickHandling();
      this.setupThumbnailNavigationHandling();
      
      console.log('✅ Content changes processed');
    }, 500); // 500ms debounce
  }

  /**
   * Cleanup observers when needed
   */
  cleanupObservers() {
    if (this.mainObserver) {
      this.mainObserver.disconnect();
      console.log('🧹 Main observer disconnected');
    }
    
    if (this.mediaChangeObserver) {
      this.mediaChangeObserver.disconnect();
      console.log('🧹 Media change observer disconnected');
    }
    
    if (this.photoSwipeSlideObserver) {
      this.photoSwipeSlideObserver.disconnect();
      console.log('🧹 PhotoSwipe slide observer disconnected');
    }
    
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
      console.log('🧹 Intersection observer disconnected');
    }
    
    if (this.contentChangeTimeout) {
      clearTimeout(this.contentChangeTimeout);
    }
    
    if (this.photoSwipeUpdateTimeout) {
      clearTimeout(this.photoSwipeUpdateTimeout);
    }
  }

  /**
   * Setup infinite scroll handling
   */
  setupInfiniteScrollHandling() {
    console.log('♾️ Setting up infinite scroll handling...');
    
    // Listen for scroll events to detect new content loading
    let scrollTimeout;
    window.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        this.checkForNewContent();
      }, 500);
    });
    
    // Also listen for scroll events on specific containers
    document.addEventListener('scroll', (event) => {
      const target = event.target;
      if (target.classList && (
        target.classList.contains('b-feed') ||
        target.classList.contains('b-content') ||
        target.classList.contains('b-posts')
      )) {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          this.checkForNewContent();
        }, 300);
      }
    }, true);
  }

  /**
   * Check for new content that might have been loaded
   */
  checkForNewContent() {
    const posts = document.querySelectorAll('.b-post');
    const postsWithButtons = document.querySelectorAll(`.b-post .${this.uniqueClass}`);
    
    // If there are posts without buttons, add them
    if (posts.length > postsWithButtons.length) {
      console.log(`♾️ Found ${posts.length - postsWithButtons.length} new posts without buttons, adding...`);
      
      posts.forEach(post => {
        if (!post.querySelector(`.${this.uniqueClass}`)) {
          const mediaToDownload = this.extractMediaFromPost(post);
          if (mediaToDownload.length > 0) {
            const buttonContainer = this.createDownloadButtonContainer(mediaToDownload);
            
            // Add button to the post's tools container (same location as image buttons)
            const toolsContainer = post.querySelector('.b-post__tools');
            if (toolsContainer) {
              toolsContainer.appendChild(buttonContainer);
              console.log('✅ Added buttons to new post from scroll in tools container');
            } else {
              // Fallback: append to post if tools container doesn't exist
              post.appendChild(buttonContainer);
              console.log('✅ Added buttons to new post from scroll (no tools container)');
            }
          }
        }
      });
    }
  }

  /**
   * Setup intersection observer for lazy-loaded content
   */
  setupIntersectionObserver() {
    console.log('👁️ Setting up Intersection Observer for lazy content...');
    
    const intersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const target = entry.target;
          
          // Check if this is a post that just became visible
          if (target.classList && target.classList.contains('b-post')) {
            console.log('👁️ Post became visible, ensuring buttons exist...');
            
            if (!target.querySelector(`.${this.uniqueClass}`)) {
              const mediaToDownload = this.extractMediaFromPost(target);
              if (mediaToDownload.length > 0) {
                const buttonContainer = this.createDownloadButtonContainer(mediaToDownload);
                
                // Add button to the post's tools container (same location as image buttons)
                const toolsContainer = target.querySelector('.b-post__tools');
                if (toolsContainer) {
                  toolsContainer.appendChild(buttonContainer);
                  console.log('✅ Added buttons to newly visible post in tools container');
                } else {
                  // Fallback: append to post if tools container doesn't exist
                  target.appendChild(buttonContainer);
                  console.log('✅ Added buttons to newly visible post (no tools container)');
                }
              }
            }
          }
        }
      });
    }, {
      rootMargin: '100px', // Start loading 100px before element becomes visible
      threshold: 0.1
    });
    
    // Observe all posts
    const posts = document.querySelectorAll('.b-post');
    posts.forEach(post => {
      intersectionObserver.observe(post);
    });
    
    // Store observer for cleanup
    this.intersectionObserver = intersectionObserver;
  }
}

// Initialize the downloader when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const downloader = new OnlyFansDownloader();
    window.onlyFansDownloaderInstance = downloader; // Store for network interception
    downloader.initialize();
    
    // Make debug methods available globally
    window.onlyFansDebug = () => downloader.debugVideoElements();
    window.forceVideoDetection = () => downloader.forceVideoDetection();
    window.refreshButtons = () => downloader.refreshDownloadButtons();
    window.analyzeOnlyFansStructure = () => downloader.analyzeOnlyFansStructure();
  });
} else {
  const downloader = new OnlyFansDownloader();
  downloader.initialize();
  
  // Make debug methods available globally
  window.onlyFansDebug = () => downloader.debugVideoElements();
  window.forceVideoDetection = () => downloader.forceVideoDetection();
  window.refreshButtons = () => downloader.refreshDownloadButtons();
  window.analyzeOnlyFansStructure = () => downloader.analyzeOnlyFansStructure();
}
