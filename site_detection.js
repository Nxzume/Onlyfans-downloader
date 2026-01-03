/**
 * Site Detection Utility
 * Pattern-based detection for Coomer, Kemono, and OnlyFans sites
 * Works even if domains change, as long as URL structure remains the same
 */

// Site configuration - easily updateable domain lists
const SITE_CONFIG = {
  coomer: {
    domains: ['coomer.su', 'coomer.st', 'coomer.party', 'coomer.net', 'coomer.lol'],
    urlPatterns: [
      /\/[^\/]+\/user\/[^\/]+/,                    // /service/user/username
      /\/[^\/]+\/user\/[^\/]+\/post\/[^\/]+/,      // /service/user/username/post/id
      /\/api\/v1\/[^\/]+\/user\/[^\/]+/,           // API endpoint pattern
      /\/data\/[^\/]+/,                             // Media data path
    ],
    apiPattern: /\/api\/v1\/([^\/]+)\/user\/([^\/]+)/,
    cdnPattern: /^https?:\/\/[n0-9]+\.(coomer|kemono)\./
  },
  kemono: {
    domains: ['kemono.su', 'kemono.cr', 'kemono.party', 'kemono.net', 'kemono.lol'],
    urlPatterns: [
      /\/[^\/]+\/user\/[^\/]+/,
      /\/[^\/]+\/user\/[^\/]+\/post\/[^\/]+/,
      /\/api\/v1\/[^\/]+\/user\/[^\/]+/,
      /\/data\/[^\/]+/,
      /\/kemono\//,  // Pattern for sites hosting Kemono (e.g., animedao.site/kemono/)
    ],
    apiPattern: /\/api\/v1\/([^\/]+)\/user\/([^\/]+)/,
    cdnPattern: /^https?:\/\/[n0-9]+\.(coomer|kemono)\./,
    // Sites that host Kemono via iframe
    iframeHosts: ['animedao.site']
  },
  onlyfans: {
    domains: ['onlyfans.com'],
    urlPatterns: [
      /\/api2\/v2\//,                               // OnlyFans API v2
      /onlyfans\.com\/\d+\//,                        // OnlyFans user ID pattern
      /\/api2\/v2\/(users|posts|chats)/,            // Specific API endpoints
    ]
  }
};

/**
 * Detect which site a URL belongs to
 * @param {string} url - The URL to check
 * @returns {string|null} - 'coomer', 'kemono', 'onlyfans', or null
 */
function detectSite(url) {
  if (!url || typeof url !== 'string') return null;
  
  try {
    // Normalize URL
    const normalizedUrl = url.toLowerCase().trim();
    
    // Check Coomer/Kemono (they share the same URL structure)
    const coomerKemonoDomains = [...SITE_CONFIG.coomer.domains, ...SITE_CONFIG.kemono.domains];
    const hasCoomerKemonoDomain = coomerKemonoDomains.some(domain => normalizedUrl.includes(domain));
    const matchesCoomerKemonoPattern = SITE_CONFIG.coomer.urlPatterns.some(pattern => pattern.test(normalizedUrl));
    
    if (hasCoomerKemonoDomain || matchesCoomerKemonoPattern) {
      // Check for iframe hosts (sites that embed Kemono/Coomer)
      if (SITE_CONFIG.kemono.iframeHosts && SITE_CONFIG.kemono.iframeHosts.some(host => normalizedUrl.includes(host))) {
        // Check if URL contains /kemono/ or /coomer/ path
        if (normalizedUrl.includes('/kemono/')) {
          return 'kemono';
        } else if (normalizedUrl.includes('/coomer/')) {
          return 'coomer';
        }
      }
      
      // Determine if it's Coomer or Kemono based on domain
      if (SITE_CONFIG.coomer.domains.some(d => normalizedUrl.includes(d))) {
        return 'coomer';
      } else if (SITE_CONFIG.kemono.domains.some(d => normalizedUrl.includes(d))) {
        return 'kemono';
      }
      
      // Check URL path for /kemono/ or /coomer/
      if (normalizedUrl.includes('/kemono/')) {
        return 'kemono';
      } else if (normalizedUrl.includes('/coomer/')) {
        return 'coomer';
      }
      
      // If domain unknown but pattern matches, check structure
      // Coomer and Kemono are essentially the same, so default to 'coomer' for processing
      return 'coomer';
    }
    
    // Check OnlyFans
    const hasOnlyFansDomain = SITE_CONFIG.onlyfans.domains.some(domain => normalizedUrl.includes(domain));
    const matchesOnlyFansPattern = SITE_CONFIG.onlyfans.urlPatterns.some(pattern => pattern.test(normalizedUrl));
    
    if (hasOnlyFansDomain || matchesOnlyFansPattern) {
      return 'onlyfans';
    }
    
    return null;
  } catch (error) {
    console.error('[Site Detection] Error detecting site:', error);
    return null;
  }
}

/**
 * Check if URL is a Coomer or Kemono site (combined check)
 * @param {string} url - The URL to check
 * @returns {boolean}
 */
function isCoomerOrKemono(url) {
  const site = detectSite(url);
  return site === 'coomer' || site === 'kemono';
}

/**
 * Check if URL is an OnlyFans site
 * @param {string} url - The URL to check
 * @returns {boolean}
 */
function isOnlyFans(url) {
  return detectSite(url) === 'onlyfans';
}

/**
 * Check if URL matches Coomer/Kemono CDN pattern
 * @param {string} url - The URL to check
 * @returns {boolean}
 */
function isCoomerKemonoCdn(url) {
  if (!url) return false;
  try {
    return SITE_CONFIG.coomer.cdnPattern.test(url) || 
           url.includes('/data/') ||
           /^https?:\/\/[n0-9]+\.(coomer|kemono)\./.test(url);
  } catch (error) {
    return false;
  }
}

/**
 * Get all known domains for a site type
 * @param {string} siteType - 'coomer', 'kemono', or 'onlyfans'
 * @returns {string[]} Array of domain strings
 */
function getKnownDomains(siteType) {
  if (siteType === 'coomer') {
    return SITE_CONFIG.coomer.domains;
  } else if (siteType === 'kemono') {
    return SITE_CONFIG.kemono.domains;
  } else if (siteType === 'onlyfans') {
    return SITE_CONFIG.onlyfans.domains;
  }
  return [];
}

/**
 * Get all Coomer and Kemono domains combined
 * @returns {string[]}
 */
function getAllCoomerKemonoDomains() {
  return [...SITE_CONFIG.coomer.domains, ...SITE_CONFIG.kemono.domains];
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    detectSite,
    isCoomerOrKemono,
    isOnlyFans,
    isCoomerKemonoCdn,
    getKnownDomains,
    getAllCoomerKemonoDomains,
    SITE_CONFIG
  };
}

// Make available globally for content scripts
if (typeof window !== 'undefined') {
  window.SiteDetection = {
    detectSite,
    isCoomerOrKemono,
    isOnlyFans,
    isCoomerKemonoCdn,
    getKnownDomains,
    getAllCoomerKemonoDomains,
    SITE_CONFIG
  };
}

