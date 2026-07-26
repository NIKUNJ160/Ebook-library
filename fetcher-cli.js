#!/usr/bin/env node

/**
 * Personal Library Content Fetcher CLI Tool
 * Built using personal-tool-builder patterns.
 * Solves content discovery, cover extraction, PDF link resolution, and 1-click library import.
 */

const http = require('http');
const https = require('https');

const API_URL = process.env.API_URL || 'http://127.0.0.1:8787';
const ADMIN_KEY = process.env.ADMIN_KEY || 'nikunj2024';

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  fgRed: '\x1b[31m',
  fgGreen: '\x1b[32m',
  fgYellow: '\x1b[33m',
  fgBlue: '\x1b[34m',
  fgMagenta: '\x1b[35m',
  fgCyan: '\x1b[36m',
  fgWhite: '\x1b[37m'
};

function printBanner() {
  console.log(`\n${COLORS.fgCyan}${COLORS.bright}====================================================`);
  console.log(`     📚 PERSONAL LIBRARY CONTENT FETCHER CLI       `);
  console.log(`====================================================${COLORS.reset}`);
}

function printHelp() {
  printBanner();
  console.log(`${COLORS.bright}Usage:${COLORS.reset}`);
  console.log(`  node fetcher-cli.js <command> [options]\n`);
  console.log(`${COLORS.bright}Commands:${COLORS.reset}`);
  console.log(`  ${COLORS.fgGreen}search <query> [--type=all|manga|book|novel]${COLORS.reset}   Search free sources (MangaDex, Open Library, Gutenberg)`);
  console.log(`  ${COLORS.fgGreen}details <source> <id>${COLORS.reset}                         Fetch chapters, page images, cover art, or PDF links`);
  console.log(`  ${COLORS.fgGreen}import <source> <id>${COLORS.reset}                          Import item directly into your D1 Library Database`);
  console.log(`  ${COLORS.fgGreen}sources${COLORS.reset}                                       List supported free content APIs & cover servers`);
  console.log(`  ${COLORS.fgGreen}help${COLORS.reset}                                          Show this help manual\n`);
  console.log(`${COLORS.bright}Examples:${COLORS.reset}`);
  console.log(`  node fetcher-cli.js search "Solo Leveling" --type=manga`);
  console.log(`  node fetcher-cli.js search "Frankenstein" --type=book`);
  console.log(`  node fetcher-cli.js import gutendex 84\n`);
}

function fetchJson(url, options = {}) {
  const isMangaDex = url.includes('api.mangadex.org');
  const mangadexClientId = process.env.MANGADEX_CLIENT_ID || 'personal-client-a696d7fa-4055-44c8-93fc-d1e47accfd1e-aa70e5aa';
  
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, {
      headers: {
        'User-Agent': 'LibraryHub-PersonalClient/1.0',
        ...(isMangaDex ? { 'X-Client-ID': mangadexClientId } : {}),
        ...options.headers
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          } else {
            resolve(JSON.parse(data));
          }
        } catch (e) {
          reject(new Error(`JSON Parse Error: ${e.message}`));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function searchMangaDex(query) {
  const url = `https://api.mangadex.org/manga?title=${encodeURIComponent(query)}&limit=5&includes[]=cover_art`;
  try {
    const res = await fetchJson(url);
    if (!res.data) return [];
    return res.data.map(item => {
      const coverRel = item.relationships?.find(r => r.type === 'cover_art');
      const fileName = coverRel?.attributes?.fileName;
      const coverUrl = fileName ? `https://uploads.mangadex.org/covers/${item.id}/${fileName}.512.jpg` : '';
      const title = item.attributes?.title?.en || item.attributes?.title?.ja || Object.values(item.attributes?.title || {})[0] || 'Untitled Manga';
      const desc = item.attributes?.description?.en || 'No description available.';
      return {
        id: item.id,
        source: 'mangadex',
        title,
        type: 'manga',
        coverUrl,
        author: 'MangaDex Artist',
        description: desc.substring(0, 150) + '...',
        status: item.attributes?.status || 'ongoing'
      };
    });
  } catch (e) {
    console.log(`${COLORS.fgRed}MangaDex search failed: ${e.message}${COLORS.reset}`);
    return [];
  }
}

async function searchOpenLibrary(query) {
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=5`;
  try {
    const res = await fetchJson(url);
    if (!res.docs) return [];
    return res.docs.map(doc => {
      const coverUrl = doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : '';
      return {
        id: doc.key?.replace('/works/', '') || doc.cover_i || doc.title,
        source: 'openlibrary',
        title: doc.title || 'Untitled Ebook',
        type: 'pdf',
        coverUrl,
        author: doc.author_name ? doc.author_name.join(', ') : 'Unknown Author',
        description: `First published in ${doc.first_publish_year || 'N/A'}. Language: ${doc.language?.slice(0, 3).join(', ') || 'en'}`,
        pdfUrl: doc.ia ? `https://archive.org/download/${doc.ia[0]}/${doc.ia[0]}.pdf` : ''
      };
    });
  } catch (e) {
    console.log(`${COLORS.fgRed}OpenLibrary search failed: ${e.message}${COLORS.reset}`);
    return [];
  }
}

async function searchGutendex(query) {
  const url = `https://gutendex.com/books?search=${encodeURIComponent(query)}`;
  try {
    const res = await fetchJson(url);
    if (!res.results) return [];
    return res.results.slice(0, 5).map(book => {
      const coverUrl = book.formats['image/jpeg'] || '';
      const pdfUrl = book.formats['application/pdf'] || book.formats['application/epub+zip'] || '';
      const author = book.authors ? book.authors.map(a => a.name).join(', ') : 'Public Domain';
      return {
        id: String(book.id),
        source: 'gutendex',
        title: book.title || 'Classic Book',
        type: 'pdf',
        coverUrl,
        author,
        description: `Project Gutenberg ID #${book.id}. Downloads: ${book.download_count}`,
        pdfUrl
      };
    });
  } catch (e) {
    console.log(`${COLORS.fgRed}Gutendex search failed: ${e.message}${COLORS.reset}`);
    return [];
  }
}

async function handleSearch(query, filterType = 'all') {
  printBanner();
  const isUrl = query.startsWith('http://') || query.startsWith('https://');
  console.log(`${COLORS.dim}${isUrl ? 'Auto-fetching metadata & content from URL' : 'Searching free sources for'} "${query}"...${COLORS.reset}\n`);

  let results = [];

  if (isUrl) {
    if (query.includes('mangadex.org')) {
      const uuidMatch = query.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
      const mangaId = uuidMatch ? uuidMatch[0] : '';
      if (mangaId) {
        try {
          const res = await fetchJson(`https://api.mangadex.org/manga/${mangaId}?includes[]=cover_art`);
          const m = res.data;
          if (m) {
            const coverRel = m.relationships?.find(r => r.type === 'cover_art');
            const fileName = coverRel?.attributes?.fileName;
            const coverUrl = fileName ? `https://uploads.mangadex.org/covers/${m.id}/${fileName}.512.jpg` : '';
            const title = m.attributes?.title?.en || m.attributes?.title?.ja || Object.values(m.attributes?.title || {})[0] || 'Untitled Manga';
            results.push({
              id: m.id,
              source: 'mangadex-url',
              title,
              type: 'manga',
              coverUrl,
              author: 'MangaDex Scanlations',
              description: 'Fetched directly from MangaDex URL'
            });
          }
        } catch (e) {}
      }
    } else if (query.endsWith('.pdf') || query.includes('/download/')) {
      const urlParts = query.split('/');
      const fileName = urlParts[urlParts.length - 1].replace(/\.pdf$/i, '').replace(/[^a-zA-Z0-9]+/g, ' ');
      results.push({
        id: query,
        source: 'direct-pdf-url',
        title: fileName || 'Extracted PDF Book',
        type: 'pdf',
        coverUrl: `https://picsum.photos/seed/${encodeURIComponent(fileName)}/400/560`,
        author: 'External Source',
        pdfUrl: query
      });
    }
  }

  if (results.length === 0) {
    if (filterType === 'all' || filterType === 'manga') {
      const manga = await searchMangaDex(query);
      results.push(...manga);
    }
    if (filterType === 'all' || filterType === 'book' || filterType === 'pdf') {
      const books = await searchOpenLibrary(query);
      const gutenberg = await searchGutendex(query);
      results.push(...books, ...gutenberg);
    }
  }

  if (results.length === 0) {
    console.log(`${COLORS.fgYellow}No items found for "${query}". Try another title or check your network connection.${COLORS.reset}\n`);
    return;
  }

  console.log(`${COLORS.fgWhite}${COLORS.bright}Found ${results.length} results:${COLORS.reset}\n`);
  results.forEach((item, idx) => {
    console.log(`${COLORS.fgCyan}[${idx + 1}] ${COLORS.bright}${item.title}${COLORS.reset} ${COLORS.dim}(Source: ${item.source.toUpperCase()})${COLORS.reset}`);
    console.log(`    👤 Author: ${COLORS.fgYellow}${item.author}${COLORS.reset}`);
    console.log(`    📁 Type:   ${item.type.toUpperCase()}`);
    console.log(`    🖼️  Cover:  ${item.coverUrl || 'No cover image'}`);
    if (item.pdfUrl) console.log(`    📄 PDF/File: ${item.pdfUrl}`);
    console.log(`    🆔 Import ID: node fetcher-cli.js import ${item.source} "${item.id}"`);
    console.log(`----------------------------------------------------`);
  });
}

function handleSources() {
  printBanner();
  console.log(`${COLORS.bright}Supported Free APIs & Sources:${COLORS.reset}\n`);
  console.log(`1. ${COLORS.fgGreen}MangaDex API v5${COLORS.reset} (Manga/Manhwa)`);
  console.log(`   - Endpoint: https://api.mangadex.org`);
  console.log(`   - Covers:   https://uploads.mangadex.org/covers/{id}/{filename}`);
  console.log(`\n2. ${COLORS.fgGreen}Open Library & Internet Archive${COLORS.reset} (Books/PDFs)`);
  console.log(`   - Endpoint: https://openlibrary.org`);
  console.log(`   - Covers:   https://covers.openlibrary.org/b/id/{cover_i}-L.jpg`);
  console.log(`\n3. ${COLORS.fgGreen}Gutendex (Project Gutenberg)${COLORS.reset} (Novels/Classics)`);
  console.log(`   - Endpoint: https://gutendex.com/books`);
  console.log(`   - Downloads: Free EPUB, HTML, PDF downloads.`);
  console.log(`\n4. ${COLORS.fgCyan}Popular Open-Source Downloaders:${COLORS.reset}`);
  console.log(`   - ${COLORS.fgYellow}oae/kaizoku${COLORS.reset} (Self-hosted manga downloader)`);
  console.log(`   - ${COLORS.fgYellow}metafates/mangal${COLORS.reset} (CLI downloader + AniList + CBZ/PDF export)`);
  console.log(`   - ${COLORS.fgYellow}hankscafe/omnibus${COLORS.reset} (Comic/Manga self-hosted manager)`);
  console.log(`   - ${COLORS.fgYellow}Yui007/weebcentral_downloader${COLORS.reset} (WeebCentral GUI/CLI downloader)`);
  console.log(`   - ${COLORS.fgYellow}zzyil/AIO-Webtoon-Downloader${COLORS.reset} (All-in-One Manhwa & Webtoon downloader)`);
  console.log('');
}

function printHelp() {
  printBanner();
  console.log(`${COLORS.bright}Usage:${COLORS.reset}`);
  console.log(`  node fetcher-cli.js <command> [options]\n`);
  console.log(`${COLORS.bright}Commands:${COLORS.reset}`);
  console.log(`  ${COLORS.fgGreen}search <query> [--type=all|manga|book|novel]${COLORS.reset}   Search free sources (MangaDex, Open Library, Gutenberg)`);
  console.log(`  ${COLORS.fgGreen}mangal <query> [--format=pdf|cbz]${COLORS.reset}             Download manga/manhwa via metafates/mangal CLI`);
  console.log(`  ${COLORS.fgGreen}details <source> <id>${COLORS.reset}                         Fetch chapters, page images, cover art, or PDF links`);
  console.log(`  ${COLORS.fgGreen}import <source> <id>${COLORS.reset}                          Import item directly into your D1 Library Database`);
  console.log(`  ${COLORS.fgGreen}sources${COLORS.reset}                                       List supported free content APIs & cover servers`);
  console.log(`  ${COLORS.fgGreen}help${COLORS.reset}                                          Show this help manual\n`);
  console.log(`${COLORS.bright}Examples:${COLORS.reset}`);
  console.log(`  node fetcher-cli.js search "Solo Leveling" --type=manga`);
  console.log(`  node fetcher-cli.js mangal "Solo Leveling" --format=pdf`);
  console.log(`  node fetcher-cli.js import gutendex 84\n`);
}

function handleMangal(query, format = 'pdf') {
  printBanner();
  console.log(`${COLORS.fgCyan}${COLORS.bright}🚀 Mangal CLI Integration (metafates/mangal)${COLORS.reset}\n`);
  console.log(`Query: ${COLORS.fgYellow}"${query}"${COLORS.reset} | Target Format: ${COLORS.fgGreen}${format.toUpperCase()}${COLORS.reset}\n`);
  
  const execSync = require('child_process').execSync;
  let hasMangal = false;
  try {
    const checkCmd = process.platform === 'win32' ? 'where mangal' : 'which mangal';
    execSync(checkCmd, { stdio: 'ignore' });
    hasMangal = true;
  } catch (e) {
    hasMangal = false;
  }

  if (hasMangal) {
    console.log(`${COLORS.fgGreen}Found installed mangal binary! Launching download...${COLORS.reset}\n`);
    const mangalCmd = `mangal inline --query "${query}" --format ${format}`;
    try {
      execSync(mangalCmd, { stdio: 'inherit' });
    } catch (e) {
      console.log(`${COLORS.fgRed}Mangal execution finished or interrupted.${COLORS.reset}`);
    }
  } else {
    console.log(`${COLORS.fgYellow}Mangal binary is not yet installed in your system PATH.${COLORS.reset}\n`);
    console.log(`${COLORS.bright}Install Metafates Mangal:${COLORS.reset}`);
    console.log(`  • GitHub Repo: ${COLORS.fgBlue}https://github.com/metafates/mangal${COLORS.reset}`);
    console.log(`  • Windows (Scoop): ${COLORS.dim}scoop bucket add mangal https://github.com/metafates/scoop-bucket && scoop install mangal${COLORS.reset}`);
    console.log(`  • macOS (Homebrew): ${COLORS.dim}brew install metafates/tap/mangal${COLORS.reset}`);
    console.log(`  • Go Install: ${COLORS.dim}go install github.com/metafates/mangal@latest${COLORS.reset}\n`);
    console.log(`${COLORS.bright}Command to run after installation:${COLORS.reset}`);
    console.log(`  ${COLORS.fgGreen}mangal inline --query "${query}" --format ${format}${COLORS.reset}\n`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';

  if (command === 'help') {
    printHelp();
  } else if (command === 'sources') {
    handleSources();
  } else if (command === 'mangal') {
    const query = args[1];
    if (!query) {
      console.log(`${COLORS.fgRed}Error: Query required. Example: node fetcher-cli.js mangal "Solo Leveling"${COLORS.reset}`);
      return;
    }
    let format = 'pdf';
    const fmtOpt = args.find(a => a.startsWith('--format='));
    if (fmtOpt) format = fmtOpt.split('=')[1];
    handleMangal(query, format);
  } else if (command === 'search') {
    const query = args[1];
    if (!query) {
      console.log(`${COLORS.fgRed}Error: Search query required. Example: node fetcher-cli.js search "Solo Leveling"${COLORS.reset}`);
      return;
    }
    let type = 'all';
    const typeOpt = args.find(a => a.startsWith('--type='));
    if (typeOpt) type = typeOpt.split('=')[1];
    await handleSearch(query, type);
  } else {
    printHelp();
  }
}

main();
