import { Hono } from 'hono';
import type { Context } from 'hono';
import { cors } from 'hono/cors';
import type { Env, Variables } from '../env';
import { hashPassword, verifyPassword, createSessionToken, verifySessionToken, getSessionCookie, setSessionCookie, clearSessionCookie } from '../auth';
import { renderBookHaven } from './bookhaven_template';

const booksApp = new Hono<{ Bindings: Env; Variables: Variables }>();

// Serves the BookHaven React UI
booksApp.get('/books', (c) => {
    return c.html(renderBookHaven());
});


// Enable CORS for frontend API calls
booksApp.use('/api/books/*', cors({
    origin: '*',
    credentials: true,
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization']
}));

// Helper to get authenticated book user
async function getAuthUser(c: Context) {
    const authHeader = c.req.header('Authorization');
    let token = '';
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
    } else {
        const cookie = getSessionCookie(c.req.header('Cookie'));
        if (cookie) token = cookie;
    }
    
    if (!token) return null;
    const session = await verifySessionToken(token, c.env.JWT_SECRET_KEY);
    if (!session) return null;
    
    // Fetch profile from ebook_users
    const user = await c.env.DB.prepare(
        'SELECT * FROM ebook_users WHERE id = ?'
    ).bind(String(session.sub)).first() as any;
    
    return user;
}

// ─── AUTHENTICATION ENDPOINTS ───

// Standard Password Register
booksApp.post('/api/books/auth/register', async (c) => {
    const { username, email, password, age_group } = await c.req.json();
    if (!username || !email || !password) {
        return c.json({ error: 'Username, email and password are required' }, 400);
    }
    
    try {
        const passHash = await hashPassword(password);
        const userId = email.toLowerCase().trim();
        
        await c.env.DB.prepare(
            'INSERT INTO ebook_users (id, username, email, provider, age_group, wallet_balance) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(userId, username, userId, 'local', age_group || 'ya', 50.00).run(); // Start with $50.00 in virtual wallet
        
        // Log transaction for registration bonus
        await c.env.DB.prepare(
            'INSERT INTO wallet_transactions (user_id, amount, type, description) VALUES (?, ?, ?, ?)'
        ).bind(userId, 50.00, 'topup', 'Registration Bonus').run();
        
        // Register in primary auth user table so login lookup works
        try {
            await c.env.DB.prepare(
                'INSERT INTO users (username, password_hash) VALUES (?, ?)'
            ).bind(userId, passHash).run();
        } catch {
            // Already exists in users table, ignore
        }
        
        const token = await createSessionToken(userId as any, username, c.env.JWT_SECRET_KEY);
        
        return c.json({
            success: true,
            token,
            user: { id: userId, username, email: userId, age_group, wallet_balance: 50.00 }
        });
    } catch (err: any) {
        if (err.message && err.message.includes('UNIQUE')) {
            return c.json({ error: 'Email already registered' }, 400);
        }
        return c.json({ error: err.message || 'Registration failed' }, 500);
    }
});

// Standard Password Login
booksApp.post('/api/books/auth/login', async (c) => {
    const { email, password } = await c.req.json();
    if (!email || !password) {
        return c.json({ error: 'Email and password are required' }, 400);
    }
    
    const userId = email.toLowerCase().trim();
    // Re-use admin password hashes for simplicity or query standard users if matching hashes exist
    // Standard user might not exist yet, let's query ebook_users
    const user = await c.env.DB.prepare(
        'SELECT * FROM ebook_users WHERE id = ? AND provider = ?'
    ).bind(userId, 'local').first() as any;
    
    if (!user) {
        // Create dummy matching record or check credentials
        return c.json({ error: 'User not found or invalid provider' }, 401);
    }
    
    // We will verify against password_hash. Wait, since ebook_users doesn't store password_hash directly to keep schemas clean,
    // let's lookup from the local users table OR let's support password checking by checking if the user profile password matches.
    // Ah, let's verify using standard credential check. Since we want standard password check, let's verify if the username matches or password hashes match.
    // For local registration we stored the hash in the main portfolio 'users' table or ebook_users! Let's check:
    // To make auth robust, let's see if the user exists in 'users' table.
    const userCredentials = await c.env.DB.prepare(
        'SELECT password_hash FROM users WHERE username = ?'
    ).bind(userId).first() as any;
    
    if (!userCredentials || !(await verifyPassword(password, userCredentials.password_hash))) {
        return c.json({ error: 'Invalid credentials' }, 401);
    }
    
    const token = await createSessionToken(userId as any, user.username, c.env.JWT_SECRET_KEY);
    return c.json({
        success: true,
        token,
        user
    });
});

// Simulated OAuth Auth Endpoint (Google, Facebook, Microsoft, Apple ID)
booksApp.post('/api/books/auth/oauth', async (c) => {
    const { provider, name, email } = await c.req.json();
    if (!provider || !name || !email) {
        return c.json({ error: 'Provider, name and email are required' }, 400);
    }
    
    const userId = `${provider}_${email.toLowerCase().trim()}`;
    
    // Check if user exists
    let user = await c.env.DB.prepare(
        'SELECT * FROM ebook_users WHERE id = ?'
    ).bind(userId).first() as any;
    
    if (!user) {
        // Create user
        try {
            await c.env.DB.prepare(
                'INSERT INTO ebook_users (id, username, email, provider, age_group, wallet_balance, avatar_url) VALUES (?, ?, ?, ?, ?, ?, ?)'
            ).bind(userId, name, email, provider, 'ya', 100.00, `https://api.dicebear.com/7.x/bottts/svg?seed=${name}`).run(); // Premium bonus
            
            await c.env.DB.prepare(
                'INSERT INTO wallet_transactions (user_id, amount, type, description) VALUES (?, ?, ?, ?)'
            ).bind(userId, 100.00, 'topup', `${provider} OAuth Registration Bonus`).run();
            
            user = {
                id: userId,
                username: name,
                email,
                provider,
                age_group: 'ya',
                wallet_balance: 100.00,
                avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${name}`
            };
        } catch (err: any) {
            return c.json({ error: err.message || 'OAuth registration failed' }, 500);
        }
    }
    
    const token = await createSessionToken(userId as any, user.username, c.env.JWT_SECRET_KEY);
    return c.json({
        success: true,
        token,
        user
    });
});

// Get user profile/status
booksApp.get('/api/books/auth/me', async (c) => {
    const user = await getAuthUser(c);
    if (!user) {
        return c.json({ error: 'Unauthorized' }, 401);
    }
    return c.json(user);
});

// ─── BOOK CATALOGUE & SEARCH ───

// Retrieve complete list of books
booksApp.get('/api/books/catalogue', async (c) => {
    const category = c.req.query('category'); // ya or adult
    const query = c.req.query('query') || '';
    
    let sql = 'SELECT * FROM books';
    const params: any[] = [];
    
    if (category || query) {
        sql += ' WHERE 1=1';
        if (category) {
            sql += ' AND category = ?';
            params.push(category);
        }
        if (query) {
            sql += ' AND (title LIKE ? OR author LIKE ? OR genre LIKE ?)';
            params.push(`%${query}%`, `%${query}%`, `%${query}%`);
        }
    }
    
    const booksResult = await c.env.DB.prepare(sql).bind(...params).all() as any;
    return c.json(booksResult.results || []);
});

// Get suggestions algorithm
booksApp.get('/api/books/suggestions', async (c) => {
    const user = await getAuthUser(c);
    const ageGroup = user ? user.age_group : 'ya';
    
    // Basic recommendation system:
    // Suggest books from the user's category (ya vs adult) that aren't already in their library
    let sql = 'SELECT * FROM books WHERE category = ?';
    const params: any[] = [ageGroup];
    
    if (user) {
        sql += ' AND id NOT IN (SELECT book_id FROM user_books WHERE user_id = ?)';
        params.push(user.id);
    }
    
    sql += ' LIMIT 6';
    const result = await c.env.DB.prepare(sql).bind(...params).all() as any;
    return c.json(result.results || []);
});

// Seed some starting books
booksApp.post('/api/books/seed', async (c) => {
    const startBooks = [
        { title: 'The Hobbit', author: 'J.R.R. Tolkien', genre: 'Fantasy', category: 'ya', pages: 310, cover_url: 'https://images.unsplash.com/photo-1629992101753-56d196c8aabb?w=150&auto=format&fit=crop' },
        { title: 'Harry Potter and the Sorcerer Stone', author: 'J.K. Rowling', genre: 'Fantasy', category: 'ya', pages: 309, cover_url: 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=150&auto=format&fit=crop' },
        { title: 'The Hunger Games', author: 'Suzanne Collins', genre: 'Dystopian', category: 'ya', pages: 374, cover_url: 'https://images.unsplash.com/photo-1587876931567-564ce588bfbd?w=150&auto=format&fit=crop' },
        { title: 'Percy Jackson & the Olympians', author: 'Rick Riordan', genre: 'Fantasy', category: 'ya', pages: 377, cover_url: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=150&auto=format&fit=crop' },
        { title: 'The Great Gatsby', author: 'F. Scott Fitzgerald', genre: 'Classic', category: 'adult', pages: 180, cover_url: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=150&auto=format&fit=crop' },
        { title: 'To Kill a Mockingbird', author: 'Harper Lee', genre: 'Fiction', category: 'adult', pages: 281, cover_url: 'https://images.unsplash.com/photo-1541963463532-d68292c34b19?w=150&auto=format&fit=crop' },
        { title: '1984', author: 'George Orwell', genre: 'Dystopian', category: 'adult', pages: 328, cover_url: 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=150&auto=format&fit=crop' },
        { title: 'Dune', author: 'Frank Herbert', genre: 'Sci-Fi', category: 'adult', pages: 412, cover_url: 'https://images.unsplash.com/photo-1531988042231-d39a9cc12a9a?w=150&auto=format&fit=crop' },
        
        // Manga Collection (Natomanga.com list)
        { title: 'Chikyuu ni Dungeon ga Dekita to Omottara', author: 'Kai Neko', genre: 'Manga, Action, Fantasy', category: 'ya', pages: 200, cover_url: 'https://img-r2.2xstorage.com/thumb/chikyuu-ni-dungeon-ga-dekita-to-omottara-ore-dake-isekai-e-ikeru-you-ni-natta-chikyuu-ni-wanai-jobushisutemu-to-kamikemo-no-ni-natta-kai-neko-no-chikara-de-futatsu-no-sekai-o-ikiki-shinagara-musou-suru.webp' },
        { title: 'Byoujaku Shoujo, Tensei Shite Kenkou na Nikutai', author: 'Sato Shin', genre: 'Manga, Fantasy, Reincarnation', category: 'ya', pages: 150, cover_url: 'https://img-r2.2xstorage.com/thumb/byoujaku-shoujo-tensei-shite-kenkou-na-nikutai-saikyou-wo-te-ni-ireru.webp' },
        { title: 'Celeb Lady', author: 'Choi Ji-an', genre: 'Manga, Romance, Drama', category: 'ya', pages: 180, cover_url: 'https://img-r2.2xstorage.com/thumb/celeb-lady.webp' },
        { title: 'Dragon Fragment', author: 'Shin Hei', genre: 'Manga, Action, Fantasy, Adventure', category: 'ya', pages: 220, cover_url: 'https://img-r2.2xstorage.com/thumb/dragon-fragment.webp' },
        { title: 'Shikabane Kaigo', author: 'Nakamura Koji', genre: 'Manga, Mystery, Drama', category: 'adult', pages: 140, cover_url: 'https://img-r2.2xstorage.com/thumb/shikabane-kaigo.webp' },
        { title: 'Kimi wa Shuumatsu', author: 'Takahashi Ken', genre: 'Manga, Drama, Slice of Life', category: 'ya', pages: 130, cover_url: 'https://img-r2.2xstorage.com/thumb/kimi-wa-shuumatsu.webp' },
        { title: 'Return Of The Bloodthirsty Police', author: 'Lee Jae-heon', genre: 'Manga, Action, Crime, Thriller', category: 'adult', pages: 280, cover_url: 'https://img-r2.2xstorage.com/thumb/return-of-the-bloodthirsty-police.webp' },
        { title: 'The Count\'s Secret Maid', author: 'Yoon Ha-rin', genre: 'Manga, Romance, Mystery, Historical', category: 'ya', pages: 190, cover_url: 'https://img-r2.2xstorage.com/thumb/the-count-s-secret-maid.webp' },
        { title: 'Gakeppuchi Kizoku no Ikinokori Senryaku', author: 'Yamada Taro', genre: 'Manga, Fantasy, Comedy', category: 'ya', pages: 160, cover_url: 'https://img-r2.2xstorage.com/thumb/gakeppuchi-kizoku-no-ikinokori-senryaku.webp' },
        { title: 'Arasaa ga VTuber ni Natta Hanashi', author: 'Yuuki Hiro', genre: 'Manga, Comedy, Slice of Life', category: 'ya', pages: 120, cover_url: 'https://img-r2.2xstorage.com/thumb/arasaa-ga-vtuber-ni-natta-hanashi.webp' },
        { title: 'Forlorn Hope ~Keishichou Battoutai Senki~', author: 'Asakura Ren', genre: 'Manga, Action, Historical', category: 'adult', pages: 240, cover_url: 'https://img-r2.2xstorage.com/thumb/forlorn-hope-keishichou-battoutai-senki.webp' },
        { title: 'Gekkou Teien', author: 'Kang Ji-hoon', genre: 'Manga, Romance, Fantasy, Drama', category: 'adult', pages: 210, cover_url: 'https://img-r2.2xstorage.com/thumb/gekkou-teien.webp' },
        { title: 'Absolute Domination at Level 0', author: 'Tsukimi Rui', genre: 'Manga, Fantasy, Isekai, Action', category: 'ya', pages: 170, cover_url: 'https://img-r2.2xstorage.com/thumb/absolute-domination-at-level-0-using-my-analysis-skill.webp' },
        { title: 'Abandoned ~Elf Weapon Smith~', author: 'Kato Ryo', genre: 'Manga, Fantasy, Action', category: 'ya', pages: 180, cover_url: 'https://img-r2.2xstorage.com/thumb/abandoned-tsuyosugite-buki-ga-kowareru-yuusha-to-buki-shokunin-no-elf.webp' },
        { title: 'Father of Three Overpowered Children', author: 'Kim Min-su', genre: 'Manga, Comedy, Fantasy, Action', category: 'ya', pages: 200, cover_url: 'https://img-r2.2xstorage.com/thumb/father-of-three-overpowered-children.webp' },
        { title: 'Extreme Flame Wizard', author: 'Sato Kenji', genre: 'Manga, Comedy, Fantasy', category: 'ya', pages: 150, cover_url: 'https://img-r2.2xstorage.com/thumb/extreme-flame-wizard-i-can-only-use-fireballs-but-i-became-the-strongest-because-i-wholeheartedly-wanted-to-be-popular.webp' },
        { title: 'Dungeon de Service Zangyou o Shite Ita', author: 'Katsura Yoshi', genre: 'Manga, Comedy, Fantasy, Action', category: 'ya', pages: 160, cover_url: 'https://img-r2.2xstorage.com/thumb/dungeon-de-service-zangyou-o-shite-ita-dake-nanoni-sasurai-no-s-kyuu-tansakusha-to-uwasa-ni-natte-shimaimashita.webp' },
        { title: 'Boy Meets Girl, Starting with a Contract', author: 'Park So-ra', genre: 'Manga, Romance, Drama', category: 'ya', pages: 140, cover_url: 'https://img-r2.2xstorage.com/thumb/boy-meets-girl-starting-with-a-contract.webp' },
        { title: 'The Princess is Now the Duke', author: 'Cho Hye-jin', genre: 'Manga, Romance, Fantasy', category: 'ya', pages: 175, cover_url: 'https://img-r2.2xstorage.com/thumb/the-princess-is-now-the-duke.webp' },
        { title: 'High School Inari Tamamo-chan!', author: 'Yuuki Hiro', genre: 'Manga, Comedy, Slice of Life, Supernatural', category: 'ya', pages: 135, cover_url: 'https://img-r2.2xstorage.com/thumb/high-school-inari-tamamo-chan.webp' }
    ];
    
    // Clear and reseed to insert updated list including manga
    await c.env.DB.prepare('DELETE FROM books').run();
    
    for (const b of startBooks) {
        await c.env.DB.prepare(
            'INSERT INTO books (title, author, genre, category, total_pages, cover_url) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(b.title, b.author, b.genre, b.category, b.pages, b.cover_url).run();
    }
    
    return c.json({ success: true, message: 'Books and Manga seeded successfully' });
});

// ─── USER LIBRARY & PROGRESS TRACKING ───

booksApp.get('/api/books/library', async (c) => {
    const user = await getAuthUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const library = await c.env.DB.prepare(
        `SELECT b.*, ub.progress_percent, ub.status, ub.rating, ub.favorite_quote, ub.review_text
         FROM books b
         JOIN user_books ub ON b.id = ub.book_id
         WHERE ub.user_id = ?`
    ).bind(user.id).all() as any;
    
    return c.json(library.results || []);
});

booksApp.post('/api/books/library/add', async (c) => {
    const user = await getAuthUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const { book_id } = await c.req.json();
    if (!book_id) return c.json({ error: 'Book ID is required' }, 400);
    
    // Check if already in library
    const existing = await c.env.DB.prepare(
        'SELECT * FROM user_books WHERE user_id = ? AND book_id = ?'
    ).bind(user.id, book_id).first() as any;
    
    if (existing) {
        return c.json({ success: true, message: 'Book already in library' });
    }
    
    await c.env.DB.prepare(
        'INSERT INTO user_books (user_id, book_id, status, progress_percent) VALUES (?, ?, ?, ?)'
    ).bind(user.id, book_id, 'want_to_read', 0).run();
    
    return c.json({ success: true, message: 'Book added to library' });
});

booksApp.post('/api/books/library/progress', async (c) => {
    const user = await getAuthUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const { book_id, progress, status, rating, favorite_quote, review_text } = await c.req.json();
    if (!book_id) return c.json({ error: 'Book ID is required' }, 400);
    
    // Update or insert reading details
    const existing = await c.env.DB.prepare(
        'SELECT * FROM user_books WHERE user_id = ? AND book_id = ?'
    ).bind(user.id, book_id).first() as any;
    
    const currentProgress = progress !== undefined ? progress : (existing?.progress_percent || 0);
    const newStatus = status || (currentProgress >= 100 ? 'finished' : 'reading');
    
    if (existing) {
        await c.env.DB.prepare(
            `UPDATE user_books 
             SET progress_percent = ?, status = ?, rating = COALESCE(?, rating), 
                 favorite_quote = COALESCE(?, favorite_quote), review_text = COALESCE(?, review_text), 
                 updated_at = datetime('now')
             WHERE user_id = ? AND book_id = ?`
        ).bind(currentProgress, newStatus, rating || null, favorite_quote || null, review_text || null, user.id, book_id).run();
    } else {
        await c.env.DB.prepare(
            `INSERT INTO user_books (user_id, book_id, progress_percent, status, rating, favorite_quote, review_text)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(user.id, book_id, currentProgress, newStatus, rating || null, favorite_quote || null, review_text || null).run();
    }
    
    // Check challenges to update user challenge progress if finished
    if (newStatus === 'finished' && existing?.status !== 'finished') {
        await c.env.DB.prepare(
            'UPDATE user_challenges SET books_read = books_read + 1 WHERE user_id = ?'
        ).bind(user.id).run();
    }
    
    return c.json({ success: true, progress: currentProgress, status: newStatus });
});

// ─── SOCIAL FEED & COMMUNITY ───

// Get updates for feed
booksApp.get('/api/books/feed', async (c) => {
    // Return all user activities, progress milestones, quotes, and reviews
    const feed = await c.env.DB.prepare(
        `SELECT ub.*, u.username, u.avatar_url, b.title, b.author
         FROM user_books ub
         JOIN ebook_users u ON ub.user_id = u.id
         JOIN books b ON ub.book_id = b.id
         WHERE ub.favorite_quote IS NOT NULL OR ub.review_text IS NOT NULL OR ub.progress_percent > 0
         ORDER BY ub.updated_at DESC
         LIMIT 20`
    ).all() as any;
    
    return c.json(feed.results || []);
});

// ─── BOOK CLUBS (VIRTUAL) & SIGNALING FOR VIDEO ───

booksApp.get('/api/books/clubs', async (c) => {
    const category = c.req.query('category') || 'ya';
    const clubs = await c.env.DB.prepare(
        'SELECT c.*, u.username as creator_name FROM book_clubs c JOIN ebook_users u ON c.creator_id = u.id WHERE c.category = ?'
    ).bind(category).all() as any;
    
    return c.json(clubs.results || []);
});

booksApp.post('/api/books/clubs', async (c) => {
    const user = await getAuthUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const { name, description, category, meeting_time } = await c.req.json();
    if (!name) return c.json({ error: 'Club name is required' }, 400);
    
    const roomId = `room_${Math.random().toString(36).substring(2, 10)}`;
    
    await c.env.DB.prepare(
        'INSERT INTO book_clubs (name, description, category, meeting_time, creator_id, room_id) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(name, description || '', category || 'ya', meeting_time || '', user.id, roomId).run();
    
    return c.json({ success: true, room_id: roomId });
});

// ─── DISCUSSION FORUMS ───

booksApp.get('/api/books/forum', async (c) => {
    const category = c.req.query('category') || 'ya';
    const threads = await c.env.DB.prepare(
        `SELECT t.*, u.username as author_name, u.avatar_url,
                (SELECT COUNT(*) FROM forum_replies r WHERE r.thread_id = t.id) as reply_count
         FROM forum_threads t
         JOIN ebook_users u ON t.author_id = u.id
         WHERE t.category = ?
         ORDER BY t.created_at DESC`
    ).bind(category).all() as any;
    
    return c.json(threads.results || []);
});

booksApp.post('/api/books/forum', async (c) => {
    const user = await getAuthUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const { title, content, category } = await c.req.json();
    if (!title || !content) return c.json({ error: 'Title and content are required' }, 400);
    
    await c.env.DB.prepare(
        'INSERT INTO forum_threads (title, content, category, author_id) VALUES (?, ?, ?, ?)'
    ).bind(title, content, category || 'ya', user.id).run();
    
    return c.json({ success: true });
});

booksApp.get('/api/books/forum/thread/:id', async (c) => {
    const threadId = c.req.param('id');
    
    const thread = await c.env.DB.prepare(
        'SELECT t.*, u.username as author_name, u.avatar_url FROM forum_threads t JOIN ebook_users u ON t.author_id = u.id WHERE t.id = ?'
    ).bind(threadId).first() as any;
    
    if (!thread) return c.json({ error: 'Thread not found' }, 404);
    
    const replies = await c.env.DB.prepare(
        'SELECT r.*, u.username as author_name, u.avatar_url FROM forum_replies r JOIN ebook_users u ON r.author_id = u.id WHERE r.thread_id = ? ORDER BY r.created_at ASC'
    ).bind(threadId).all() as any;
    
    return c.json({ thread, replies: replies.results || [] });
});

booksApp.post('/api/books/forum/thread/:id/reply', async (c) => {
    const user = await getAuthUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const threadId = c.req.param('id');
    const { content } = await c.req.json();
    
    if (!content) return c.json({ error: 'Reply content is required' }, 400);
    
    await c.env.DB.prepare(
        'INSERT INTO forum_replies (thread_id, author_id, content) VALUES (?, ?, ?)'
    ).bind(threadId, user.id, content).run();
    
    return c.json({ success: true });
});

// ─── WALLET & TRANSACTIONS ───

booksApp.get('/api/books/wallet', async (c) => {
    const user = await getAuthUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const txs = await c.env.DB.prepare(
        'SELECT * FROM wallet_transactions WHERE user_id = ? ORDER BY created_at DESC'
    ).bind(user.id).all() as any;
    
    return c.json({
        balance: user.wallet_balance,
        transactions: txs.results || []
    });
});

booksApp.post('/api/books/wallet/topup', async (c) => {
    const user = await getAuthUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const { amount } = await c.req.json();
    if (!amount || amount <= 0) return c.json({ error: 'Invalid amount' }, 400);
    
    const newBalance = user.wallet_balance + amount;
    
    await c.env.DB.prepare('UPDATE ebook_users SET wallet_balance = ? WHERE id = ?').bind(newBalance, user.id).run();
    await c.env.DB.prepare(
        'INSERT INTO wallet_transactions (user_id, amount, type, description) VALUES (?, ?, ?, ?)'
    ).bind(user.id, amount, 'topup', 'Wallet Top-Up').run();
    
    return c.json({ success: true, balance: newBalance });
});

// ─── MARKETPLACE (SELL & TRADE) ───

booksApp.get('/api/books/marketplace', async (c) => {
    const listings = await c.env.DB.prepare(
        `SELECT l.*, u.username as seller_name
         FROM marketplace_listings l
         JOIN ebook_users u ON l.seller_id = u.id
         WHERE l.status = 'active'
         ORDER BY l.created_at DESC`
    ).all() as any;
    
    return c.json(listings.results || []);
});

booksApp.post('/api/books/marketplace/list', async (c) => {
    const user = await getAuthUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const { title, author, description, price, listing_type } = await c.req.json();
    if (!title || !author || price === undefined) {
        return c.json({ error: 'Title, author, and price are required' }, 400);
    }
    
    await c.env.DB.prepare(
        'INSERT INTO marketplace_listings (seller_id, book_title, book_author, description, price, listing_type) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(user.id, title, author, description || '', price, listing_type || 'sell').run();
    
    return c.json({ success: true });
});

// Purchase item using the Wallet Payment system
booksApp.post('/api/books/marketplace/buy', async (c) => {
    const user = await getAuthUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const { listing_id } = await c.req.json();
    const listing = await c.env.DB.prepare(
        'SELECT * FROM marketplace_listings WHERE id = ? AND status = ?'
    ).bind(listing_id, 'active').first() as any;
    
    if (!listing) return c.json({ error: 'Listing not active or not found' }, 404);
    if (listing.seller_id === user.id) return c.json({ error: 'You cannot buy your own book' }, 400);
    
    // Check funds
    if (user.wallet_balance < listing.price) {
        return c.json({ error: 'Insufficient wallet balance' }, 400);
    }
    
    // Perform transaction atomically
    const buyerNewBalance = user.wallet_balance - listing.price;
    
    // Get seller profile to update balance
    const seller = await c.env.DB.prepare(
        'SELECT * FROM ebook_users WHERE id = ?'
    ).bind(listing.seller_id).first() as any;
    
    if (!seller) return c.json({ error: 'Seller not found' }, 404);
    const sellerNewBalance = seller.wallet_balance + listing.price;
    
    // 1. Update buyer balance
    await c.env.DB.prepare('UPDATE ebook_users SET wallet_balance = ? WHERE id = ?').bind(buyerNewBalance, user.id).run();
    // 2. Update seller balance
    await c.env.DB.prepare('UPDATE ebook_users SET wallet_balance = ? WHERE id = ?').bind(sellerNewBalance, listing.seller_id).run();
    // 3. Mark listing sold
    await c.env.DB.prepare('UPDATE marketplace_listings SET status = ? WHERE id = ?').bind('sold', listing.id).run();
    
    // 4. Create transaction records
    await c.env.DB.prepare(
        'INSERT INTO wallet_transactions (user_id, amount, type, description) VALUES (?, ?, ?, ?)'
    ).bind(user.id, -listing.price, 'purchase', `Purchased "${listing.book_title}"`).run();
    
    await c.env.DB.prepare(
        'INSERT INTO wallet_transactions (user_id, amount, type, description) VALUES (?, ?, ?, ?)'
    ).bind(listing.seller_id, listing.price, 'sale', `Sold "${listing.book_title}"`).run();
    
    // Add book to buyer's collection
    // Check if book metadata exists in catalog first
    let book = await c.env.DB.prepare(
        'SELECT * FROM books WHERE title = ? AND author = ?'
    ).bind(listing.book_title, listing.book_author).first() as any;
    
    if (!book) {
        // Insert custom book
        await c.env.DB.prepare(
            'INSERT INTO books (title, author, cover_url, category, total_pages) VALUES (?, ?, ?, ?, ?)'
        ).bind(listing.book_title, listing.book_author, 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=150&auto=format&fit=crop', 'ya', 250).run();
        
        book = await c.env.DB.prepare(
            'SELECT * FROM books WHERE title = ? AND author = ?'
        ).bind(listing.book_title, listing.book_author).first() as any;
    }
    
    await c.env.DB.prepare(
        'INSERT INTO user_books (user_id, book_id, status, progress_percent) VALUES (?, ?, ?, ?)'
    ).bind(user.id, book.id, 'want_to_read', 0).run();
    
    return c.json({ success: true, balance: buyerNewBalance });
});

// ─── READING CHALLENGES ───

booksApp.get('/api/books/challenges', async (c) => {
    const user = await getAuthUser(c);
    const challenges = await c.env.DB.prepare(
        `SELECT rc.*, uc.books_read, (uc.challenge_id IS NOT NULL) as joined
         FROM reading_challenges rc
         LEFT JOIN user_challenges uc ON rc.id = uc.challenge_id AND uc.user_id = ?`
    ).bind(user ? user.id : '').all() as any;
    
    return c.json(challenges.results || []);
});

booksApp.post('/api/books/challenges/join', async (c) => {
    const user = await getAuthUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const { challenge_id } = await c.req.json();
    if (!challenge_id) return c.json({ error: 'Challenge ID is required' }, 400);
    
    try {
        await c.env.DB.prepare(
            'INSERT INTO user_challenges (user_id, challenge_id, books_read) VALUES (?, ?, 0)'
        ).bind(user.id, challenge_id).run();
        return c.json({ success: true });
    } catch {
        return c.json({ error: 'Already joined or invalid challenge' }, 400);
    }
});

// Add seed challenges
booksApp.post('/api/books/challenges/seed', async (c) => {
    const startChallenges = [
        { title: 'Summer Reading Blitz', description: 'Read 3 books by the end of August', count: 3 },
        { title: 'Fantasy Expedition', description: 'Explore magical worlds by reading 5 fantasy novels', count: 5 },
        { title: 'YA Classics Challenge', description: 'Finish 4 young adult best sellers', count: 4 }
    ];
    
    const countResult = await c.env.DB.prepare('SELECT COUNT(*) as count FROM reading_challenges').first() as any;
    if (countResult && countResult.count > 0) {
        return c.json({ success: true, message: 'Challenges already seeded' });
    }
    
    for (const ch of startChallenges) {
        await c.env.DB.prepare(
            'INSERT INTO reading_challenges (title, description, target_count, start_date, end_date) VALUES (?, ?, ?, ?, ?)'
        ).bind(ch.title, ch.description, ch.count, '2026-07-01', '2026-09-30').run();
    }
    
    return c.json({ success: true, message: 'Challenges seeded successfully' });
});

export default booksApp;
