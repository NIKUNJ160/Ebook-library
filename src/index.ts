import { Hono, Context } from 'hono';
import { html } from 'hono/html';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';

type Bindings = {
  DB: D1Database;
  ALLOW_REGISTRATION: string;
  INVITE_CODE: string;
  JWT_SECRET_KEY: string;
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

// Helper to hash passwords securely using Web Crypto SHA-256
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'salt_value_123');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Helper to convert an uploaded multipart File into Base64 Data URL
async function fileToBase64(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:${file.type};base64,${btoa(binary)}`;
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

// Helper to resolve and attach latest updates (chapters or pages) to each book
async function attachLatestUpdates(db: D1Database, items: LibraryItem[]): Promise<LibraryItem[]> {
  if (items.length === 0) return [];
  
  const updatedItems: LibraryItem[] = [];

  for (const item of items) {
    // Check if this item has chapters
    const chaptersQuery = await db.prepare(`
      SELECT * FROM chapters WHERE item_id = ? ORDER BY chapter_number DESC LIMIT 3
    `).bind(item.id).all<Chapter>();
    
    if (chaptersQuery.results.length > 0) {
      // Map chapters as updates
      updatedItems.push({
        ...item,
        updates: chaptersQuery.results.map(c => ({
          label: `Chapter ${c.chapter_number}`,
          url: `/item/${item.slug}/chapter/${c.chapter_number}`,
          created_at: c.created_at
        }))
      });
    } else {
      // Fallback: Map raw pages
      const filesQuery = await db.prepare(`
        SELECT * FROM files WHERE item_id = ? ORDER BY page_number DESC LIMIT 3
      `).bind(item.id).all<FilePage>();
      
      updatedItems.push({
        ...item,
        updates: filesQuery.results.map(f => ({
          label: `Page ${f.page_number}`,
          url: `/item/${item.slug}/view/${f.page_number}`,
          created_at: f.created_at
        }))
      });
    }
  }

  return updatedItems;
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

// Layout Helper matching natomanga design doc
const layout = (title: string, content: any, activeNav: string = 'home', extraHead: any = '', username: string | null = null) => html`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - LibraryHub</title>
  <link rel="icon" type="image/webp" href="/images/favicon-manganato.webp">
  <!-- Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,300..800;1,300..800&family=Roboto:ital,wght@0,100;0,300;0,400;0,500;0,700;0,900;1,100;1,300;1,400;1,500;1,700;1,900&display=swap" rel="stylesheet">
  <!-- FontAwesome -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <!-- Stylesheets -->
  <link rel="stylesheet" href="/css/all.css">
  <link rel="stylesheet" href="/css/app.css">
  ${extraHead}
</head>
<body>
  <script>
    // Theme toggle init
    const theme = localStorage.getItem('themeMode') || 'light';
    document.body.classList.add(theme);
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
          <form action="/search" method="GET">
            <input type="text" id="search_story" name="q" placeholder="Search images, PDFs, collections..." autocomplete="off">
            <button type="submit"><i class="fa fa-search"></i></button>
          </form>
          <div id="search-autocomplete" class="search-autocomplete-box" style="display:none;"></div>
        </div>
        <div class="link-social-desktop">
          <a href="#" class="social-btn fb"><i class="fab fa-facebook-f"></i></a>
          <a href="#" class="social-btn discord"><i class="fab fa-discord"></i></a>
        </div>
        <div class="user-options">
          ${username 
            ? html`
                <div class="user-profile-header">
                  <span class="user-welcome"><i class="fa fa-user-circle"></i> ${username}</span>
                  <a href="/profile" class="header-profile-btn" title="My Profile Dashboard">Profile</a>
                  <a href="/logout" class="header-logout-btn" title="Logout"><i class="fa-solid fa-right-from-bracket"></i></a>
                </div>
              `
            : html`
                <div class="user-auth-links">
                  <a href="/login" class="header-login-btn"><i class="fa-solid fa-sign-in"></i> Sign In</a>
                  <a href="/register" class="header-register-btn"><i class="fa-solid fa-user-plus"></i> Register</a>
                </div>
              `
          }
          <button id="theme-toggle" class="theme-toggle-btn" title="Toggle Dark/Light Mode">
            <i class="fa-solid fa-moon"></i>
          </button>
        </div>
      </div>
      
      <div class="mobile-menu-btn" id="mobile-menu-btn">
        <i class="fa fa-bars"></i> MENU
      </div>

      <nav class="wrap-menu-primary" id="primary-nav">
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

  <!-- NOTIFICATION BANNER -->
  <div class="container">
    <div class="notification-banner">
      <i class="fa-solid fa-bullhorn"></i> <strong>Welcome to LibraryHub!</strong> Enjoy reading free PDF documents, photo collections, and illustrations. Bookmark us by pressing <strong>Ctrl + D</strong>!
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
        <a href="#">About Us</a> | 
        <a href="#">Contact Us</a> | 
        <a href="#">Privacy Policy</a> | 
        <a href="#">Terms of Use</a> | 
        <a href="#">DMCA Takedown</a> | 
        <a href="#">FAQ</a>
      </div>
      <div class="footer-content">
        <p>Copyright © 2026 LibraryHub. All rights reserved.</p>
        <p>All images, books, and PDFs are property of their respective owners. Support email: <span class="email-text">support@libraryhub.com</span></p>
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
const renderSidebar = (categories: Category[], topItems: LibraryItem[]) => html`
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
const renderItemCard = (item: LibraryItem) => html`
  <div class="item-card ${item.is_hot ? 'item-hot' : ''} ${item.is_new ? 'item-new' : ''}">
    <div class="card-cover-wrap">
      <a href="/item/${item.slug}">
        <img src="${item.cover_url}" alt="${item.title}" class="card-cover lazy-img" loading="lazy">
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
        <span class="card-views"><i class="fa fa-eye"></i> ${item.view_count.toLocaleString()} views</span>
        <span class="card-rating"><i class="fa fa-star"></i> ${item.rating.toFixed(1)}</span>
      </div>
      <div class="card-bottom">
        <span class="card-author"><i class="fa fa-user"></i> ${item.author}</span>
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
        <h2 class="section-title"><i class="fa-solid fa-fire accent-orange-color"></i> POPULAR COLLECTIONS</h2>
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
        <h2 class="section-title"><i class="fa-solid fa-clock accent-teal-color"></i> LATEST ADDITIONS</h2>
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

// POST Login Handler
app.post('/login', async (c) => {
  const body = await c.req.parseBody();
  const inputUsername = (body.username as string || '').trim();
  const inputPassword = body.password as string || '';
  const db = c.env.DB;

  const user = await db.prepare('SELECT * FROM users WHERE username = ?').bind(inputUsername).first<User>();

  if (user) {
    const hashedInput = await hashPassword(inputPassword);
    if (user.password === hashedInput) {
      setCookie(c, 'user_session', user.username, {
        path: '/',
        secure: true,
        httpOnly: true,
        maxAge: 60 * 60 * 24 * 7, // 7 days
        sameSite: 'Lax'
      });
      return c.redirect('/profile');
    }
  }

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
                <a href="/item/\${b.slug}">
                  <img src="\${b.cover}" alt="\${b.title}" class="profile-card-cover" loading="lazy">
                </a>
              </div>
              <div class="profile-card-details">
                <h4><a href="/item/\${b.slug}">\${b.title}</a></h4>
                <div class="profile-card-actions">
                  <a href="/item/\${b.slug}" class="profile-btn-read">Read Now</a>
                  <button class="profile-btn-unbookmark" data-slug="\${b.slug}"><i class="fa-solid fa-bookmark-slash"></i> Remove</button>
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
              <img src="\${h.cover}" class="profile-history-cover" loading="lazy">
              <div class="profile-history-info">
                <h4><a href="/item/\${h.slug}">\${h.title}</a></h4>
                <p class="history-page-progress"><i class="fa-solid fa-book-open-reader"></i> Last read \${h.lastChapter ? 'Chapter ' + h.lastChapter : 'Page ' + h.lastPage} of \${h.totalPages}</p>
                <p class="history-timestamp"><i class="fa fa-clock"></i> \${dateStr}</p>
              </div>
              <div class="profile-history-actions">
                <a href="/item/\${h.slug}\${h.lastChapter ? '/chapter/' + h.lastChapter : '/view/' + h.lastPage}" class="profile-btn-resume">Resume</a>
                <button class="profile-btn-del-history" data-slug="\${h.slug}"><i class="fa-regular fa-trash-can"></i></button>
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

// GET Admin Index (Dashboard / Login)
app.get('/admin', async (c) => {
  const adminSession = getCookie(c, 'admin_session');
  const expectedKey = c.env.INVITE_CODE || 'nikunj2024';

  if (!adminSession || adminSession !== expectedKey) {
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
        <i class="fa fa-info-circle"></i> <strong>Remote Control API Key:</strong> You can control this website remotely using the endpoints below.
        Use Header: <code>Authorization: Bearer ${expectedKey}</code> or <code>X-Admin-Key: ${expectedKey}</code>. 
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

// POST Admin Login
app.post('/admin/login', async (c) => {
  const body = await c.req.parseBody();
  const inputKey = body.admin_key as string;
  const expectedKey = c.env.INVITE_CODE || 'nikunj2024';

  if (inputKey === expectedKey) {
    setCookie(c, 'admin_session', expectedKey, {
      path: '/',
      secure: true,
      httpOnly: true,
      maxAge: 60 * 60 * 2, // 2 hours
      sameSite: 'Lax'
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
  const adminSession = getCookie(c, 'admin_session');
  const expectedKey = c.env.INVITE_CODE || 'nikunj2024';
  if (!adminSession || adminSession !== expectedKey) {
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

// GET Create Item Page (with JSZip, custom categories, Cover Upload and selectable tags)
app.get('/admin/items/new', async (c) => {
  const adminSession = getCookie(c, 'admin_session');
  const expectedKey = c.env.INVITE_CODE || 'nikunj2024';
  if (!adminSession || adminSession !== expectedKey) {
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
  const adminSession = getCookie(c, 'admin_session');
  const expectedKey = c.env.INVITE_CODE || 'nikunj2024';
  if (!adminSession || adminSession !== expectedKey) {
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
      for (let i = 0; i < fileUrls.length; i++) {
        await db.prepare(`
          INSERT INTO files (item_id, url, filename, type, page_number)
          VALUES (?, ?, ?, ?, ?)
        `).bind(item.id, fileUrls[i], `page-${i + 1}`, type === 'pdf' ? 'pdf' : 'image', i + 1).run();
      }
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
  const adminSession = getCookie(c, 'admin_session');
  const expectedKey = c.env.INVITE_CODE || 'nikunj2024';
  if (!adminSession || adminSession !== expectedKey) {
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
  const adminSession = getCookie(c, 'admin_session');
  const expectedKey = c.env.INVITE_CODE || 'nikunj2024';
  if (!adminSession || adminSession !== expectedKey) {
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
    for (let i = 0; i < fileUrls.length; i++) {
      await db.prepare(`
        INSERT INTO files (item_id, url, filename, type, page_number)
        VALUES (?, ?, ?, ?, ?)
      `).bind(item.id, fileUrls[i], `page-${i + 1}`, type === 'pdf' ? 'pdf' : 'image', i + 1).run();
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
  const adminSession = getCookie(c, 'admin_session');
  const expectedKey = c.env.INVITE_CODE || 'nikunj2024';
  if (!adminSession || adminSession !== expectedKey) {
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
  const adminSession = getCookie(c, 'admin_session');
  const expectedKey = c.env.INVITE_CODE || 'nikunj2024';
  if (!adminSession || adminSession !== expectedKey) {
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
  const adminSession = getCookie(c, 'admin_session');
  const expectedKey = c.env.INVITE_CODE || 'nikunj2024';
  if (!adminSession || adminSession !== expectedKey) {
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

  const expectedKey = c.env.INVITE_CODE || 'nikunj2024';
  if (!token || token !== expectedKey) {
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
        setClauses.push('view_count = ?');
        params.push(views);
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

  // Increase view count
  await db.prepare('UPDATE items SET view_count = view_count + 1 WHERE slug = ?').bind(slug).run();

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
      </div>
    </div>

    <!-- Sidebar Right Column -->
    ${renderSidebar(categories, topItems)}
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
