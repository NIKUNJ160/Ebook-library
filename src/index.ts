import { Hono, Context } from 'hono';
import { html } from 'hono/html';

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
  updates?: FilePage[];
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

interface FilePage {
  id: number;
  item_id: number;
  url: string;
  filename: string;
  type: 'image' | 'pdf';
  page_number: number;
  size_bytes: number;
  created_at: string;
}

const app = new Hono<{ Bindings: Bindings }>();

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

// Helper to resolve and attach latest files/pages as updates to items
async function attachLatestUpdates(db: D1Database, items: LibraryItem[]): Promise<LibraryItem[]> {
  if (items.length === 0) return [];
  const ids = items.map(item => item.id);
  const questionMarks = ids.map(() => '?').join(',');
  
  const filesQuery = await db.prepare(`
    SELECT * FROM files 
    WHERE item_id IN (${questionMarks}) 
    ORDER BY page_number DESC
  `).bind(...ids).all<FilePage>();
  
  const allFiles = filesQuery.results;
  
  return items.map(item => {
    const itemUpdates = allFiles.filter(f => f.item_id === item.id).slice(0, 3);
    return {
      ...item,
      updates: itemUpdates
    };
  });
}

// Layout Helper matching natomanga design doc
const layout = (title: string, content: any, activeNav: string = 'home', extraHead: any = '') => html`
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
            <a href="/item/${item.slug}/view/${update.page_number}" class="update-link">Page ${update.page_number}</a>
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
  
  // Fetch popular items for carousel (is_featured = 1 or top view count)
  const carouselItemsQuery = db.prepare(`
    SELECT * FROM items WHERE status = 'active' ORDER BY is_featured DESC, view_count DESC LIMIT 6
  `).all<LibraryItem>();

  // Fetch latest update items
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

  // Resolve and attach latest updates (files) to each book
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

  return c.html(layout('Home', content, 'home'));
});

// GET Item Details Page
app.get('/item/:slug', async (c) => {
  const slug = c.req.param('slug');
  const db = c.env.DB;

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
    return c.html(layout('Item Not Found', html`<h2>404 Not Found</h2><p>The requested library item does not exist or has been removed.</p>`));
  }

  // Fetch pages / files inside this item
  const filesQuery = await db.prepare(`
    SELECT * FROM files WHERE item_id = ? ORDER BY page_number ASC
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
              <li><strong>Pages/Files:</strong> <span>${itemQuery.file_count || files.length}</span></li>
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
              ${itemQuery.type === 'pdf' && files.length > 0 
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

        <!-- Document / Pages Listing Grid -->
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
      </div>
    </div>

    <!-- Sidebar Right Column -->
    ${renderSidebar(categories, topItems)}
  `;

  return c.html(layout(itemQuery.title, content, 'item'));
});

// Helper to render the vertical scroll reader page matching Home Plate Villain page
const renderReaderPage = async (c: Context<{ Bindings: Bindings }>, slug: string, pageNum: number | null) => {
  const db = c.env.DB;

  // Fetch Item details
  const itemQuery = await db.prepare(`
    SELECT i.*, cat.name as category_name, cat.slug as category_slug 
    FROM items i
    LEFT JOIN categories cat ON i.category_id = cat.id
    WHERE i.slug = ? AND i.status = 'active'
  `).bind(slug).first<LibraryItem>();

  if (!itemQuery) {
    return c.html(layout('Item Not Found', html`<h2>404 Not Found</h2>`));
  }

  // Fetch all pages
  const filesQuery = await db.prepare(`
    SELECT * FROM files WHERE item_id = ? ORDER BY page_number ASC
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

  return c.html(layout(itemQuery.title, content, 'reader', html`<link rel="stylesheet" href="/css/reader.css">`));
};

// GET View / Page Reader Page (scroll-based)
app.get('/item/:slug/view', async (c) => {
  return renderReaderPage(c, c.req.param('slug'), null);
});

app.get('/item/:slug/view/:page', async (c) => {
  const pageNum = parseInt(c.req.param('page')) || 1;
  return renderReaderPage(c, c.req.param('slug'), pageNum);
});

// GET Search Page
app.get('/search', async (c) => {
  const query = c.req.query('q') || '';
  const type = c.req.query('type') || '';
  const categorySlug = c.req.query('category') || '';
  const db = c.env.DB;

  // Build query
  let sql = `
    SELECT i.*, cat.name as category_name 
    FROM items i 
    LEFT JOIN categories cat ON i.category_id = cat.id 
    WHERE i.status = 'active'
  `;
  const params: any[] = [];

  if (query) {
    sql += ` AND (i.title LIKE ? OR i.description LIKE ? OR i.tags LIKE ?)`;
    const searchVal = `%${query}%`;
    params.push(searchVal, searchVal, searchVal);
  }

  if (type) {
    sql += ` AND i.type = ?`;
    params.push(type);
  }

  if (categorySlug) {
    sql += ` AND cat.slug = ?`;
    params.push(categorySlug);
  }

  sql += ` ORDER BY i.created_at DESC`;

  const itemsQuery = await db.prepare(sql).bind(...params).all<LibraryItem>();
  const rawSearchResults = itemsQuery.results;

  // Resolve updates
  const searchResults = await attachLatestUpdates(db, rawSearchResults);

  // Sidebar queries
  const categoriesQuery = db.prepare(`SELECT * FROM categories ORDER BY name ASC`).all<Category>();
  const topItemsQuery = db.prepare(`SELECT * FROM items WHERE status = 'active' ORDER BY view_count DESC LIMIT 8`).all<LibraryItem>();

  const [categoriesRes, topRes] = await Promise.all([categoriesQuery, topItemsQuery]);

  const categories = categoriesRes.results;
  const topItems = topRes.results;

  const content = html`
    <div class="leftCol">
      <div class="breadcrumb">
        <a href="/">Home</a> » <span>Search Results</span>
      </div>

      <section class="search-results-section">
        <h1 class="section-title">SEARCH RESULTS FOR: "${query || 'All Filters'}"</h1>
        <p class="search-meta-info">Found ${searchResults.length} matching item(s)</p>

        <div class="items-grid">
          ${searchResults.map((item) => renderItemCard(item))}
          
          ${searchResults.length === 0 ? html`<p class="no-results-msg">No library items found matching your criteria. Try adjusting your query or filter.</p>` : ''}
        </div>
      </section>
    </div>

    <!-- Sidebar Right Column -->
    ${renderSidebar(categories, topItems)}
  `;

  return c.html(layout(`Search: ${query}`, content, 'search'));
});

// GET Category / Genre Page
app.get('/category/:slug', async (c) => {
  const slug = c.req.param('slug');
  const db = c.env.DB;

  const categoryQuery = await db.prepare(`SELECT * FROM categories WHERE slug = ?`).bind(slug).first<Category>();

  if (!categoryQuery) {
    return c.html(layout('Category Not Found', html`<h2>404 Category Not Found</h2>`));
  }

  // Fetch items in category
  const itemsQuery = await db.prepare(`
    SELECT i.*, cat.name as category_name 
    FROM items i
    LEFT JOIN categories cat ON i.category_id = cat.id
    WHERE i.category_id = ? AND i.status = 'active'
    ORDER BY i.created_at DESC
  `).bind(categoryQuery.id).all<LibraryItem>();

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
      </section>
    </div>

    <!-- Sidebar Right Column -->
    ${renderSidebar(categories, topItems)}
  `;

  return c.html(layout(`Category: ${categoryQuery.name}`, content, 'category'));
});

// GET Lists Page (Latest, Hot, Collections, PDFs)
app.get('/list/:type', async (c) => {
  const type = c.req.param('type');
  const db = c.env.DB;

  let sql = `SELECT * FROM items WHERE status = 'active'`;
  let title = 'Library Catalog';
  let activeMenu = '';

  if (type === 'latest') {
    sql += ` ORDER BY created_at DESC`;
    title = 'Latest Added Items';
    activeMenu = 'latest';
  } else if (type === 'hot') {
    sql += ` ORDER BY view_count DESC`;
    title = 'Hot Trending Items';
    activeMenu = 'hot';
  } else if (type === 'collections') {
    sql += ` AND type = 'collection' ORDER BY created_at DESC`;
    title = 'Photo Collections';
    activeMenu = 'collections';
  } else if (type === 'pdfs') {
    sql += ` AND type = 'pdf' ORDER BY created_at DESC`;
    title = 'PDF Documents';
    activeMenu = 'pdfs';
  }

  const itemsQuery = await db.prepare(sql).all<LibraryItem>();
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
      </section>
    </div>

    <!-- Sidebar Right Column -->
    ${renderSidebar(categories, topItems)}
  `;

  return c.html(layout(title, content, activeMenu));
});

// GET History Page
app.get('/history', async (c) => {
  const db = c.env.DB;

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

  return c.html(layout('Viewing History', content, 'history'));
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
