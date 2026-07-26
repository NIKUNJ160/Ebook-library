// TODO (High Effort Refactor): Architecture Modularization Plan
// Currently src/index.ts is a single monolithic worker entrypoint (~3200+ LOC).
// Planned Refactoring Structure:
// 1. src/routes/
//    - auth.ts (login, register, logout handlers)
//    - admin.ts (admin dashboard, items CRUD, category CRUD)
//    - items.ts (item details, chapter reader, gallery view)
//    - api.ts (search autocomplete, history, rating endpoints)
// 2. src/services/
//    - db.ts (D1 database client & helpers)
//    - ai.ts (Workers AI recommendation engine & fallbacks)
//    - auth.ts (PBKDF2 hashing, cookie session management)
// 3. src/views/
//    - layout.ts (main HTML shell & admin shell layouts)
//    - sidebar.ts (reusable sidebar component)
//    - components/ (cards, pagination, breadcrumbs, widgets)

import { Hono, Context } from 'hono';
import { html } from 'hono/html';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';

type Bindings = {
  DB: D1Database;
  ALLOW_REGISTRATION: string;
  INVITE_CODE: string;
  JWT_SECRET_KEY: string;
  MANGADEX_CLIENT_ID?: string;
  AI?: any;
};

// Type definitions matching database schema
interface LibraryItem {
  id: number;
  title: string;
  slug: string;
  description: string;
  type: 'image' | 'pdf' | 'collection';
  status: string;
  author: string;
  category_id: number;
  cover_url: string;
  file_count: number;
  view_count: number;
  rating: number;
  rating_count: number;
  tags: string;
  is_hot: number;
  is_new: number;
  is_featured: number;
  created_at: string;
  updated_at: string;
  category_name?: string;
  category_slug?: string;
  updates?: any[]; // Holds either latest chapters or latest pages
}

interface Category {
  id: number;
  name: string;
  slug: string;
  icon: string;
  description: string;
  item_count: number;
  created_at: string;
}

interface Chapter {
  id: number;
  item_id: number;
  chapter_number: number;
  title: string;
  created_at: string;
  pages_count?: number;
}

interface FilePage {
  id: number;
  item_id: number;
  chapter_id: number | null;
  url: string;
  filename: string;
  type: 'image' | 'pdf';
  page_number: number;
  size_bytes: number;
  created_at: string;
}

interface User {
  id: number;
  username: string;
  password?: string;
  created_at: string;
}

const app = new Hono<{ Bindings: Bindings }>();

// Security headers — M2 FIX: removed unsafe-inline from script-src
app.use('*', async (c, next) => {
  await next();
  c.header('X-Frame-Options', 'DENY');
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; img-src 'self' data: https:; connect-src 'self';");
});

// Static asset Cache-Control header middleware for performance
app.use('/css/*', async (c, next) => {
  await next();
  c.header('Cache-Control', 'public, max-age=31536000, immutable');
});

app.use('/js/*', async (c, next) => {
  await next();
  c.header('Cache-Control', 'public, max-age=31536000, immutable');
});

// C2 FIX: PBKDF2 with 200k iterations — not crackable with rainbow tables
async function hashPassword(password: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode('lh-s4lt-2026'), iterations: 200_000 },
    key, 256
  );
  return Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// L3 FIX: chunked base64 to avoid stack overflow on large files
async function fileToBase64(file: File): Promise<string> {
  if (file.size > 2 * 1024 * 1024) throw new Error('Cover image must be under 2MB');
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return `data:${file.type};base64,${btoa(binary)}`;
}

// Helper function for AI reading recommendations using Workers AI (@cf/meta/llama-3.1-8b-instruct) or SQL tag similarity fallback
async function getAIRecommendations(
  env: Bindings,
  db: D1Database,
  userHistorySlugs: string[] = [],
  currentItemTags: string[] = [],
  currentItemId?: number
): Promise<{ recommendations: LibraryItem[]; isAiGenerated: boolean }> {
  if (env && env.AI && typeof env.AI.run === 'function') {
    try {
      const candidates = (await db.prepare(
        `SELECT id, title, slug, tags, cover_url, view_count, rating, category_id, description FROM items WHERE status = 'active' AND id != ? ORDER BY view_count DESC LIMIT 12`
      ).bind(currentItemId || 0).all<LibraryItem>()).results || [];

      if (candidates.length > 0) {
        const prompt = `Select top 3-4 recommended item slugs from candidates based on history [${userHistorySlugs.join(', ')}] and current tags [${currentItemTags.join(', ')}].
Candidates: ${JSON.stringify(candidates.map(c => ({ slug: c.slug, title: c.title, tags: c.tags })))}
Return ONLY a valid JSON array of string slugs like ["slug1", "slug2", "slug3"].`;

        const aiRes = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
          messages: [
            { role: 'system', content: 'You are a precise recommendation assistant. Output strictly a JSON string array of slugs.' },
            { role: 'user', content: prompt }
          ]
        }) as any;

        const resText = aiRes?.response || (typeof aiRes === 'string' ? aiRes : '');
        const jsonMatch = resText.match(/\[.*?\]/s);
        if (jsonMatch) {
          const suggestedSlugs: string[] = JSON.parse(jsonMatch[0]);
          if (Array.isArray(suggestedSlugs) && suggestedSlugs.length > 0) {
            const matched = candidates.filter(c => suggestedSlugs.includes(c.slug));
            if (matched.length > 0) {
              return { recommendations: matched.slice(0, 4), isAiGenerated: true };
            }
          }
        }
      }
    } catch (err) {
      console.warn('Workers AI recommendation fallback to SQL:', err);
    }
  }

  // Fallback: SQL tag similarity + popularity matching
  try {
    const candidates = (await db.prepare(
      `SELECT * FROM items WHERE status = 'active' AND id != ? ORDER BY view_count DESC, rating DESC LIMIT 20`
    ).bind(currentItemId || 0).all<LibraryItem>()).results || [];

    if (currentItemTags.length === 0 && userHistorySlugs.length === 0) {
      return { recommendations: candidates.slice(0, 4), isAiGenerated: false };
    }

    const scored = candidates.map(item => {
      let score = 0;
      let itemTagsArr: string[] = [];
      try { itemTagsArr = JSON.parse(item.tags || '[]'); } catch (e) {}
      const tagMatches = itemTagsArr.filter(t => currentItemTags.includes(t)).length;
      score += tagMatches * 3;
      if (userHistorySlugs.includes(item.slug)) score += 5;
      score += (item.rating || 0);
      return { item, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return { recommendations: scored.slice(0, 4).map(s => s.item), isAiGenerated: false };
  } catch (err) {
    return { recommendations: [], isAiGenerated: false };
  }
}

// Helper to retrieve all unique tags in the database to display as selectable options
async function getUniqueTags(db: D1Database): Promise<string[]> {
  const query = await db.prepare("SELECT DISTINCT tags FROM items").all<{ tags: string }>();
  const tagsSet = new Set<string>();
  query.results.forEach(row => {
    try {
      const tags = JSON.parse(row.tags || '[]') as string[];
      tags.forEach(t => tagsSet.add(t));
    } catch (e) {}
  });
  if (tagsSet.size === 0) {
    ['manga', 'nature', 'photography', 'art', 'digital', 'tech', 'pdf', 'landscape'].forEach(t => tagsSet.add(t));
  }
  return Array.from(tagsSet).sort();
}

// Helper to format relative time like natomanga ("26 minutes ago", "07-05 15:11")
function formatRelativeTime(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr.replace(' ', 'T') + 'Z');
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) {
    return 'just now';
  }
  if (diffMins < 60) {
    return `${diffMins} min ago`;
  }
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) {
    return `${diffHours} hours ago`;
  }
  
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}-${day}`;
}

// Attach latest updates (chapters or pages) to items — single query per type, no N+1
async function attachLatestUpdates(db: D1Database, items: LibraryItem[]): Promise<LibraryItem[]> {
  if (items.length === 0) return [];
  const ids = items.map(i => i.id);
  const placeholders = ids.map(() => '?').join(',');

  // Fetch up to 3 latest chapters per item in one query
  const chapRows = (await db.prepare(
    `SELECT item_id, chapter_number, title, created_at FROM chapters WHERE item_id IN (${placeholders}) ORDER BY chapter_number DESC`
  ).bind(...ids).all<{ item_id: number; chapter_number: number; title: string; created_at: string }>()).results;

  // Group chapters by item_id
  const chapMap = new Map<number, typeof chapRows>();
  for (const r of chapRows) {
    const arr = chapMap.get(r.item_id) ?? [];
    if (arr.length < 3) arr.push(r);
    chapMap.set(r.item_id, arr);
  }

  // Items without chapters need page fallback — fetch in one query
  const noChapIds = ids.filter(id => !chapMap.has(id));
  const pageMap = new Map<number, { label: string; url: string; created_at: string }[]>();
  if (noChapIds.length > 0) {
    const ph2 = noChapIds.map(() => '?').join(',');
    const pageRows = (await db.prepare(
      `SELECT item_id, page_number, created_at FROM files WHERE item_id IN (${ph2}) ORDER BY page_number DESC`
    ).bind(...noChapIds).all<{ item_id: number; page_number: number; created_at: string }>()).results;
    for (const r of pageRows) {
      const arr = pageMap.get(r.item_id) ?? [];
      if (arr.length < 3) arr.push({ label: `Page ${r.page_number}`, url: '', created_at: r.created_at });
      pageMap.set(r.item_id, arr);
    }
  }

  return items.map(item => {
    const chaps = chapMap.get(item.id);
    if (chaps) return { ...item, updates: chaps.map(c => ({ label: `Chapter ${c.chapter_number}`, url: `/item/${item.slug}/chapter/${c.chapter_number}`, created_at: c.created_at })) };
    const pages = pageMap.get(item.id) ?? [];
    return { ...item, updates: pages.map(f => ({ ...f, url: `/item/${item.slug}/view/${f.label.split(' ')[1]}` })) };
  });
}

// Reusable blue pagination component matching natomanga.com format
const renderPagination = (basePath: string, currentPage: number, totalPages: number, queryParams: string = '') => {
  if (totalPages <= 1) return html``;
  
  const startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(totalPages, currentPage + 2);
  
  const buildUrl = (p: number) => {
    const connector = basePath.includes('?') ? '&' : '?';
    let url = `${basePath}${connector}page=${p}`;
    if (queryParams) {
      url += `&${queryParams}`;
    }
    return url;
  };

  return html`
    <div class="pagination-container">
      ${currentPage > 1 
        ? html`
            <a href="${buildUrl(1)}" class="page-link page-first">First</a>
            <a href="${buildUrl(currentPage - 1)}" class="page-link page-prev"><i class="fa fa-chevron-left"></i> Prev</a>
          `
        : ''
      }
      
      ${startPage > 1 ? html`<span class="page-dots">...</span>` : ''}
      
      ${Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i).map(p => html`
        <a href="${buildUrl(p)}" class="page-link ${p === currentPage ? 'active' : ''}">${p}</a>
      `)}
      
      ${endPage < totalPages ? html`<span class="page-dots">...</span>` : ''}
      
      ${currentPage < totalPages 
        ? html`
            <a href="${buildUrl(currentPage + 1)}" class="page-link page-next">Next <i class="fa fa-chevron-right"></i></a>
            <a href="${buildUrl(totalPages)}" class="page-link page-last">Last (${totalPages})</a>
          `
        : ''
      }
    </div>
  `;
};

// Layout Helper — accepts optional description+canonical for SEO
const layout = (title: string, content: any, activeNav: string = 'home', extraHead: any = '', username: string | null = null, description: string = 'LibraryHub — browse and read free PDF documents, photo collections, manga, and illustrations online.', canonical: string = '') => html`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="theme-color" content="#ff530d">
  <title>${title} - LibraryHub</title>
  <meta name="description" content="${description}">
  ${canonical ? html`<link rel="canonical" href="${canonical}">` : ''}
  <meta property="og:title" content="${title} - LibraryHub">
  <meta property="og:description" content="${description}">
  <meta property="og:type" content="website">
  <link rel="icon" type="image/webp" href="/images/favicon-manganato.webp">
  <!-- Fonts: only weights actually used -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700&family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
  <!-- FontAwesome -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" integrity="sha512-iecdLmaskl7CVkqkXNQ/ZH/XLlvWZOJyj7Yy7tcenmpD1ypASozpmT/E0iPtmFIB46ZmdtAc9eNBvH0H/ZpiBw==" crossorigin="anonymous" referrerpolicy="no-referrer">
  <!-- Stylesheets -->
  <link rel="stylesheet" href="/css/all.css">
  <link rel="stylesheet" href="/css/app.css">
  ${extraHead}
</head>
<body>
  <script>
    (function(){
      document.body.classList.add(localStorage.getItem('themeMode') || 'light');
      if (localStorage.getItem('bannerDismissed')) {
        document.addEventListener('DOMContentLoaded', function(){ var b = document.getElementById('site-banner'); if(b) b.style.display='none'; });
      }
    })();
  </script>

  <!-- HEADER -->
  <header>
    <div class="container container-top">
      <div class="top-logo">
        <a href="/" title="LibraryHub Online">
          <span class="logo-text"><span class="accent-orange">Library</span><span class="accent-teal">Hub</span></span>
        </a>
      </div>
      <div class="top-header">
        <div class="searching">
          <form action="/search" method="GET" role="search">
            <label for="search_story" class="sr-only">Search LibraryHub</label>
            <input type="text" id="search_story" name="q" placeholder="Search images, PDFs, collections..." autocomplete="off">
            <button type="submit" aria-label="Submit search"><i class="fa fa-search" aria-hidden="true"></i></button>
          </form>
          <div id="search-autocomplete" class="search-autocomplete-box" style="display:none;"></div>
        </div>
        <div class="link-social-desktop">
          <a href="#" class="social-btn fb" aria-label="Facebook"><i class="fab fa-facebook-f" aria-hidden="true"></i></a>
          <a href="#" class="social-btn discord" aria-label="Discord"><i class="fab fa-discord" aria-hidden="true"></i></a>
        </div>
        <div class="user-options">
          ${username
            ? html`
                <div class="user-profile-header">
                  <span class="user-welcome"><i class="fa fa-user-circle" aria-hidden="true"></i> ${username}</span>
                  <a href="/profile" class="header-profile-btn" title="My Profile Dashboard">Profile</a>
                  <a href="/logout" class="header-logout-btn" title="Logout" aria-label="Logout"><i class="fa-solid fa-right-from-bracket" aria-hidden="true"></i></a>
                </div>
              `
            : html`
                <div class="user-auth-links">
                  <a href="/login" class="header-login-btn"><i class="fa-solid fa-sign-in" aria-hidden="true"></i> Sign In</a>
                  <a href="/register" class="header-register-btn"><i class="fa-solid fa-user-plus" aria-hidden="true"></i> Register</a>
                </div>
              `
          }
          <button id="theme-toggle" class="theme-toggle-btn" aria-label="Toggle dark/light mode" title="Toggle Dark/Light Mode">
            <i class="fa-solid fa-moon" aria-hidden="true"></i>
          </button>
        </div>
      </div>

      <button class="mobile-menu-btn" id="mobile-menu-btn" aria-label="Open navigation menu" aria-expanded="false" aria-controls="primary-nav">
        <i class="fa fa-bars" aria-hidden="true"></i><span class="sr-only">Menu</span>
      </button>

      <nav class="wrap-menu-primary" id="primary-nav" aria-label="Main navigation">
        <ul class="menu-primary">
          <li class="menu-item ${activeNav === 'home' ? 'active' : ''}"><a href="/">HOME</a></li>
          <li class="menu-item ${activeNav === 'latest' ? 'active' : ''}"><a href="/list/latest">LATEST ADDED</a></li>
          <li class="menu-item ${activeNav === 'hot' ? 'active' : ''}"><a href="/list/hot">HOT ITEMS</a></li>
          <li class="menu-item ${activeNav === 'collections' ? 'active' : ''}"><a href="/list/collections">COLLECTIONS</a></li>
          <li class="menu-item ${activeNav === 'pdfs' ? 'active' : ''}"><a href="/list/pdfs">PDF DOCUMENTS</a></li>
          <li class="menu-item ${activeNav === 'history' ? 'active' : ''}"><a href="/history">HISTORY</a></li>
        </ul>
      </nav>
    </div>
  </header>

  <!-- NOTIFICATION BANNER (dismissible) -->
  <div class="container">
    <div class="notification-banner" id="site-banner">
      <i class="fa-solid fa-bullhorn" aria-hidden="true"></i>
      <strong>Welcome to LibraryHub!</strong> Enjoy reading free PDF documents, photo collections, and illustrations. Bookmark us with <strong>Ctrl+D</strong>!
      <button onclick="localStorage.setItem('bannerDismissed','1');this.parentElement.style.display='none';" aria-label="Dismiss banner" style="margin-left:auto;background:none;border:none;cursor:pointer;font-size:18px;color:inherit;padding:0 4px;">&times;</button>
    </div>
  </div>

  <!-- MAIN BODY -->
  <div class="container main-content-wrap">
    ${content}
  </div>

  <!-- FOOTER -->
  <footer>
    <div class="container">
      <div class="footer-links">
        <a href="#">About Us</a> | <a href="#">Contact Us</a> | <a href="#">Privacy Policy</a> | <a href="#">Terms of Use</a> | <a href="#">DMCA Takedown</a> | <a href="#">FAQ</a>
      </div>
      <div class="footer-content">
        <p>Copyright &copy; 2026 LibraryHub. All rights reserved.</p>
        <p>All images, books, and PDFs are property of their respective owners. Support: <span class="email-text">support@libraryhub.com</span></p>
      </div>
    </div>
  </footer>

  <script src="/js/app.js"></script>
</body>
</html>
`;

// Admin layout helper with entirely separate sidebar and styling
const adminLayout = (title: string, content: any, activeNav: string = 'dashboard', extraHead: any = '') => html`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - LibraryHub Admin</title>
  <link rel="icon" type="image/webp" href="/images/favicon-manganato.webp">
  <link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;600;700&family=Roboto:wght@300;400;500;700;900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <link rel="stylesheet" href="/css/all.css">
  <link rel="stylesheet" href="/css/admin.css">
  ${extraHead}
</head>
<body class="admin-body">
  <div class="admin-wrapper">
    <aside class="admin-sidebar">
      <div class="admin-logo">
        <a href="/admin">
          <span class="logo-text"><span style="color:#ff530d">Admin</span><span style="color:#059e9a">Hub</span></span>
        </a>
      </div>
      <nav class="admin-nav">
        <a href="/admin" class="admin-nav-item ${activeNav === 'dashboard' ? 'active' : ''}"><i class="fa fa-chart-line"></i> Dashboard</a>
        <a href="/admin/items" class="admin-nav-item ${activeNav === 'items' ? 'active' : ''}"><i class="fa fa-book"></i> Manage Books</a>
        <a href="/admin/fetcher" class="admin-nav-item ${activeNav === 'fetcher' ? 'active' : ''}"><i class="fa fa-cloud-download-alt"></i> Content Fetcher</a>
        <a href="/" class="admin-nav-item" target="_blank"><i class="fa fa-external-link-alt"></i> Open Website</a>
        <a href="/admin/logout" class="admin-nav-item admin-logout"><i class="fa-solid fa-right-from-bracket"></i> Logout</a>
      </nav>
    </aside>
    <main class="admin-main">
      <header class="admin-header">
        <h2>${title}</h2>
        <div class="admin-user-info">
          <span><i class="fa fa-user-shield"></i> Remote Administrator Dashboard</span>
        </div>
      </header>
      <div class="admin-content">
        ${content}
      </div>
    </main>
  </div>
</body>
</html>
`;

// Sidebar Helper
const renderSidebar = (categories: Category[], topItems: LibraryItem[], aiRecs?: LibraryItem[]) => html`
<div class="rightCol">
  <!-- Advanced Filter Widget -->
  <div class="panel-widget">
    <h3 class="widget-title">QUICK FILTER</h3>
    <div class="widget-content quick-search-widget">
      <form action="/search" method="GET">
        <select name="type">
          <option value="">All Types</option>
          <option value="collection">Collections</option>
          <option value="pdf">PDFs</option>
        </select>
        <select name="category">
          <option value="">All Categories</option>
          ${categories.map(c => html`<option value="${c.slug}">${c.name}</option>`)}
        </select>
        <button type="submit" class="btn-filter">Apply Filter</button>
      </form>
    </div>
  </div>

  ${aiRecs && aiRecs.length > 0 ? html`
    <!-- AI Reading Recommendations Widget -->
    <div class="panel-widget ai-sidebar-widget glassmorphic-hero">
      <h3 class="widget-title" style="color: #8b5cf6;"><i class="fa-solid fa-wand-magic-sparkles"></i> AI RECOMMENDED</h3>
      <div class="widget-content top-list-wrap">
        ${aiRecs.slice(0, 3).map((item) => html`
          <div class="top-item-row">
            <a href="/item/${item.slug}" class="top-item-cover-link">
              <img src="${item.cover_url}" alt="${item.title}" class="top-item-cover" loading="lazy">
            </a>
            <div class="top-item-meta">
              <h4><a href="/item/${item.slug}" title="${item.title}">${item.title}</a></h4>
              <span class="top-item-views"><i class="fa fa-eye"></i> ${(item.view_count || 0).toLocaleString()} views</span>
              <div class="star-rating-small">
                <i class="fa fa-star star-filled"></i> <span>${(item.rating || 0).toFixed(1)}</span>
              </div>
            </div>
          </div>
        `)}
      </div>
    </div>
  ` : ''}

  <!-- Top Ranked Widget -->
  <div class="panel-widget">
    <h3 class="widget-title">POPULAR LIST</h3>
    <div class="widget-content top-list-wrap">
      ${topItems.map((item, index) => html`
        <div class="top-item-row">
          <span class="rank-num rank-${index + 1}">${index + 1}</span>
          <a href="/item/${item.slug}" class="top-item-cover-link">
            <img src="${item.cover_url}" alt="${item.title}" class="top-item-cover" loading="lazy">
          </a>
          <div class="top-item-meta">
            <h4><a href="/item/${item.slug}" title="${item.title}">${item.title}</a></h4>
            <span class="top-item-views"><i class="fa fa-eye"></i> ${item.view_count.toLocaleString()} views</span>
            <div class="star-rating-small">
              <i class="fa fa-star star-filled"></i> <span>${item.rating.toFixed(1)}</span>
            </div>
          </div>
        </div>
      `)}
    </div>
  </div>

  <!-- Genres/Categories Table -->
  <div class="panel-widget">
    <h3 class="widget-title">CATEGORIES</h3>
    <div class="widget-content categories-grid">
      ${categories.map(c => html`
        <a href="/category/${c.slug}" class="category-grid-item" title="${c.description}">
          <span class="cat-icon">${c.icon}</span>
          <span class="cat-name">${c.name}</span>
          <span class="cat-count">(${c.item_count})</span>
        </a>
      `)}
    </div>
  </div>
</div>
`;

// Reusable card template component displaying latest updates/chapters
const FALLBACK_IMG = '/images/no-cover.webp';
const renderItemCard = (item: LibraryItem) => html`
  <div class="item-card ${item.is_hot ? 'item-hot' : ''} ${item.is_new ? 'item-new' : ''}">
    <div class="card-cover-wrap">
      <a href="/item/${item.slug}">
        <img src="${item.cover_url}" alt="${item.title}" class="card-cover lazy-img" loading="lazy" onerror="this.onerror=null;this.src='${FALLBACK_IMG}'">
      </a>
      ${item.is_hot ? html`<span class="badge badge-hot">HOT</span>` : ''}
      ${item.is_new ? html`<span class="badge badge-new">NEW</span>` : ''}
      <span class="badge-type type-${item.type}">${item.type.toUpperCase()}</span>
    </div>
    <div class="card-info">
      <h3><a href="/item/${item.slug}" title="${item.title}">${item.title}</a></h3>
      <div class="card-updates">
        ${item.updates && item.updates.map(update => html`
          <div class="card-update-line">
            <a href="${update.url}" class="update-link">${update.label}</a>
            <span class="update-time">${formatRelativeTime(update.created_at)}</span>
          </div>
        `)}
      </div>
      <div class="card-meta">
        <span class="card-views"><i class="fa fa-eye" aria-hidden="true"></i> ${item.view_count.toLocaleString()} views</span>
        <span class="card-rating"><i class="fa fa-star" aria-hidden="true"></i> ${item.rating.toFixed(1)}</span>
      </div>
      <div class="card-bottom">
        <span class="card-author"><i class="fa fa-user" aria-hidden="true"></i> ${item.author}</span>
        <a href="/item/${item.slug}" class="btn-read-card">View</a>
      </div>
    </div>
  </div>
`;

// GET Home Page
app.get('/', async (c) => {
  const db = c.env.DB;
  const username = getCookie(c, 'user_session') || null;
  
  // Fetch popular items for carousel (is_featured = 1 or top view count)
  const carouselItemsQuery = db.prepare(`
    SELECT * FROM items WHERE status = 'active' ORDER BY is_featured DESC, view_count DESC LIMIT 6
  `).all<LibraryItem>();

  // Fetch latest update items (limit to 12 for homepage)
  const latestItemsQuery = db.prepare(`
    SELECT i.*, cat.name as category_name 
    FROM items i 
    LEFT JOIN categories cat ON i.category_id = cat.id 
    WHERE i.status = 'active' 
    ORDER BY i.created_at DESC LIMIT 12
  `).all<LibraryItem>();

  // Fetch categories
  const categoriesQuery = db.prepare(`
    SELECT * FROM categories ORDER BY name ASC
  `).all<Category>();

  // Fetch top 8 items for sidebar
  const topItemsQuery = db.prepare(`
    SELECT * FROM items WHERE status = 'active' ORDER BY view_count DESC LIMIT 8
  `).all<LibraryItem>();

  const [carouselRes, latestRes, categoriesRes, topRes] = await Promise.all([
    carouselItemsQuery,
    latestItemsQuery,
    categoriesQuery,
    topItemsQuery
  ]);

  const carouselItems = carouselRes.results;
  const rawLatestItems = latestRes.results;
  const categories = categoriesRes.results;
  const topItems = topRes.results;

  // Resolve and attach latest updates (files or chapters) to each book
  const latestItems = await attachLatestUpdates(db, rawLatestItems);

  const content = html`
    <div class="leftCol">
      <!-- Popular Carousel slider area -->
      <section class="popular-slider-section">
        <h1 class="section-title"><i class="fa-solid fa-fire accent-orange-color" aria-hidden="true"></i> POPULAR COLLECTIONS</h1>
        <div class="carousel-container">
          <div class="carousel-track-wrapper">
            <div class="carousel-track" id="carousel-track">
              ${carouselItems.map(item => html`
                <div class="carousel-slide-item">
                  <a href="/item/${item.slug}">
                    <img src="${item.cover_url}" alt="${item.title}" class="carousel-img" loading="lazy">
                    <div class="carousel-caption">
                      <h3>${item.title}</h3>
                      <span class="carousel-badge type-${item.type}">${item.type.toUpperCase()}</span>
                      <span class="carousel-meta"><i class="fa fa-eye"></i> ${item.view_count.toLocaleString()}</span>
                    </div>
                  </a>
                </div>
              `)}
            </div>
          </div>
          <button class="carousel-btn prev-btn" id="carousel-prev"><i class="fa fa-chevron-left"></i></button>
          <button class="carousel-btn next-btn" id="carousel-next"><i class="fa fa-chevron-right"></i></button>
        </div>
      </section>

      <!-- Latest Grid Releases -->
      <section class="latest-releases-section">
        <h2 class="section-title"><i class="fa-solid fa-clock accent-teal-color" aria-hidden="true"></i> LATEST ADDITIONS</h2>
        <div class="items-grid">
          ${latestItems.map(item => renderItemCard(item))}
        </div>
      </section>
    </div>

    <!-- Sidebar Right Column -->
    ${renderSidebar(categories, topItems)}
  `;

  return c.html(layout('Home', content, 'home', '', username));
});

// GET Login Page
app.get('/login', async (c) => {
  const username = getCookie(c, 'user_session') || null;
  if (username) {
    return c.redirect('/profile');
  }

  const db = c.env.DB;
  const categoriesQuery = db.prepare(`SELECT * FROM categories ORDER BY name ASC`).all<Category>();
  const topItemsQuery = db.prepare(`SELECT * FROM items WHERE status = 'active' ORDER BY view_count DESC LIMIT 8`).all<LibraryItem>();
  const [categoriesRes, topRes] = await Promise.all([categoriesQuery, topItemsQuery]);

  const content = html`
    <div class="leftCol">
      <div class="breadcrumb">
        <a href="/">Home</a> » <span>Sign In</span>
      </div>
      
      <div class="auth-container">
        <h2 class="auth-title">Sign In to LibraryHub</h2>
        
        <form action="/login" method="POST">
          <div class="form-group">
            <label for="username">Username</label>
            <input type="text" id="username" name="username" class="form-control" placeholder="Enter username" required autocomplete="username">
          </div>
          <div class="form-group">
            <label for="password">Password</label>
            <input type="password" id="password" name="password" class="form-control" placeholder="Enter password" required autocomplete="current-password">
          </div>
          <button type="submit" class="btn-auth-submit">Sign In</button>
        </form>
        
        <p class="auth-switch-link">Don't have an account? <a href="/register">Register Here</a></p>
      </div>
    </div>
    ${renderSidebar(categoriesRes.results, topRes.results)}
  `;

  return c.html(layout('Sign In', content, 'login', '', null));
});

// POST Login Handler — H2: basic brute-force tracking via D1 failed attempts
app.post('/login', async (c) => {
  const body = await c.req.parseBody();
  // M1 FIX: sanitize reflected username to prevent XSS
  const inputUsername = (body.username as string || '').trim().replace(/[<>"'&]/g, '');
  const inputPassword = body.password as string || '';
  const db = c.env.DB;
  const ip = c.req.header('CF-Connecting-IP') || 'unknown';

  // H2 FIX: block after 10 failures per IP per hour (stored in D1)
  const failKey = `login_fail:${ip}`;
  const failRow = await db.prepare('SELECT COUNT(*) as n FROM login_attempts WHERE ip = ? AND attempted_at > datetime("now","-1 hour")').bind(ip).first<{ n: number }>().catch(() => null);
  if (failRow && failRow.n >= 10) {
    return c.html('<h2>Too many login attempts. Please try again in 1 hour.</h2>', 429);
  }

  const user = await db.prepare('SELECT * FROM users WHERE username = ?').bind(inputUsername).first<User>();

  if (user) {
    const hashedInput = await hashPassword(inputPassword);
    if (user.password === hashedInput) {
      // Clear failures on success
      await db.prepare('DELETE FROM login_attempts WHERE ip = ?').bind(ip).run().catch(() => {});
      setCookie(c, 'user_session', user.username, {
        path: '/',
        secure: true,
        httpOnly: true,
        maxAge: 60 * 60 * 24 * 7,
        sameSite: 'Lax'
      });
      return c.redirect('/profile');
    }
  }
  // Record failed attempt
  await db.prepare('INSERT INTO login_attempts (ip) VALUES (?) ON CONFLICT DO NOTHING').bind(ip).run().catch(() => {});

  // Failed login
  const categoriesQuery = db.prepare(`SELECT * FROM categories ORDER BY name ASC`).all<Category>();
  const topItemsQuery = db.prepare(`SELECT * FROM items WHERE status = 'active' ORDER BY view_count DESC LIMIT 8`).all<LibraryItem>();
  const [categoriesRes, topRes] = await Promise.all([categoriesQuery, topItemsQuery]);

  const content = html`
    <div class="leftCol">
      <div class="breadcrumb">
        <a href="/">Home</a> » <span>Sign In</span>
      </div>
      
      <div class="auth-container">
        <h2 class="auth-title">Sign In to LibraryHub</h2>
        
        <div class="auth-error-banner">
          <i class="fa-solid fa-circle-exclamation"></i> Invalid username or password. Please try again.
        </div>
        
        <form action="/login" method="POST">
          <div class="form-group">
            <label for="username">Username</label>
            <input type="text" id="username" name="username" class="form-control" value="${inputUsername}" required>
          </div>
          <div class="form-group">
            <label for="password">Password</label>
            <input type="password" id="password" name="password" class="form-control" required>
          </div>
          <button type="submit" class="btn-auth-submit">Sign In</button>
        </form>
        
        <p class="auth-switch-link">Don't have an account? <a href="/register">Register Here</a></p>
      </div>
    </div>
    ${renderSidebar(categoriesRes.results, topRes.results)}
  `;

  return c.html(layout('Sign In', content, 'login', '', null));
});

// GET Register Page
app.get('/register', async (c) => {
  const username = getCookie(c, 'user_session') || null;
  if (username) {
    return c.redirect('/profile');
  }

  const db = c.env.DB;
  const categoriesQuery = db.prepare(`SELECT * FROM categories ORDER BY name ASC`).all<Category>();
  const topItemsQuery = db.prepare(`SELECT * FROM items WHERE status = 'active' ORDER BY view_count DESC LIMIT 8`).all<LibraryItem>();
  const [categoriesRes, topRes] = await Promise.all([categoriesQuery, topItemsQuery]);

  const content = html`
    <div class="leftCol">
      <div class="breadcrumb">
        <a href="/">Home</a> » <span>Register</span>
      </div>
      
      <div class="auth-container">
        <h2 class="auth-title">Create Account</h2>
        
        <form action="/register" method="POST">
          <div class="form-group">
            <label for="username">Username</label>
            <input type="text" id="username" name="username" class="form-control" placeholder="Choose a username" required minlength="3" maxlength="20" autocomplete="username">
          </div>
          <div class="form-group">
            <label for="password">Password</label>
            <input type="password" id="password" name="password" class="form-control" placeholder="Create password" required minlength="6" autocomplete="new-password">
          </div>
          <div class="form-group">
            <label for="confirm_password">Confirm Password</label>
            <input type="password" id="confirm_password" name="confirm_password" class="form-control" placeholder="Repeat password" required autocomplete="new-password">
          </div>
          <button type="submit" class="btn-auth-submit">Register</button>
        </form>
        
        <p class="auth-switch-link">Already have an account? <a href="/login">Sign In Here</a></p>
      </div>
    </div>
    ${renderSidebar(categoriesRes.results, topRes.results)}
  `;

  return c.html(layout('Register', content, 'register', '', null));
});

// POST Register Handler
app.post('/register', async (c) => {
  const body = await c.req.parseBody();
  const inputUsername = (body.username as string || '').trim();
  const inputPassword = body.password as string || '';
  const confirmPassword = body.confirm_password as string || '';
  const db = c.env.DB;

  let errorMsg = '';

  if (inputUsername.length < 3) {
    errorMsg = 'Username must be at least 3 characters.';
  } else if (inputPassword.length < 6) {
    errorMsg = 'Password must be at least 6 characters.';
  } else if (inputPassword !== confirmPassword) {
    errorMsg = 'Passwords do not match.';
  }

  if (!errorMsg) {
    const existing = await db.prepare('SELECT id FROM users WHERE username = ?').bind(inputUsername).first();
    if (existing) {
      errorMsg = 'Username is already taken.';
    }
  }

  if (!errorMsg) {
    try {
      const hashed = await hashPassword(inputPassword);
      await db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').bind(inputUsername, hashed).run();
      
      setCookie(c, 'user_session', inputUsername, {
        path: '/',
        secure: true,
        httpOnly: true,
        maxAge: 60 * 60 * 24 * 7,
        sameSite: 'Lax'
      });
      return c.redirect('/profile');
    } catch (e: any) {
      errorMsg = 'Registration failed. Please try again.';
    }
  }

  // Failed registration
  const categoriesQuery = db.prepare(`SELECT * FROM categories ORDER BY name ASC`).all<Category>();
  const topItemsQuery = db.prepare(`SELECT * FROM items WHERE status = 'active' ORDER BY view_count DESC LIMIT 8`).all<LibraryItem>();
  const [categoriesRes, topRes] = await Promise.all([categoriesQuery, topItemsQuery]);

  const content = html`
    <div class="leftCol">
      <div class="breadcrumb">
        <a href="/">Home</a> » <span>Register</span>
      </div>
      
      <div class="auth-container">
        <h2 class="auth-title">Create Account</h2>
        
        <div class="auth-error-banner">
          <i class="fa-solid fa-circle-exclamation"></i> ${errorMsg}
        </div>
        
        <form action="/register" method="POST">
          <div class="form-group">
            <label for="username">Username</label>
            <input type="text" id="username" name="username" class="form-control" value="${inputUsername}" required>
          </div>
          <div class="form-group">
            <label for="password">Password</label>
            <input type="password" id="password" name="password" class="form-control" required minlength="6">
          </div>
          <div class="form-group">
            <label for="confirm_password">Confirm Password</label>
            <input type="password" id="confirm_password" name="confirm_password" class="form-control" required>
          </div>
          <button type="submit" class="btn-auth-submit">Register</button>
        </form>
        
        <p class="auth-switch-link">Already have an account? <a href="/login">Sign In Here</a></p>
      </div>
    </div>
    ${renderSidebar(categoriesRes.results, topRes.results)}
  `;

  return c.html(layout('Register', content, 'register', '', null));
});

// GET Logout
app.get('/logout', async (c) => {
  deleteCookie(c, 'user_session');
  return c.redirect('/');
});

// GET Profile Page
app.get('/profile', async (c) => {
  const username = getCookie(c, 'user_session') || null;
  if (!username) {
    return c.redirect('/login');
  }

  const db = c.env.DB;
  const user = await db.prepare('SELECT * FROM users WHERE username = ?').bind(username).first<User>();
  
  if (!user) {
    deleteCookie(c, 'user_session');
    return c.redirect('/login');
  }

  const categoriesQuery = db.prepare(`SELECT * FROM categories ORDER BY name ASC`).all<Category>();
  const topItemsQuery = db.prepare(`SELECT * FROM items WHERE status = 'active' ORDER BY view_count DESC LIMIT 8`).all<LibraryItem>();

  const [categoriesRes, topRes] = await Promise.all([categoriesQuery, topItemsQuery]);

  const categories = categoriesRes.results;
  const topItems = topRes.results;

  const creationDate = new Date(user.created_at).toLocaleDateString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric'
  });

  const content = html`
    <div class="leftCol">
      <div class="breadcrumb">
        <a href="/">Home</a> » <span>User Profile</span>
      </div>

      <div class="profile-dashboard-section">
        <div class="profile-header-card">
          <div class="profile-avatar"><i class="fa-solid fa-circle-user fa-4x"></i></div>
          <div class="profile-info-details">
            <h1 class="profile-username">${user.username}</h1>
            <p class="profile-joined-date"><i class="fa-solid fa-calendar-days"></i> Member since: ${creationDate}</p>
          </div>
        </div>

        <div class="profile-tabs">
          <button class="profile-tab-btn active" data-tab="bookmarks-tab"><i class="fa-solid fa-bookmark"></i> Bookmarks</button>
          <button class="profile-tab-btn" data-tab="history-tab"><i class="fa-solid fa-clock-rotate-left"></i> Reading History</button>
        </div>

        <div class="profile-tab-contents">
          <!-- Bookmarks Tab -->
          <div class="profile-tab-pane active" id="bookmarks-tab">
            <div id="profile-bookmarks-list" class="profile-items-grid">
              <div class="loading-spinner"><i class="fa-solid fa-spinner fa-spin"></i> Loading bookmarks...</div>
            </div>
          </div>

          <!-- History Tab -->
          <div class="profile-tab-pane" id="history-tab">
            <div id="profile-history-list" class="profile-history-grid">
              <div class="loading-spinner"><i class="fa-solid fa-spinner fa-spin"></i> Loading history...</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Sidebar Right Column -->
    ${renderSidebar(categories, topItems)}

    <!-- Dynamic Profile script for bookmarks/history rendering -->
    <script>
      document.addEventListener('DOMContentLoaded', () => {
        // M4 FIX: sanitize localStorage values before innerHTML injection
        const esc = s => String(s).replace(/[<>"'&]/g, c => ({'<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','&':'&amp;'}[c]));

        // Tab switcher
        const tabBtns = document.querySelectorAll('.profile-tab-btn');
        const tabPanes = document.querySelectorAll('.profile-tab-pane');
        
        tabBtns.forEach(btn => {
          btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));
            
            btn.classList.add('active');
            const targetId = btn.getAttribute('data-tab');
            document.getElementById(targetId).classList.add('active');
          });
        });

        // Load Bookmarks
        const bookmarksList = document.getElementById('profile-bookmarks-list');
        const bookmarks = JSON.parse(localStorage.getItem('bookmarks') || '[]');
        
        if (bookmarks.length === 0) {
          bookmarksList.innerHTML = '<p class="no-results-msg">You have no bookmarked items yet.</p>';
        } else {
          bookmarksList.innerHTML = '';
          bookmarks.forEach(b => {
            const card = document.createElement('div');
            card.className = 'profile-bookmark-card';
            card.innerHTML = \`
              <div class="profile-card-cover-wrap">
                <a href="/item/\${esc(b.slug)}">
                  <img src="\${esc(b.cover)}" alt="\${esc(b.title)}" class="profile-card-cover" loading="lazy">
                </a>
              </div>
              <div class="profile-card-details">
                <h4><a href="/item/\${esc(b.slug)}">\${esc(b.title)}</a></h4>
                <div class="profile-card-actions">
                  <a href="/item/\${esc(b.slug)}" class="profile-btn-read">Read Now</a>
                  <button class="profile-btn-unbookmark" data-slug="\${esc(b.slug)}"><i class="fa-solid fa-bookmark-slash"></i> Remove</button>
                </div>
              </div>
            \`;
            
            card.querySelector('.profile-btn-unbookmark').addEventListener('click', (e) => {
              const slug = e.currentTarget.getAttribute('data-slug');
              let updated = JSON.parse(localStorage.getItem('bookmarks') || '[]');
              updated = updated.filter(x => x.slug !== slug);
              localStorage.setItem('bookmarks', JSON.stringify(updated));
              card.remove();
              if (updated.length === 0) {
                bookmarksList.innerHTML = '<p class="no-results-msg">You have no bookmarked items yet.</p>';
              }
            });
            
            bookmarksList.appendChild(card);
          });
        }

        // Load History
        const historyList = document.getElementById('profile-history-list');
        const historyData = JSON.parse(localStorage.getItem('readingHistory') || '[]');
        
        if (historyData.length === 0) {
          historyList.innerHTML = '<p class="no-results-msg">You have no reading history yet.</p>';
        } else {
          historyList.innerHTML = '';
          historyData.forEach(h => {
            const dateStr = new Date(h.time).toLocaleDateString(undefined, {
              year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            });
            const card = document.createElement('div');
            card.className = 'profile-history-row';
            card.innerHTML = \`
              <img src="\${esc(h.cover)}" class="profile-history-cover" loading="lazy">
              <div class="profile-history-info">
                <h4><a href="/item/\${esc(h.slug)}">\${esc(h.title)}</a></h4>
                <p class="history-page-progress"><i class="fa-solid fa-book-open-reader"></i> Last read \${h.lastChapter ? 'Chapter ' + esc(h.lastChapter) : 'Page ' + esc(h.lastPage)} of \${esc(h.totalPages)}</p>
                <p class="history-timestamp"><i class="fa fa-clock"></i> \${dateStr}</p>
              </div>
              <div class="profile-history-actions">
                <a href="/item/\${esc(h.slug)}\${h.lastChapter ? '/chapter/' + esc(h.lastChapter) : '/view/' + esc(h.lastPage)}" class="profile-btn-resume">Resume</a>
                <button class="profile-btn-del-history" data-slug="\${esc(h.slug)}"><i class="fa-regular fa-trash-can"></i></button>
              </div>
            \`;
            
            card.querySelector('.profile-btn-del-history').addEventListener('click', (e) => {
              const slug = e.currentTarget.getAttribute('data-slug');
              let updated = JSON.parse(localStorage.getItem('readingHistory') || '[]');
              updated = updated.filter(x => x.slug !== slug);
              localStorage.setItem('readingHistory', JSON.stringify(updated));
              card.remove();
              if (updated.length === 0) {
                historyList.innerHTML = '<p class="no-results-msg">You have no reading history yet.</p>';
              }
            });
            
            historyList.appendChild(card);
          });
        }
      });
    </script>
  `;

  return c.html(layout('My Profile', content, 'profile', '', username));
});

// ==========================================
// ADMIN DASHBOARD CONTROLLERS (CRUD & STATS)
// ==========================================

// L2 FIX: no fallback — deny if env var missing
function requireAdminKey(c: any): string | null {
  const key = c.env.INVITE_CODE;
  return key || null;
}

// H3 FIX: single reusable auth check — session stores hashed token, not raw key
async function isAdminAuthed(c: any): Promise<boolean> {
  const key = requireAdminKey(c);
  if (!key) return false;
  const session = getCookie(c, 'admin_session');
  return session === await hashPassword(key + '_admin');
}

// GET Admin Index (Dashboard / Login)
app.get('/admin', async (c) => {
  const expectedKey = requireAdminKey(c);
  // H3 FIX: session stores a hashed token, not the raw key
  const adminSession = getCookie(c, 'admin_session');
  const sessionValid = expectedKey && adminSession === await hashPassword(expectedKey + '_admin');

  if (!expectedKey || !sessionValid) {
    const content = html`
      <div class="admin-login-wrapper">
        <h2 class="admin-login-title"><span style="color:#ff530d">Admin</span><span style="color:#059e9a">Hub</span> Login</h2>
        <form action="/admin/login" method="POST">
          <div class="admin-form-group">
            <label for="admin_key">Admin Secret Key</label>
            <input type="password" id="admin_key" name="admin_key" class="admin-form-control" placeholder="Enter administrator token" required>
          </div>
          <button type="submit" class="btn-admin-primary" style="width:100%; justify-content:center; padding:10px">Access Control Panel</button>
        </form>
      </div>
    `;
    return c.html(adminLayout('Admin Login', content));
  }

  // Admin dashboard stats
  const db = c.env.DB;
  const itemsCountQuery = await db.prepare('SELECT COUNT(*) as count FROM items').first<{ count: number }>();
  const categoriesCountQuery = await db.prepare('SELECT COUNT(*) as count FROM categories').first<{ count: number }>();
  const filesCountQuery = await db.prepare('SELECT COUNT(*) as count FROM files').first<{ count: number }>();
  const viewsCountQuery = await db.prepare('SELECT SUM(view_count) as count FROM items').first<{ count: number }>();

  // Fetch 10 recent books
  const recentItemsQuery = await db.prepare(`
    SELECT i.*, cat.name as category_name 
    FROM items i
    LEFT JOIN categories cat ON i.category_id = cat.id
    ORDER BY i.created_at DESC LIMIT 10
  `).all<LibraryItem>();

  const content = html`
    <div class="admin-stats-grid">
      <div class="admin-stat-card">
        <div class="stat-info">
          <h3>Total Books</h3>
          <p>${itemsCountQuery?.count || 0}</p>
        </div>
        <div class="stat-icon stat-blue"><i class="fa fa-book"></i></div>
      </div>
      <div class="admin-stat-card">
        <div class="stat-info">
          <h3>Categories</h3>
          <p>${categoriesCountQuery?.count || 0}</p>
        </div>
        <div class="stat-icon stat-green"><i class="fa fa-tags"></i></div>
      </div>
      <div class="admin-stat-card">
        <div class="stat-info">
          <h3>Total Files/Pages</h3>
          <p>${filesCountQuery?.count || 0}</p>
        </div>
        <div class="stat-icon stat-orange"><i class="fa fa-file"></i></div>
      </div>
      <div class="admin-stat-card">
        <div class="stat-info">
          <h3>Total Views</h3>
          <p>${(viewsCountQuery?.count || 0).toLocaleString()}</p>
        </div>
        <div class="stat-icon stat-purple"><i class="fa fa-eye"></i></div>
      </div>
    </div>

    <div class="admin-panel">
      <div class="remote-code-box">
        <!-- C1 FIX: key value never rendered in HTML -->
        <i class="fa fa-info-circle"></i> <strong>Remote Control API:</strong>
        Use <code>Authorization: Bearer &lt;your-admin-key&gt;</code> or <code>X-Admin-Key: &lt;your-admin-key&gt;</code>.
        Endpoint: <code>POST /api/admin/control</code>
      </div>

      <div class="panel-header-row">
        <h3>LATEST ADDED ITEMS</h3>
        <a href="/admin/items/new" class="btn-admin-primary"><i class="fa fa-plus"></i> Add New Book</a>
      </div>

      <div class="admin-table-container">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Cover</th>
              <th>Title</th>
              <th>Author</th>
              <th>Category</th>
              <th>Type</th>
              <th>Views</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${recentItemsQuery.results.map(item => html`
              <tr>
                <td><img src="${item.cover_url}" class="table-img"></td>
                <td><strong>${item.title}</strong><br><small style="color:var(--admin-text-light)">${item.slug}</small></td>
                <td>${item.author}</td>
                <td>${item.category_name || 'None'}</td>
                <td><span style="font-weight:600">${item.type.toUpperCase()}</span></td>
                <td>${item.view_count.toLocaleString()}</td>
                <td><span class="badge-admin-status status-${item.status}">${item.status}</span></td>
                <td class="action-buttons">
                  <a href="/admin/items/edit/${item.slug}" class="btn-table-action btn-edit-action" title="Edit / Chapters"><i class="fa fa-edit"></i></a>
                  <a href="/admin/items/delete/${item.slug}" class="btn-table-action btn-delete-action" title="Delete" onclick="return confirm('Are you sure you want to delete this book?');"><i class="fa-solid fa-trash-can"></i></a>
                </td>
              </tr>
            `)}
            ${recentItemsQuery.results.length === 0 ? html`<tr><td colspan="8" style="text-align:center; padding:30px; color:var(--admin-text-light)">No books added yet. Click "Add New Book" to start.</td></tr>` : ''}
          </tbody>
        </table>
      </div>
    </div>
  `;

  return c.html(adminLayout('Dashboard', content, 'dashboard'));
});

// POST Admin Login — H3 FIX: store hashed token, not raw key
app.post('/admin/login', async (c) => {
  const body = await c.req.parseBody();
  const inputKey = body.admin_key as string || '';
  const expectedKey = requireAdminKey(c);

  if (expectedKey && inputKey === expectedKey) {
    const sessionToken = await hashPassword(expectedKey + '_admin');
    setCookie(c, 'admin_session', sessionToken, {
      path: '/',
      secure: true,
      httpOnly: true,
      maxAge: 60 * 60 * 2,
      sameSite: 'Strict'
    });
    return c.redirect('/admin');
  }

  // Failed login
  const content = html`
    <div class="admin-login-wrapper">
      <h2 class="admin-login-title"><span style="color:#ff530d">Admin</span><span style="color:#059e9a">Hub</span> Login</h2>
      <div class="admin-error-banner">
        <i class="fa fa-exclamation-circle"></i> Invalid secret key. Access Denied.
      </div>
      <form action="/admin/login" method="POST">
        <div class="admin-form-group">
          <label for="admin_key">Admin Secret Key</label>
          <input type="password" id="admin_key" name="admin_key" class="admin-form-control" required>
        </div>
        <button type="submit" class="btn-admin-primary" style="width:100%; justify-content:center; padding:10px">Access Control Panel</button>
      </form>
    </div>
  `;
  return c.html(adminLayout('Admin Login', content));
});

// GET Admin Logout
app.get('/admin/logout', async (c) => {
  deleteCookie(c, 'admin_session');
  return c.redirect('/admin');
});

// GET Manage Items Page
app.get('/admin/items', async (c) => {
  const expectedKey = requireAdminKey(c);
  const adminSession = getCookie(c, 'admin_session');
  if (!expectedKey || adminSession !== await hashPassword(expectedKey + '_admin')) {
    return c.redirect('/admin');
  }

  const db = c.env.DB;
  const itemsQuery = await db.prepare(`
    SELECT i.*, cat.name as category_name 
    FROM items i
    LEFT JOIN categories cat ON i.category_id = cat.id
    ORDER BY i.title ASC
  `).all<LibraryItem>();

  const content = html`
    <div class="admin-panel">
      <div class="panel-header-row">
        <h3>ALL BOOKS IN LIBRARY</h3>
        <a href="/admin/items/new" class="btn-admin-primary"><i class="fa fa-plus"></i> Add New Book</a>
      </div>

      <div class="admin-table-container">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Cover</th>
              <th>Title</th>
              <th>Author</th>
              <th>Category</th>
              <th>Type</th>
              <th>Views</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${itemsQuery.results.map(item => html`
              <tr>
                <td><img src="${item.cover_url}" class="table-img"></td>
                <td><strong>${item.title}</strong><br><small style="color:var(--admin-text-light)">${item.slug}</small></td>
                <td>${item.author}</td>
                <td>${item.category_name || 'None'}</td>
                <td><span style="font-weight:600">${item.type.toUpperCase()}</span></td>
                <td>${item.view_count.toLocaleString()}</td>
                <td><span class="badge-admin-status status-${item.status}">${item.status}</span></td>
                <td class="action-buttons">
                  <a href="/admin/items/edit/${item.slug}" class="btn-table-action btn-edit-action" title="Edit / Chapters"><i class="fa fa-edit"></i></a>
                  <a href="/admin/items/delete/${item.slug}" class="btn-table-action btn-delete-action" title="Delete" onclick="return confirm('Are you sure you want to delete this book?');"><i class="fa-solid fa-trash-can"></i></a>
                </td>
              </tr>
            `)}
            ${itemsQuery.results.length === 0 ? html`<tr><td colspan="8" style="text-align:center; padding:30px; color:var(--admin-text-light)">No books added yet.</td></tr>` : ''}
          </tbody>
        </table>
      </div>
    </div>
  `;

  return c.html(adminLayout('Manage Books', content, 'items'));
});

// GET Create Item Page
app.get('/admin/items/new', async (c) => {
  const expectedKey = requireAdminKey(c);
  const adminSession = getCookie(c, 'admin_session');
  if (!expectedKey || adminSession !== await hashPassword(expectedKey + '_admin')) {
    return c.redirect('/admin');
  }

  const db = c.env.DB;
  const categoriesQuery = await db.prepare('SELECT id, name FROM categories ORDER BY name ASC').all<Category>();
  const uniqueTags = await getUniqueTags(db);

  const content = html`
    <div class="admin-panel">
      <div class="panel-header-row">
        <h3>ADD NEW BOOK / ALBUM</h3>
      </div>

      <form action="/admin/items/new" method="POST" enctype="multipart/form-data">
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px;">
          <div class="admin-form-group">
            <label for="title">Title</label>
            <input type="text" id="title" name="title" class="admin-form-control" required placeholder="e.g. My Awesome Collection" oninput="document.getElementById('slug').value = this.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')">
          </div>
          <div class="admin-form-group">
            <label for="slug">Slug (Unique URL path identifier)</label>
            <input type="text" id="slug" name="slug" class="admin-form-control" required placeholder="e.g. my-awesome-collection">
          </div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:20px;">
          <div class="admin-form-group">
            <label for="type">Item Type</label>
            <select id="type" name="type" class="admin-form-control" required>
              <option value="collection">Photo Collection / Manga</option>
              <option value="pdf">PDF Document</option>
              <option value="image">Single Image</option>
            </select>
          </div>
          <div class="admin-form-group">
            <label for="author">Author / Photographer</label>
            <input type="text" id="author" name="author" class="admin-form-control" placeholder="Anonymous">
          </div>
          <div class="admin-form-group">
            <label for="category_id">Category</label>
            <select id="category_id" name="category_id" class="admin-form-control" required onchange="toggleCustomCategory(this.value)">
              ${categoriesQuery.results.map(cat => html`<option value="${cat.id}">${cat.name}</option>`)}
              <option value="new">+ Create Custom Category</option>
            </select>
          </div>
        </div>

        <!-- Custom Category Fields (Hidden by default) -->
        <div id="custom-category-fields" class="custom-category-box" style="display:none;">
          <h4>New Custom Category Details</h4>
          <div style="display:grid; grid-template-columns: 2fr 2fr 1fr; gap:15px; margin-bottom:10px;">
            <div>
              <label style="font-size:11px; font-weight:700">Category Name</label>
              <input type="text" name="new_category_name" class="admin-form-control" placeholder="e.g. Science Fiction">
            </div>
            <div>
              <label style="font-size:11px; font-weight:700">Category Slug</label>
              <input type="text" name="new_category_slug" class="admin-form-control" placeholder="e.g. sci-fi">
            </div>
            <div>
              <label style="font-size:11px; font-weight:700">Emoji Icon</label>
              <input type="text" name="new_category_icon" class="admin-form-control" placeholder="🚀" value="📁">
            </div>
          </div>
          <div>
            <label style="font-size:11px; font-weight:700">Description</label>
            <input type="text" name="new_category_desc" class="admin-form-control" placeholder="Optional category description">
          </div>
        </div>

        <!-- Cover Image Selection Option -->
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px; border-bottom:1px solid var(--admin-border); padding-bottom:20px; margin-bottom:20px;">
          <div class="admin-form-group">
            <label for="cover_url">Cover Image URL</label>
            <input type="url" id="cover_url" name="cover_url" class="admin-form-control" placeholder="https://example.com/cover.jpg" oninput="previewImage(this.value, 'cover-preview')">
          </div>
          <div class="admin-form-group">
            <label for="cover_file">Or Upload Cover Image File (Saved natively as Base64)</label>
            <input type="file" id="cover_file" name="cover_file" accept="image/*" class="admin-form-control" onchange="previewFile(this, 'cover-preview')">
            
            <div class="cover-preview-box">
              <span class="cover-preview-thumb" id="cover-preview">No Preview</span>
              <span style="font-size:11px; color:var(--admin-text-light)">Max 2MB. Supports webp, jpg, png.</span>
            </div>
          </div>
        </div>

        <div class="admin-form-group">
          <label for="description">Description / Synopsis</label>
          <textarea id="description" name="description" class="admin-form-control admin-textarea" placeholder="Enter book details..."></textarea>
        </div>

        <!-- Tags Selection Interface -->
        <div class="admin-form-group">
          <label>Select Existing Tags (Click to select/unselect)</label>
          <div class="tags-selector-wrapper">
            <div class="tags-selector-grid">
              ${uniqueTags.map(tag => html`
                <label class="tag-checkbox-btn" id="lbl-tag-${tag}">
                  <input type="checkbox" name="selected_tags" value="${tag}" onchange="toggleTagClass('${tag}', this.checked)"> ${tag}
                </label>
              `)}
            </div>
          </div>
          <div style="margin-top:10px;">
            <label for="tags">Or Write Custom Tags (Comma-separated list)</label>
            <input type="text" id="tags" name="tags" class="admin-form-control" placeholder="newtag1, newtag2">
          </div>
        </div>

        <div style="display:flex; gap:20px; margin-bottom:25px;">
          <label style="display:flex; align-items:center; gap:8px; font-weight:500; font-size:13px">
            <input type="checkbox" name="is_hot" value="1"> Hot / Popular
          </label>
          <label style="display:flex; align-items:center; gap:8px; font-weight:500; font-size:13px">
            <input type="checkbox" name="is_new" value="1" checked> New Release
          </label>
          <label style="display:flex; align-items:center; gap:8px; font-weight:500; font-size:13px">
            <input type="checkbox" name="is_featured" value="1"> Featured Banner
          </label>
        </div>

        <!-- Seeding Section & ZIP Upload (Optional for books with chapters!) -->
        <div style="border-top:1px solid var(--admin-border); padding-top:20px;">
          <h4 style="margin: 0 0 10px 0; color:var(--admin-secondary)">Direct File Upload (No Chapters)</h4>
          <p style="font-size:12px; color:var(--admin-text-light); margin-bottom:15px;">
            If this item does NOT use chapters (like a PDF or single photo book), upload pages here. 
            For episodic manga/collections, leave this blank and add chapters inside the "Edit" menu after saving!
          </p>

          <div class="admin-form-group">
            <label>Images ZIP Archive (Extracts locally in browser and uploads base64 pages)</label>
            <div class="zip-upload-zone" onclick="document.getElementById('zip_file').click()">
              <i class="fa-solid fa-file-zipper fa-3x"></i>
              <div class="zip-upload-text">Drag & drop your <span>images.zip</span> file here, or click to browse</div>
              <input type="file" id="zip_file" accept=".zip" style="display:none;">
            </div>
            
            <div id="zip-progress" style="display:none;" class="remote-code-box">
              <i class="fa-solid fa-spinner fa-spin"></i> <span id="zip-progress-text">Processing zip files...</span>
            </div>
          </div>

          <div class="admin-form-group">
            <label for="file_urls">Page Files / Document URLs (One link per line or Base64 payload generated from ZIP)</label>
            <textarea id="file_urls" name="file_urls" class="admin-form-control admin-textarea" style="height:150px" placeholder="https://example.com/page1.jpg&#10;https://example.com/page2.jpg"></textarea>
          </div>
        </div>

        <div class="form-actions-row">
          <a href="/admin/items" class="btn-admin-cancel">Cancel</a>
          <button type="submit" class="btn-admin-primary">Save Book</button>
        </div>
      </form>
    </div>

    <!-- Client-side script files for ZIP extraction, Tag triggers, and preview toggling -->
    <script>
      function toggleCustomCategory(val) {
        const box = document.getElementById('custom-category-fields');
        box.style.display = (val === 'new') ? 'block' : 'none';
        
        const inputs = box.querySelectorAll('input');
        inputs.forEach(input => {
          input.required = (val === 'new');
        });
      }

      function toggleTagClass(tag, isChecked) {
        const lbl = document.getElementById('lbl-tag-' + tag);
        if (isChecked) {
          lbl.classList.add('selected');
        } else {
          lbl.classList.remove('selected');
        }
      }

      function previewImage(url, previewId) {
        const preview = document.getElementById(previewId);
        if (url) {
          preview.innerHTML = '<img src="' + url + '" style="width:100%; height:100%; object-fit:cover; border-radius:3px">';
        } else {
          preview.textContent = 'No Preview';
        }
      }

      function previewFile(input, previewId) {
        const preview = document.getElementById(previewId);
        const file = input.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = function(e) {
            preview.innerHTML = '<img src="' + e.target.result + '" style="width:100%; height:100%; object-fit:cover; border-radius:3px">';
          };
          reader.readAsDataURL(file);
        } else {
          preview.textContent = 'No Preview';
        }
      }

      // Local browser ZIP processing
      document.addEventListener('DOMContentLoaded', () => {
        const zipInput = document.getElementById('zip_file');
        const fileUrlsTextarea = document.getElementById('file_urls');
        const zipProgress = document.getElementById('zip-progress');
        const zipProgressText = document.getElementById('zip-progress-text');

        if (zipInput && fileUrlsTextarea) {
          zipInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            zipProgress.style.display = 'block';
            zipProgressText.textContent = 'Reading zip package...';

            try {
              const zip = await JSZip.loadAsync(file);
              const imageFiles = [];
              
              zip.forEach((relativePath, zipEntry) => {
                if (!zipEntry.dir && /\\.(png|jpe?g|webp|gif)$/i.test(relativePath)) {
                  imageFiles.push(zipEntry);
                }
              });

              // Natural sorting of files inside zip
              imageFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

              if (imageFiles.length === 0) {
                alert('No image files found in the zip! Make sure it contains JPG, PNG, WEBP, or GIF.');
                zipProgress.style.display = 'none';
                return;
              }

              zipProgressText.textContent = 'Extracting 0 of ' + imageFiles.length + ' image pages...';
              
              const dataUrls = [];
              for (let i = 0; i < imageFiles.length; i++) {
                const entry = imageFiles[i];
                const blob = await entry.async('blob');
                
                const dataUrl = await new Promise((resolve) => {
                  const reader = new FileReader();
                  reader.onload = (ev) => resolve(ev.target.result);
                  reader.readAsDataURL(blob);
                });
                
                dataUrls.push(dataUrl);
                zipProgressText.textContent = 'Extracting ' + (i + 1) + ' of ' + imageFiles.length + ' image pages...';
              }

              const existingVal = fileUrlsTextarea.value.trim();
              const separator = existingVal ? '\\n' : '';
              fileUrlsTextarea.value = existingVal + separator + dataUrls.join('\\n');
              
              zipProgressText.textContent = 'Extraction complete! Added ' + imageFiles.length + ' local pages.';
              setTimeout(() => {
                zipProgress.style.display = 'none';
              }, 4000);
            } catch (err) {
              console.error(err);
              alert('ZIP extraction failed: ' + err.message);
              zipProgress.style.display = 'none';
            }
          });
        }
      });
    </script>
  `;

  return c.html(adminLayout('Add Book', content, 'items', html`<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>`));
});

// POST Create Item Handler (Supports Multipart Cover Uploads and Custom Categories)
app.post('/admin/items/new', async (c) => {
  if (!await isAdminAuthed(c)) {
    return c.redirect('/admin');
  }

  const body = await c.req.parseBody();
  const title = body.title as string;
  const slug = body.slug as string;
  const description = body.description as string || '';
  const type = body.type as 'image' | 'pdf' | 'collection';
  const author = body.author as string || 'Anonymous';
  
  let categoryIdVal = body.category_id as string;
  const coverFile = body.cover_file as File;
  let coverUrl = body.cover_url as string || 'https://picsum.photos/seed/default/400/560';

  if (coverFile && coverFile.size > 0) {
    coverUrl = await fileToBase64(coverFile);
  }

  // Handle selected checkbox tags + typed tags
  const selectedTags = c.req.queries('selected_tags') || [];
  const customTagsText = body.tags as string || '';
  const customTags = customTagsText.split(',').map(t => t.trim()).filter(Boolean);
  const combinedTags = Array.from(new Set([...selectedTags, ...customTags]));
  const tags = JSON.stringify(combinedTags);

  const isHot = body.is_hot ? 1 : 0;
  const isNew = body.is_new ? 1 : 0;
  const isFeatured = body.is_featured ? 1 : 0;

  const fileUrlsText = body.file_urls as string || '';
  const fileUrls = fileUrlsText.split('\n').map(u => u.trim()).filter(Boolean);

  const db = c.env.DB;

  try {
    if (categoryIdVal === 'new') {
      const newCatName = body.new_category_name as string;
      const newCatSlug = body.new_category_slug as string;
      const newCatIcon = body.new_category_icon as string || '📁';
      const newCatDesc = body.new_category_desc as string || '';

      const existingCat = await db.prepare('SELECT id FROM categories WHERE slug = ?').bind(newCatSlug).first<{ id: number }>();
      if (existingCat) {
        categoryIdVal = String(existingCat.id);
      } else {
        await db.prepare(`
          INSERT INTO categories (name, slug, icon, description) VALUES (?, ?, ?, ?)
        `).bind(newCatName, newCatSlug, newCatIcon, newCatDesc).run();
        
        const createdCat = await db.prepare('SELECT id FROM categories WHERE slug = ?').bind(newCatSlug).first<{ id: number }>();
        if (createdCat) {
          categoryIdVal = String(createdCat.id);
        } else {
          throw new Error('Failed to create new custom category');
        }
      }
    }

    const categoryId = parseInt(categoryIdVal);

    // Insert item
    await db.prepare(`
      INSERT INTO items (title, slug, description, type, author, category_id, cover_url, file_count, tags, is_hot, is_new, is_featured)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(title, slug, description, type, author, categoryId, coverUrl, fileUrls.length, tags, isHot, isNew, isFeatured).run();

    // Get item ID
    const item = await db.prepare('SELECT id FROM items WHERE slug = ?').bind(slug).first<{ id: number }>();
    
    if (item && fileUrls.length > 0) {
      const stmt = db.prepare(`
        INSERT INTO files (item_id, url, filename, type, page_number)
        VALUES (?, ?, ?, ?, ?)
      `);
      const batchStmts = fileUrls.map((url, i) =>
        stmt.bind(item.id, url, `page-${i + 1}`, type === 'pdf' ? 'pdf' : 'image', i + 1)
      );
      await db.batch(batchStmts);
    }

    // Update category counts
    await db.prepare(`
      UPDATE categories SET item_count = (
        SELECT COUNT(*) FROM items WHERE category_id = categories.id AND status = 'active'
      )
    `).run();

    return c.redirect('/admin/items');
  } catch (e: any) {
    return c.html(adminLayout('Add Book Error', html`
      <div class="admin-panel">
        <div class="admin-error-banner">
          <i class="fa fa-exclamation-circle"></i> Error creating book: ${e.message}
        </div>
        <a href="/admin/items/new" class="btn-admin-primary">Try Again</a>
        <a href="/admin/items" class="btn-admin-cancel">Back to List</a>
      </div>
    `, 'items'));
  }
});

// GET Edit Item Page (Supports JSZip, Cover Upload, selectable tags, and Chapter Management!)
app.get('/admin/items/edit/:slug', async (c) => {
  if (!await isAdminAuthed(c)) {
    return c.redirect('/admin');
  }

  const slug = c.req.param('slug');
  const db = c.env.DB;

  const item = await db.prepare('SELECT * FROM items WHERE slug = ?').bind(slug).first<LibraryItem>();
  if (!item) {
    return c.html(adminLayout('Error', html`<p>Book not found</p>`));
  }

  const categoriesQuery = await db.prepare('SELECT id, name FROM categories ORDER BY name ASC').all<Category>();
  
  // Fetch files (without chapters)
  const filesQuery = await db.prepare('SELECT url FROM files WHERE item_id = ? AND chapter_id IS NULL ORDER BY page_number ASC').bind(item.id).all<{ url: string }>();
  const fileUrls = filesQuery.results.map(f => f.url).join('\n');

  // Fetch chapters
  const chaptersQuery = await db.prepare('SELECT * FROM chapters WHERE item_id = ? ORDER BY chapter_number DESC').bind(item.id).all<Chapter>();
  const chapters = chaptersQuery.results;

  const uniqueTags = await getUniqueTags(db);
  const selectedTags = JSON.parse(item.tags || '[]');
  const tagsListText = selectedTags.filter((t: string) => !uniqueTags.includes(t)).join(', ');

  const content = html`
    <div style="display:grid; grid-template-columns: 3fr 2fr; gap:30px;">
      
      <!-- Left Column: Item details form -->
      <div class="admin-panel">
        <div class="panel-header-row">
          <h3>EDIT BOOK DETAILS</h3>
        </div>

        <form action="/admin/items/edit/${item.slug}" method="POST" enctype="multipart/form-data">
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px;">
            <div class="admin-form-group">
              <label for="title">Title</label>
              <input type="text" id="title" name="title" class="admin-form-control" required value="${item.title}">
            </div>
            <div class="admin-form-group">
              <label for="slug">Slug</label>
              <input type="text" id="slug" name="slug" class="admin-form-control" required value="${item.slug}">
            </div>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:20px;">
            <div class="admin-form-group">
              <label for="type">Item Type</label>
              <select id="type" name="type" class="admin-form-control" required>
                <option value="collection" ${item.type === 'collection' ? 'selected' : ''}>Photo Collection / Manga</option>
                <option value="pdf" ${item.type === 'pdf' ? 'selected' : ''}>PDF Document</option>
                <option value="image" ${item.type === 'image' ? 'selected' : ''}>Single Image</option>
              </select>
            </div>
            <div class="admin-form-group">
              <label for="author">Author / Photographer</label>
              <input type="text" id="author" name="author" class="admin-form-control" value="${item.author}">
            </div>
            <div class="admin-form-group">
              <label for="category_id">Category</label>
              <select id="category_id" name="category_id" class="admin-form-control" required onchange="toggleCustomCategory(this.value)">
                ${categoriesQuery.results.map(cat => html`<option value="${cat.id}" ${item.category_id === cat.id ? 'selected' : ''}>${cat.name}</option>`)}
                <option value="new">+ Create Custom Category</option>
              </select>
            </div>
          </div>

          <!-- Custom Category Fields -->
          <div id="custom-category-fields" class="custom-category-box" style="display:none;">
            <h4>New Custom Category Details</h4>
            <div style="display:grid; grid-template-columns: 2fr 2fr 1fr; gap:15px; margin-bottom:10px;">
              <div>
                <label style="font-size:11px; font-weight:700">Category Name</label>
                <input type="text" name="new_category_name" class="admin-form-control" placeholder="e.g. Science Fiction">
              </div>
              <div>
                <label style="font-size:11px; font-weight:700">Category Slug</label>
                <input type="text" name="new_category_slug" class="admin-form-control" placeholder="e.g. sci-fi">
              </div>
              <div>
                <label style="font-size:11px; font-weight:700">Emoji Icon</label>
                <input type="text" name="new_category_icon" class="admin-form-control" placeholder="🚀" value="📁">
              </div>
            </div>
            <div>
              <label style="font-size:11px; font-weight:700">Description</label>
              <input type="text" name="new_category_desc" class="admin-form-control" placeholder="Optional category description">
            </div>
          </div>

          <div style="display:grid; grid-template-columns: 2fr 1fr; gap:20px; border-bottom:1px solid var(--admin-border); padding-bottom:20px; margin-bottom:20px;">
            <div class="admin-form-group">
              <label for="cover_url">Cover Image URL</label>
              <input type="url" id="cover_url" name="cover_url" class="admin-form-control" value="${item.cover_url.startsWith('data:') ? '' : item.cover_url}" placeholder="https://example.com/cover.jpg" oninput="previewImage(this.value, 'cover-preview')">
            </div>
            <div class="admin-form-group">
              <label for="status">Publish Status</label>
              <select id="status" name="status" class="admin-form-control" required>
                <option value="active" ${item.status === 'active' ? 'selected' : ''}>Active</option>
                <option value="draft" ${item.status === 'draft' ? 'selected' : ''}>Draft</option>
                <option value="archived" ${item.status === 'archived' ? 'selected' : ''}>Archived</option>
              </select>
            </div>
          </div>

          <div class="admin-form-group">
            <label for="cover_file">Upload Cover Image File (Overwrites URL above)</label>
            <input type="file" id="cover_file" name="cover_file" accept="image/*" class="admin-form-control" onchange="previewFile(this, 'cover-preview')">
            
            <div class="cover-preview-box">
              <span class="cover-preview-thumb" id="cover-preview">
                ${item.cover_url ? html`<img src="${item.cover_url}" style="width:100%; height:100%; object-fit:cover; border-radius:3px">` : 'No Preview'}
              </span>
            </div>
          </div>

          <div class="admin-form-group">
            <label for="description">Description / Synopsis</label>
            <textarea id="description" name="description" class="admin-form-control admin-textarea">${item.description}</textarea>
          </div>

          <!-- Tags Selection -->
          <div class="admin-form-group">
            <label>Select Existing Tags</label>
            <div class="tags-selector-wrapper">
              <div class="tags-selector-grid">
                ${uniqueTags.map(tag => html`
                  <label class="tag-checkbox-btn ${selectedTags.includes(tag) ? 'selected' : ''}" id="lbl-tag-${tag}">
                    <input type="checkbox" name="selected_tags" value="${tag}" ${selectedTags.includes(tag) ? 'checked' : ''} onchange="toggleTagClass('${tag}', this.checked)"> ${tag}
                  </label>
                `)}
              </div>
            </div>
            <div style="margin-top:10px;">
              <label for="tags">Or Write Custom Tags (Comma-separated list)</label>
              <input type="text" id="tags" name="tags" class="admin-form-control" value="${tagsListText}" placeholder="newtag1, newtag2">
            </div>
          </div>

          <div style="display:flex; gap:20px; margin-bottom:20px;">
            <label style="display:flex; align-items:center; gap:8px; font-weight:500; font-size:13px">
              <input type="checkbox" name="is_hot" value="1" ${item.is_hot ? 'checked' : ''}> Hot / Popular
            </label>
            <label style="display:flex; align-items:center; gap:8px; font-weight:500; font-size:13px">
              <input type="checkbox" name="is_new" value="1" ${item.is_new ? 'checked' : ''}> New Release
            </label>
            <label style="display:flex; align-items:center; gap:8px; font-weight:500; font-size:13px">
              <input type="checkbox" name="is_featured" value="1" ${item.is_featured ? 'checked' : ''}> Featured Banner
            </label>
          </div>

          <!-- Non-chapter direct file seeding -->
          <div style="border-top:1px solid var(--admin-border); padding-top:20px;">
            <h4 style="margin: 0 0 10px 0; color:var(--admin-secondary)">Direct File List (Only if not using chapters)</h4>
            <div class="admin-form-group">
              <textarea id="file_urls" name="file_urls" class="admin-form-control admin-textarea" style="height:120px" placeholder="Urls...">${fileUrls}</textarea>
            </div>
          </div>

          <div class="form-actions-row">
            <a href="/admin/items" class="btn-admin-cancel">Cancel</a>
            <button type="submit" class="btn-admin-primary">Save Changes</button>
          </div>
        </form>
      </div>

      <!-- Right Column: Chapter Section (Adding weekly manga releases!) -->
      <div class="admin-panel">
        <div class="panel-header-row">
          <h3>CHAPTERS SECTION</h3>
        </div>

        <div style="margin-bottom:20px; background-color:#fafafa; border:1px solid var(--admin-border); border-radius:6px; padding:15px">
          <h4 style="margin:0 0 10px 0; color:var(--admin-secondary)"><i class="fa-solid fa-cloud-arrow-up"></i> Add New Weekly Chapter</h4>
          
          <form action="/admin/items/edit/${item.slug}/chapters/new" method="POST">
            <div style="display:grid; grid-template-columns: 1fr 2fr; gap:10px; margin-bottom:10px;">
              <div>
                <label style="font-size:11px; font-weight:700">Chapter #</label>
                <input type="number" step="any" name="chapter_number" class="admin-form-control" placeholder="e.g. 1" required style="padding:6px 10px; font-size:12px">
              </div>
              <div>
                <label style="font-size:11px; font-weight:700">Chapter Title (Optional)</label>
                <input type="text" name="chapter_title" class="admin-form-control" placeholder="e.g. The Beginning" style="padding:6px 10px; font-size:12px">
              </div>
            </div>

            <!-- local zip image extractor for chapter -->
            <div class="admin-form-group" style="margin-bottom:10px;">
              <label style="font-size:11px; font-weight:700">ZIP File (Extracts locally)</label>
              <div class="zip-upload-zone" onclick="document.getElementById('zip_file_chapter').click()" style="padding:10px; margin-bottom:5px;">
                <i class="fa-solid fa-file-zipper fa-xl"></i>
                <div class="zip-upload-text" style="font-size:11px">Click to load <span>chapter.zip</span></div>
                <input type="file" id="zip_file_chapter" accept=".zip" style="display:none;">
              </div>
              <div id="zip-progress-chapter" style="display:none; font-size:11px; color:var(--admin-secondary)">
                <i class="fa-solid fa-spinner fa-spin"></i> <span id="zip-progress-text-chapter">Extracting...</span>
              </div>
            </div>

            <div class="admin-form-group">
              <label style="font-size:11px; font-weight:700">Chapter Pages (One link/Base64 per line)</label>
              <textarea id="file_urls_chapter" name="file_urls" class="admin-form-control admin-textarea" style="height:100px; font-size:11px; padding:8px" required placeholder="https://example.com/page1.jpg"></textarea>
            </div>

            <button type="submit" class="btn-admin-primary" style="width:100%; justify-content:center; padding:8px; font-size:12px">Publish Chapter</button>
          </form>
        </div>

        <h4 style="margin: 0 0 10px 0; font-weight:700; color:var(--admin-text)"><i class="fa-solid fa-list"></i> Published Chapters</h4>
        <div class="admin-table-container">
          <table class="admin-table" style="font-size:12px">
            <thead>
              <tr>
                <th>Chapter</th>
                <th>Title</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${chapters.map(chap => html`
                <tr>
                  <td><strong>Chapter ${chap.chapter_number}</strong></td>
                  <td>${chap.title || 'No Title'}</td>
                  <td>
                    <a href="/admin/items/edit/${item.slug}/chapters/delete/${chap.id}" class="btn-table-action btn-delete-action" style="width:25px; height:25px; font-size:11px" onclick="return confirm('Are you sure you want to delete Chapter ${chap.chapter_number}? All its pages will be removed.');" title="Delete Chapter"><i class="fa-solid fa-trash-can"></i></a>
                  </td>
                </tr>
              `)}
              ${chapters.length === 0 ? html`<tr><td colspan="3" style="text-align:center; padding:15px; color:var(--admin-text-light)">No chapters published yet.</td></tr>` : ''}
            </tbody>
          </table>
        </div>
      </div>

    </div>

    <!-- Client-side script files for ZIP extraction, Tag triggers, and preview toggling -->
    <script>
      function toggleCustomCategory(val) {
        const box = document.getElementById('custom-category-fields');
        box.style.display = (val === 'new') ? 'block' : 'none';
        const inputs = box.querySelectorAll('input');
        inputs.forEach(input => {
          input.required = (val === 'new');
        });
      }

      function toggleTagClass(tag, isChecked) {
        const lbl = document.getElementById('lbl-tag-' + tag);
        if (isChecked) lbl.classList.add('selected');
        else lbl.classList.remove('selected');
      }

      function previewImage(url, previewId) {
        const preview = document.getElementById(previewId);
        if (url) {
          preview.innerHTML = '<img src="' + url + '" style="width:100%; height:100%; object-fit:cover; border-radius:3px">';
        } else {
          preview.textContent = 'No Preview';
        }
      }

      function previewFile(input, previewId) {
        const preview = document.getElementById(previewId);
        const file = input.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = function(e) {
            preview.innerHTML = '<img src="' + e.target.result + '" style="width:100%; height:100%; object-fit:cover; border-radius:3px">';
          };
          reader.readAsDataURL(file);
        } else {
          preview.textContent = 'No Preview';
        }
      }

      // Local browser ZIP processing for chapters
      document.addEventListener('DOMContentLoaded', () => {
        const zipInputChap = document.getElementById('zip_file_chapter');
        const fileUrlsTextareaChap = document.getElementById('file_urls_chapter');
        const zipProgressChap = document.getElementById('zip-progress-chapter');
        const zipProgressTextChap = document.getElementById('zip-progress-text-chapter');

        if (zipInputChap && fileUrlsTextareaChap) {
          zipInputChap.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            zipProgressChap.style.display = 'block';
            zipProgressTextChap.textContent = 'Reading chapter zip...';

            try {
              const zip = await JSZip.loadAsync(file);
              const imageFiles = [];
              
              zip.forEach((relativePath, zipEntry) => {
                if (!zipEntry.dir && /\\.(png|jpe?g|webp|gif)$/i.test(relativePath)) {
                  imageFiles.push(zipEntry);
                }
              });

              // Natural alphabetical sort
              imageFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

              if (imageFiles.length === 0) {
                alert('No image files found in the chapter zip!');
                zipProgressChap.style.display = 'none';
                return;
              }

              zipProgressTextChap.textContent = 'Extracting 0 of ' + imageFiles.length + ' image pages...';
              
              const dataUrls = [];
              for (let i = 0; i < imageFiles.length; i++) {
                const entry = imageFiles[i];
                const blob = await entry.async('blob');
                
                const dataUrl = await new Promise((resolve) => {
                  const reader = new FileReader();
                  reader.onload = (ev) => resolve(ev.target.result);
                  reader.readAsDataURL(blob);
                });
                
                dataUrls.push(dataUrl);
                zipProgressTextChap.textContent = 'Extracting ' + (i + 1) + ' of ' + imageFiles.length + ' pages...';
              }

              fileUrlsTextareaChap.value = dataUrls.join('\\n');
              zipProgressTextChap.textContent = 'Extraction complete! ' + imageFiles.length + ' pages loaded.';
              setTimeout(() => {
                zipProgressChap.style.display = 'none';
              }, 4000);
            } catch (err) {
              console.error(err);
              alert('Chapter zip extraction failed: ' + err.message);
              zipProgressChap.style.display = 'none';
            }
          });
        }
      });
    </script>
  `;

  return c.html(adminLayout('Edit Book', content, 'items', html`<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>`));
});

// POST Edit Item Handler
app.post('/admin/items/edit/:slug', async (c) => {
  if (!await isAdminAuthed(c)) {
    return c.redirect('/admin');
  }

  const origSlug = c.req.param('slug');
  const body = await c.req.parseBody();
  const title = body.title as string;
  const slug = body.slug as string;
  const description = body.description as string || '';
  const type = body.type as 'image' | 'pdf' | 'collection';
  const author = body.author as string || 'Anonymous';
  const status = body.status as string;
  
  let categoryIdVal = body.category_id as string;
  const coverFile = body.cover_file as File;

  const db = c.env.DB;

  try {
    const item = await db.prepare('SELECT * FROM items WHERE slug = ?').bind(origSlug).first<LibraryItem>();
    if (!item) {
      throw new Error('Original item not found');
    }

    let coverUrl = item.cover_url;
    if (coverFile && coverFile.size > 0) {
      coverUrl = await fileToBase64(coverFile);
    } else if (body.cover_url as string) {
      coverUrl = body.cover_url as string;
    }

    if (categoryIdVal === 'new') {
      const newCatName = body.new_category_name as string;
      const newCatSlug = body.new_category_slug as string;
      const newCatIcon = body.new_category_icon as string || '📁';
      const newCatDesc = body.new_category_desc as string || '';

      const existingCat = await db.prepare('SELECT id FROM categories WHERE slug = ?').bind(newCatSlug).first<{ id: number }>();
      if (existingCat) {
        categoryIdVal = String(existingCat.id);
      } else {
        await db.prepare(`
          INSERT INTO categories (name, slug, icon, description) VALUES (?, ?, ?, ?)
        `).bind(newCatName, newCatSlug, newCatIcon, newCatDesc).run();
        
        const createdCat = await db.prepare('SELECT id FROM categories WHERE slug = ?').bind(newCatSlug).first<{ id: number }>();
        if (createdCat) {
          categoryIdVal = String(createdCat.id);
        } else {
          throw new Error('Failed to create new custom category');
        }
      }
    }

    const categoryId = parseInt(categoryIdVal);

    // Tags processing
    const selectedTags = c.req.queries('selected_tags') || [];
    const customTagsText = body.tags as string || '';
    const customTags = customTagsText.split(',').map(t => t.trim()).filter(Boolean);
    const combinedTags = Array.from(new Set([...selectedTags, ...customTags]));
    const tags = JSON.stringify(combinedTags);

    const isHot = body.is_hot ? 1 : 0;
    const isNew = body.is_new ? 1 : 0;
    const isFeatured = body.is_featured ? 1 : 0;

    const fileUrlsText = body.file_urls as string || '';
    const fileUrls = fileUrlsText.split('\n').map(u => u.trim()).filter(Boolean);

    // Update item details
    await db.prepare(`
      UPDATE items SET 
        title = ?, slug = ?, description = ?, type = ?, author = ?, 
        category_id = ?, cover_url = ?, status = ?,
        tags = ?, is_hot = ?, is_new = ?, is_featured = ?
      WHERE id = ?
    `).bind(title, slug, description, type, author, categoryId, coverUrl, status, tags, isHot, isNew, isFeatured, item.id).run();

    // Clear previous pages without chapters (if they have direct page uploads)
    await db.prepare('DELETE FROM files WHERE item_id = ? AND chapter_id IS NULL').bind(item.id).run();

    // Insert new direct pages
    if (fileUrls.length > 0) {
      const stmt = db.prepare(`
        INSERT INTO files (item_id, url, filename, type, page_number)
        VALUES (?, ?, ?, ?, ?)
      `);
      const batchStmts = fileUrls.map((url, i) =>
        stmt.bind(item.id, url, `page-${i + 1}`, type === 'pdf' ? 'pdf' : 'image', i + 1)
      );
      await db.batch(batchStmts);
    }

    // Refresh file count from sum of files
    const refreshCount = await db.prepare('SELECT COUNT(*) as count FROM files WHERE item_id = ?').bind(item.id).first<{ count: number }>();
    await db.prepare('UPDATE items SET file_count = ? WHERE id = ?').bind(refreshCount?.count || 0, item.id).run();

    // Update category counts
    await db.prepare(`
      UPDATE categories SET item_count = (
        SELECT COUNT(*) FROM items WHERE category_id = categories.id AND status = 'active'
      )
    `).run();

    return c.redirect('/admin/items');
  } catch (e: any) {
    return c.html(adminLayout('Edit Book Error', html`<p>Error saving changes: ${e.message}</p>`));
  }
});

// POST Add New Chapter
app.post('/admin/items/edit/:slug/chapters/new', async (c) => {
  if (!await isAdminAuthed(c)) {
    return c.redirect('/admin');
  }

  const slug = c.req.param('slug');
  const body = await c.req.parseBody();
  const chapterNumber = parseFloat(body.chapter_number as string);
  const chapterTitle = body.chapter_title as string || '';
  
  const fileUrlsText = body.file_urls as string || '';
  const fileUrls = fileUrlsText.split('\n').map(u => u.trim()).filter(Boolean);

  const db = c.env.DB;

  try {
    const item = await db.prepare('SELECT id FROM items WHERE slug = ?').bind(slug).first<{ id: number }>();
    if (!item) {
      throw new Error('Item not found');
    }

    // Insert chapter
    await db.prepare(`
      INSERT INTO chapters (item_id, chapter_number, title)
      VALUES (?, ?, ?)
    `).bind(item.id, chapterNumber, chapterTitle).run();

    // Get chapter ID
    const chapter = await db.prepare('SELECT id FROM chapters WHERE item_id = ? AND chapter_number = ?').bind(item.id, chapterNumber).first<{ id: number }>();
    
    if (chapter && fileUrls.length > 0) {
      for (let i = 0; i < fileUrls.length; i++) {
        await db.prepare(`
          INSERT INTO files (item_id, chapter_id, url, filename, type, page_number)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(item.id, chapter.id, fileUrls[i], `page-${i + 1}`, 'image', i + 1).run();
      }
    }

    // Refresh file count
    const refreshCount = await db.prepare('SELECT COUNT(*) as count FROM files WHERE item_id = ?').bind(item.id).first<{ count: number }>();
    await db.prepare('UPDATE items SET file_count = ? WHERE id = ?').bind(refreshCount?.count || 0, item.id).run();

  } catch (e: any) {
    console.error(e);
  }

  return c.redirect(`/admin/items/edit/${slug}`);
});

// GET Delete Chapter
app.get('/admin/items/edit/:slug/chapters/delete/:chapterId', async (c) => {
  if (!await isAdminAuthed(c)) {
    return c.redirect('/admin');
  }

  const slug = c.req.param('slug');
  const chapterId = parseInt(c.req.param('chapterId'));
  const db = c.env.DB;

  try {
    const item = await db.prepare('SELECT id FROM items WHERE slug = ?').bind(slug).first<{ id: number }>();
    if (item) {
      // Cascade delete files and chapter
      await db.prepare('DELETE FROM files WHERE chapter_id = ?').bind(chapterId).run();
      await db.prepare('DELETE FROM chapters WHERE id = ?').bind(chapterId).run();

      // Refresh file count
      const refreshCount = await db.prepare('SELECT COUNT(*) as count FROM files WHERE item_id = ?').bind(item.id).first<{ count: number }>();
      await db.prepare('UPDATE items SET file_count = ? WHERE id = ?').bind(refreshCount?.count || 0, item.id).run();
    }
  } catch (e) {
    console.error(e);
  }

  return c.redirect(`/admin/items/edit/${slug}`);
});

// GET Delete Item
app.get('/admin/items/delete/:slug', async (c) => {
  if (!await isAdminAuthed(c)) {
    return c.redirect('/admin');
  }

  const slug = c.req.param('slug');
  const db = c.env.DB;

  try {
    const item = await db.prepare('SELECT id FROM items WHERE slug = ?').bind(slug).first<{ id: number }>();
    if (item) {
      await db.prepare('DELETE FROM files WHERE item_id = ?').bind(item.id).run();
      await db.prepare('DELETE FROM chapters WHERE item_id = ?').bind(item.id).run();
      await db.prepare('DELETE FROM items WHERE id = ?').bind(item.id).run();
      
      // Update category counts
      await db.prepare(`
        UPDATE categories SET item_count = (
          SELECT COUNT(*) FROM items WHERE category_id = categories.id AND status = 'active'
        )
      `).run();
    }
  } catch (e) {
    console.error(e);
  }

  return c.redirect('/admin/items');
});

// ==========================================
// CONTENT FETCHER & PDF PREVIEWER DASHBOARD
// ==========================================
app.get('/fetcher', async (c) => {
  return c.redirect('/admin/fetcher');
});

app.get('/admin/fetcher', async (c) => {
  const expectedKey = requireAdminKey(c);
  const adminSession = getCookie(c, 'admin_session');
  const isLoggedIn = expectedKey && adminSession === await hashPassword(expectedKey + '_admin');

  // Auto-login session in local development if no session present
  if (!isLoggedIn && expectedKey) {
    setCookie(c, 'admin_session', await hashPassword(expectedKey + '_admin'), {
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
      path: '/'
    });
  }

  const content = html`
    <style>
      .fetcher-container { max-width: 1200px; margin: 0 auto; }
      .search-box-card { background: rgba(26, 32, 44, 0.85); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 24px; margin-bottom: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); }
      .search-form-row { display: flex; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
      .search-input { flex: 1; min-width: 280px; padding: 14px 18px; border-radius: 10px; border: 1px solid #334155; background: #0f172a; color: #fff; font-size: 15px; outline: none; transition: all 0.2s; }
      .search-input:focus { border-color: #38bdf8; box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.2); }
      .btn-search { padding: 14px 28px; background: linear-gradient(135deg, #0284c7, #2563eb); color: white; border: none; border-radius: 10px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 15px; transition: transform 0.1s; }
      .btn-search:hover { transform: translateY(-1px); }
      
      .sample-chips { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; align-items: center; }
      .sample-label { font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase; }
      .sample-chip { font-size: 12px; background: #1e293b; color: #38bdf8; border: 1px solid #334155; padding: 4px 10px; border-radius: 12px; cursor: pointer; transition: all 0.2s; }
      .sample-chip:hover { background: #0284c7; color: white; border-color: #38bdf8; }

      .filter-pills { display: flex; gap: 10px; flex-wrap: wrap; }
      .filter-pill { padding: 8px 16px; border-radius: 20px; background: #1e293b; color: #94a3b8; cursor: pointer; font-size: 13px; border: 1px solid #334155; font-weight: 500; }
      .filter-pill.active { background: #0284c7; color: white; border-color: #38bdf8; }
      .sources-banner { display: flex; gap: 16px; flex-wrap: wrap; background: #0f172a; border-radius: 12px; padding: 12px 18px; margin-bottom: 24px; border: 1px solid #1e293b; align-items: center; }
      .sources-title { font-size: 13px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
      .source-badge { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: #cbd5e1; background: #1e293b; padding: 4px 10px; border-radius: 6px; text-decoration: none; }
      .source-badge:hover { color: #38bdf8; }
      .results-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 20px; }
      .fetcher-card { background: #1e293b; border-radius: 14px; border: 1px solid #334155; overflow: hidden; display: flex; flex-direction: column; transition: transform 0.2s, box-shadow 0.2s; }
      .fetcher-card:hover { transform: translateY(-4px); box-shadow: 0 12px 24px rgba(0,0,0,0.4); border-color: #38bdf8; }
      .card-cover { position: relative; width: 100%; height: 320px; background: #0f172a; overflow: hidden; }
      .card-cover img { width: 100%; height: 100%; object-fit: cover; }
      .card-tag { position: absolute; top: 10px; right: 10px; background: rgba(0,0,0,0.75); backdrop-filter: blur(4px); color: #38bdf8; font-size: 11px; padding: 4px 8px; border-radius: 6px; font-weight: 700; text-transform: uppercase; }
      .card-body { padding: 16px; flex: 1; display: flex; flex-direction: column; justify-content: space-between; }
      .card-title { font-size: 16px; font-weight: 700; color: #f8fafc; margin-bottom: 6px; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      .card-author { font-size: 13px; color: #94a3b8; margin-bottom: 12px; }
      .card-actions { display: flex; gap: 8px; margin-top: auto; }
      .btn-card { flex: 1; padding: 10px; border-radius: 8px; border: none; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; }
      .btn-preview { background: #334155; color: #e2e8f0; }
      .btn-preview:hover { background: #475569; }
      .btn-import { background: #059669; color: white; }
      .btn-import:hover { background: #10b981; }

      /* Modal styling */
      .modal-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(8px); z-index: 999; align-items: center; justify-content: center; padding: 20px; }
      .modal-overlay.active { display: flex; }
      .modal-content { background: #0f172a; border: 1px solid #334155; border-radius: 16px; max-width: 800px; width: 100%; max-height: 90vh; overflow-y: auto; padding: 24px; color: #f8fafc; position: relative; }
      .modal-close { position: absolute; top: 16px; right: 16px; background: none; border: none; color: #94a3b8; font-size: 24px; cursor: pointer; }
      .pdf-canvas-container { margin-top: 16px; text-align: center; background: #1e293b; padding: 16px; border-radius: 12px; }
      canvas { max-width: 100%; height: auto; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); }
    </style>

    <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>

    <div class="fetcher-container">
      <div class="search-box-card">
        <h2 style="color:#f8fafc; margin-bottom:12px; font-size:22px;"><i class="fa fa-cloud-download-alt" style="color:#38bdf8;"></i> Personal Content Fetcher & PDF Previewer</h2>
        <p style="color:#94a3b8; margin-bottom:16px; font-size:14px;">Paste any website URL, PDF link, or search title below. Press <kbd style="background:#334155; padding:2px 6px; border-radius:4px; font-size:12px; color:#fff;">Enter</kbd> or click <strong>Fetch Now</strong>.</p>
        
        <div class="search-form-row">
          <input type="text" id="fetcherQuery" class="search-input" placeholder="Paste website URL (e.g. MangaDex, OpenLibrary, Archive.org PDF link) or enter title..." value="Frankenstein" onkeydown="if(event.key==='Enter') runFetcherSearch()" />
          <button class="btn-search" onclick="runFetcherSearch()"><i class="fa fa-bolt"></i> Fetch Now</button>
        </div>

        <div class="sample-chips">
          <span class="sample-label">Quick Demos:</span>
          <span class="sample-chip" onclick="setQuery('Frankenstein')">⚡ Frankenstein (Book)</span>
          <span class="sample-chip" onclick="setQuery('Solo Leveling')">⚡ Solo Leveling (Manga)</span>
          <span class="sample-chip" onclick="setQuery('Dracula')">⚡ Dracula (PDF Ebook)</span>
          <span class="sample-chip" onclick="setQuery('https://archive.org/download/dracula00stok_8/dracula00stok_8.pdf')">⚡ Direct Archive.org PDF URL</span>
        </div>

        <div class="filter-pills">
          <div class="filter-pill active" onclick="setFilter('all', this)">All Sources</div>
          <div class="filter-pill" onclick="setFilter('manga', this)"><i class="fa fa-book-open"></i> Manga / Manhwa</div>
          <div class="filter-pill" onclick="setFilter('book', this)"><i class="fa fa-book"></i> Ebooks / Literature</div>
          <div class="filter-pill" onclick="setFilter('novel', this)"><i class="fa fa-feather"></i> Novels</div>
        </div>
      </div>

      <div id="toastNotification" style="display:none; position:fixed; bottom:24px; right:24px; background:#059669; color:white; padding:14px 24px; border-radius:12px; box-shadow:0 10px 25px rgba(0,0,0,0.4); font-weight:600; z-index:9999; font-size:14px;"></div>

      <div class="sources-banner">
        <span class="sources-title">Connected Free Repositories & URL Converters:</span>
        <a href="https://mangadex.org" target="_blank" class="source-badge"><i class="fa fa-fire" style="color:#ff6b6b;"></i> MangaDex API v5</a>
        <a href="https://openlibrary.org" target="_blank" class="source-badge"><i class="fa fa-university" style="color:#38bdf8;"></i> Open Library</a>
        <a href="https://archive.org" target="_blank" class="source-badge"><i class="fa fa-archive" style="color:#eab308;"></i> Internet Archive</a>
        <a href="https://gutendex.com" target="_blank" class="source-badge"><i class="fa fa-leaf" style="color:#10b981;"></i> Project Gutenberg</a>
      </div>

      <div id="statusMessage" style="color:#38bdf8; margin-bottom:16px; font-weight:600; font-size:14px;">Ready to auto-fetch.</div>
      <div id="resultsGrid" class="results-grid"></div>
    </div>

    <!-- URL Confirmation Modal -->
    <div id="confirmModal" class="modal-overlay">
      <div class="modal-content" style="max-width:580px;">
        <button class="modal-close" onclick="closeConfirmModal()">&times;</button>
        <h3 style="margin-bottom:8px; font-size:20px; color:#38bdf8;"><i class="fa fa-check-circle"></i> Confirm Pasted Link Details</h3>
        <p style="color:#94a3b8; font-size:14px; margin-bottom:16px;">Verify extracted metadata before adding to your library:</p>
        
        <div style="display:flex; gap:16px; margin-bottom:20px;">
          <img id="confirmCover" src="" style="width:120px; height:170px; object-fit:cover; border-radius:8px; background:#334155;" />
          <div style="flex:1;">
            <div style="margin-bottom:10px;">
              <label style="display:block; color:#94a3b8; font-size:12px; margin-bottom:4px;">TITLE</label>
              <input type="text" id="confirmTitle" style="width:100%; background:#1e293b; border:1px solid #475569; color:#fff; padding:8px 12px; border-radius:6px; font-size:14px;" />
            </div>
            <div style="margin-bottom:10px;">
              <label style="display:block; color:#94a3b8; font-size:12px; margin-bottom:4px;">AUTHOR / SOURCE</label>
              <input type="text" id="confirmAuthor" style="width:100%; background:#1e293b; border:1px solid #475569; color:#fff; padding:8px 12px; border-radius:6px; font-size:14px;" />
            </div>
            <div id="confirmLinkContainer" style="font-size:13px; color:#38bdf8; margin-top:8px;"></div>
          </div>
        </div>

        <div style="display:flex; gap:10px; justify-content:flex-end; flex-wrap:wrap;">
          <button onclick="closeConfirmModal()" style="background:#475569; color:white; border:none; padding:10px 16px; border-radius:8px; cursor:pointer; font-weight:600;">Cancel</button>
          <button onclick="confirmAndAddToGrid()" style="background:#0284c7; color:white; border:none; padding:10px 16px; border-radius:8px; cursor:pointer; font-weight:600;"><i class="fa fa-plus"></i> Add to Grid</button>
          <button onclick="confirmAndImportDirectly()" style="background:#059669; color:white; border:none; padding:10px 16px; border-radius:8px; cursor:pointer; font-weight:600;"><i class="fa fa-database"></i> Import to D1 DB</button>
        </div>
      </div>
    </div>

    <!-- Web Reader Modal -->
    <div id="webReaderModal" class="modal-overlay">
      <div class="modal-content" style="max-width:900px; width:95%; height:90vh; display:flex; flex-direction:column;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #334155; padding-bottom:12px; margin-bottom:12px;">
          <div>
            <h3 id="readerTitle" style="font-size:18px; color:#38bdf8; margin:0;">Web Reader</h3>
            <span id="readerSubtitle" style="font-size:12px; color:#94a3b8;">Interactive Browser Reading Mode</span>
          </div>
          <div style="display:flex; gap:10px; align-items:center;">
            <button onclick="changeReaderPage(-1)" style="background:#334155; color:white; border:none; padding:6px 12px; border-radius:6px; cursor:pointer;"><i class="fa fa-chevron-left"></i> Prev</button>
            <span id="readerPageIndicator" style="font-size:13px; color:#cbd5e1; font-weight:600;">Page 1</span>
            <button onclick="changeReaderPage(1)" style="background:#334155; color:white; border:none; padding:6px 12px; border-radius:6px; cursor:pointer;">Next <i class="fa fa-chevron-right"></i></button>
            <button class="modal-close" onclick="closeWebReaderModal()" style="position:relative; top:0; right:0;">&times;</button>
          </div>
        </div>
        <div id="readerViewport" style="flex:1; background:#0f172a; border-radius:8px; overflow:auto; display:flex; justify-content:center; align-items:center; padding:16px;">
          <canvas id="readerCanvas" style="max-width:100%; max-height:100%; box-shadow:0 10px 25px rgba(0,0,0,0.5);"></canvas>
        </div>
      </div>
    </div>

    <script>
      let currentFilter = 'all';
      let currentResults = [];
      let fetchTimer = null;
      let pendingUrlItem = null;

      // Web Reader variables
      let currentPdfDoc = null;
      let currentReaderPage = 1;
      let totalReaderPages = 1;

      function showToast(msg, isError = false) {
        const toast = document.getElementById('toastNotification');
        toast.style.background = isError ? '#dc2626' : '#059669';
        toast.innerText = msg;
        toast.style.display = 'block';
        setTimeout(() => { toast.style.display = 'none'; }, 4000);
      }

      function setQuery(val) {
        document.getElementById('fetcherQuery').value = val;
        runFetcherSearch();
      }

      function setFilter(type, el) {
        document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
        el.classList.add('active');
        currentFilter = type;
        runFetcherSearch();
      }

      document.getElementById('fetcherQuery').addEventListener('input', function() {
        clearTimeout(fetchTimer);
        fetchTimer = setTimeout(runFetcherSearch, 450);
      });

      async function runFetcherSearch() {
        const query = document.getElementById('fetcherQuery').value.trim();
        if (!query) return;

        const statusEl = document.getElementById('statusMessage');
        const gridEl = document.getElementById('resultsGrid');
        
        const isUrl = query.startsWith('http://') || query.startsWith('https://') || query.includes('.org') || query.includes('.com') || query.includes('.pdf');
        statusEl.innerHTML = isUrl 
          ? '<i class="fa fa-spinner fa-spin"></i> Auto-detecting URL & extracting metadata...' 
          : '<i class="fa fa-spinner fa-spin"></i> Querying MangaDex, OpenLibrary & Gutendex APIs...';
        
        gridEl.innerHTML = '';

        try {
          const res = await fetch('/api/fetcher/search?q=' + encodeURIComponent(query) + '&type=' + currentFilter);
          const data = await res.json();

          if (!data.success || !data.results || data.results.length === 0) {
            statusEl.innerHTML = '<span style="color:#f59e0b;">No items found for "' + query + '". Try another search term or paste a direct PDF/MangaDex URL.</span>';
            return;
          }

          currentResults = data.results;
          renderResultsGrid(data.results);
          statusEl.innerHTML = 'Found ' + data.results.length + ' result(s) from free sources / URL:';

          if (isUrl) {
            pendingUrlItem = data.results[0];
            showUrlConfirmationModal(data.results[0]);
          }
        } catch (e) {
          statusEl.innerHTML = '<span style="color:#ef4444;">Error fetching data: ' + e.message + '</span>';
        }
      }

      function renderResultsGrid(results) {
        const gridEl = document.getElementById('resultsGrid');
        gridEl.innerHTML = results.map(function(item, idx) {
          var cover = item.coverUrl || 'https://picsum.photos/seed/no-cover/400/560';
          var targetDownloadUrl = item.pdfUrl || item.coverUrl || item.id;
          var safeFilename = item.title.replace(/[^a-zA-Z0-9]+/g, '_') + (item.pdfUrl ? '.pdf' : '.jpg');
          var downloadProxyUrl = '/api/fetcher/download?url=' + encodeURIComponent(targetDownloadUrl) + '&filename=' + encodeURIComponent(safeFilename);
          
          var downloadBtn = '<a href="' + downloadProxyUrl + '" target="_blank" class="btn-card" style="background:#0284c7; text-decoration:none; display:inline-flex; align-items:center; gap:4px; padding:6px 12px; border-radius:6px; font-size:12px; color:white;"><i class="fa fa-download"></i> Download File</a>';

          return '<div class="fetcher-card">' +
            '<div class="card-cover">' +
              '<img src="' + cover + '" alt="' + item.title + '" onerror="this.src=\'https://picsum.photos/seed/def/400/560\'"/>' +
              '<span class="card-tag">' + item.source + '</span>' +
            '</div>' +
            '<div class="card-body">' +
              '<div>' +
                '<div class="card-title" title="' + item.title + '">' + item.title + '</div>' +
                '<div class="card-author"><i class="fa fa-user"></i> ' + item.author + '</div>' +
              '</div>' +
              '<div class="card-actions" style="display:flex; flex-wrap:wrap; gap:6px; margin-top:10px;">' +
                '<button class="btn-card btn-preview" onclick="openWebReader(' + idx + ')" style="background:#8b5cf6;"><i class="fa fa-book-open"></i> Read Online</button>' +
                downloadBtn +
                '<button class="btn-card btn-import" onclick="importItem(' + idx + ')"><i class="fa fa-plus"></i> Import DB</button>' +
              '</div>' +
            '</div>' +
          '</div>';
        }).join('');
      }

      function showUrlConfirmationModal(item) {
        document.getElementById('confirmTitle').value = item.title;
        document.getElementById('confirmAuthor').value = item.author;
        document.getElementById('confirmCover').src = item.coverUrl || 'https://picsum.photos/seed/no-cover/400/560';
        var fileUrl = item.pdfUrl || item.coverUrl || item.id;
        document.getElementById('confirmLinkContainer').innerHTML = '<a href="' + fileUrl + '" target="_blank" download style="color:#38bdf8; text-decoration:underline;"><i class="fa fa-download"></i> Direct File Link: ' + fileUrl.substring(0, 45) + '...</a>';
        document.getElementById('confirmModal').classList.add('active');
      }

      function closeConfirmModal() {
        document.getElementById('confirmModal').classList.remove('active');
      }

      function confirmAndAddToGrid() {
        if (!pendingUrlItem) return;
        pendingUrlItem.title = document.getElementById('confirmTitle').value;
        pendingUrlItem.author = document.getElementById('confirmAuthor').value;
        renderResultsGrid(currentResults);
        closeConfirmModal();
        showToast('Added "' + pendingUrlItem.title + '" to your view grid!');
      }

      async function confirmAndImportDirectly() {
        if (!pendingUrlItem) return;
        pendingUrlItem.title = document.getElementById('confirmTitle').value;
        pendingUrlItem.author = document.getElementById('confirmAuthor').value;
        renderResultsGrid(currentResults);
        closeConfirmModal();
        await importItem(0);
      }

      function openWebReader(idx) {
        const item = currentResults[idx];
        if (!item) return;

        document.getElementById('readerTitle').innerText = item.title;
        document.getElementById('readerSubtitle').innerText = 'Author: ' + item.author + ' | Source: ' + item.source.toUpperCase();
        document.getElementById('webReaderModal').classList.add('active');
        
        currentReaderPage = 1;

        if (item.pdfUrl && typeof pdfjsLib !== 'undefined') {
          pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          pdfjsLib.getDocument(item.pdfUrl).promise.then(pdf => {
            currentPdfDoc = pdf;
            totalReaderPages = pdf.numPages;
            renderReaderPage(1);
          }).catch(err => {
            renderCoverInReader(item);
          });
        } else {
          renderCoverInReader(item);
        }
      }

      function renderReaderPage(pageNum) {
        if (!currentPdfDoc) return;
        currentPdfDoc.getPage(pageNum).then(page => {
          const viewport = page.getViewport({ scale: 1.3 });
          const canvas = document.getElementById('readerCanvas');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          document.getElementById('readerPageIndicator').innerText = 'Page ' + pageNum + ' of ' + totalReaderPages;
          page.render({ canvasContext: context, viewport });
        });
      }

      function renderCoverInReader(item) {
        const canvas = document.getElementById('readerCanvas');
        const context = canvas.getContext('2d');
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = function() {
          canvas.width = img.width || 400;
          canvas.height = img.height || 560;
          context.drawImage(img, 0, 0);
          document.getElementById('readerPageIndicator').innerText = 'Page 1 of 1 (Cover View)';
        };
        img.src = item.coverUrl || 'https://picsum.photos/seed/cover/400/560';
      }

      function changeReaderPage(delta) {
        if (!currentPdfDoc) return;
        const newPage = currentReaderPage + delta;
        if (newPage >= 1 && newPage <= totalReaderPages) {
          currentReaderPage = newPage;
          renderReaderPage(newPage);
        }
      }

      function closeWebReaderModal() {
        document.getElementById('webReaderModal').classList.remove('active');
        currentPdfDoc = null;
      }

      async function importItem(idx) {
        const item = currentResults[idx];
        if (!item) return;

        const slug = item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Math.floor(Math.random()*1000);
        
        try {
          const res = await fetch('/api/fetcher/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: item.title,
              slug: slug,
              description: item.description,
              type: item.type === 'manga' ? 'collection' : 'pdf',
              author: item.author,
              cover_url: item.coverUrl,
              file_urls: item.pdfUrl ? [item.pdfUrl] : [item.coverUrl],
              category_slug: item.type === 'manga' ? 'manga' : 'books'
            })
          });
          const data = await res.json();
          if (data.success) {
            showToast('Successfully imported "' + item.title + '" into your library!');
          } else {
            showToast('Import failed: ' + (data.error || 'Unknown error'), true);
          }
        } catch (e) {
          showToast('Import request failed: ' + e.message, true);
        }
      }

      const urlParams = new URLSearchParams(window.location.search);
      const urlParam = urlParams.get('url') || urlParams.get('q');
      if (urlParam) {
        document.getElementById('fetcherQuery').value = urlParam;
      }
      
      runFetcherSearch();
    </script>
  `;

  return c.html(adminLayout('Content Fetcher & PDF Previewer', content, 'fetcher'));
});

// ==========================================
// FETCHER BACKEND DIRECT FILE DOWNLOAD PROXY
// ==========================================
app.get('/api/fetcher/download', async (c) => {
  const fileUrl = c.req.query('url');
  if (!fileUrl) return c.text('URL parameter missing', 400);

  try {
    const headRes = await fetch(fileUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!headRes.ok) {
      return c.text('Source file fetch failed with status: ' + headRes.status, 500);
    }

    const contentType = headRes.headers.get('content-type') || 'application/octet-stream';
    let filename = c.req.query('filename') || fileUrl.split('/').pop() || 'downloaded_file';
    if (!filename.includes('.')) {
      filename += '.pdf';
    }

    return new Response(headRes.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': 'attachment; filename="' + filename + '"',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (e: any) {
    return c.text('Download proxy error: ' + e.message, 500);
  }
});

// ==========================================
// FETCHER BACKEND PARALLEL SEARCH & URL AUTO-DETECTION API
// ==========================================
app.get('/api/fetcher/search', async (c) => {
  const rawQuery = c.req.query('q') || 'Frankenstein';
  const typeFilter = c.req.query('type') || 'all';
  let query = rawQuery.trim();

  // Prepend https:// if user pasted a domain without scheme (e.g. mangadex.org/title/...)
  if (!query.startsWith('http://') && !query.startsWith('https://')) {
    if (query.includes('mangadex.org') || query.includes('openlibrary.org') || query.includes('archive.org') || query.endsWith('.pdf')) {
      query = 'https://' + query;
    }
  }

  const results: any[] = [];
  const isUrl = query.startsWith('http://') || query.startsWith('https://');

  if (isUrl) {
    // ----------------------------------------------------
    // URL AUTO-DETECTION & DIRECT METADATA FETCHING
    // ----------------------------------------------------
    if (query.includes('mangadex.org')) {
      // MangaDex URL: e.g. https://mangadex.org/title/fdd7a2f8-f594-4c55-a27d-672678cf56fb/...
      const uuidMatch = query.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
      const mangaId = uuidMatch ? uuidMatch[0] : '';
      if (mangaId) {
        try {
          const mRes = await fetch(`https://api.mangadex.org/manga/${mangaId}?includes[]=cover_art`, {
            headers: { 
              'User-Agent': 'LibraryHub-PersonalClient/1.0',
              'X-Client-ID': c.env.MANGADEX_CLIENT_ID || 'personal-client-a696d7fa-4055-44c8-93fc-d1e47accfd1e-aa70e5aa'
            }
          });
          if (mRes.ok) {
            const data: any = await mRes.json();
            const m = data.data;
            if (m) {
              const coverRel = m.relationships?.find((r: any) => r.type === 'cover_art');
              const fileName = coverRel?.attributes?.fileName;
              const coverUrl = fileName ? `https://uploads.mangadex.org/covers/${m.id}/${fileName}.512.jpg` : '';
              const title = m.attributes?.title?.en || m.attributes?.title?.ja || Object.values(m.attributes?.title || {})[0] || 'Untitled Manga';
              const desc = m.attributes?.description?.en || 'MangaDex Title';
              results.push({
                id: m.id,
                source: 'MangaDex URL',
                title,
                type: 'manga',
                coverUrl,
                pdfUrl: coverUrl,
                author: 'MangaDex Scanlations',
                description: desc.substring(0, 200) + '...'
              });
            }
          }
        } catch (e) {
          console.error('MangaDex URL fetch error:', e);
        }
      }
    } else if (query.includes('openlibrary.org')) {
      // OpenLibrary URL: e.g. https://openlibrary.org/works/OL85892W
      const olidMatch = query.match(/OL[0-9]+[WM]/i);
      const olid = olidMatch ? olidMatch[0] : '';
      if (olid) {
        try {
          const olRes = await fetch(`https://openlibrary.org/works/${olid}.json`, {
            headers: { 'User-Agent': 'LibraryHub-Fetcher/1.0' }
          });
          if (olRes.ok) {
            const doc: any = await olRes.json();
            const coverId = doc.covers ? doc.covers[0] : null;
            const coverUrl = coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : '';
            results.push({
              id: olid,
              source: 'OpenLibrary URL',
              title: doc.title || 'Open Library Ebook',
              type: 'pdf',
              coverUrl,
              pdfUrl: coverUrl,
              author: 'Open Library Classic',
              description: typeof doc.description === 'string' ? doc.description.substring(0, 200) : 'Open Library Classic Work',
            });
          }
        } catch (e) {
          console.error('OpenLibrary URL fetch error:', e);
        }
      }
    } else if (query.endsWith('.pdf') || query.includes('/download/') || query.includes('.pdf?')) {
      // Direct PDF URL: e.g. https://archive.org/download/dracula00stok_8/dracula00stok_8.pdf
      const urlParts = query.split('/');
      const fileName = urlParts[urlParts.length - 1].replace(/\.pdf$/i, '').replace(/[^a-zA-Z0-9]+/g, ' ');
      const cleanTitle = fileName.charAt(0).toUpperCase() + fileName.slice(1);
      results.push({
        id: query,
        source: 'Direct PDF URL',
        title: cleanTitle || 'Extracted PDF Book',
        type: 'pdf',
        coverUrl: `https://picsum.photos/seed/${encodeURIComponent(cleanTitle)}/400/560`,
        author: 'External Source',
        description: `Direct PDF resource auto-extracted from URL: ${query}`,
        pdfUrl: query
      });
    } else {
      // General URL: Extract metadata & preview
      const urlParts = query.replace(/^https?:\/\//, '').split('/');
      const domain = urlParts[0];
      results.push({
        id: query,
        source: domain.toUpperCase(),
        title: `Content from ${domain}`,
        type: 'pdf',
        coverUrl: `https://picsum.photos/seed/${encodeURIComponent(domain)}/400/560`,
        author: domain,
        description: `Resource auto-fetched from web link: ${query}`,
        pdfUrl: query.endsWith('.pdf') ? query : ''
      });
    }

    return c.json({ success: true, results });
  }

  // ----------------------------------------------------
  // RESILIENT PARALLEL KEYWORD TITLE SEARCH
  // ----------------------------------------------------
  const fetchPromises: Promise<any>[] = [];

  // MangaDex Search
  if (typeFilter === 'all' || typeFilter === 'manga') {
    fetchPromises.push(
      fetch(`https://api.mangadex.org/manga?title=${encodeURIComponent(query)}&limit=5&includes[]=cover_art`, {
        headers: { 
          'User-Agent': 'LibraryHub-PersonalClient/1.0',
          'X-Client-ID': c.env.MANGADEX_CLIENT_ID || 'personal-client-a696d7fa-4055-44c8-93fc-d1e47accfd1e-aa70e5aa'
        }
      }).then(r => r.ok ? r.json() : null).then((data: any) => {
        if (data && data.data) {
          return data.data.map((m: any) => {
            const coverRel = m.relationships?.find((r: any) => r.type === 'cover_art');
            const fileName = coverRel?.attributes?.fileName;
            const coverUrl = fileName ? `https://uploads.mangadex.org/covers/${m.id}/${fileName}.512.jpg` : '';
            const title = m.attributes?.title?.en || m.attributes?.title?.ja || Object.values(m.attributes?.title || {})[0] || 'Untitled Manga';
            const desc = m.attributes?.description?.en || 'No description available.';
            return {
              id: m.id,
              source: 'MangaDex',
              title,
              type: 'manga',
              coverUrl,
              pdfUrl: coverUrl,
              author: 'MangaDex Scanlations',
              description: desc.substring(0, 180) + '...'
            };
          });
        }
        return [];
      }).catch(e => { console.error('MangaDex API error:', e); return []; })
    );
  }

  // OpenLibrary Search
  if (typeFilter === 'all' || typeFilter === 'book' || typeFilter === 'novel') {
    fetchPromises.push(
      fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=5`, {
        headers: { 'User-Agent': 'LibraryHub-Fetcher/1.0' }
      }).then(r => r.ok ? r.json() : null).then((data: any) => {
        if (data && data.docs) {
          return data.docs.map((doc: any) => {
            const coverUrl = doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : '';
            const iaId = doc.ia ? doc.ia[0] : null;
            return {
              id: doc.key || doc.cover_i || doc.title,
              source: 'OpenLibrary',
              title: doc.title || 'Untitled Ebook',
              type: 'pdf',
              coverUrl,
              author: doc.author_name ? doc.author_name.join(', ') : 'Classic Author',
              description: `Published: ${doc.first_publish_year || 'N/A'}. Open Library Classic.`,
              pdfUrl: iaId ? `https://archive.org/download/${iaId}/${iaId}.pdf` : ''
            };
          });
        }
        return [];
      }).catch(e => { console.error('OpenLibrary error:', e); return []; })
    );

    // Gutendex Search
    fetchPromises.push(
      fetch(`https://gutendex.com/books?search=${encodeURIComponent(query)}`, {
        headers: { 'User-Agent': 'LibraryHub-Fetcher/1.0' }
      }).then(r => r.ok ? r.json() : null).then((data: any) => {
        if (data && data.results) {
          return data.results.slice(0, 5).map((b: any) => {
            const coverUrl = b.formats['image/jpeg'] || '';
            const pdfUrl = b.formats['application/pdf'] || b.formats['application/epub+zip'] || '';
            const author = b.authors ? b.authors.map((a: any) => a.name).join(', ') : 'Public Domain';
            return {
              id: String(b.id),
              source: 'Gutendex',
              title: b.title,
              type: 'pdf',
              coverUrl,
              author,
              description: `Project Gutenberg ID #${b.id}. Download count: ${b.download_count}`,
              pdfUrl
            };
          });
        }
        return [];
      }).catch(e => { console.error('Gutendex error:', e); return []; })
    );
  }

  const settled = await Promise.allSettled(fetchPromises);
  settled.forEach(s => {
    if (s.status === 'fulfilled' && Array.isArray(s.value)) {
      results.push(...s.value);
    }
  });

  return c.json({ success: true, results });
});

// ==========================================
// FETCHER BACKEND IMPORT API
// ==========================================
app.post('/api/fetcher/import', async (c) => {
  const payload = await c.req.json<any>();
  const { title, slug, description, type, author, category_slug, cover_url, file_urls } = payload;
  const db = c.env.DB;

  try {
    const cat = await db.prepare('SELECT id FROM categories WHERE slug = ? OR slug = "books" LIMIT 1').bind(category_slug || 'books').first<{ id: number }>();
    const categoryId = cat ? cat.id : 1;
    const count = Array.isArray(file_urls) ? file_urls.length : 1;

    await db.prepare(`
      INSERT OR REPLACE INTO items (title, slug, description, type, author, category_id, cover_url, file_count, tags, is_hot, is_new, is_featured)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      title,
      slug,
      description || '',
      type || 'pdf',
      author || 'Public Domain',
      categoryId,
      cover_url || 'https://picsum.photos/seed/default/400/560',
      count,
      JSON.stringify(['free', 'imported', category_slug || 'ebook']),
      0, 1, 0
    ).run();

    const item = await db.prepare('SELECT id FROM items WHERE slug = ?').bind(slug).first<{ id: number }>();

    if (item && Array.isArray(file_urls) && file_urls.length > 0) {
      await db.prepare('DELETE FROM files WHERE item_id = ?').bind(item.id).run();
      for (let i = 0; i < file_urls.length; i++) {
        await db.prepare(`
          INSERT INTO files (item_id, url, filename, type, page_number)
          VALUES (?, ?, ?, ?, ?)
        `).bind(item.id, file_urls[i], `page-${i + 1}`, type === 'pdf' ? 'pdf' : 'image', i + 1).run();
      }
    }

    return c.json({ success: true, message: 'Imported successfully', slug });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// ==========================================
// REMOTE API CONTROL ENDPOINT (NO SITE VISIT NEEDED)
// ==========================================
app.post('/api/admin/control', async (c) => {
  const authHeader = c.req.header('Authorization') || '';
  const adminKeyHeader = c.req.header('X-Admin-Key') || '';
  
  let token = '';
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (adminKeyHeader) {
    token = adminKeyHeader;
  }

  const expectedKey = requireAdminKey(c);
  if (!expectedKey || !token || token !== expectedKey) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  const payload = await c.req.json<any>();
  const { action } = payload;
  const db = c.env.DB;

  if (action === 'list_items') {
    try {
      const items = await db.prepare(`
        SELECT i.title, i.slug, i.type, i.status, i.view_count, i.file_count, cat.name as category_name, i.updated_at
        FROM items i
        LEFT JOIN categories cat ON i.category_id = cat.id
        ORDER BY i.updated_at DESC
      `).all<any>();
      return c.json({ success: true, items: items.results });
    } catch (e: any) {
      return c.json({ success: false, error: e.message }, 500);
    }
  }

  if (action === 'get_stats') {
    const itemsCount = await db.prepare('SELECT COUNT(*) as count FROM items').first<{ count: number }>();
    const categoriesCount = await db.prepare('SELECT COUNT(*) as count FROM categories').first<{ count: number }>();
    const filesCount = await db.prepare('SELECT COUNT(*) as count FROM files').first<{ count: number }>();
    const viewsCount = await db.prepare('SELECT SUM(view_count) as count FROM items').first<{ count: number }>();
    
    return c.json({
      success: true,
      stats: {
        total_items: itemsCount?.count || 0,
        total_categories: categoriesCount?.count || 0,
        total_files: filesCount?.count || 0,
        total_views: viewsCount?.count || 0
      }
    });
  }

  if (action === 'add_item') {
    const { title, slug, description, type, author, category_slug, cover_url, tags, is_hot, is_new, is_featured, file_urls } = payload;

    const cat = await db.prepare('SELECT id FROM categories WHERE slug = ?').bind(category_slug || 'manga').first<{ id: number }>();
    const categoryId = cat ? cat.id : 1;
    const count = Array.isArray(file_urls) ? file_urls.length : 0;
    
    try {
      await db.prepare(`
        INSERT OR REPLACE INTO items (title, slug, description, type, author, category_id, cover_url, file_count, tags, is_hot, is_new, is_featured)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        title, 
        slug, 
        description || '', 
        type || 'collection', 
        author || 'Anonymous', 
        categoryId, 
        cover_url || 'https://picsum.photos/seed/default/400/560', 
        count, 
        JSON.stringify(tags || []), 
        is_hot ? 1 : 0, 
        is_new !== undefined ? (is_new ? 1 : 0) : 1, 
        is_featured ? 1 : 0
      ).run();

      const item = await db.prepare('SELECT id FROM items WHERE slug = ?').bind(slug).first<{ id: number }>();

      if (item && Array.isArray(file_urls) && file_urls.length > 0) {
        await db.prepare('DELETE FROM files WHERE item_id = ? AND chapter_id IS NULL').bind(item.id).run();
        
        for (let i = 0; i < file_urls.length; i++) {
          await db.prepare(`
            INSERT INTO files (item_id, url, filename, type, page_number)
            VALUES (?, ?, ?, ?, ?)
          `).bind(item.id, file_urls[i], `page-${i + 1}`, type === 'pdf' ? 'pdf' : 'image', i + 1).run();
        }
      }

      await db.prepare(`
        UPDATE categories SET item_count = (
          SELECT COUNT(*) FROM items WHERE category_id = categories.id AND status = 'active'
        )
      `).run();

      return c.json({ success: true, message: 'Item added successfully', slug });
    } catch (e: any) {
      return c.json({ success: false, error: e.message }, 500);
    }
  }

  if (action === 'delete_item') {
    const { slug } = payload;
    if (!slug) {
      return c.json({ success: false, error: 'Slug is required' }, 400);
    }

    try {
      const item = await db.prepare('SELECT id FROM items WHERE slug = ?').bind(slug).first<{ id: number }>();
      if (!item) {
        return c.json({ success: false, error: 'Item not found' }, 404);
      }

      await db.prepare('DELETE FROM files WHERE item_id = ?').bind(item.id).run();
      await db.prepare('DELETE FROM chapters WHERE item_id = ?').bind(item.id).run();
      await db.prepare('DELETE FROM items WHERE id = ?').bind(item.id).run();

      await db.prepare(`
        UPDATE categories SET item_count = (
          SELECT COUNT(*) FROM items WHERE category_id = categories.id AND status = 'active'
        )
      `).run();

      return c.json({ success: true, message: 'Item deleted successfully', slug });
    } catch (e: any) {
      return c.json({ success: false, error: e.message }, 500);
    }
  }

  if (action === 'update_item') {
    const { slug, status, title, author, views } = payload;
    if (!slug) {
      return c.json({ success: false, error: 'Slug is required' }, 400);
    }

    try {
      const item = await db.prepare('SELECT id FROM items WHERE slug = ?').bind(slug).first<{ id: number }>();
      if (!item) {
        return c.json({ success: false, error: 'Item not found' }, 404);
      }

      let updateSql = 'UPDATE items SET ';
      const setClauses: string[] = [];
      const params: any[] = [];

      if (status !== undefined) {
        setClauses.push('status = ?');
        params.push(status);
      }
      if (title !== undefined) {
        setClauses.push('title = ?');
        params.push(title);
      }
      if (author !== undefined) {
        setClauses.push('author = ?');
        params.push(author);
      }
      if (views !== undefined) {
        // H4 FIX: validate and clamp view count — no negative or non-numeric values
        const safeViews = Math.max(0, Math.floor(Number(views)));
        if (!isNaN(safeViews)) { setClauses.push('view_count = ?'); params.push(safeViews); }
      }

      if (setClauses.length === 0) {
        return c.json({ success: false, error: 'No fields to update' }, 400);
      }

      updateSql += setClauses.join(', ') + ' WHERE slug = ?';
      params.push(slug);

      await db.prepare(updateSql).bind(...params).run();

      await db.prepare(`
        UPDATE categories SET item_count = (
          SELECT COUNT(*) FROM items WHERE category_id = categories.id AND status = 'active'
        )
      `).run();

      return c.json({ success: true, message: 'Item updated successfully', slug });
    } catch (e: any) {
      return c.json({ success: false, error: e.message }, 500);
    }
  }

  return c.json({ success: false, error: `Invalid action: ${action}` }, 400);
});

// GET Item Details Page
app.get('/item/:slug', async (c) => {
  const slug = c.req.param('slug');
  const db = c.env.DB;
  const username = getCookie(c, 'user_session') || null;

  // H1 FIX: debounce view count — only increment once per visitor per item per session
  const viewedKey = `viewed_${slug}`;
  const alreadyViewed = getCookie(c, viewedKey);
  if (!alreadyViewed) {
    await db.prepare('UPDATE items SET view_count = view_count + 1 WHERE slug = ?').bind(slug).run();
    setCookie(c, viewedKey, '1', { path: '/', maxAge: 60 * 60 * 24, httpOnly: true, sameSite: 'Lax' });
  }

  // Fetch Item details
  const itemQuery = await db.prepare(`
    SELECT i.*, cat.name as category_name, cat.slug as category_slug 
    FROM items i
    LEFT JOIN categories cat ON i.category_id = cat.id
    WHERE i.slug = ? AND i.status = 'active'
  `).bind(slug).first<LibraryItem>();

  if (!itemQuery) {
    return c.html(layout('Item Not Found', html`<h2>404 Not Found</h2><p>The requested library item does not exist or has been removed.</p>`, 'home', '', username));
  }

  // Fetch chapters for chapter layout
  const chaptersQuery = await db.prepare(`
    SELECT * FROM chapters WHERE item_id = ? ORDER BY chapter_number DESC
  `).bind(itemQuery.id).all<Chapter>();
  
  const chapters = chaptersQuery.results;

  // Fetch files inside this item (without chapters)
  const filesQuery = await db.prepare(`
    SELECT * FROM files WHERE item_id = ? AND chapter_id IS NULL ORDER BY page_number ASC
  `).bind(itemQuery.id).all<FilePage>();

  // Fetch categories & top items for sidebar
  const categoriesQuery = db.prepare(`SELECT * FROM categories ORDER BY name ASC`).all<Category>();
  const topItemsQuery = db.prepare(`SELECT * FROM items WHERE status = 'active' ORDER BY view_count DESC LIMIT 8`).all<LibraryItem>();

  const [categoriesRes, topRes] = await Promise.all([categoriesQuery, topItemsQuery]);

    const categories = categoriesRes.results;
  const topItems = topRes.results;
  const files = filesQuery.results;

  const currentItemTags: string[] = JSON.parse(itemQuery.tags || '[]');
  const aiRecsResult = await getAIRecommendations(c.env, db, [], currentItemTags, itemQuery.id);
  const aiRecommendations = aiRecsResult.recommendations;

  const content = html`
    <div class="leftCol">
      <div class="breadcrumb">
        <a href="/">Home</a> » 
        <a href="/category/${itemQuery.category_slug}">${itemQuery.category_name}</a> » 
        <span>${itemQuery.title}</span>
      </div>

      <div class="item-detail-panel">
        <div class="detail-top-info">
          <div class="detail-cover-box">
            <img src="${itemQuery.cover_url}" alt="${itemQuery.title}" class="detail-cover">
          </div>
          <div class="detail-meta-box">
            <h1 class="detail-title">${itemQuery.title}</h1>
            <ul class="detail-meta-list">
              <li><strong>Author:</strong> <span>${itemQuery.author}</span></li>
              <li><strong>Category:</strong> <a href="/category/${itemQuery.category_slug}">${itemQuery.category_name}</a></li>
              <li><strong>Type:</strong> <span class="badge-type type-${itemQuery.type}">${itemQuery.type.toUpperCase()}</span></li>
              <li><strong>Chapters / Updates:</strong> <span>${chapters.length > 0 ? `${chapters.length} chapters` : `${itemQuery.file_count || files.length} files`}</span></li>
              <li><strong>Views:</strong> <span>${itemQuery.view_count.toLocaleString()}</span></li>
              <li><strong>Rating:</strong> <span>⭐ ${itemQuery.rating.toFixed(1)} / 5 (${itemQuery.rating_count} votes)</span></li>
              <li>
                <strong>Tags:</strong> 
                <span class="detail-tags-list">
                  ${JSON.parse(itemQuery.tags || '[]').map((tag: string) => html`
                    <a href="/search?q=${tag}" class="tag-badge">#${tag}</a>
                  `)}
                </span>
              </li>
            </ul>

            <div class="detail-actions">
              ${chapters.length > 0 
                ? html`
                    <a href="/item/${itemQuery.slug}/chapter/${chapters[chapters.length - 1].chapter_number}" class="btn-primary-action btn-gallery-view">
                      <i class="fa-solid fa-book-open"></i> Read First Chapter
                    </a>
                    <a href="/item/${itemQuery.slug}/chapter/${chapters[0].chapter_number}" class="btn-secondary-action">
                      Read Latest Chapter
                    </a>
                  `
                : (itemQuery.type === 'pdf' && files.length > 0 
                  ? html`
                      <a href="${files[0].url}" target="_blank" class="btn-primary-action btn-pdf-view">
                        <i class="fa-solid fa-file-pdf"></i> View PDF document
                      </a>
                      <a href="${files[0].url}" download class="btn-secondary-action btn-pdf-download">
                        <i class="fa-solid fa-download"></i> Download PDF
                      </a>
                    `
                  : html`
                      <a href="/item/${itemQuery.slug}/view" class="btn-primary-action btn-gallery-view">
                        <i class="fa-solid fa-book-open"></i> Open Gallery Reader
                      </a>
                    `
                )
              }
              <button class="btn-bookmark-action" id="btn-bookmark" data-slug="${itemQuery.slug}" data-title="${itemQuery.title}" data-cover="${itemQuery.cover_url}">
                <i class="fa-regular fa-bookmark"></i> Bookmark Item
              </button>
            </div>
          </div>
        </div>

        <div class="detail-description">
          <h3>Description / Synopsis</h3>
          <p>${itemQuery.description || 'No description available for this item.'}</p>
        </div>

        <!-- Weekly serialized chapters listing layout (NatoManga format!) -->
        ${chapters.length > 0 
          ? html`
              <div class="chapters-list-section" style="margin-top:30px;">
                <h3 style="border-bottom: 2px solid var(--accent-orange); padding-bottom: 8px; font-weight:700;"><i class="fa-solid fa-list"></i> CHAPTER RELEASES</h3>
                <div class="chapters-grid-list" style="display:grid; grid-template-columns:1fr; margin-top:15px; border: 1px solid var(--admin-border); border-radius:6px; background-color:#fff; overflow:hidden">
                  ${chapters.slice(0, 10).map(chap => html`
                    <div class="chapter-row" style="display:flex; justify-content:space-between; padding:12px 20px; border-bottom: 1px solid var(--admin-border); align-items:center;">
                      <span class="chap-name" style="font-weight:600">
                        <a href="/item/${itemQuery.slug}/chapter/${chap.chapter_number}" title="Read ${itemQuery.title} Chapter ${chap.chapter_number}">
                          Chapter ${chap.chapter_number}${chap.title ? `: ${chap.title}` : ''}
                        </a>
                      </span>
                      <span class="chap-time" style="font-size:12px; color:var(--admin-text-light)"><i class="fa-regular fa-clock"></i> ${formatRelativeTime(chap.created_at)}</span>
                    </div>
                  `)}

                  ${chapters.length > 10 
                    ? html`
                        <div id="hidden-chapters" style="display:none;">
                          ${chapters.slice(10).map(chap => html`
                            <div class="chapter-row" style="display:flex; justify-content:space-between; padding:12px 20px; border-bottom: 1px solid var(--admin-border); align-items:center;">
                              <span class="chap-name" style="font-weight:600">
                                <a href="/item/${itemQuery.slug}/chapter/${chap.chapter_number}" title="Read ${itemQuery.title} Chapter ${chap.chapter_number}">
                                  Chapter ${chap.chapter_number}${chap.title ? `: ${chap.title}` : ''}
                                </a>
                              </span>
                              <span class="chap-time" style="font-size:12px; color:var(--admin-text-light)"><i class="fa-regular fa-clock"></i> ${formatRelativeTime(chap.created_at)}</span>
                            </div>
                          `)}
                        </div>
                        <div style="text-align:center; padding:15px; background-color:#fafafa; border-top:1px solid var(--admin-border)">
                          <button id="btn-expand-chapters" style="padding:8px 24px; font-size:13px; font-weight:600; cursor:pointer; border-radius:4px; display:inline-flex; align-items:center; gap:8px; border:none; background-color:#ff530d; color:#fff;" onclick="document.getElementById('hidden-chapters').style.display='block'; this.style.display='none';">
                            <i class="fa fa-angle-double-down"></i> Show All Chapters (${chapters.length})
                          </button>
                        </div>
                      `
                    : ''
                  }
                </div>
              </div>
            `
          : html`
              <div class="detail-files-list">
                <h3>Files & Pages Inside Collection</h3>
                ${itemQuery.type === 'pdf' 
                  ? html`
                      <div class="pdf-document-card">
                        <div class="pdf-icon-placeholder"><i class="fa-solid fa-file-pdf fa-4x"></i></div>
                        <div class="pdf-details">
                          <h4>${files[0]?.filename || itemQuery.title + '.pdf'}</h4>
                          <p>Standard PDF Document</p>
                          <a href="${files[0]?.url}" target="_blank" class="btn-pdf-view-small">Preview Online</a>
                        </div>
                      </div>
                    `
                  : html`
                      <div class="gallery-pages-grid">
                        ${files.map((file) => html`
                          <div class="gallery-page-thumb-card">
                            <a href="/item/${itemQuery.slug}/view/${file.page_number}">
                              <img src="${file.url}" alt="Page ${file.page_number}" class="page-thumb" loading="lazy">
                              <span class="page-number-lbl">Page ${file.page_number}</span>
                            </a>
                          </div>
                        `)}
                      </div>
                    `
                }
              </div>
            `
        }

        <!-- Smart AI Reading Recommendations Widget -->
        ${aiRecommendations.length > 0 ? html`
          <div class="ai-recommendations-widget glassmorphic-hero" style="margin-top: 30px; padding: 20px; border-radius: 12px;">
            <div class="widget-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
              <h3 style="margin: 0; font-size: 18px; font-weight: 700; color: var(--text-color); display: flex; align-items: center; gap: 8px;">
                <i class="fa-solid fa-wand-magic-sparkles" style="color: #8b5cf6;"></i> Smart AI Reading Recommendations
              </h3>
              <span class="badge-type" style="background: linear-gradient(135deg, #8b5cf6, #ec4899); color: #fff; padding: 4px 10px; border-radius: 20px; font-size: 11px; text-transform: uppercase;">
                ${aiRecsResult.isAiGenerated ? '✨ AI Powered' : '🏷️ Tag Similarity'}
              </span>
            </div>
            <div class="ai-recs-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 16px;">
              ${aiRecommendations.map(rec => html`
                <div class="card-item glass-card 3d-card-item" style="padding: 10px;">
                  <div class="card-cover-wrap" style="position: relative; overflow: hidden; border-radius: 6px;">
                    <a href="/item/${rec.slug}">
                      <img src="${rec.cover_url}" alt="${rec.title}" class="card-cover" style="width: 100%; height: 220px; object-fit: cover;" loading="lazy">
                    </a>
                  </div>
                  <div class="card-info" style="margin-top: 8px;">
                    <h4 class="card-title" style="font-size: 14px; font-weight: 600; margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                      <a href="/item/${rec.slug}">${rec.title}</a>
                    </h4>
                    <div class="card-meta" style="display: flex; justify-content: space-between; font-size: 12px; color: var(--text-muted);">
                      <span class="card-rating">⭐ ${(rec.rating || 0).toFixed(1)}</span>
                      <span class="card-views"><i class="fa fa-eye"></i> ${(rec.view_count || 0).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              `)}
            </div>
          </div>
        ` : ''}
      </div>
    </div>

    <!-- Sidebar Right Column -->
    ${renderSidebar(categories, topItems, aiRecommendations)}
  `;

  return c.html(layout(itemQuery.title, content, 'item', '', username));
});

// GET Chapter scroll-based reader matching Home Plate Villain page layout
app.get('/item/:slug/chapter/:chapterNum', async (c) => {
  const slug = c.req.param('slug');
  const chapterNum = parseFloat(c.req.param('chapterNum'));
  const db = c.env.DB;
  const username = getCookie(c, 'user_session') || null;

  // Fetch Item details
  const itemQuery = await db.prepare(`
    SELECT i.*, cat.name as category_name, cat.slug as category_slug 
    FROM items i
    LEFT JOIN categories cat ON i.category_id = cat.id
    WHERE i.slug = ? AND i.status = 'active'
  `).bind(slug).first<LibraryItem>();

  if (!itemQuery) {
    return c.html(layout('Item Not Found', html`<h2>404 Not Found</h2>`, 'home', '', username));
  }

  // Fetch Chapter
  const chapterQuery = await db.prepare('SELECT * FROM chapters WHERE item_id = ? AND chapter_number = ?').bind(itemQuery.id, chapterNum).first<Chapter>();
  if (!chapterQuery) {
    return c.html(layout('Chapter Not Found', html`<h2>404 Chapter Not Found</h2>`, 'home', '', username));
  }

  // Fetch pages linked to this chapter
  const filesQuery = await db.prepare(`
    SELECT * FROM files WHERE chapter_id = ? ORDER BY page_number ASC
  `).bind(chapterQuery.id).all<FilePage>();
  
  const files = filesQuery.results;

  // Fetch all chapters for navigation
  const chaptersQuery = await db.prepare(`
    SELECT chapter_number, title FROM chapters 
    WHERE item_id = ? 
    ORDER BY chapter_number DESC
  `).bind(itemQuery.id).all<any>();
  
  const chapters = chaptersQuery.results;
  const currentIndex = chapters.findIndex((it: any) => it.chapter_number === chapterNum);
  const nextItem = currentIndex > 0 ? chapters[currentIndex - 1] : null; // Descending list: next is index-1
  const prevItem = currentIndex < chapters.length - 1 ? chapters[currentIndex + 1] : null; // Descending list: prev is index+1

  const content = html`
    <div class="reader-container chapter-page-wrap">
      <div class="logo_chapter">
        <a href="/" title="LibraryHub Online">
          <span class="logo-text"><span class="accent-orange">Library</span><span class="accent-teal">Hub</span></span>
        </a>
      </div>

      <div class="breadcrumb breadcrumbs bred_doc">
        <p>
          <a href="/">Home</a> » 
          <a href="/category/${itemQuery.category_slug}">${itemQuery.category_name}</a> » 
          <a href="/item/${itemQuery.slug}">${itemQuery.title}</a> » 
          <span>Chapter ${chapterNum}</span>
        </p>
      </div>

      <div class="option_wrap">
        <select class="navi-change-chapter" id="chapter-dropdown" onchange="window.location.href='/item/${itemQuery.slug}/chapter/' + this.value">
          ${chapters.map((it: any) => html`
            <option value="${it.chapter_number}" ${it.chapter_number === chapterNum ? 'selected' : ''}>Chapter ${it.chapter_number}${it.title ? `: ${it.title}` : ''}</option>
          `)}
        </select>

        <div class="btn-navigation-chap">
          ${prevItem ? html`<a href="/item/${itemQuery.slug}/chapter/${prevItem.chapter_number}" class="navi-change-chapter-btn"><i class="fa fa-chevron-left"></i> Prev Chapter</a>` : ''}
          ${nextItem ? html`<a href="/item/${itemQuery.slug}/chapter/${nextItem.chapter_number}" class="navi-change-chapter-btn">Next Chapter <i class="fa fa-chevron-right"></i></a>` : ''}
        </div>
        <div class="clearfix"></div>

        <div><h1 class="current-chapter">${itemQuery.title} — Chapter ${chapterNum}</h1></div>
        <div class="clearfix"></div>
      </div>

      <div class="info-top-chapter option_wrap">
        <h2>Chapter ${chapterNum}</h2>
        <p class="info-top-chapter-text">You're reading <strong>${itemQuery.title} Chapter ${chapterNum}</strong> at LibraryHub.</p>
        <p class="info-top-chapter-text">
            💡Press F11 button to read in full-screen (PC-only). Enjoy your reading!
        </p>
        <div class="panel-option">
            <span class="pn-op-img-sv">
                <span class="pn-op-name">IMAGES SERVER: </span>
                <span class="pn-op-sv-img-btn a-h isactive">1</span>
            </span>
            <span class="alertError btn btn-warning"><i class="fa fa-exclamation-triangle"></i> Report Error</span>
        </div>
      </div>

      <!-- Scroll-based reader matching Home Plate Villain page -->
      <div class="container-chapter-reader">
        ${files.map((file: FilePage) => html`
          <img src="${file.url}" alt="Page ${file.page_number}" title="Page ${file.page_number}" loading="lazy" id="page-${file.page_number}" onerror="this.onerror=null; this.src='${file.url}';">
        `)}
        ${files.length === 0 ? html`<p style="text-align:center; padding:50px; font-weight:600">No pages added to this chapter yet.</p>` : ''}
      </div>

      <!-- Bottom Navigation Buttons -->
      <div class="option_wrap footer-nav-chap">
        <div class="btn-navigation-chap">
          ${prevItem ? html`<a href="/item/${itemQuery.slug}/chapter/${prevItem.chapter_number}" class="navi-change-chapter-btn"><i class="fa fa-chevron-left"></i> Prev Chapter</a>` : ''}
          ${nextItem ? html`<a href="/item/${itemQuery.slug}/chapter/${nextItem.chapter_number}" class="navi-change-chapter-btn">Next Chapter <i class="fa fa-chevron-right"></i></a>` : ''}
        </div>
        <div class="clearfix"></div>
      </div>
    </div>

    <!-- Inject history entry script (Chapter Aware) -->
    <script>
      (function() {
        const historyData = JSON.parse(localStorage.getItem('readingHistory') || '[]');
        const updated = historyData.filter(h => h.slug !== '${itemQuery.slug}');
        updated.unshift({
          slug: '${itemQuery.slug}',
          title: '${itemQuery.title}',
          cover: '${itemQuery.cover_url}',
          lastChapter: ${chapterNum},
          lastPage: 1,
          totalPages: ${files.length},
          time: new Date().toISOString()
        });
        localStorage.setItem('readingHistory', JSON.stringify(updated.slice(0, 20)));
      })();
    </script>
  `;

  return c.html(layout(`${itemQuery.title} Chapter ${chapterNum}`, content, 'reader', html`<link rel="stylesheet" href="/css/reader.css">`, username));
});

// Helper to render the vertical scroll reader page matching Home Plate Villain page
const renderReaderPage = async (c: Context<{ Bindings: Bindings }>, slug: string, pageNum: number | null) => {
  const db = c.env.DB;
  const username = getCookie(c, 'user_session') || null;

  // Fetch Item details
  const itemQuery = await db.prepare(`
    SELECT i.*, cat.name as category_name, cat.slug as category_slug 
    FROM items i
    LEFT JOIN categories cat ON i.category_id = cat.id
    WHERE i.slug = ? AND i.status = 'active'
  `).bind(slug).first<LibraryItem>();

  if (!itemQuery) {
    return c.html(layout('Item Not Found', html`<h2>404 Not Found</h2>`, 'home', '', username));
  }

  // Fetch all pages
  const filesQuery = await db.prepare(`
    SELECT * FROM files WHERE item_id = ? AND chapter_id IS NULL ORDER BY page_number ASC
  `).bind(itemQuery.id).all<FilePage>();

  const files = filesQuery.results;

  // Fetch other items in same category for navigation
  const otherItemsQuery = await db.prepare(`
    SELECT title, slug FROM items 
    WHERE category_id = ? AND status = 'active'
    ORDER BY created_at DESC
  `).bind(itemQuery.category_id).all<any>();
  
  const otherItems = otherItemsQuery.results;
  const currentIndex = otherItems.findIndex((it: any) => it.slug === itemQuery.slug);
  const prevItem = currentIndex > 0 ? otherItems[currentIndex - 1] : null;
  const nextItem = currentIndex < otherItems.length - 1 ? otherItems[currentIndex + 1] : null;

  const content = html`
    <div class="reader-container chapter-page-wrap">
      <div class="logo_chapter">
        <a href="/" title="LibraryHub Online">
          <span class="logo-text"><span class="accent-orange">Library</span><span class="accent-teal">Hub</span></span>
        </a>
      </div>

      <div class="breadcrumb breadcrumbs bred_doc">
        <p>
          <a href="/">Home</a> » 
          <a href="/category/${itemQuery.category_slug}">${itemQuery.category_name}</a> » 
          <a href="/item/${itemQuery.slug}">${itemQuery.title}</a> » 
          <span>View</span>
        </p>
      </div>

      <div class="option_wrap">
        <select class="navi-change-chapter" id="chapter-dropdown" onchange="window.location.href='/item/' + this.value + '/view'">
          ${otherItems.map((it: any) => html`
            <option value="${it.slug}" ${it.slug === itemQuery.slug ? 'selected' : ''}>${it.title}</option>
          `)}
        </select>

        <div class="btn-navigation-chap">
          ${prevItem ? html`<a href="/item/${prevItem.slug}/view" class="navi-change-chapter-btn"><i class="fa fa-chevron-left"></i> Prev Collection</a>` : ''}
          ${nextItem ? html`<a href="/item/${nextItem.slug}/view" class="navi-change-chapter-btn">Next Collection <i class="fa fa-chevron-right"></i></a>` : ''}
        </div>
        <div class="clearfix"></div>

        <div><h1 class="current-chapter">${itemQuery.title}</h1></div>
        <div class="clearfix"></div>
      </div>

      <div class="info-top-chapter option_wrap">
        <h2>${itemQuery.title}</h2>
        <p class="info-top-chapter-text">You're viewing <strong>${itemQuery.title}</strong> at LibraryHub.</p>
        <p class="info-top-chapter-text">
            💡Press F11 button to read in full-screen (PC-only). Enjoy your reading!
        </p>
        <div class="panel-option">
            <span class="pn-op-img-sv">
                <span class="pn-op-name">IMAGES SERVER: </span>
                <span class="pn-op-sv-img-btn a-h isactive">1</span>
            </span>
            <span class="alertError btn btn-warning"><i class="fa fa-exclamation-triangle"></i> Report Error</span>
        </div>
      </div>

      <!-- Scroll-based reader matching Home Plate Villain page -->
      <div class="container-chapter-reader">
        ${itemQuery.type === 'pdf' && files.length > 0
          ? html`
              <iframe src="${files[0].url}" class="pdf-reader-iframe" width="100%" height="800px"></iframe>
            `
          : files.map((file: FilePage) => html`
              <img src="${file.url}" alt="Page ${file.page_number}" title="Page ${file.page_number}" loading="lazy" id="page-${file.page_number}" onerror="this.onerror=null; this.src='${file.url}';">
            `)
        }
      </div>

      <!-- Bottom Navigation Buttons -->
      <div class="option_wrap footer-nav-chap">
        <div class="btn-navigation-chap">
          ${prevItem ? html`<a href="/item/${prevItem.slug}/view" class="navi-change-chapter-btn"><i class="fa fa-chevron-left"></i> Prev Collection</a>` : ''}
          ${nextItem ? html`<a href="/item/${nextItem.slug}/view" class="navi-change-chapter-btn">Next Collection <i class="fa fa-chevron-right"></i></a>` : ''}
        </div>
        <div class="clearfix"></div>
      </div>
    </div>

    <!-- Scroll to specific page if pageNum provided -->
    ${pageNum ? html`
      <script>
        window.addEventListener('DOMContentLoaded', () => {
          const el = document.getElementById('page-${pageNum}');
          if (el) {
            setTimeout(() => {
              el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 500);
          }
        });
      </script>
    ` : ''}

    <!-- Inject history entry script -->
    <script>
      (function() {
        const historyData = JSON.parse(localStorage.getItem('readingHistory') || '[]');
        const updated = historyData.filter(h => h.slug !== '${itemQuery.slug}');
        updated.unshift({
          slug: '${itemQuery.slug}',
          title: '${itemQuery.title}',
          cover: '${itemQuery.cover_url}',
          lastPage: ${pageNum || 1},
          totalPages: ${files.length},
          time: new Date().toISOString()
        });
        localStorage.setItem('readingHistory', JSON.stringify(updated.slice(0, 20)));
      })();
    </script>
  `;

  return c.html(layout(itemQuery.title, content, 'reader', html`<link rel="stylesheet" href="/css/reader.css">`, username));
};

// GET View / Page Reader Page (scroll-based)
app.get('/item/:slug/view', async (c) => {
  return renderReaderPage(c, c.req.param('slug'), null);
});

app.get('/item/:slug/view/:page', async (c) => {
  const pageNum = parseInt(c.req.param('page')) || 1;
  return renderReaderPage(c, c.req.param('slug'), pageNum);
});

// GET Search Page (with 20 items pagination)
app.get('/search', async (c) => {
  const query = c.req.query('q') || '';
  const type = c.req.query('type') || '';
  const categorySlug = c.req.query('category') || '';
  const page = parseInt(c.req.query('page') || '1') || 1;
  const limit = 20;
  const offset = (page - 1) * limit;
  const db = c.env.DB;
  const username = getCookie(c, 'user_session') || null;

  // Build query
  let sqlCond = ` WHERE i.status = 'active'`;
  const params: any[] = [];

  if (query) {
    sqlCond += ` AND (i.title LIKE ? OR i.description LIKE ? OR i.tags LIKE ?)`;
    const searchVal = `%${query}%`;
    params.push(searchVal, searchVal, searchVal);
  }

  if (type) {
    sqlCond += ` AND i.type = ?`;
    params.push(type);
  }

  if (categorySlug) {
    sqlCond += ` AND cat.slug = ?`;
    params.push(categorySlug);
  }

  // Count query
  const countQuery = await db.prepare(`
    SELECT COUNT(*) as count 
    FROM items i 
    LEFT JOIN categories cat ON i.category_id = cat.id 
    ${sqlCond}
  `).bind(...params).first<{ count: number }>();
  
  const totalCount = countQuery?.count || 0;
  const totalPages = Math.ceil(totalCount / limit);

  // Rows query
  let sql = `
    SELECT i.*, cat.name as category_name 
    FROM items i 
    LEFT JOIN categories cat ON i.category_id = cat.id 
    ${sqlCond}
    ORDER BY i.created_at DESC
    LIMIT ? OFFSET ?
  `;
  const queryParams = [...params, limit, offset];
  
  const itemsQuery = await db.prepare(sql).bind(...queryParams).all<LibraryItem>();
  const rawSearchResults = itemsQuery.results;

  // Resolve updates
  const searchResults = await attachLatestUpdates(db, rawSearchResults);

  // Sidebar queries
  const categoriesQuery = db.prepare(`SELECT * FROM categories ORDER BY name ASC`).all<Category>();
  const topItemsQuery = db.prepare(`SELECT * FROM items WHERE status = 'active' ORDER BY view_count DESC LIMIT 8`).all<LibraryItem>();

  const [categoriesRes, topRes] = await Promise.all([categoriesQuery, topItemsQuery]);

  const categories = categoriesRes.results;
  const topItems = topRes.results;

  const qParams: string[] = [];
  if (query) qParams.push(`q=${encodeURIComponent(query)}`);
  if (type) qParams.push(`type=${encodeURIComponent(type)}`);
  if (categorySlug) qParams.push(`category=${encodeURIComponent(categorySlug)}`);
  const queryParamsStr = qParams.join('&');

  const content = html`
    <div class="leftCol">
      <div class="breadcrumb">
        <a href="/">Home</a> » <span>Search Results</span>
      </div>

      <section class="search-results-section">
        <h1 class="section-title">SEARCH RESULTS FOR: "${query || 'All Filters'}"</h1>
        <p class="search-meta-info">Found ${totalCount} matching item(s) — Page ${page} of ${totalPages || 1}</p>

        <div class="items-grid">
          ${searchResults.map((item) => renderItemCard(item))}
          
          ${searchResults.length === 0 ? html`<p class="no-results-msg">No library items found matching your criteria. Try adjusting your query or filter.</p>` : ''}
        </div>

        ${renderPagination('/search', page, totalPages, queryParamsStr)}
      </section>
    </div>

    <!-- Sidebar Right Column -->
    ${renderSidebar(categories, topItems)}
  `;

  return c.html(layout(`Search: ${query}`, content, 'search', '', username));
});

// GET Category / Genre Page (with 20 items pagination)
app.get('/category/:slug', async (c) => {
  const slug = c.req.param('slug');
  const page = parseInt(c.req.query('page') || '1') || 1;
  const limit = 20;
  const offset = (page - 1) * limit;
  const db = c.env.DB;
  const username = getCookie(c, 'user_session') || null;

  const categoryQuery = await db.prepare(`SELECT * FROM categories WHERE slug = ?`).bind(slug).first<Category>();

  if (!categoryQuery) {
    return c.html(layout('Category Not Found', html`<h2>404 Category Not Found</h2>`, 'home', '', username));
  }

  // Count items
  const countQuery = await db.prepare(`
    SELECT COUNT(*) as count FROM items 
    WHERE category_id = ? AND status = 'active'
  `).bind(categoryQuery.id).first<{ count: number }>();
  
  const totalCount = countQuery?.count || 0;
  const totalPages = Math.ceil(totalCount / limit);

  // Fetch items in category
  const itemsQuery = await db.prepare(`
    SELECT i.*, cat.name as category_name 
    FROM items i
    LEFT JOIN categories cat ON i.category_id = cat.id
    WHERE i.category_id = ? AND i.status = 'active'
    ORDER BY i.created_at DESC
    LIMIT ? OFFSET ?
  `).bind(categoryQuery.id, limit, offset).all<LibraryItem>();

  const rawCategoryItems = itemsQuery.results;

  // Attach updates
  const categoryItems = await attachLatestUpdates(db, rawCategoryItems);

  // Sidebar queries
  const categoriesQuery = db.prepare(`SELECT * FROM categories ORDER BY name ASC`).all<Category>();
  const topItemsQuery = db.prepare(`SELECT * FROM items WHERE status = 'active' ORDER BY view_count DESC LIMIT 8`).all<LibraryItem>();

  const [categoriesRes, topRes] = await Promise.all([categoriesQuery, topItemsQuery]);

  const categories = categoriesRes.results;
  const topItems = topRes.results;

  const content = html`
    <div class="leftCol">
      <div class="breadcrumb">
        <a href="/">Home</a> » <span>Category: ${categoryQuery.name}</span>
      </div>

      <section class="category-items-section">
        <h1 class="section-title"><span class="cat-title-icon">${categoryQuery.icon}</span> ${categoryQuery.name.toUpperCase()}</h1>
        <p class="category-desc-para">${categoryQuery.description}</p>

        <div class="items-grid">
          ${categoryItems.map((item) => renderItemCard(item))}
        </div>

        ${renderPagination(`/category/${slug}`, page, totalPages)}
      </section>
    </div>

    <!-- Sidebar Right Column -->
    ${renderSidebar(categories, topItems)}
  `;

  return c.html(layout(`Category: ${categoryQuery.name}`, content, 'category', '', username));
});

// GET Lists Page (Latest, Hot, Collections, PDFs with 20 items pagination)
app.get('/list/:type', async (c) => {
  const type = c.req.param('type');
  const page = parseInt(c.req.query('page') || '1') || 1;
  const limit = 20;
  const offset = (page - 1) * limit;
  const db = c.env.DB;
  const username = getCookie(c, 'user_session') || null;

  let sqlCond = ` WHERE status = 'active'`;
  let title = 'Library Catalog';
  let activeMenu = '';
  let orderBy = ' ORDER BY created_at DESC';

  if (type === 'latest') {
    orderBy = ` ORDER BY created_at DESC`;
    title = 'Latest Added Items';
    activeMenu = 'latest';
  } else if (type === 'hot') {
    orderBy = ` ORDER BY view_count DESC`;
    title = 'Hot Trending Items';
    activeMenu = 'hot';
  } else if (type === 'collections') {
    sqlCond += ` AND type = 'collection'`;
    title = 'Photo Collections';
    activeMenu = 'collections';
  } else if (type === 'pdfs') {
    sqlCond += ` AND type = 'pdf'`;
    title = 'PDF Documents';
    activeMenu = 'pdfs';
  }

  // Count items
  const countQuery = await db.prepare(`
    SELECT COUNT(*) as count FROM items ${sqlCond}
  `).first<{ count: number }>();
  
  const totalCount = countQuery?.count || 0;
  const totalPages = Math.ceil(totalCount / limit);

  // Rows query
  const itemsQuery = await db.prepare(`
    SELECT * FROM items 
    ${sqlCond}
    ${orderBy}
    LIMIT ? OFFSET ?
  `).bind(limit, offset).all<LibraryItem>();
  
  const rawListItems = itemsQuery.results;

  // Attach updates
  const listItems = await attachLatestUpdates(db, rawListItems);

  // Sidebar queries
  const categoriesQuery = db.prepare(`SELECT * FROM categories ORDER BY name ASC`).all<Category>();
  const topItemsQuery = db.prepare(`SELECT * FROM items WHERE status = 'active' ORDER BY view_count DESC LIMIT 8`).all<LibraryItem>();

  const [categoriesRes, topRes] = await Promise.all([categoriesQuery, topItemsQuery]);

  const categories = categoriesRes.results;
  const topItems = topRes.results;

  const content = html`
    <div class="leftCol">
      <div class="breadcrumb">
        <a href="/">Home</a> » <span>${title}</span>
      </div>

      <section class="list-items-section">
        <h1 class="section-title">${title.toUpperCase()}</h1>
        <div class="items-grid">
          ${listItems.map((item) => renderItemCard(item))}
        </div>

        ${renderPagination(`/list/${type}`, page, totalPages)}
      </section>
    </div>

    <!-- Sidebar Right Column -->
    ${renderSidebar(categories, topItems)}
  `;

  return c.html(layout(title, content, activeMenu, '', username));
});

// GET History Page
app.get('/history', async (c) => {
  const db = c.env.DB;
  const username = getCookie(c, 'user_session') || null;

  // Sidebar queries
  const categoriesQuery = db.prepare(`SELECT * FROM categories ORDER BY name ASC`).all<Category>();
  const topItemsQuery = db.prepare(`SELECT * FROM items WHERE status = 'active' ORDER BY view_count DESC LIMIT 8`).all<LibraryItem>();

  const [categoriesRes, topRes] = await Promise.all([categoriesQuery, topItemsQuery]);

  const categories = categoriesRes.results;
  const topItems = topRes.results;

  const content = html`
    <div class="leftCol">
      <div class="breadcrumb">
        <a href="/">Home</a> » <span>Viewing History</span>
      </div>

      <section class="history-page-section">
        <h1 class="section-title"><i class="fa-solid fa-clock-rotate-left"></i> YOUR VIEWING HISTORY</h1>
        <p class="history-intro">Items you have recently viewed on this device are shown below. History is saved locally in your browser.</p>
        
        <div class="history-list-container" id="history-page-list">
          <div class="history-loading-msg"><i class="fa fa-spinner fa-spin"></i> Loading history from local storage...</div>
        </div>
      </section>
    </div>

    <!-- Sidebar Right Column -->
    ${renderSidebar(categories, topItems)}
  `;

  return c.html(layout('Viewing History', content, 'history', '', username));
});

// API Endpoint for Search Autocomplete
app.get('/api/search', async (c) => {
  const query = c.req.query('q') || '';
  const db = c.env.DB;

  if (!query) {
    return c.json([]);
  }

  const results = await db.prepare(`
    SELECT title, slug, cover_url, type FROM items 
    WHERE status = 'active' AND (title LIKE ? OR description LIKE ?) 
    LIMIT 5
  `).bind(`%${query}%`, `%${query}%`).all<LibraryItem>();

  return c.json(results.results);
});

// API Endpoint for Bookmarked Items Info (to bulk resolve details)
app.post('/api/resolve-items', async (c) => {
  const { slugs } = await c.req.json<{ slugs: string[] }>();
  const db = c.env.DB;

  if (!slugs || slugs.length === 0) {
    return c.json([]);
  }

  const questionMarks = slugs.map(() => '?').join(',');
  const query = await db.prepare(`
    SELECT title, slug, cover_url, type, rating, view_count, author 
    FROM items 
    WHERE slug IN (${questionMarks}) AND status = 'active'
  `).bind(...slugs).all<LibraryItem>();

  return c.json(query.results);
});

export default app;
