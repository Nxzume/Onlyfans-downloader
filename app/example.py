#!/usr/bin/env python3
"""
Simple example script for using the OnlyFans Downloader App
"""

import asyncio
from main import OnlyFansDownloaderApp


async def example_basic():
    """Basic example: Download all content from a user"""
    app = OnlyFansDownloaderApp(output_dir="downloads")
    
    try:
        # Initialize browser (visible, not headless)
        await app.initialize_browser(headless=False)
        
        # Login
        await app.login(
            email="your_email@example.com",
            password="your_password"
        )
        
        # Download all content from a user
        await app.download_user_content(
            username="creator_username",
            max_posts=None,  # Download all posts
            download_media=True
        )
        
    finally:
        await app.close()


async def example_metadata_only():
    """Example: Only scrape metadata, don't download media"""
    app = OnlyFansDownloaderApp(output_dir="downloads")
    
    try:
        await app.initialize_browser(headless=False)
        
        # Use saved session (no login needed if already logged in)
        await app.page.goto("https://onlyfans.com")
        
        # Scrape and export metadata only
        await app.download_user_content(
            username="creator_username",
            max_posts=10,  # Only first 10 posts
            download_media=False  # Don't download files
        )
        
    finally:
        await app.close()


async def example_custom():
    """Example: Custom workflow"""
    app = OnlyFansDownloaderApp(output_dir="my_custom_downloads")
    
    try:
        await app.initialize_browser(headless=True)  # Headless mode
        
        # Manual login
        await app.page.goto("https://onlyfans.com")
        print("Please login manually...")
        input("Press Enter after login...")
        await app.save_session()
        
        # Get posts
        posts = await app.scrape_user_posts("creator_username", max_posts=5)
        
        # Download only first 3 posts
        for post in posts[:3]:
            await app.download_media(post, "creator_username")
        
        # Export metadata
        await app.export_metadata("creator_username", posts)
        
    finally:
        await app.close()


if __name__ == "__main__":
    # Run the basic example
    asyncio.run(example_basic())
    
    # Or uncomment to run other examples:
    # asyncio.run(example_metadata_only())
    # asyncio.run(example_custom())


