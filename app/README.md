# OnlyFans Downloader - Standalone App

A Python-based standalone application that automates OnlyFans login, scrapes user profiles, and downloads all media content (photos and videos).

## Features

- **Automated Login**: Handles OnlyFans authentication (including 2FA support)
- **Profile Scraping**: Automatically scrapes all posts from a user's profile
- **Media Download**: Downloads all photos and videos from posts
- **Metadata Export**: Exports post metadata (text, dates, media URLs) to JSON
- **Session Management**: Saves login session to avoid repeated logins
- **Rate Limiting**: Built-in delays to avoid overwhelming the server
- **Resume Support**: Skips already downloaded files

## Installation

### Prerequisites

- Python 3.8 or higher
- pip (Python package manager)

### Steps

1. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Install Playwright browsers:**
   ```bash
   playwright install chromium
   ```

## Usage

### Basic Usage

Download all content from a user:

```bash
python main.py --username "creator_username" --email "your_email@example.com" --password "your_password"
```

### Advanced Options

```bash
# Download with saved session (no login needed)
python main.py --username "creator_username"

# Limit number of posts
python main.py --username "creator_username" --max-posts 50

# Only scrape metadata, don't download media
python main.py --username "creator_username" --no-download

# Run in headless mode (no browser window)
python main.py --username "creator_username" --headless

# Custom output directory
python main.py --username "creator_username" --output-dir "my_downloads"
```

### Command Line Arguments

- `--username` (required): OnlyFans username to download from
- `--email`: Your OnlyFans email for login
- `--password`: Your OnlyFans password
- `--max-posts`: Maximum number of posts to download (default: all)
- `--headless`: Run browser in headless mode (no window)
- `--no-download`: Only scrape metadata, don't download media files
- `--output-dir`: Output directory for downloads (default: "downloads")

## Output Structure

```
downloads/
├── sessions/
│   └── cookies.json          # Saved login session
├── media/
│   └── creator_username/
│       └── post_12345/
│           ├── post_12345_1.jpg
│           ├── post_12345_2.mp4
│           └── ...
└── metadata/
    └── creator_username_posts_20240101_120000.json
```

## 🔐 Authentication

### Method 1: Command Line Credentials
```bash
python main.py --username "creator" --email "your@email.com" --password "password"
```

### Method 2: Saved Session
1. Run without credentials:
   ```bash
   python main.py --username "creator"
   ```
2. Login manually in the browser window
3. Press Enter after logging in
4. Future runs will use the saved session

### Method 3: 2FA Support
If you have 2FA enabled, you'll need to enter the code manually when prompted. The app will wait for you to complete 2FA verification.

## Configuration

### Rate Limiting
The app includes built-in delays:
- 0.5 seconds between media downloads
- 1 second between posts
- 2 seconds for page loads

You can modify these in `main.py` if needed.

### Browser Settings
The app uses Chromium with realistic user agent and viewport settings to avoid detection. You can modify these in the `initialize_browser()` method.

## Troubleshooting

### Login Issues
- Make sure you're using the correct email/password
- If 2FA is enabled, you may need to login manually
- Check if OnlyFans has blocked automated access (may need to use manual login)

### Download Issues
- Some videos use HLS streams (.m3u8) which require special handling (currently skipped)
- Large files may take time to download
- Check your internet connection if downloads fail

### Scraping Issues
- OnlyFans may change their HTML structure, requiring code updates
- If posts aren't being found, check the browser console for errors
- Try running without `--headless` to see what's happening

## Important Notes

1. **Terms of Service**: Make sure you comply with OnlyFans Terms of Service when using this tool
2. **Rate Limiting**: The app includes rate limiting, but be respectful and don't abuse the service
3. **Legal**: Only download content you have permission to download
4. **Updates**: OnlyFans may change their website structure, requiring code updates

## 🔧 Development

### Extending the App

The app is structured to be easily extensible:

- `OnlyFansDownloaderApp`: Main class handling all operations
- `scrape_user_posts()`: Modify to change how posts are scraped
- `extract_posts_from_page()`: Modify to change how post data is extracted
- `download_media()`: Modify to change download behavior

### Adding Features

To add new features:
1. Add methods to `OnlyFansDownloaderApp` class
2. Update `main()` function to handle new command-line arguments
3. Test thoroughly before using

## License

This tool is for educational purposes. Use responsibly and in accordance with OnlyFans Terms of Service.

## 🤝 Contributing

Contributions are welcome! Please:
1. Test your changes thoroughly
2. Update documentation
3. Follow Python best practices
4. Add comments for complex logic


