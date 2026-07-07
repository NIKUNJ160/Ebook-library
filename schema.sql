-- D1 (SQLite) Schema for Portfolio

-- Users table for Admin Authentication
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Projects table for Portfolio Showcase
CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    tags TEXT,
    project_url TEXT,
    repo_url TEXT,
    is_featured INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Messages table for Contact Form Inquiries
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'new' CHECK(status IN ('new', 'read', 'replied')),
    created_at TEXT DEFAULT (datetime('now'))
);

-- Skills table
CREATE TABLE IF NOT EXISTS skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK(category IN ('frontend', 'backend', 'tools', 'other')),
    proficiency INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Services table
CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- ─── BOOKHAVEN EBOOK PLATFORM TABLES ───

-- Profiles & Wallets
CREATE TABLE IF NOT EXISTS ebook_users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    email TEXT UNIQUE,
    provider TEXT DEFAULT 'local',
    age_group TEXT CHECK(age_group IN ('adult', 'ya')) DEFAULT 'ya',
    bio TEXT,
    avatar_url TEXT,
    wallet_balance REAL DEFAULT 0.00,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Wallet Transactions
CREATE TABLE IF NOT EXISTS wallet_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    amount REAL NOT NULL,
    type TEXT CHECK(type IN ('topup', 'purchase', 'sale', 'withdraw')),
    description TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Book Directory
CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    cover_url TEXT,
    description TEXT,
    genre TEXT,
    category TEXT CHECK(category IN ('adult', 'ya')) DEFAULT 'ya',
    published_year INTEGER,
    total_pages INTEGER DEFAULT 100
);

-- User-Book Reading Progress
CREATE TABLE IF NOT EXISTS user_books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    book_id INTEGER NOT NULL,
    progress_percent INTEGER DEFAULT 0,
    status TEXT CHECK(status IN ('reading', 'finished', 'want_to_read')) DEFAULT 'want_to_read',
    rating INTEGER,
    favorite_quote TEXT,
    review_text TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Community Book Clubs
CREATE TABLE IF NOT EXISTS book_clubs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT CHECK(category IN ('adult', 'ya')) DEFAULT 'ya',
    meeting_time TEXT,
    creator_id TEXT NOT NULL,
    room_id TEXT NOT NULL
);

-- Forum Categories & Threads
CREATE TABLE IF NOT EXISTS forum_threads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT CHECK(category IN ('adult', 'ya')) DEFAULT 'ya',
    author_id TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Forum Thread Replies
CREATE TABLE IF NOT EXISTS forum_replies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    thread_id INTEGER NOT NULL,
    author_id TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Marketplace Listings for buying/selling books
CREATE TABLE IF NOT EXISTS marketplace_listings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seller_id TEXT NOT NULL,
    book_title TEXT NOT NULL,
    book_author TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    listing_type TEXT CHECK(listing_type IN ('sell', 'trade')) DEFAULT 'sell',
    status TEXT CHECK(status IN ('active', 'sold', 'traded')) DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now'))
);

-- Reading Challenges
CREATE TABLE IF NOT EXISTS reading_challenges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    target_count INTEGER NOT NULL,
    start_date TEXT,
    end_date TEXT
);

-- User Challenge Signups
CREATE TABLE IF NOT EXISTS user_challenges (
    user_id TEXT NOT NULL,
    challenge_id INTEGER NOT NULL,
    books_read INTEGER DEFAULT 0,
    PRIMARY KEY (user_id, challenge_id)
);

