/**
 * Universal Media Downloader - Background Script
 * Handles API interception and download management for OnlyFans, Coomer, and Kemono
 */

// Import site detection utility
importScripts('site_detection.js');

class OnlyFansBackgroundService {
  constructor() {
    this.apiDataCache = new Map();
    this.downloadQueue = [];
    this.isProcessingQueue = false;
  }

  /**
   * Initialize the background service
   */
  initialize() {
    this.setupWebRequestListener();
    this.setupMessageListener();
    console.log('OnlyFans Background Service initialized');
  }

  /**
   * Setup web request listener to intercept API calls
   */
  setupWebRequestListener() {
    chrome.webRequest.onSendHeaders.addListener(
      (details) => {
        this.handleApiRequest(details);
      },
      {
        urls: [
          "*://*.onlyfans.com/api2/v2/users/*",
          "*://*.onlyfans.com/api2/v2/posts/*", 
          "*://*.onlyfans.com/api2/v2/chats/*",
          "*://*.onlyfans.com/*/"
        ]
      },
      ["requestHeaders"]
    );
  }

  /**
   * Handle API requests and extract relevant data
   */
  handleApiRequest(details) {
    try {
      // Skip if not a valid request
      if (details.tabId < 0 || details.url.includes('#trilobite')) {
        return;
      }

      // Check if this is a relevant API endpoint
      const isRelevantEndpoint = details.url.match(
        /(onlyfans\.com\/api2\/v2\/(users|posts|chats)|onlyfans\.com\/[0-9]+\/)/
      );
      
      if (!isRelevantEndpoint) {
        return;
      }

      // Extract headers (excluding security headers)
      const headers = this.extractHeaders(details.requestHeaders);
      
      // Send data to content script
      this.sendToContentScript(details.url, headers, details.tabId);
      
    } catch (error) {
      console.error('Error handling API request:', error);
    }
  }

  /**
   * Extract relevant headers from request
   */
  extractHeaders(requestHeaders) {
    const excludedHeaders = new Set([
      'Sec-Fetch-Site',
      'Sec-Fetch-Mode', 
      'Sec-Fetch-Dest',
      'Sec-Fetch-User',
      'DNT',
      'User-Agent'
    ]);

    const headers = {};
    
    for (const header of requestHeaders) {
      if (!excludedHeaders.has(header.name)) {
        headers[header.name] = header.value;
      }
    }
    
    return headers;
  }

  /**
   * Send API data to content script
   */
  async sendToContentScript(url, headers, tabId) {
    try {
      // Fetch the API data
      const response = await this.fetchApiData(url, headers);
      
      if (!response) return;
      
      // Parse and process the data
      const data = this.processApiResponse(response);
      
      if (!data) return;
      
      // Send to content script
      const message = {
        type: 'apiData',
        data: data,
        isForDm: url.includes('messages'),
        headers: headers
      };
      
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Failed to send message to content script:', chrome.runtime.lastError);
        }
      });
      
    } catch (error) {
      console.error('Error sending data to content script:', error);
    }
  }

  /**
   * Fetch API data from OnlyFans
   */
  async fetchApiData(url, headers) {
    try {
      const response = await fetch(url + '#trilobite', {
        method: 'GET',
        headers: headers
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
      
    } catch (error) {
      console.error('Error fetching API data:', error);
      return null;
    }
  }

  /**
   * Process API response data
   */
  processApiResponse(data) {
    try {
      // Handle different response formats
      if (Array.isArray(data)) {
        return data;
      } else if (data.list) {
        return data.list;
      } else if (data.id && Array.isArray(data.media)) {
        return data;
      }
      
      return null;
    } catch (error) {
      console.error('Error processing API response:', error);
      return null;
    }
  }

  /**
   * Setup message listener for download requests
   */
  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      try {
        // Handle OnlyFans download requests (array format)
        if (Array.isArray(message) && message.length >= 3) {
          this.handleDownloadRequest(message);
          sendResponse({ success: true });
          return true;
        }
        
        // Handle Coomer download requests (object format with action)
        if (message && typeof message === 'object' && message.action) {
          this.handleCoomerMessage(message, sender, sendResponse);
          return true; // Keep channel open for async response
        }
        
        sendResponse({ success: false, error: 'Invalid message format' });
      } catch (error) {
        console.error('Error handling message:', error);
        sendResponse({ success: false, error: error.message });
      }
      return true;
    });
  }
  
  /**
   * Handle Coomer-specific messages
   */
  async handleCoomerMessage(message, sender, sendResponse) {
    try {
      if (message.action === 'download') {
        const result = await handleCoomerDownload(message);
        sendResponse(result);
      } else if (message.action === 'downloadSingle') {
        const result = await handleCoomerSingleDownload(message, sender);
        sendResponse(result);
      } else if (message.action === 'cancel') {
        coomerDownloadCanceled = true;
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('[COOMER] Error handling message:', error);
      sendResponse({ success: false, message: error.message });
    }
  }

  /**
   * Handle download request from content script
   */
  async handleDownloadRequest([url, creator, type]) {
    try {
      if (!url) {
        throw new Error('No URL provided');
      }

      // Get user settings
      const settings = await this.getUserSettings();
      
      // Generate filename
      const filename = this.generateFilename(url, creator, type, settings);
      
      // Add to download queue
      this.downloadQueue.push({
        url: url,
        filename: filename,
        creator: creator,
        type: type
      });
      
      // Process queue if not already processing
      if (!this.isProcessingQueue) {
        this.processDownloadQueue();
      }
      
    } catch (error) {
      console.error('Error handling download request:', error);
    }
  }

  /**
   * Get user settings from storage
   */
  async getUserSettings() {
    try {
      const result = await chrome.storage.sync.get({
        quality: 'full',
        autoCreateFolder: true
      });
      return result;
    } catch (error) {
      console.error('Error loading user settings:', error);
      return { quality: 'full', autoCreateFolder: true };
    }
  }

  /**
   * Generate filename for download
   */
  generateFilename(url, creator, type, settings) {
    try {
      // Extract file extension from URL
      const urlParts = url.split('?')[0].split('/');
      const filename = urlParts[urlParts.length - 1];
      
      // Clean creator name
      const cleanCreator = creator.replace(/[^a-zA-Z0-9]/g, '_');
      
      // Create folder structure if enabled
      if (settings.autoCreateFolder) {
        return `${cleanCreator}/${filename}`;
      } else {
        return filename;
      }
      
    } catch (error) {
      console.error('Error generating filename:', error);
      return `download_${Date.now()}.file`;
    }
  }

  /**
   * Process download queue
   */
  async processDownloadQueue() {
    if (this.isProcessingQueue || this.downloadQueue.length === 0) {
      return;
    }
    
    this.isProcessingQueue = true;
    
    try {
      while (this.downloadQueue.length > 0) {
        const download = this.downloadQueue.shift();
        await this.executeDownload(download);
        
        // Add small delay between downloads to prevent overwhelming
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error('Error processing download queue:', error);
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Execute individual download
   */
  async executeDownload(download) {
    try {
      const { url, filename, creator, type } = download;
      
      console.log(`Starting download: ${filename}`);
      
      const downloadId = await chrome.downloads.download({
        url: url,
        filename: filename,
        conflictAction: 'uniquify',
        saveAs: false
      });
      
      if (downloadId) {
        console.log(`Download started successfully: ${filename}`);
      } else {
        throw new Error('Download failed to start');
      }
      
    } catch (error) {
      console.error(`Download failed for ${download.filename}:`, error);
      
      // Show notification to user
      this.showNotification('Download Failed', `Failed to download ${download.filename}`);
    }
  }

  /**
   * Show notification to user
   */
  showNotification(title, message) {
    try {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: '/assets/icon48.png',
        title: title,
        message: message
      });
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.apiDataCache.clear();
    this.downloadQueue = [];
    this.isProcessingQueue = false;
  }
}

// Initialize the background service
const backgroundService = new OnlyFansBackgroundService();
backgroundService.initialize();

// Coomer download cancellation flag
let coomerDownloadCanceled = false;

// Coomer download handlers (from browser_extension_coomer/background.js)
async function handleCoomerDownload(message) {
  const { url, type, settings } = message;
  
  try {
    if (isCoomerOrKemono(url)) {
      return await downloadCoomer(url, type, settings);
    } else {
      return { success: false, message: 'Only Coomer/Kemono URLs are supported' };
    }
  } catch (error) {
    return { success: false, message: error.message };
  }
}

async function handleCoomerSingleDownload(message, sender) {
  try {
    const { url: fileUrl } = message;
    
    // Get settings from storage
    const settings = {
      downloadFolder: 'Downloads/CoomerDL',
      downloadImages: true,
      downloadVideos: true,
      downloadCompressed: true,
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
      console.error('[COOMER] Error loading settings:', e);
    }
    
    // Get the current tab URL to extract username and post name
    let tab = null;
    if (sender && sender.tab) {
      tab = sender.tab;
    } else {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs.length > 0) {
        tab = tabs[0];
      }
    }
    
    if (!tab || !tab.url || !isCoomerOrKemono(tab.url)) {
      await downloadCoomerFile(fileUrl, settings.downloadFolder);
      return { success: true, message: 'Download started' };
    }
    
    const pageUrl = tab.url;
    
    // Extract username and post name from page URL
    let username = null;
    let postName = null;
    
    const userMatch = pageUrl.match(/\/([^\/]+)\/user\/([^\/\?]+)/);
    if (userMatch) {
      const userIdOrName = userMatch[2];
      if (/^\d+$/.test(userIdOrName)) {
        try {
          const pageData = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              const userLink = document.querySelector('.post__user-name') ||
                              document.querySelector('.user-header__profile span[itemprop="name"]') ||
                              document.querySelector('a[href*="/user/"]');
              if (userLink) {
                const linkText = userLink.textContent.trim();
                if (linkText && !/^\d+$/.test(linkText) && linkText.length < 100) {
                  return linkText;
                }
              }
              return null;
            }
          });
          
          if (pageData && pageData[0] && pageData[0].result) {
            username = pageData[0].result;
          }
        } catch (e) {
          console.error('[COOMER] Error extracting username:', e);
        }
      } else {
        username = userIdOrName;
      }
    }
    
    // Extract post name from page
    if (pageUrl.includes('/post/')) {
      try {
        const pageData = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            const titleElement = document.querySelector('.post__title, h1.post__title');
            if (titleElement) {
              return titleElement.textContent.trim().replace(/\s*\([^)]+\)\s*$/, '');
            }
            return null;
          }
        });
        
        if (pageData && pageData[0] && pageData[0].result) {
          postName = pageData[0].result;
        }
      } catch (e) {
        console.error('[COOMER] Error extracting post name:', e);
      }
    }
    
    // Build folder structure
    let downloadFolder = settings.downloadFolder || 'Downloads/CoomerDL';
    
    if (username) {
      const sanitizedUsername = username.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim();
      downloadFolder = `${downloadFolder}/${sanitizedUsername}`;
    }
    
    if (postName && settings.separatePosts !== false) {
      let sanitizedPostName = postName
        .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
        .replace(/\.+$/, '')
        .trim()
        .substring(0, 50);
      
      sanitizedPostName = sanitizedPostName.replace(/\s+/g, '_');
      sanitizedPostName = sanitizedPostName.replace(/_+/g, '_');
      sanitizedPostName = sanitizedPostName.replace(/^_+|_+$/g, '');
      
      if (sanitizedPostName.length === 0) {
        sanitizedPostName = 'untitled_post';
      }
      
      downloadFolder = `${downloadFolder}/${sanitizedPostName}`;
    }
    
    console.log(`[COOMER] Single download to: ${downloadFolder}`);
    
    await downloadCoomerFile(fileUrl, downloadFolder);
    return { success: true, message: 'Download started' };
  } catch (error) {
    console.error('[COOMER] Single download error:', error);
    return { success: false, message: error.message };
  }
}

// Coomer helper functions
async function downloadCoomer(url, type, settings) {
  try {
    const siteMatch = url.match(/https?:\/\/([^\/]+)/);
    if (!siteMatch) {
      return { success: false, message: 'Invalid URL' };
    }
    const site = siteMatch[1];
    
    let username = null;
    const userMatch = url.match(/\/([^\/]+)\/user\/([^\/\?]+)/);
    if (userMatch) {
      const userIdOrName = userMatch[2];
      if (/^\d+$/.test(userIdOrName)) {
        username = null;
      } else {
        username = userIdOrName;
      }
    }
    
    const isPostPage = url.includes('/post/');
    
    if (isPostPage) {
      const postMatch = url.match(/\/([^\/]+)\/user\/([^\/]+)\/post\/([^\/\?]+)/);
      if (!postMatch) {
        return { success: false, message: `Invalid post URL format: ${url}` };
      }
      
      const service = postMatch[1];
      const userIdOrName = postMatch[2];
      const postId = postMatch[3];
      
      if (/^\d+$/.test(userIdOrName)) {
        let tab = null;
        try {
          const tabs = await chrome.tabs.query({});
          tab = tabs.find(t => {
            if (!t.url) return false;
            const tabUrl = t.url.split('?')[0].split('#')[0];
            const targetUrl = url.split('?')[0].split('#')[0];
            return tabUrl === targetUrl || tabUrl.includes(targetUrl) || targetUrl.includes(tabUrl);
          });
        } catch (e) {
          console.error('[COOMER] Error finding tab:', e);
        }
        
        if (tab && tab.id) {
          try {
            const pageData = await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: () => {
                const result = { username: null };
                const userLink = document.querySelector('.post__user-name') || 
                                document.querySelector('.post__user a') || 
                                document.querySelector('a[href*="/user/"]');
                if (userLink) {
                  const linkText = userLink.textContent.trim();
                  if (linkText && !/^\d+$/.test(linkText) && linkText.length < 50) {
                    result.username = linkText;
                  }
                }
                return result;
              }
            });
            
            if (pageData && pageData[0] && pageData[0].result && pageData[0].result.username) {
              username = pageData[0].result.username;
            }
          } catch (e) {
            console.error('[COOMER] Error extracting username:', e);
          }
        }
      } else {
        username = userIdOrName;
      }
      
      const apiUrl = `https://${site}/api/v1/${service}/user/${encodeURIComponent(userIdOrName)}/post/${postId}`;
      
      let response;
      try {
        const headers = {
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': `https://${site}/`,
          'Origin': `https://${site}`,
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-origin'
        };
        
        response = await fetch(apiUrl, {
          method: 'GET',
          credentials: 'include',
          headers: headers
        });
      } catch (fetchError) {
        return { success: false, message: `Network error: ${fetchError.message}` };
      }
      
      if (!response.ok) {
        return await scrapeCoomerPostFromDOM(url, settings, username);
      }
      
      let postData;
      try {
        postData = await response.json();
      } catch (jsonError) {
        return { success: false, message: `Failed to parse API response: ${jsonError.message}` };
      }
      
      const post = postData.post || postData;
      const mediaUrls = [];
      
      const file = post.file || {};
      const filePath = file.path || file.url || file.name;
      if (filePath) {
        const path = filePath.startsWith('/') ? filePath : `/${filePath}`;
        mediaUrls.push(`https://${site}${path}`);
      }
      
      const attachments = post.attachments || [];
      for (const att of attachments) {
        const attPath = att.path || att.url || att.name;
        if (attPath) {
          const path = attPath.startsWith('/') ? attPath : `/${attPath}`;
          mediaUrls.push(`https://${site}${path}`);
        }
      }
      
      if (!username && post.user) {
        if (post.user.name) {
          username = post.user.name;
        } else if (post.user.service && post.user.id) {
          username = post.user.id;
        }
      }
      
      let postName = null;
      if (post.title) {
        postName = post.title;
      } else if (post.id) {
        postName = `post_${post.id}`;
      }
      
      if (mediaUrls.length === 0) {
        return await scrapeCoomerPostFromDOM(url, settings, username, postName);
      }
      
      preloadImages(mediaUrls).catch(err => {
        console.log(`[COOMER] Pre-loading failed (non-critical):`, err);
      });
      
      return await downloadCoomerFiles(mediaUrls, settings, username, postName);
    } else {
      // Profile download - fetch all posts
      const match = url.match(/\/([^\/]+)\/user\/([^\/\?]+)/);
      if (!match) {
        return { success: false, message: 'Invalid Coomer URL' };
      }
      
      const service = match[1];
      const userId = match[2];
      
      const allPosts = [];
      let offset = 0;
      const limit = 50;
      
      while (true) {
        if (coomerDownloadCanceled) break;
        
        const apiUrl = `https://${site}/api/v1/${service}/user/${encodeURIComponent(userId)}/posts?o=${offset}`;
        
        const headers = {
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': `https://${site}/`,
          'Origin': `https://${site}`,
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-origin'
        };
        
        const response = await fetch(apiUrl, {
          method: 'GET',
          credentials: 'include',
          headers: headers
        });
        
        if (!response.ok) {
          if (response.status === 400 && offset > 0) {
            break;
          }
          if (response.status === 403) {
            return { success: false, message: `API blocked (403). Please ensure you're logged in or try again later.` };
          }
          return { success: false, message: `API error: ${response.status}` };
        }
        
        const postsData = await response.json();
        let posts = postsData;
        if (typeof postsData === 'object' && postsData !== null && 'data' in postsData) {
          posts = postsData.data;
        }
        
        if (!posts || posts.length === 0) {
          break;
        }
        
        allPosts.push(...posts);
        offset += limit;
        if (offset >= 1000) break;
      }
      
      if (allPosts.length === 0) {
        return { success: false, message: 'No posts found for this user' };
      }
      
      if (!username || /^\d+$/.test(username)) {
        if (allPosts[0] && allPosts[0].user) {
          if (allPosts[0].user.name) {
            username = allPosts[0].user.name;
          }
        }
      }
      
      let totalFilesCount = 0;
      const postMediaMap = new Map();
      
      for (const post of allPosts) {
        const mediaUrls = [];
        
        const file = post.file || {};
        const filePath = file.path || file.url || file.name;
        if (filePath) {
          const path = filePath.startsWith('/') ? filePath : `/${filePath}`;
          mediaUrls.push(`https://${site}${path}`);
        }
        
        const attachments = post.attachments || [];
        for (const att of attachments) {
          const attPath = att.path || att.url || att.name;
          if (attPath) {
            const path = attPath.startsWith('/') ? attPath : `/${attPath}`;
            mediaUrls.push(`https://${site}${path}`);
          }
        }
        
        const filteredUrls = [];
        for (const mediaUrl of mediaUrls) {
          const urlWithoutParams = mediaUrl.split('?')[0];
          const ext = urlWithoutParams.split('.').pop().toLowerCase();
          const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
          const isVideo = ['mp4', 'webm', 'mov', 'mkv', 'm4v', 'avi', 'flv', 'wmv'].includes(ext);
          const isCompressed = ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext);
          
          if ((isImage && settings.downloadImages) ||
              (isVideo && settings.downloadVideos) ||
              (isCompressed && settings.downloadCompressed)) {
            filteredUrls.push(mediaUrl);
          }
        }
        
        if (filteredUrls.length > 0) {
          postMediaMap.set(post, filteredUrls);
          totalFilesCount += filteredUrls.length;
        }
      }
      
      let totalDownloaded = 0;
      let totalFailed = 0;
      let currentFileIndex = 0;
      
      for (const [post, mediaUrls] of postMediaMap.entries()) {
        if (coomerDownloadCanceled) break;
        
        const postId = post.id || 'unknown';
        const postTitle = post.title || '';
        const postName = postTitle || `post_${postId}`;
        
        try {
          const result = await downloadCoomerFiles(mediaUrls, settings, username, postName);
          if (result.success) {
            totalDownloaded += result.completed || mediaUrls.length;
            currentFileIndex += result.completed || mediaUrls.length;
            
            try {
              chrome.runtime.sendMessage({
                action: 'progress',
                current: currentFileIndex,
                total: totalFilesCount
              }).catch(() => {});
              chrome.storage.local.set({
                downloadProgress: { current: currentFileIndex, total: totalFilesCount }
              });
            } catch (e) {}
          } else {
            totalFailed++;
          }
          
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (error) {
          console.error(`[COOMER] Error processing post ${postId}:`, error);
          totalFailed++;
        }
      }
      
      const message = totalFailed > 0
        ? `Downloaded ${totalDownloaded} files from ${postMediaMap.size} posts (${totalFailed} posts failed)`
        : `Downloaded ${totalDownloaded} files from ${postMediaMap.size} posts`;
      
      return { success: totalDownloaded > 0, message: message, totalFiles: totalDownloaded };
    }
  } catch (error) {
    console.error('[COOMER] Error:', error);
    return { success: false, message: error.message };
  }
}

async function downloadCoomerFiles(mediaUrls, settings, username = null, postName = null) {
  let downloadFolder = settings.downloadFolder || 'Downloads/CoomerDL';
  
  if (username) {
    const sanitizedUsername = username.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim();
    downloadFolder = `${downloadFolder}/${sanitizedUsername}`;
  }
  
  if (postName && settings.separatePosts !== false) {
    let sanitizedPostName = postName
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
      .replace(/\.+$/, '')
      .trim()
      .substring(0, 50);
    
    sanitizedPostName = sanitizedPostName.replace(/\s+/g, '_');
    sanitizedPostName = sanitizedPostName.replace(/_+/g, '_');
    sanitizedPostName = sanitizedPostName.replace(/^_+|_+$/g, '');
    
    if (sanitizedPostName.length === 0) {
      sanitizedPostName = 'untitled_post';
    }
    
    downloadFolder = `${downloadFolder}/${sanitizedPostName}`;
  }
  
  const urlsToDownload = [];
  for (const mediaUrl of mediaUrls) {
    const urlWithoutParams = mediaUrl.split('?')[0];
    const ext = urlWithoutParams.split('.').pop().toLowerCase();
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
    const isVideo = ['mp4', 'webm', 'mov', 'mkv', 'm4v', 'avi', 'flv', 'wmv'].includes(ext);
    const isCompressed = ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext);
    
    if ((isImage && settings.downloadImages) || 
        (isVideo && settings.downloadVideos) || 
        (isCompressed && settings.downloadCompressed)) {
      urlsToDownload.push(mediaUrl);
    }
  }
  
  const totalFiles = urlsToDownload.length;
  if (totalFiles === 0) {
    return { success: false, message: 'No files to download based on settings', totalFiles: 0 };
  }
  
  let completed = 0;
  let failed = 0;
  
  for (let i = 0; i < urlsToDownload.length; i++) {
    if (coomerDownloadCanceled) {
      break;
    }
    
    const mediaUrl = urlsToDownload[i];
    
    try {
      await downloadCoomerFile(mediaUrl, downloadFolder);
      completed++;
      
      try {
        chrome.runtime.sendMessage({ 
          action: 'progress', 
          current: completed, 
          total: totalFiles 
        }).catch(() => {});
      } catch (e) {}
      
      try {
        chrome.storage.local.set({
          downloadProgress: { current: completed, total: totalFiles }
        });
      } catch (e) {}
      
      if (i < urlsToDownload.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      failed++;
      console.error(`[COOMER] Failed to download ${mediaUrl}:`, error);
    }
  }
  
  const message = failed > 0 
    ? `Downloaded ${completed} files (${failed} failed)`
    : `Downloaded ${completed} files`;
  
  try {
    chrome.storage.local.remove(['downloadProgress']);
  } catch (e) {}
  
  return { success: completed > 0, message: message, totalFiles: totalFiles, completed: completed };
}

async function scrapeCoomerPostFromDOM(url, settings, username = null, postName = null) {
  try {
    const urlBase = url.split('?')[0].split('#')[0];
    const tabs = await chrome.tabs.query({});
    const tab = tabs.find(t => t.url && (t.url.includes(urlBase) || urlBase.includes(t.url.split('?')[0])));
    
    if (!tab) {
      return { success: false, message: 'Please open the Coomer page in a tab first, then try again' };
    }
    
    let mediaUrls = [];
    
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const mediaUrls = [];
        document.querySelectorAll('.post__files a.fileThumb, .post__files a[href*="/data/"], .post__files a.image-link').forEach(link => {
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
                              isCoomerKemonoCdn(fullUrl);
            const isExcluded = fullUrl.includes('.html') || 
                             fullUrl.includes('.htm') ||
                             fullUrl.includes('/api/') || 
                             fullUrl.includes('/post/') ||
                             fullUrl.includes('/user/') ||
                             fullUrl.includes('/artists/') ||
                             fullUrl.includes('/account/') ||
                             !endsWithExt ||
                             !isDataPath;
            
            if (!isExcluded && endsWithExt && isDataPath) {
              const pathParts = urlPath.split('/');
              const lastPart = pathParts[pathParts.length - 1];
              if (lastPart && /\.(jpg|jpeg|png|gif|webp|mp4|webm|mov|mkv|m4v|avi|flv|wmv|zip|rar|7z)$/i.test(lastPart)) {
                if (!mediaUrls.includes(fullUrl)) {
                  mediaUrls.push(fullUrl);
                }
              }
            }
          }
        });
        
        document.querySelectorAll('.post__files video, .post__video, video.js-fluid-player').forEach(video => {
          let src = video.src || video.getAttribute('src');
          if (src) {
            if (!src.startsWith('http')) {
              if (src.startsWith('//')) {
                src = 'https:' + src;
              } else if (src.startsWith('/')) {
                src = window.location.origin + src;
              }
            }
            
            const urlPath = src.split('?')[0].split('#')[0];
            const endsWithExt = /\.(jpg|jpeg|png|gif|webp|mp4|webm|mov|mkv|m4v|avi|flv|wmv|zip|rar|7z)$/i.test(urlPath);
            // More flexible CDN detection - works with any TLD
            const isDataPath = src.includes('/data/') || 
                              /^https?:\/\/[n0-9]+\.(coomer|kemono)\./.test(src) ||
                              isCoomerKemonoCdn(src);
            const isExcluded = src.includes('.html') || 
                             src.includes('.htm') ||
                             src.includes('/api/') || 
                             src.includes('/post/') ||
                             src.includes('/user/') ||
                             !endsWithExt ||
                             !isDataPath;
            
            if (!isExcluded && endsWithExt && isDataPath) {
              const pathParts = urlPath.split('/');
              const lastPart = pathParts[pathParts.length - 1];
              if (lastPart && /\.(jpg|jpeg|png|gif|webp|mp4|webm|mov|mkv|m4v|avi|flv|wmv|zip|rar|7z)$/i.test(lastPart)) {
                if (!mediaUrls.includes(src)) {
                  mediaUrls.push(src);
                }
              }
            }
          }
        });
        
        return mediaUrls;
      }
    });
    
    if (results && results[0] && results[0].result) {
      mediaUrls = results[0].result;
    }
    
    const pageData = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const result = { username: null, postName: null };
        const userLink = document.querySelector('.post__user-name') || 
                        document.querySelector('.post__user a') || 
                        document.querySelector('a[href*="/user/"]');
        
        if (userLink) {
          const linkText = userLink.textContent.trim();
          if (linkText && !/^\d+$/.test(linkText) && linkText.length > 0 && linkText.length < 100) {
            result.username = linkText;
          }
        }
        
        const titleElement = document.querySelector('.post__title, h1.post__title');
        if (titleElement) {
          result.postName = titleElement.textContent.trim().replace(/\s*\([^)]+\)\s*$/, '');
        } else {
          const urlMatch = window.location.pathname.match(/\/post\/([^\/\?]+)/);
          if (urlMatch) {
            result.postName = `post_${urlMatch[1]}`;
          }
        }
        
        return result;
      }
    });
    
    if (pageData && pageData[0] && pageData[0].result) {
      const { username: extractedUsername, postName: extractedPostName } = pageData[0].result;
      if (!username || /^\d+$/.test(username)) {
        if (extractedUsername) {
          username = extractedUsername;
        }
      }
      if (!postName && extractedPostName) {
        postName = extractedPostName;
      }
    }
    
    if (mediaUrls.length > 0) {
      return await downloadCoomerFiles(mediaUrls, settings, username, postName);
    }
    
    return { success: false, message: 'No media found in page. Make sure the page is fully loaded.' };
  } catch (error) {
    console.error('[COOMER] DOM scraping error:', error);
    return { success: false, message: `DOM scraping failed: ${error.message}` };
  }
}

async function preloadImages(urls) {
  const preloadPromises = urls.slice(0, 10).map(url => {
    return fetch(url, {
      method: 'HEAD',
      credentials: 'include',
      headers: {
        'Referer': new URL(url).origin
      }
    }).catch(() => {});
  });
  
  await Promise.all(preloadPromises);
}

async function downloadCoomerFile(url, folder) {
  return new Promise((resolve, reject) => {
    try {
      const urlPath = url.split('?')[0].split('#')[0];
      const hasValidExtension = /\.(jpg|jpeg|png|gif|webp|mp4|webm|mov|mkv|m4v|avi|flv|wmv|zip|rar|7z)$/i.test(urlPath);
      // More flexible CDN detection - works with any TLD
      const isDataPath = url.includes('/data/') || 
                        /^https?:\/\/[n0-9]+\.(coomer|kemono)\./.test(url) ||
                        isCoomerKemonoCdn(url);
      const isExcluded = url.includes('.html') || 
                        url.includes('.htm') ||
                        url.includes('/api/') || 
                        url.includes('/post/') || 
                        url.includes('/user/') ||
                        url.includes('/artists/');
      
      const pathParts = urlPath.split('/');
      const lastPart = pathParts[pathParts.length - 1];
      const lastPartHasExt = lastPart && /\.(jpg|jpeg|png|gif|webp|mp4|webm|mov|mkv|m4v|avi|flv|wmv|zip|rar|7z)$/i.test(lastPart);
      
      if (!hasValidExtension || !isDataPath || isExcluded || !lastPartHasExt) {
        reject(new Error('Invalid URL - not a media file'));
        return;
      }
      
      const urlObj = new URL(url);
      let filename = urlObj.pathname.split('/').pop();
      filename = filename.split('?')[0];
      
      if (!filename || filename.length === 0) {
        const fParam = urlObj.searchParams.get('f');
        if (fParam) {
          filename = fParam;
        } else {
          const extMatch = url.match(/\.([a-z0-9]+)(?:\?|$)/i);
          if (extMatch && ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm', 'mov', 'mkv', 'zip', 'rar', '7z'].includes(extMatch[1].toLowerCase())) {
            const ext = extMatch[1];
            filename = `file_${Date.now()}.${ext}`;
          } else {
            reject(new Error('Invalid file type - no valid extension'));
            return;
          }
        }
      }
      
      const validExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm', 'mov', 'mkv', 'm4v', 'avi', 'flv', 'wmv', 'zip', 'rar', '7z'];
      const fileExt = filename.split('.').pop().toLowerCase();
      if (!validExtensions.includes(fileExt)) {
        reject(new Error(`Invalid file extension: ${fileExt}`));
        return;
      }
      
      filename = filename
        .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
        .replace(/\.+$/, '')
        .replace(/^\.+/, '')
        .trim();
      
      if (filename.length > 200) {
        const ext = filename.split('.').pop();
        const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.'));
        filename = `${nameWithoutExt.substring(0, 200 - ext.length - 1)}.${ext}`;
      }
      
      let cleanFolder = folder
        .replace(/^\/+/, '')
        .replace(/\/+$/, '')
        .replace(/\\/g, '/')
        .replace(/\/+/g, '/');
      
      cleanFolder = cleanFolder.replace(/[<>:"|?*\x00-\x1f]+$/g, '');
      
      const downloadPath = `${cleanFolder}/${filename}`;
      
      chrome.downloads.download({
        url: url,
        filename: downloadPath,
        saveAs: false,
        conflictAction: 'uniquify'
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          reject(new Error(`${chrome.runtime.lastError.message} (path: ${downloadPath})`));
        } else {
          resolve(downloadId);
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

// Handle extension lifecycle
chrome.runtime.onInstalled.addListener(() => {
  console.log('Universal Media Downloader installed');
});

chrome.runtime.onSuspend.addListener(() => {
  backgroundService.cleanup();
}); 