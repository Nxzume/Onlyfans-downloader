#!/usr/bin/env python3
"""
OnlyFans Downloader - Standalone App
Automates browser login, scrapes user profiles, and downloads all media
"""

import asyncio
import json
import os
import sys
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Optional

from playwright.async_api import async_playwright, Page, Browser, BrowserContext
import aiohttp
import aiofiles


class OnlyFansDownloaderApp:
    def __init__(self, output_dir: str = "downloads"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        self.session_dir = self.output_dir / "sessions"
        self.session_dir.mkdir(exist_ok=True)
        self.downloads_dir = self.output_dir / "media"
        self.downloads_dir.mkdir(exist_ok=True)
        self.metadata_dir = self.output_dir / "metadata"
        self.metadata_dir.mkdir(exist_ok=True)
        
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None
        self.page: Optional[Page] = None
        self.session_cookies = None
        
    async def initialize_browser(self, headless: bool = False):
        """Initialize Playwright browser"""
        print("Initializing browser...")
        playwright = await async_playwright().start()
        self.browser = await playwright.chromium.launch(
            headless=headless,
            args=['--disable-blink-features=AutomationControlled']
        )
        
        # Create context with realistic settings
        self.context = await self.browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        )
        
        # Load saved cookies if available
        cookies_file = self.session_dir / "cookies.json"
        if cookies_file.exists():
            try:
                with open(cookies_file, 'r') as f:
                    cookies = json.load(f)
                    await self.context.add_cookies(cookies)
                    print("Loaded saved session cookies")
            except Exception as e:
                print(f"Could not load cookies: {e}")
        
        self.page = await self.context.new_page()
        print("Browser initialized")
        
    async def login(self, email: str, password: str, two_factor_code: Optional[str] = None):
        """Login to OnlyFans"""
        print(f"🔐 Logging in as {email}...")
        
        try:
            await self.page.goto("https://onlyfans.com", wait_until="networkidle")
            await asyncio.sleep(2)
            
            # Check if already logged in
            if "onlyfans.com/my" in self.page.url or self.page.locator("text=Home").count() > 0:
                print("Already logged in (using saved session)")
                await self.save_session()
                return True
            
            # Click login button if needed
            login_button = self.page.locator("text=Log in").first
            if await login_button.count() > 0:
                await login_button.click()
                await asyncio.sleep(1)
            
            # Enter email
            email_input = self.page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first
            await email_input.fill(email)
            await asyncio.sleep(0.5)
            
            # Enter password
            password_input = self.page.locator('input[type="password"]').first
            await password_input.fill(password)
            await asyncio.sleep(0.5)
            
            # Submit login form
            submit_button = self.page.locator('button[type="submit"], button:has-text("Log in")').first
            await submit_button.click()
            await asyncio.sleep(3)
            
            # Handle 2FA if needed
            if two_factor_code:
                print("🔐 Entering 2FA code...")
                code_input = self.page.locator('input[type="text"], input[placeholder*="code" i]').first
                if await code_input.count() > 0:
                    await code_input.fill(two_factor_code)
                    await asyncio.sleep(0.5)
                    submit_2fa = self.page.locator('button:has-text("Verify"), button[type="submit"]').first
                    await submit_2fa.click()
                    await asyncio.sleep(3)
            
            # Wait for login to complete
            await self.page.wait_for_url("**/my**", timeout=30000)
            print("Login successful!")
            
            # Save session
            await self.save_session()
            return True
            
        except Exception as e:
            print(f"Login failed: {e}")
            return False
    
    async def save_session(self):
        """Save browser cookies for future sessions"""
        cookies = await self.context.cookies()
        cookies_file = self.session_dir / "cookies.json"
        with open(cookies_file, 'w') as f:
            json.dump(cookies, f, indent=2)
        print("💾 Session saved")
    
    async def get_user_profile_url(self, username: str) -> str:
        """Get the profile URL for a username"""
        # Try to navigate to user profile
        profile_url = f"https://onlyfans.com/{username}"
        await self.page.goto(profile_url, wait_until="networkidle")
        await asyncio.sleep(2)
        
        # Check if profile exists
        if "404" in self.page.url or self.page.locator("text=Page not found").count() > 0:
            raise ValueError(f"User '{username}' not found")
        
        return self.page.url
    
    async def scrape_user_posts(self, username: str, max_posts: Optional[int] = None) -> List[Dict]:
        """Scrape all posts from a user's profile"""
        print(f"Scraping posts from {username}...")
        
        profile_url = await self.get_user_profile_url(username)
        posts = []
        page_num = 0
        
        while True:
            print(f"📄 Scraping page {page_num + 1}...")
            
            # Scroll to load more posts
            await self.page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            await asyncio.sleep(2)
            
            # Extract posts from current page
            page_posts = await self.extract_posts_from_page()
            
            if not page_posts:
                print("No posts found on this page")
                break
            
            # Add new posts
            for post in page_posts:
                if post not in posts:
                    posts.append(post)
            
            print(f"Found {len(posts)} total posts so far")
            
            # Check if we've reached the limit
            if max_posts and len(posts) >= max_posts:
                posts = posts[:max_posts]
                break
            
            # Try to load more posts
            load_more = self.page.locator("text=Load more, text=Show more").first
            if await load_more.count() > 0:
                await load_more.click()
                await asyncio.sleep(3)
            else:
                # Check if we can scroll more
                old_height = await self.page.evaluate("document.body.scrollHeight")
                await self.page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                await asyncio.sleep(2)
                new_height = await self.page.evaluate("document.body.scrollHeight")
                
                if old_height == new_height:
                    print("Reached end of posts")
                    break
            
            page_num += 1
        
        print(f"Scraped {len(posts)} posts from {username}")
        return posts
    
    async def extract_posts_from_page(self) -> List[Dict]:
        """Extract post data from the current page"""
        posts = []
        
        # Wait for posts to load
        await self.page.wait_for_selector('.b-post, [class*="post"]', timeout=5000)
        
        # Extract post data using JavaScript
        posts_data = await self.page.evaluate("""
            () => {
                const posts = [];
                const postElements = document.querySelectorAll('.b-post, [class*="post"]');
                
                postElements.forEach((postEl, index) => {
                    try {
                        const post = {
                            id: postEl.getAttribute('data-id') || postEl.id || `post-${index}`,
                            text: postEl.querySelector('.b-post__text, [class*="text"]')?.textContent?.trim() || '',
                            date: postEl.querySelector('time')?.getAttribute('datetime') || 
                                  postEl.querySelector('time')?.textContent?.trim() || '',
                            media: []
                        };
                        
                        // Extract images
                        const images = postEl.querySelectorAll('img.b-post__media__img, [class*="media"] img');
                        images.forEach(img => {
                            const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-url');
                            if (src && !src.includes('data:image')) {
                                post.media.push({
                                    type: 'image',
                                    url: src,
                                    thumbnail: img.src
                                });
                            }
                        });
                        
                        // Extract videos
                        const videos = postEl.querySelectorAll('video, .video-wrapper, .video-js');
                        videos.forEach(video => {
                            let videoUrl = null;
                            
                            // Try to get from video element
                            if (video.tagName === 'VIDEO') {
                                videoUrl = video.src || video.getAttribute('data-src');
                            }
                            
                            // Try to get from video.js player
                            if (!videoUrl && video.classList.contains('video-js')) {
                                const playerId = video.id;
                                if (playerId && window.videojs) {
                                    try {
                                        const player = window.videojs(playerId);
                                        if (player && player.httpSourceSelector) {
                                            const sources = player.httpSourceSelector.sources;
                                            if (sources && sources.length > 0) {
                                                videoUrl = sources[0].src;
                                            }
                                        }
                                        if (!videoUrl && player.currentSrc) {
                                            videoUrl = player.currentSrc();
                                        }
                                    } catch (e) {}
                                }
                            }
                            
                            if (videoUrl && !videoUrl.startsWith('blob:')) {
                                post.media.push({
                                    type: 'video',
                                    url: videoUrl
                                });
                            }
                        });
                        
                        // Extract video URLs from network requests (stored in extension)
                        if (window.networkVideoUrls) {
                            window.networkVideoUrls.forEach((data, url) => {
                                if (url && !url.startsWith('blob:')) {
                                    post.media.push({
                                        type: 'video',
                                        url: url
                                    });
                                }
                            });
                        }
                        
                        if (post.media.length > 0 || post.text) {
                            posts.push(post);
                        }
                    } catch (e) {
                        console.error('Error extracting post:', e);
                    }
                });
                
                return posts;
            }
        """)
        
        return posts_data
    
    async def download_media(self, post: Dict, username: str):
        """Download all media from a post"""
        post_id = post.get('id', 'unknown')
        post_dir = self.downloads_dir / username / f"post_{post_id}"
        post_dir.mkdir(parents=True, exist_ok=True)
        
        media_files = []
        
        for idx, media in enumerate(post.get('media', [])):
            try:
                url = media.get('url')
                if not url:
                    continue
                
                # Clean URL
                url = url.split('?')[0]  # Remove query params
                
                # Determine file extension
                if media.get('type') == 'video':
                    ext = '.mp4'
                    if '.m3u8' in url:
                        print(f"HLS stream detected for post {post_id}, skipping (requires special handling)")
                        continue
                else:
                    ext = '.jpg'
                    if '.png' in url.lower():
                        ext = '.png'
                    elif '.gif' in url.lower():
                        ext = '.gif'
                
                filename = f"{post_id}_{idx+1}{ext}"
                filepath = post_dir / filename
                
                # Skip if already downloaded
                if filepath.exists():
                    print(f"Skipping {filename} (already exists)")
                    media_files.append(str(filepath))
                    continue
                
                print(f"Downloading {filename}...")
                
                # Download file
                async with aiohttp.ClientSession() as session:
                    async with session.get(url) as response:
                        if response.status == 200:
                            async with aiofiles.open(filepath, 'wb') as f:
                                async for chunk in response.content.iter_chunked(8192):
                                    await f.write(chunk)
                            print(f"Downloaded {filename}")
                            media_files.append(str(filepath))
                        else:
                            print(f"Failed to download {filename}: HTTP {response.status}")
                
                # Rate limiting
                await asyncio.sleep(0.5)
                
            except Exception as e:
                print(f"Error downloading media: {e}")
        
        return media_files
    
    async def export_metadata(self, username: str, posts: List[Dict]):
        """Export post metadata to JSON"""
        metadata_file = self.metadata_dir / f"{username}_posts_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        export_data = {
            'username': username,
            'export_date': datetime.now().isoformat(),
            'total_posts': len(posts),
            'posts': posts
        }
        
        async with aiofiles.open(metadata_file, 'w', encoding='utf-8') as f:
            await f.write(json.dumps(export_data, indent=2, ensure_ascii=False))
        
        print(f"💾 Metadata exported to {metadata_file}")
        return metadata_file
    
    async def download_user_content(self, username: str, max_posts: Optional[int] = None, download_media: bool = True):
        """Main method to download all content from a user"""
        print(f"\n{'='*60}")
        print(f"Starting download for user: {username}")
        print(f"{'='*60}\n")
        
        # Scrape posts
        posts = await self.scrape_user_posts(username, max_posts)
        
        if not posts:
            print(f"No posts found for {username}")
            return
        
        # Export metadata
        await self.export_metadata(username, posts)
        
        # Download media
        if download_media:
            print(f"\nDownloading media for {len(posts)} posts...")
            for idx, post in enumerate(posts, 1):
                print(f"\n📦 Processing post {idx}/{len(posts)}...")
                await self.download_media(post, username)
                await asyncio.sleep(1)  # Rate limiting between posts
        
        print(f"\nCompleted download for {username}")
        print(f"Files saved to: {self.downloads_dir / username}")
        print(f"📄 Metadata saved to: {self.metadata_dir}")
    
    async def close(self):
        """Close browser and cleanup"""
        if self.context:
            await self.context.close()
        if self.browser:
            await self.browser.close()
        print("👋 Browser closed")


async def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description='OnlyFans Downloader - Standalone App')
    parser.add_argument('--email', help='OnlyFans email')
    parser.add_argument('--password', help='OnlyFans password')
    parser.add_argument('--username', required=True, help='OnlyFans username to download from')
    parser.add_argument('--max-posts', type=int, help='Maximum number of posts to download')
    parser.add_argument('--headless', action='store_true', help='Run browser in headless mode')
    parser.add_argument('--no-download', action='store_true', help='Only scrape metadata, do not download media')
    parser.add_argument('--output-dir', default='downloads', help='Output directory for downloads')
    
    args = parser.parse_args()
    
    app = OnlyFansDownloaderApp(output_dir=args.output_dir)
    
    try:
        # Initialize browser
        await app.initialize_browser(headless=args.headless)
        
        # Login if credentials provided
        if args.email and args.password:
            success = await app.login(args.email, args.password)
            if not success:
                print("Login failed. Exiting.")
                return
        else:
            print("No credentials provided. Using saved session or manual login.")
            await app.page.goto("https://onlyfans.com")
            print("👤 Please login manually in the browser window...")
            input("Press Enter after you've logged in...")
            await app.save_session()
        
        # Download user content
        await app.download_user_content(
            username=args.username,
            max_posts=args.max_posts,
            download_media=not args.no_download
        )
        
    except KeyboardInterrupt:
        print("\nInterrupted by user")
    except Exception as e:
        print(f"\nError: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await app.close()


if __name__ == "__main__":
    asyncio.run(main())


