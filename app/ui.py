#!/usr/bin/env python3
"""
OnlyFans Downloader - Web UI
Modern web-based interface for the downloader app
"""

import asyncio
import json
import threading
from datetime import datetime
from pathlib import Path
from flask import Flask, render_template, request, jsonify, send_from_directory
from flask_socketio import SocketIO, emit
import webbrowser

from main import OnlyFansDownloaderApp

app = Flask(__name__)
app.config['SECRET_KEY'] = 'onlyfans-downloader-secret-key'
socketio = SocketIO(app, cors_allowed_origins="*")

# Global state
downloader_app = None
download_status = {
    'is_running': False,
    'current_user': None,
    'progress': {
        'total_posts': 0,
        'processed_posts': 0,
        'downloaded_files': 0,
        'current_action': 'Idle'
    },
    'logs': []
}

def log_message(message, level='info'):
    """Add log message and emit to clients"""
    timestamp = datetime.now().strftime('%H:%M:%S')
    log_entry = {
        'timestamp': timestamp,
        'message': message,
        'level': level
    }
    download_status['logs'].append(log_entry)
    # Keep only last 100 logs
    if len(download_status['logs']) > 100:
        download_status['logs'] = download_status['logs'][-100:]
    socketio.emit('log', log_entry)
    print(f"[{timestamp}] {message}")

def update_progress(action, processed=0, total=0, files=0):
    """Update download progress"""
    download_status['progress'] = {
        'total_posts': total,
        'processed_posts': processed,
        'downloaded_files': files,
        'current_action': action
    }
    socketio.emit('progress', download_status['progress'])

@app.route('/')
def index():
    """Main page"""
    return render_template('index.html')

@app.route('/api/status', methods=['GET'])
def get_status():
    """Get current download status"""
    return jsonify(download_status)

@app.route('/api/login', methods=['POST'])
def login():
    """Handle login request"""
    global downloader_app
    
    data = request.json
    email = data.get('email', '').strip()
    password = data.get('password', '').strip()
    two_factor = data.get('twoFactor', '').strip() or None
    
    if not email or not password:
        return jsonify({'success': False, 'error': 'Email and password required'}), 400
    
    def login_thread():
        global downloader_app
        try:
            log_message('Initializing browser...', 'info')
            downloader_app = OnlyFansDownloaderApp()
            
            # Run async login in new event loop
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
            loop.run_until_complete(downloader_app.initialize_browser(headless=False))
            log_message('Browser initialized', 'success')
            
            success = loop.run_until_complete(
                downloader_app.login(email, password, two_factor)
            )
            
            if success:
                log_message('Login successful!', 'success')
                download_status['is_running'] = False
                socketio.emit('login_success')
            else:
                log_message('Login failed', 'error')
                download_status['is_running'] = False
                socketio.emit('login_failed', {'error': 'Login failed. Please check credentials.'})
            
        except Exception as e:
            log_message(f'Login error: {str(e)}', 'error')
            download_status['is_running'] = False
            socketio.emit('login_failed', {'error': str(e)})
    
    download_status['is_running'] = True
    thread = threading.Thread(target=login_thread, daemon=True)
    thread.start()
    
    return jsonify({'success': True, 'message': 'Login started'})

@app.route('/api/download', methods=['POST'])
def download():
    """Handle download request"""
    global downloader_app
    
    data = request.json
    username = data.get('username', '').strip()
    max_posts = data.get('maxPosts')
    download_media = data.get('downloadMedia', True)
    
    if not username:
        return jsonify({'success': False, 'error': 'Username required'}), 400
    
    if downloader_app is None:
        return jsonify({'success': False, 'error': 'Please login first'}), 400
    
    def download_thread():
        global downloader_app
        try:
            download_status['is_running'] = True
            download_status['current_user'] = username
            log_message(f'Starting download for {username}...', 'info')
            
            # Run async download
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
            # Custom download function with progress updates
            async def download_with_progress():
                update_progress('Scraping posts...', 0, 0, 0)
                posts = await downloader_app.scrape_user_posts(username, max_posts)
                
                if not posts:
                    log_message('No posts found', 'warning')
                    download_status['is_running'] = False
                    socketio.emit('download_complete', {'success': False, 'message': 'No posts found'})
                    return
                
                update_progress('Exporting metadata...', 0, len(posts), 0)
                await downloader_app.export_metadata(username, posts)
                log_message(f'Metadata exported for {len(posts)} posts', 'success')
                
                if download_media:
                    update_progress('Downloading media...', 0, len(posts), 0)
                    downloaded_files = 0
                    
                    for idx, post in enumerate(posts, 1):
                        update_progress(f'Downloading post {idx}/{len(posts)}...', idx, len(posts), downloaded_files)
                        log_message(f'Processing post {idx}/{len(posts)}...', 'info')
                        
                        files = await downloader_app.download_media(post, username)
                        downloaded_files += len(files)
                        update_progress(f'Downloaded {downloaded_files} files', idx, len(posts), downloaded_files)
                    
                    log_message(f'Downloaded {downloaded_files} files from {len(posts)} posts', 'success')
                else:
                    log_message(f'Metadata only mode: {len(posts)} posts scraped', 'success')
                
                download_status['is_running'] = False
                socketio.emit('download_complete', {
                    'success': True,
                    'message': f'Completed: {len(posts)} posts, {downloaded_files if download_media else 0} files'
                })
            
            loop.run_until_complete(download_with_progress())
            
        except Exception as e:
            log_message(f'Download error: {str(e)}', 'error')
            download_status['is_running'] = False
            socketio.emit('download_complete', {'success': False, 'error': str(e)})
    
    thread = threading.Thread(target=download_thread, daemon=True)
    thread.start()
    
    return jsonify({'success': True, 'message': 'Download started'})

@app.route('/api/stop', methods=['POST'])
def stop():
    """Stop current operation"""
    global downloader_app
    download_status['is_running'] = False
    log_message('Stop requested', 'warning')
    return jsonify({'success': True, 'message': 'Stop requested'})

@app.route('/api/logs', methods=['GET'])
def get_logs():
    """Get recent logs"""
    return jsonify(download_status['logs'])

@app.route('/api/browser/close', methods=['POST'])
def close_browser():
    """Close browser"""
    global downloader_app
    if downloader_app:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(downloader_app.close())
        downloader_app = None
        log_message('Browser closed', 'info')
    return jsonify({'success': True})

def run_server(host='127.0.0.1', port=5000, open_browser=True):
    """Run the web server"""
    print(f"\n{'='*60}")
    print("OnlyFans Downloader - Web UI")
    print(f"{'='*60}")
    print(f"\n📡 Server starting on http://{host}:{port}")
    print("Open this URL in your browser to access the UI")
    print("\nPress Ctrl+C to stop the server\n")
    
    if open_browser:
        # Open browser after a short delay
        def open_browser_delayed():
            import time
            time.sleep(1.5)
            webbrowser.open(f'http://{host}:{port}')
        threading.Thread(target=open_browser_delayed, daemon=True).start()
    
    socketio.run(app, host=host, port=port, debug=False, allow_unsafe_werkzeug=True)

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='OnlyFans Downloader Web UI')
    parser.add_argument('--host', default='127.0.0.1', help='Host to bind to')
    parser.add_argument('--port', type=int, default=5000, help='Port to bind to')
    parser.add_argument('--no-browser', action='store_true', help='Do not open browser automatically')
    args = parser.parse_args()
    
    run_server(host=args.host, port=args.port, open_browser=not args.no_browser)


