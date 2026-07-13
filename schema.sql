-- ============================================================
-- LibraryHub Database Schema
-- Inspired by natomanga.com architecture (service_doc.md)
-- ============================================================

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  icon TEXT DEFAULT '📁',
  description TEXT DEFAULT '',
  item_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Items table (images / pdf / collections)
CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT DEFAULT '',
  type TEXT NOT NULL CHECK(type IN ('image','pdf','collection')),
  status TEXT DEFAULT 'active' CHECK(status IN ('active','archived','draft')),
  author TEXT DEFAULT 'Anonymous',
  category_id INTEGER REFERENCES categories(id),
  cover_url TEXT DEFAULT 'https://picsum.photos/seed/default/400/560',
  file_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  rating REAL DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  tags TEXT DEFAULT '[]',
  is_hot INTEGER DEFAULT 0,
  is_new INTEGER DEFAULT 1,
  is_featured INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Chapters table (for serializations like weekly manga releases)
CREATE TABLE IF NOT EXISTS chapters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  chapter_number REAL NOT NULL,
  title TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Files table (individual image pages or PDFs)
CREATE TABLE IF NOT EXISTS files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  chapter_id INTEGER REFERENCES chapters(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  filename TEXT DEFAULT '',
  type TEXT DEFAULT 'image' CHECK(type IN ('image','pdf')),
  page_number INTEGER DEFAULT 1,
  size_bytes INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Ratings table
CREATE TABLE IF NOT EXISTS ratings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL REFERENCES items(id),
  user_hash TEXT DEFAULT '',
  score INTEGER CHECK(score BETWEEN 1 AND 5),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(item_id, user_hash)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_items_slug     ON items(slug);
CREATE INDEX IF NOT EXISTS idx_items_type     ON items(type);
CREATE INDEX IF NOT EXISTS idx_items_category ON items(category_id);
CREATE INDEX IF NOT EXISTS idx_items_created  ON items(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_items_views    ON items(view_count DESC);
CREATE INDEX IF NOT EXISTS idx_items_status   ON items(status);
CREATE INDEX IF NOT EXISTS idx_files_item     ON files(item_id, page_number);
CREATE INDEX IF NOT EXISTS idx_files_chapter  ON files(chapter_id);
CREATE INDEX IF NOT EXISTS idx_chapters_item  ON chapters(item_id, chapter_number);

-- ============================================================
-- SEED: Categories
-- ============================================================
INSERT OR IGNORE INTO categories (name, slug, icon, description) VALUES
  ('Photography',  'photography',  '📷', 'High-quality photography collections from around the world'),
  ('Digital Art',  'digital-art',  '🎨', 'Digital artwork, illustrations, and creative designs'),
  ('Documents',    'documents',    '📄', 'PDF documents, reports, and official papers'),
  ('Architecture', 'architecture', '🏛️', 'Architectural photography and technical drawings'),
  ('Nature',       'nature',       '🌿', 'Nature, wildlife, and landscape photography'),
  ('Technology',   'technology',   '💻', 'Tech diagrams, infographics, and technical guides'),
  ('Education',    'education',    '🎓', 'Educational materials, textbooks, and learning resources'),
  ('Travel',       'travel',       '✈️', 'Travel photography, maps, and destination guides');

-- ============================================================
-- SEED: Items
-- ============================================================
INSERT OR IGNORE INTO items (title, slug, description, type, author, category_id, cover_url, file_count, view_count, rating, rating_count, tags, is_hot, is_new, is_featured) VALUES
  ('Mountain Landscapes Collection',  'mountain-landscapes',       'Stunning high-resolution mountain landscape photographs captured from the Alps, Himalayas, Rockies, and Andes.',                          'collection', 'PhotoLib',    5, 'https://picsum.photos/seed/mountain/400/560',  24, 8420,  4.8, 234, '["landscape","mountains","nature","photography"]',   1, 0, 1),
  ('Urban Architecture Vol.1',        'urban-architecture-vol1',   'Modern urban architecture photography featuring skyscrapers, bridges, and dramatic city skylines across the globe.',                  'collection', 'ArchVision',  4, 'https://picsum.photos/seed/urban/400/560',     18, 5230,  4.5, 178, '["architecture","urban","city","buildings"]',         1, 0, 1),
  ('Digital Art Showcase 2025',       'digital-art-showcase-2025', 'A curated collection of stunning digital artworks from independent artists covering fantasy, sci-fi, and abstract styles.',          'collection', 'ArtHub',      2, 'https://picsum.photos/seed/artshowcase/400/560', 32, 12500, 4.9, 456, '["digital-art","illustration","creative","2025"]',   1, 0, 1),
  ('Web Development Handbook',        'web-development-handbook',  'Comprehensive PDF guide covering modern web development practices, HTML, CSS, JavaScript, React, and deployment.',                   'pdf',        'TechDocs',    6, 'https://picsum.photos/seed/webdevbook/400/560',  1,  3800,  4.7, 189, '["web","development","programming","guide"]',        0, 0, 1),
  ('Japanese Street Photography',     'japanese-street-photography','Intimate street photography from the bustling streets of Tokyo, Osaka, and Kyoto capturing everyday Japanese life.',               'collection', 'StreetLens',  1, 'https://picsum.photos/seed/japanst/400/560',   40, 9120,  4.6, 312, '["japan","street","photography","asia"]',            1, 1, 0),
  ('Nature Macro Photography',        'nature-macro-photography',  'Extreme close-up photography of insects, flowers, raindrops and natural textures revealing a hidden world.',                        'collection', 'MacroWorld',  5, 'https://picsum.photos/seed/macronature/400/560', 28, 6700,  4.4, 203, '["macro","nature","insects","flowers"]',             0, 1, 0),
  ('Python Programming Guide',        'python-programming-guide',  'Complete Python 3.x programming guide for beginners to advanced. Covers OOP, async, decorators, and data science basics.',          'pdf',        'LearnCode',   7, 'https://picsum.photos/seed/pythonbook/400/560', 1,  7200,  4.8, 341, '["python","programming","tutorial","education"]',    1, 0, 0),
  ('Nordic Interior Design',          'nordic-interior-design',    'Clean and minimal Nordic interior design inspiration from Scandinavian homes featuring natural wood, muted tones, and simplicity.',  'collection', 'DesignNorth', 4, 'https://picsum.photos/seed/nordicint/400/560', 22, 4300,  4.3, 156, '["interior","design","nordic","minimal"]',           0, 1, 0),
  ('Ocean & Underwater World',        'ocean-underwater-world',    'Breathtaking underwater photography from coral reefs in the Maldives, Great Barrier Reef, and Red Sea.',                             'collection', 'DeepBlue',    5, 'https://picsum.photos/seed/oceanworld/400/560', 35, 8900,  4.7, 278, '["ocean","underwater","marine","coral"]',            1, 0, 0),
  ('Machine Learning Fundamentals',   'machine-learning-fundamentals','PDF textbook covering machine learning algorithms, neural networks, deep learning, and practical AI implementation.',             'pdf',        'AILearn',     7, 'https://picsum.photos/seed/mlbook/400/560',    1,  5600,  4.9, 423, '["machine-learning","AI","education","data-science"]', 1, 0, 0),
  ('European Travel Photography',     'european-travel-photography','A stunning photographic journey through iconic European cities: Paris, Rome, Barcelona, Prague, and Amsterdam.',                    'collection', 'WanderlensEU',8, 'https://picsum.photos/seed/eurotravel/400/560', 48, 11200, 4.5, 389, '["travel","europe","photography","cities"]',         1, 1, 0),
  ('Abstract Digital Paintings',      'abstract-digital-paintings', 'Bold, vibrant abstract digital paintings by emerging artists pushing the boundaries of color, form, and texture.',                 'collection', 'AbstractLab', 2, 'https://picsum.photos/seed/abstractpaint/400/560',19, 3400,  4.2, 134, '["abstract","painting","digital","art"]',            0, 1, 0),
  ('UI/UX Design Patterns',           'uiux-design-patterns',       'Comprehensive PDF covering modern UI/UX design patterns, wireframing, user research, and accessibility best practices.',           'pdf',        'DesignPro',   6, 'https://picsum.photos/seed/uiuxpdf/400/560',   1,  6100,  4.6, 267, '["ui","ux","design","patterns","guide"]',            0, 0, 0),
  ('Desert Landscapes',               'desert-landscapes',          'Dramatic desert photography from the Sahara, Atacama, Namib, and Arabian deserts — vast, silent, and breathtaking.',               'collection', 'SandDunes',   5, 'https://picsum.photos/seed/desertland/400/560', 26, 4800,  4.4, 167, '["desert","landscape","nature","sand"]',             0, 1, 0),
  ('Portrait Photography Masterclass','portrait-photography-masterclass','Professional portrait photography showcasing studio techniques, natural light, and stunning human expressions.',              'collection', 'PortraitPro', 1, 'https://picsum.photos/seed/portraitph/400/560', 30, 7600,  4.8, 298, '["portrait","photography","people","professional"]', 1, 0, 0),
  ('Cloud Computing PDF Guide',       'cloud-computing-guide',      'AWS, Azure, and GCP architecture patterns, serverless computing, containers, and cloud-native application design.',                 'pdf',        'CloudDocs',   6, 'https://picsum.photos/seed/cloudpdf/400/560',  1,  4200,  4.5, 198, '["cloud","AWS","Azure","computing","guide"]',        0, 1, 0),
  ('Wildlife Africa',                 'wildlife-africa',            'Stunning wildlife photography from African savannas — lions, elephants, giraffes, and leopards in their natural habitat.',          'collection', 'SafariLens',  5, 'https://picsum.photos/seed/wildafrica/400/560', 44, 13600, 4.9, 512, '["wildlife","africa","animals","safari"]',           1, 0, 1),
  ('Minimalist Photography',          'minimalist-photography',     'Clean, minimal photographic compositions exploring negative space, simplicity, and the beauty of empty space.',                    'collection', 'LessIsMore',  1, 'https://picsum.photos/seed/minimalph/400/560', 16, 3200,  4.3, 129, '["minimal","photography","clean","composition"]',    0, 1, 0),
  ('Space Exploration Archive',       'space-exploration-archive',  'NASA and ESA space exploration photographs from the last decade — galaxies, nebulae, planetary surfaces, and astronauts.',         'collection', 'CosmicLib',   5, 'https://picsum.photos/seed/spacearch/400/560', 60, 18400, 5.0, 678, '["space","NASA","cosmos","exploration","science"]',  1, 0, 1),
  ('Data Visualization Handbook',     'data-visualization-handbook','PDF guide to creating effective charts, infographics, dashboards, and data stories with D3.js, Tableau, and Python.',             'pdf',        'DataVizPro',  7, 'https://picsum.photos/seed/datavizpdf/400/560', 1,  3900,  4.4, 167, '["data","visualization","charts","guide"]',          0, 1, 0);

-- ============================================================
-- SEED: Files for key items
-- ============================================================

-- Mountain Landscapes (item 1)
INSERT OR IGNORE INTO files (item_id, url, filename, type, page_number) VALUES
  (1,'https://picsum.photos/seed/mt1/1200/800','mountain-01.jpg','image',1),
  (1,'https://picsum.photos/seed/mt2/1200/800','mountain-02.jpg','image',2),
  (1,'https://picsum.photos/seed/mt3/1200/800','mountain-03.jpg','image',3),
  (1,'https://picsum.photos/seed/mt4/1200/800','mountain-04.jpg','image',4),
  (1,'https://picsum.photos/seed/mt5/1200/800','mountain-05.jpg','image',5),
  (1,'https://picsum.photos/seed/mt6/1200/800','mountain-06.jpg','image',6);

-- Urban Architecture (item 2)
INSERT OR IGNORE INTO files (item_id, url, filename, type, page_number) VALUES
  (2,'https://picsum.photos/seed/ar1/1200/800','arch-01.jpg','image',1),
  (2,'https://picsum.photos/seed/ar2/1200/800','arch-02.jpg','image',2),
  (2,'https://picsum.photos/seed/ar3/1200/800','arch-03.jpg','image',3),
  (2,'https://picsum.photos/seed/ar4/1200/800','arch-04.jpg','image',4);

-- Digital Art (item 3)
INSERT OR IGNORE INTO files (item_id, url, filename, type, page_number) VALUES
  (3,'https://picsum.photos/seed/da1/1200/800','art-01.jpg','image',1),
  (3,'https://picsum.photos/seed/da2/1200/800','art-02.jpg','image',2),
  (3,'https://picsum.photos/seed/da3/1200/800','art-03.jpg','image',3),
  (3,'https://picsum.photos/seed/da4/1200/800','art-04.jpg','image',4);

-- Web Dev Handbook (item 4 - PDF)
INSERT OR IGNORE INTO files (item_id, url, filename, type, page_number) VALUES
  (4,'https://www.w3.org/WAI/WCAG21/wcag-2.1-merged-understanding.pdf','web-handbook.pdf','pdf',1);

-- Japanese Street (item 5)
INSERT OR IGNORE INTO files (item_id, url, filename, type, page_number) VALUES
  (5,'https://picsum.photos/seed/jp1/1200/800','japan-01.jpg','image',1),
  (5,'https://picsum.photos/seed/jp2/1200/800','japan-02.jpg','image',2),
  (5,'https://picsum.photos/seed/jp3/1200/800','japan-03.jpg','image',3),
  (5,'https://picsum.photos/seed/jp4/1200/800','japan-04.jpg','image',4),
  (5,'https://picsum.photos/seed/jp5/1200/800','japan-05.jpg','image',5);

-- Wildlife Africa (item 17)
INSERT OR IGNORE INTO files (item_id, url, filename, type, page_number) VALUES
  (17,'https://picsum.photos/seed/wl1/1200/800','wildlife-01.jpg','image',1),
  (17,'https://picsum.photos/seed/wl2/1200/800','wildlife-02.jpg','image',2),
  (17,'https://picsum.photos/seed/wl3/1200/800','wildlife-03.jpg','image',3),
  (17,'https://picsum.photos/seed/wl4/1200/800','wildlife-04.jpg','image',4),
  (17,'https://picsum.photos/seed/wl5/1200/800','wildlife-05.jpg','image',5);

-- Space Exploration (item 19)
INSERT OR IGNORE INTO files (item_id, url, filename, type, page_number) VALUES
  (19,'https://picsum.photos/seed/sp1/1200/800','space-01.jpg','image',1),
  (19,'https://picsum.photos/seed/sp2/1200/800','space-02.jpg','image',2),
  (19,'https://picsum.photos/seed/sp3/1200/800','space-03.jpg','image',3),
  (19,'https://picsum.photos/seed/sp4/1200/800','space-04.jpg','image',4),
  (19,'https://picsum.photos/seed/sp5/1200/800','space-05.jpg','image',5),
  (19,'https://picsum.photos/seed/sp6/1200/800','space-06.jpg','image',6);

-- Python Guide (item 7 - PDF)
INSERT OR IGNORE INTO files (item_id, url, filename, type, page_number) VALUES
  (7,'https://www.thinkcspy.reinteractive.net/downloads/ThinkCSPy.pdf','python-guide.pdf','pdf',1);

-- ML Fundamentals (item 10 - PDF)
INSERT OR IGNORE INTO files (item_id, url, filename, type, page_number) VALUES
  (10,'https://www.deeplearningbook.org/contents/intro.html','ml-fundamentals.pdf','pdf',1);

-- Update category counts
UPDATE categories SET item_count = (
  SELECT COUNT(*) FROM items WHERE category_id = categories.id AND status = 'active'
);
