/**
 * Universal Media Downloader - Popup Script
 * Handles popup UI for both OnlyFans and Coomer/Kemono
 */

let currentSite = null;
let downloadInProgress = false;
let downloadCanceled = false;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await detectCurrentSite();
  await initializeSite();
  initializeQuickLinks();
});

// Initialize quick links dropdowns
function initializeQuickLinks() {
  const coomerLink = document.querySelector('.quick-link.coomer').parentElement;
  const kemonoLink = document.querySelector('.quick-link.kemono').parentElement;
  
  const coomerDropdown = coomerLink.querySelector('.domain-dropdown');
  const kemonoDropdown = kemonoLink.querySelector('.domain-dropdown');
  
  // Toggle dropdown on click
  coomerLink.querySelector('.quick-link').addEventListener('click', (e) => {
    e.preventDefault();
    coomerDropdown.style.display = coomerDropdown.style.display === 'none' ? 'block' : 'none';
    kemonoDropdown.style.display = 'none';
  });
  
  kemonoLink.querySelector('.quick-link').addEventListener('click', (e) => {
    e.preventDefault();
    kemonoDropdown.style.display = kemonoDropdown.style.display === 'none' ? 'block' : 'none';
    coomerDropdown.style.display = 'none';
  });
  
  // Close dropdowns when clicking outside
  document.addEventListener('click', (e) => {
    if (!coomerLink.contains(e.target) && !kemonoLink.contains(e.target)) {
      coomerDropdown.style.display = 'none';
      kemonoDropdown.style.display = 'none';
    }
  });
}

async function detectCurrentSite() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      // Use pattern-based detection instead of hardcoded domains
      const detectedSite = detectSite(tab.url);
      if (detectedSite === 'onlyfans') {
        currentSite = 'onlyfans';
      } else if (detectedSite === 'coomer' || detectedSite === 'kemono') {
        currentSite = 'coomer'; // Treat both as 'coomer' for UI purposes
      } else {
        currentSite = 'none';
      }
    } else {
      currentSite = 'none';
    }
  } catch (error) {
    console.error('Error detecting site:', error);
    currentSite = 'none';
  }
  
  updateSiteIndicator();
}

function updateSiteIndicator() {
  const indicator = document.getElementById('siteIndicator');
  const textSpan = document.getElementById('currentSite');
  if (indicator && textSpan) {
    if (currentSite === 'onlyfans') {
      textSpan.textContent = 'OnlyFans';
      indicator.classList.add('active');
      indicator.style.borderColor = '#00aff0';
      indicator.style.color = '#00aff0';
    } else if (currentSite === 'coomer') {
      textSpan.textContent = 'Coomer/Kemono';
      indicator.classList.add('active');
      indicator.style.borderColor = '#4a9eff';
      indicator.style.color = '#4a9eff';
    } else {
      textSpan.textContent = 'No supported site detected';
      indicator.classList.remove('active');
      indicator.style.borderColor = '#333';
      indicator.style.color = '#a0a0a0';
    }
  }
}

async function initializeSite() {
  const onlyfansSection = document.getElementById('onlyfansSection');
  const coomerSection = document.getElementById('coomerSection');
  
  if (currentSite === 'onlyfans') {
    if (onlyfansSection) onlyfansSection.style.display = 'block';
    if (coomerSection) coomerSection.style.display = 'none';
    await initializeOnlyFans();
  } else if (currentSite === 'coomer') {
    if (onlyfansSection) onlyfansSection.style.display = 'none';
    if (coomerSection) coomerSection.style.display = 'block';
    await initializeCoomer();
  } else {
    // Show both sections when no site detected
    if (onlyfansSection) onlyfansSection.style.display = 'block';
    if (coomerSection) coomerSection.style.display = 'block';
    await initializeOnlyFans();
    await initializeCoomer();
  }
}

// OnlyFans functionality
async function initializeOnlyFans() {
  const popupManager = new OnlyFansPopupManager();
  await popupManager.initialize();
}

class OnlyFansPopupManager {
  constructor() {
    this.settings = {
      quality: 'full',
      autoCreateFolder: true
    };
  }

  async initialize() {
    try {
      await this.loadSettings();
      this.setupEventListeners();
      this.updateUI();
    } catch (error) {
      console.error('Failed to initialize OnlyFans popup:', error);
    }
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get({
        quality: 'full',
        autoCreateFolder: true
      });
      this.settings = result;
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  setupEventListeners() {
    const qualityInputs = document.querySelectorAll('input[name="segmented"]');
    qualityInputs.forEach(input => {
      input.addEventListener('change', (e) => {
        this.handleQualityChange(e.target.value);
      });
    });
  }

  updateUI() {
    const qualityInput = document.getElementById(this.settings.quality);
    if (qualityInput) {
      qualityInput.checked = true;
      this.updateQualityUI(qualityInput);
    }
  }

  async handleQualityChange(quality) {
    try {
      this.settings.quality = quality;
      await this.saveSettings();
      this.updateQualityUI(document.getElementById(quality));
      this.showStatus('Quality preference saved. Page refresh needed to take effect.');
    } catch (error) {
      console.error('Error saving quality setting:', error);
      this.showStatus('Failed to save quality setting.', 'error');
    }
  }

  updateQualityUI(selectedInput) {
    const allLabels = document.querySelectorAll('.segmented label');
    allLabels.forEach(label => {
      label.classList.remove('checked');
    });

    if (selectedInput) {
      const label = document.querySelector(`label[for="${selectedInput.id}"]`);
      if (label) {
        label.classList.add('checked');
      }
    }
  }

  async saveSettings() {
    try {
      await chrome.storage.sync.set(this.settings);
    } catch (error) {
      console.error('Error saving settings:', error);
      throw error;
    }
  }

  showStatus(message, type = 'success') {
    const statusElement = document.getElementById('status');
    if (statusElement) {
      statusElement.textContent = message;
      statusElement.className = `status ${type}`;
      statusElement.style.display = 'block';
      
      setTimeout(() => {
        statusElement.textContent = '';
        statusElement.className = 'status';
        statusElement.style.display = 'none';
      }, 3000);
    }
  }
}

// Coomer functionality
async function initializeCoomer() {
  await loadCoomerSettings();
  setupCoomerEventListeners();
  await loadCoomerProgress();
}

async function loadCoomerSettings() {
  const settings = await chrome.storage.local.get([
    'downloadImages',
    'downloadVideos',
    'downloadCompressed',
    'downloadFolder',
    'separatePosts'
  ]);
  
  const imagesCheckbox = document.getElementById('downloadImages');
  const videosCheckbox = document.getElementById('downloadVideos');
  const compressedCheckbox = document.getElementById('downloadCompressed');
  const folderInput = document.getElementById('downloadFolder');
  const separatePostsCheckbox = document.getElementById('separatePosts');
  
  if (imagesCheckbox) imagesCheckbox.checked = settings.downloadImages !== false;
  if (videosCheckbox) videosCheckbox.checked = settings.downloadVideos !== false;
  if (compressedCheckbox) compressedCheckbox.checked = settings.downloadCompressed !== false;
  if (folderInput) folderInput.value = settings.downloadFolder || 'Downloads/CoomerDL';
  if (separatePostsCheckbox) separatePostsCheckbox.checked = settings.separatePosts !== false;
}

async function saveCoomerSettings() {
  await chrome.storage.local.set({
    downloadImages: document.getElementById('downloadImages')?.checked ?? true,
    downloadVideos: document.getElementById('downloadVideos')?.checked ?? true,
    downloadCompressed: document.getElementById('downloadCompressed')?.checked ?? true,
    downloadFolder: document.getElementById('downloadFolder')?.value || 'Downloads/CoomerDL',
    separatePosts: document.getElementById('separatePosts')?.checked ?? true
  });
}

function setupCoomerEventListeners() {
  ['downloadImages', 'downloadVideos', 'downloadCompressed', 'separatePosts'].forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener('change', saveCoomerSettings);
    }
  });
  
  const downloadBtn = document.getElementById('downloadBtn');
  const fetchUrlBtn = document.getElementById('fetchUrlBtn');
  const changeFolderBtn = document.getElementById('changeFolderBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  const customUrl = document.getElementById('customUrl');
  
  if (downloadBtn) downloadBtn.addEventListener('click', startCoomerDownload);
  if (fetchUrlBtn) fetchUrlBtn.addEventListener('click', fetchCurrentTabUrl);
  if (changeFolderBtn) changeFolderBtn.addEventListener('click', changeDownloadFolder);
  if (cancelBtn) cancelBtn.addEventListener('click', cancelCoomerDownload);
  if (customUrl) {
    customUrl.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        startCoomerDownload();
      }
    });
  }
  
  fetchCurrentTabUrl();
}

async function fetchCurrentTabUrl() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const customUrlInput = document.getElementById('customUrl');
    if (tab && tab.url && customUrlInput) {
      // Use pattern-based detection
      if (isCoomerOrKemono(tab.url)) {
        customUrlInput.value = tab.url;
        showCoomerStatus('URL fetched from current tab', 'success');
      } else {
        showCoomerStatus('Current tab is not a Coomer/Kemono page', 'info');
      }
    }
  } catch (error) {
    console.error('Error fetching tab URL:', error);
  }
}

function showCoomerStatus(message, type = 'info') {
  const statusDiv = document.getElementById('status');
  if (statusDiv) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = 'block';
    
    if (type === 'success') {
      setTimeout(() => {
        statusDiv.style.display = 'none';
      }, 5000);
    }
  }
}

async function updateCoomerProgress(current, total) {
  const progressFill = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');
  const progressContainer = document.getElementById('progressContainer');
  
  if (total > 0 && progressFill && progressText && progressContainer) {
    const percentage = (current / total) * 100;
    progressFill.style.width = `${percentage}%`;
    progressText.textContent = `${current} / ${total} files`;
    progressContainer.style.display = 'block';
    
    await chrome.storage.local.set({
      downloadProgress: { current, total }
    });
  }
}

async function loadCoomerProgress() {
  const data = await chrome.storage.local.get(['downloadProgress']);
  if (data.downloadProgress && data.downloadProgress.total > 0) {
    const { current, total } = data.downloadProgress;
    updateCoomerProgress(current, total);
  }
}

function clearCoomerProgress() {
  chrome.storage.local.remove(['downloadProgress']);
  const progressContainer = document.getElementById('progressContainer');
  const progressFill = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');
  
  if (progressContainer) progressContainer.style.display = 'none';
  if (progressFill) progressFill.style.width = '0%';
  if (progressText) progressText.textContent = '0 / 0 files';
}

async function changeDownloadFolder() {
  const folderInput = document.getElementById('downloadFolder');
  if (!folderInput) return;
  
  const currentFolder = folderInput.value;
  const newFolder = prompt('Enter download folder name:', currentFolder);
  
  if (newFolder) {
    folderInput.value = newFolder;
    await saveCoomerSettings();
  }
}

async function startCoomerDownload() {
  if (downloadInProgress) {
    showCoomerStatus('Download already in progress', 'error');
    return;
  }
  
  const customUrlInput = document.getElementById('customUrl');
  if (!customUrlInput) return;
  
  const url = customUrlInput.value.trim();
  
  if (!url) {
    showCoomerStatus('Please enter a URL', 'error');
    return;
  }
  
  // Use pattern-based detection instead of hardcoded domain check
  if (!isCoomerOrKemono(url)) {
    showCoomerStatus('Only Coomer/Kemono URLs are supported', 'error');
    return;
  }
  
  downloadInProgress = true;
  downloadCanceled = false;
  
  showCoomerStatus('Starting download...', 'info');
  await updateCoomerProgress(0, 0);
  
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'download',
      url: url,
      type: url.includes('/post/') ? 'page' : 'profile',
      settings: {
        downloadImages: document.getElementById('downloadImages')?.checked ?? true,
        downloadVideos: document.getElementById('downloadVideos')?.checked ?? true,
        downloadCompressed: document.getElementById('downloadCompressed')?.checked ?? true,
        downloadFolder: document.getElementById('downloadFolder')?.value || 'Downloads/CoomerDL',
        separatePosts: document.getElementById('separatePosts')?.checked ?? true
      }
    });
    
    if (response && response.success) {
      showCoomerStatus(`${response.message}`, 'success');
      await updateCoomerProgress(response.totalFiles || 0, response.totalFiles || 0);
      
      setTimeout(() => {
        clearCoomerProgress();
      }, 3000);
    } else {
      showCoomerStatus(`Error: ${response ? response.message : 'Unknown error'}`, 'error');
      clearCoomerProgress();
    }
  } catch (error) {
    showCoomerStatus(`Error: ${error.message}`, 'error');
    console.error('Download error:', error);
    clearCoomerProgress();
  } finally {
    setTimeout(() => {
      downloadInProgress = false;
    }, 2000);
  }
}

function cancelCoomerDownload() {
  downloadCanceled = true;
  chrome.runtime.sendMessage({ action: 'cancel' });
  showCoomerStatus('Download cancelled', 'info');
  downloadInProgress = false;
  clearCoomerProgress();
}

// Listen for progress updates
chrome.runtime.onMessage.addListener(async (message) => {
  if (message.action === 'progress') {
    await updateCoomerProgress(message.current, message.total);
  }
  
  if (message.action === 'downloadComplete') {
    clearCoomerProgress();
    showCoomerStatus('Download completed', 'success');
  }
  
  if (message.action === 'downloadError') {
    clearCoomerProgress();
    showCoomerStatus(`Download error: ${message.message}`, 'error');
  }
});
