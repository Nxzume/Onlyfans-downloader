# Quick Start Guide

## Getting Started in 5 Minutes

### Step 1: Install Dependencies

```bash
# Install Python packages
pip install -r requirements.txt

# Install Playwright browser
playwright install chromium
```

### Step 2: Run the App

**Option A: With Login Credentials**
```bash
python main.py --username "creator_username" --email "your@email.com" --password "your_password"
```

**Option B: Manual Login (Recommended for first time)**
```bash
python main.py --username "creator_username"
```
Then login manually in the browser window and press Enter.

### Step 3: Wait for Download

The app will:
1. Login to OnlyFans
2. Navigate to the user's profile
3. Scrape all posts
4. Download all media files
5. Export metadata to JSON

### Step 4: Find Your Downloads

Check the `downloads/` folder:
```
downloads/
├── media/
│   └── creator_username/
│       └── post_12345/
│           ├── post_12345_1.jpg
│           └── post_12345_2.mp4
└── metadata/
    └── creator_username_posts_20240101_120000.json
```

## 📋 Common Commands

```bash
# Download everything from a user
python main.py --username "creator" --email "email" --password "pass"

# Download only first 10 posts
python main.py --username "creator" --max-posts 10

# Only get metadata, don't download files
python main.py --username "creator" --no-download

# Run in background (headless)
python main.py --username "creator" --headless
```

## Troubleshooting

**Problem: "Module not found" error**
```bash
pip install -r requirements.txt
```

**Problem: "Playwright not installed"**
```bash
playwright install chromium
```

**Problem: Login fails**
- Try manual login: Run without `--email` and `--password`
- Check if 2FA is enabled (may need manual entry)
- Make sure credentials are correct

**Problem: No posts found**
- Check if username is correct
- Make sure you're subscribed to the user
- Try running without `--headless` to see what's happening

## Tips

1. **First Run**: Use manual login to save your session
2. **Large Profiles**: Use `--max-posts` to limit downloads
3. **Testing**: Use `--no-download` to test scraping without downloading
4. **Background**: Use `--headless` for automated runs

## Security

- Your session is saved in `downloads/sessions/cookies.json`
- Keep this file secure and don't share it
- The app never stores your password (only session cookies)

## 📞 Need Help?

Check the full README.md for detailed documentation and advanced usage.


