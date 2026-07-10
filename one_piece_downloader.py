import os
import sys
import json
import time
import urllib.request
import ssl
from curl_cffi import requests

# Set default unverified SSL context for urllib (useful on Windows python bundles)
ssl._create_default_https_context = ssl._create_unverified_context

# Configuration
COMIC_SLUG = "one-piece"
BASE_API_URL = f"https://www.natomanga.com/api/manga/{COMIC_SLUG}/chapters"
METADATA_FILE = "one_piece_chapters.json"
DEFAULT_DOWNLOADS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "downloads", COMIC_SLUG)

CDN_LIST = [
    "https://img-r1.2xstorage.com/",
    "https://img-r2.2xstorage.com/",
    "https://imgs-2.2xstorage.com/",
    "https://storage4.waitst.com/",
    "https://storage.waitst.com/",
    "https://storage2.waitst.com/",
    "https://storage3.waitst.com/"
]

def fetch_chapters_metadata():
    """Fetches the list of all chapters from the unprotected API and saves it locally."""
    print("Fetching chapters directory from Natomanga API...")
    url = f"{BASE_API_URL}?limit=2000"
    req = urllib.request.Request(
        url,
        headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}
    )
    try:
        with urllib.request.urlopen(req) as response:
            res_data = response.read().decode('utf-8')
            parsed = json.loads(res_data)
            if not parsed.get('success'):
                print("[-] Error: API response success is False.")
                return None
            chapters = parsed.get('data', {}).get('chapters', [])
            # Sort chapters chronologically (Chapter 0, 0.1, 1, 2, ... 1187+)
            chapters.sort(key=lambda x: float(x.get('chapter_num', 0)))
            
            with open(METADATA_FILE, 'w', encoding='utf-8') as f:
                json.dump(chapters, f, indent=4)
            print(f"[+] Successfully indexed {len(chapters)} chapters and saved to {METADATA_FILE}")
            return chapters
    except Exception as e:
        print(f"[-] Failed to fetch chapters metadata: {e}")
        return None

def load_chapters():
    """Loads chapter index metadata from local JSON or fetches it if not present."""
    if os.path.exists(METADATA_FILE):
        try:
            with open(METADATA_FILE, 'r', encoding='utf-8') as f:
                chapters = json.load(f)
                print(f"[+] Loaded {len(chapters)} chapters from local cache ({METADATA_FILE})")
                return chapters
        except Exception:
            pass
    return fetch_chapters_metadata()

def try_download_chapter(chapter, downloads_dir):
    """Probes CDNs and downloads all pages for a single chapter."""
    slug = chapter['chapter_slug']
    num = chapter['chapter_num']
    chapter_name = chapter['chapter_name']
    
    chapter_dir = os.path.join(downloads_dir, slug)
    os.makedirs(chapter_dir, exist_ok=True)
    
    # Check if folder is already populated (simplifies resume/retry)
    if os.path.exists(chapter_dir) and len(os.listdir(chapter_dir)) > 0:
        # Check if files are non-empty
        files = os.listdir(chapter_dir)
        if all(os.path.getsize(os.path.join(chapter_dir, f)) > 0 for f in files):
            print(f"[~] Chapter {num} ({chapter_name}) already downloaded. Skipping.")
            return True
            
    # Probes to discover the active CDN and page numbering format
    active_cdn = None
    test_paths = [
        f"{COMIC_SLUG}/{num}/0.webp",
        f"{COMIC_SLUG}/{num}/1.webp",
        f"{COMIC_SLUG}/{num}/0.jpg",
        f"{COMIC_SLUG}/{num}/1.jpg"
    ]
    
    found_path = None
    for cdn in CDN_LIST:
        for tp in test_paths:
            test_url = f"{cdn}{tp}"
            try:
                res = requests.get(
                    test_url,
                    impersonate='chrome120',
                    headers={
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Referer': 'https://www.natomanga.com/'
                    },
                    timeout=5
                )
                if res.status_code == 200:
                    active_cdn = cdn
                    found_path = tp
                    break
            except Exception:
                continue
        if active_cdn:
            break
            
    if not active_cdn:
        print(f"[-] Could not find active CDN/path for {chapter_name} (skipped).")
        return False
        
    print(f"[+] Found active CDN: {active_cdn} (Format: {found_path})")
    
    page_idx = 0
    consecutive_failures = 0
    downloaded_pages = 0
    found_ext = '.webp' if '.webp' in found_path else '.jpg'
    
    # Download sequentially until we hit consecutive 404s
    while consecutive_failures < 2:
        img_path = f"{COMIC_SLUG}/{num}/{page_idx}{found_ext}"
        image_url = f"{active_cdn}{img_path}"
        dest_path = os.path.join(chapter_dir, f"page-{str(page_idx+1).zfill(2)}{found_ext}")
        
        if os.path.exists(dest_path) and os.path.getsize(dest_path) > 0:
            page_idx += 1
            consecutive_failures = 0
            downloaded_pages += 1
            continue
            
        try:
            res = requests.get(
                image_url,
                impersonate='chrome120',
                headers={
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': 'https://www.natomanga.com/'
                },
                timeout=15
            )
            status_code = res.status_code
            content = res.content
        except Exception:
            status_code = 0
            content = b''
            
        if status_code == 200:
            with open(dest_path, 'wb') as f:
                f.write(content)
            page_idx += 1
            consecutive_failures = 0
            downloaded_pages += 1
        else:
            # Try alternate extension once
            alt_ext = '.jpg' if found_ext == '.webp' else '.webp'
            alt_path = f"{COMIC_SLUG}/{num}/{page_idx}{alt_ext}"
            alt_url = f"{active_cdn}{alt_path}"
            
            try:
                res_alt = requests.get(
                    alt_url,
                    impersonate='chrome120',
                    headers={
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Referer': 'https://www.natomanga.com/'
                    },
                    timeout=15
                )
                alt_status_code = res_alt.status_code
                alt_content = res_alt.content
            except Exception:
                alt_status_code = 0
                alt_content = b''
                
            if alt_status_code == 200:
                dest_path_alt = os.path.join(chapter_dir, f"page-{str(page_idx+1).zfill(2)}{alt_ext}")
                with open(dest_path_alt, 'wb') as f:
                    f.write(alt_content)
                page_idx += 1
                consecutive_failures = 0
                downloaded_pages += 1
            else:
                consecutive_failures += 1
                page_idx += 1
                
    if downloaded_pages > 0:
        print(f"[√] Successfully downloaded {downloaded_pages} pages for {chapter_name}")
        return True
    else:
        print(f"[-] Failed to download any pages for {chapter_name}")
        # Clean up empty folder
        try:
            os.rmdir(chapter_dir)
        except Exception:
            pass
        return False

def main():
    print("=" * 60)
    print("             ONE PIECE MANGA DOWNLOADER (Natomanga)")
    print("=" * 60)
    
    chapters = load_chapters()
    if not chapters:
        print("[-] Error: Unable to load chapter list.")
        sys.exit(1)
        
    print(f"\nAvailable range: Chapter {chapters[0]['chapter_num']} to Chapter {chapters[-1]['chapter_num']}")
    
    # Prompt for download range
    start_num_input = input("Enter START chapter number (e.g. 0 or 1180) [default: 0]: ").strip()
    end_num_input = input("Enter END chapter number (e.g. 10 or 1187) [default: latest]: ").strip()
    
    start_num = float(start_num_input) if start_num_input else 0.0
    end_num = float(end_num_input) if end_num_input else float(chapters[-1]['chapter_num'])
    
    # Filter chapters in range
    target_chapters = [
        ch for ch in chapters 
        if start_num <= float(ch.get('chapter_num', 0)) <= end_num
    ]
    
    if not target_chapters:
        print("[-] No chapters found in the specified range.")
        sys.exit(0)
        
    print(f"\nSelected {len(target_chapters)} chapters to download.")
    confirm = input("Confirm start download? (y/n) [y]: ").strip().lower()
    if confirm not in ('', 'y', 'yes'):
        print("Aborted.")
        sys.exit(0)
        
    print(f"\nDownloads will be saved to: {DEFAULT_DOWNLOADS_DIR}")
    
    success_count = 0
    fail_count = 0
    
    for idx, ch in enumerate(target_chapters):
        print(f"\n[{idx+1}/{len(target_chapters)}] Processing {ch['chapter_name']}...")
        success = try_download_chapter(ch, DEFAULT_DOWNLOADS_DIR)
        if success:
            success_count += 1
        else:
            fail_count += 1
            
        # Rate-limiting pause to avoid triggering anti-bot protections
        time.sleep(1.5)
        
    print("\n" + "=" * 60)
    print("                     DOWNLOAD RUN COMPLETED")
    print(f"  Successful downloads: {success_count}")
    print(f"  Failed downloads:     {fail_count}")
    print("=" * 60)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n[-] Process interrupted by user. Exiting.")
        sys.exit(0)
