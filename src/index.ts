import { Hono } from 'hono';
import type { Env, Variables } from './env';

import publicApp from './routes/public';
import authApp from './routes/auth';
import adminApp from './routes/admin';
import booksApp from './routes/books';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Mount routes
app.route('/', publicApp);
app.route('/', authApp);
app.route('/admin', adminApp);
app.route('/', booksApp);

export default app;

