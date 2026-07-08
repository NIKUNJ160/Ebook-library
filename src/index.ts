import { Hono } from 'hono';
import type { Env, Variables } from './env';

import publicApp from './routes/public';
import authApp from './routes/auth';
import adminApp from './routes/admin';
import booksApp from './routes/books';
import { renderBookHaven } from './routes/bookhaven_template';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Serve the ebook website directly on the root path if requested on the ebook-library subdomain
app.get('/', async (c, next) => {
    const host = c.req.header('host') || '';
    if (host.includes('ebook-library')) {
        return c.html(renderBookHaven());
    }
    await next();
});

// Mount routes
app.route('/', publicApp);
app.route('/', authApp);
app.route('/admin', adminApp);
app.route('/', booksApp);

export default app;

