# Free Ebook, Manga, Manhwa & Novel Content Sources Guide

This guide details legal, open-access, and public domain repositories and APIs to discover, fetch, and download content (Books, Manga, Manhwa, Novels, PDFs, and Covers) for your online library.

---

## 1. Manga & Manhwa Sources

### **MangaDex API v5**
* **Type**: Public REST API (Free, No API key required)
* **Base URL**: `https://api.mangadex.org`
* **Cover Art URL**: `https://uploads.mangadex.org/covers/{manga-id}/{cover-filename}` (Thumbnails available by appending `.256.jpg` or `.512.jpg`)
* **Chapter Images (MangaDex@Home)**:
  1. Call `GET https://api.mangadex.org/at-home/server/{chapterId}`
  2. Returns `{ baseUrl, chapter: { hash, data: ["1.jpg", "2.jpg"] } }`
  3. Image URL: `{baseUrl}/data/{hash}/{filename}`
* **Search Endpoint**: `GET https://api.mangadex.org/manga?title={query}&includes[]=cover_art`

### **AniList GraphQL API**
* **Type**: Public GraphQL API
* **Endpoint**: `https://graphql.anilist.co`
* **Features**: High-res cover images, genres, descriptions, staff, and scoring metadata for anime, manga, and manhwa.

---

## 2. Recommended Open-Source Downloader Repositories

| Repository | Description | Key Features |
| :--- | :--- | :--- |
| **[oae/kaizoku](https://github.com/oae/kaizoku)** | Self-hosted manga downloader | Automates chapter downloads and metadata sync for digital libraries. |
| **[metafates/mangal](https://github.com/metafates/mangal)** | CLI manga downloader & scraper | AniList integration, Lua scrapers, exports directly to CBZ & PDF. |
| **[hankscafe/omnibus](https://github.com/hankscafe/omnibus)** | Comic & manga manager | Automated downloading and library organization. |
| **[Yui007/weebcentral_downloader](https://github.com/Yui007/weebcentral_downloader)** | WeebCentral downloader | GUI & CLI support for fetching chapters. |
| **[zzyil/AIO-Webtoon-Downloader](https://github.com/zzyil/AIO-Webtoon-Downloader)** | All-in-One Webtoon & Manhwa downloader | Multi-site scrapers, supports PDF & CBZ exports. |
| **[kanasimi/work_crawler](https://github.com/kanasimi/work_crawler)** | Batch novel & comic crawler | Supports 40+ platforms (Kakao, Naver, Tencent), exports EPUB, PDF, CBZ. |

---

## 3. Books & Literature Sources

### **Open Library (Internet Archive)**
* **Type**: Public REST API
* **Search Endpoint**: `https://openlibrary.org/search.json?q={query}`
* **Covers API**:
  * By Cover ID: `https://covers.openlibrary.org/b/id/{cover_i}-L.jpg`
  * By ISBN: `https://covers.openlibrary.org/b/isbn/{isbn}-L.jpg`
* **Internet Archive PDFs**:
  * Metadata API: `https://archive.org/metadata/{identifier}`
  * Direct PDF Link: `https://archive.org/download/{identifier}/{filename}.pdf`

### **Project Gutenberg (via Gutendex API)**
* **Type**: Public REST API (`https://gutendex.com/books`)
* **Search Endpoint**: `https://gutendex.com/books?search={query}`
* **Formats Provided**: EPUB, HTML, Plain text, Cover images.

### **Standard Ebooks**
* **Type**: Open OPDS Feed & Downloads (`https://standardebooks.org`)
* **Features**: Beautifully formatted, high-quality public domain EPUB and AZW3 downloads.

---

## 4. Light Novels & Web Fiction

### **Royal Road**
* **Type**: Web Novels & Original Fiction
* **Features**: Free original web novels. Provides public RSS feeds for chapter updates.

---

## 5. PDF & Image Extraction Techniques

1. **Client-side PDF.js Rendering**:
   - Render PDF page canvases in the browser dynamically to produce image snapshots (`.png` / `.jpg`).
2. **Covers API Extraction**:
   - Open Library Covers API handles automatic resizing (`-S`, `-M`, `-L`).
   - MangaDex Cover CDN delivers optimized webp/jpeg images.
3. **CBZ / Comic Archive Extraction**:
   - Standard zip archive containing sorted page images (`001.jpg`, `002.jpg`).
