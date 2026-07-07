import { Hono } from 'hono';
import type { Context } from 'hono';
import {
    hashPassword, verifyPassword,
    createSessionToken, setSessionCookie, clearSessionCookie,
    generateCsrfToken, setCsrfCookie, getCsrfCookie
} from '../auth';
import { renderLogin, renderRegister } from '../templates';
import type { Env, Variables } from '../env';

const authApp = new Hono<{ Bindings: Env; Variables: Variables }>();

// Helper to parse form body
async function parseForm(c: Context): Promise<Record<string, any>> {
    const contentType = c.req.header('Content-Type') || '';
    if (contentType.includes('application/x-www-form-urlencoded')) {
        const text = await c.req.text();
        return Object.fromEntries(new URLSearchParams(text));
    }
    return {};
}

function validateCsrf(c: Context, csrfToken: string): boolean {
    const expectedCsrf = getCsrfCookie(c.req.header('Cookie'));
    return !!expectedCsrf && csrfToken === expectedCsrf;
}

authApp.get('/login', (c) => {
    const csrfToken = generateCsrfToken();
    c.header('Set-Cookie', setCsrfCookie(csrfToken));
    return c.html(renderLogin('', '', csrfToken));
});

authApp.post('/login', async (c) => {
    const db = c.env.DB;
    const form = await parseForm(c);
    const { username, password, csrfToken } = form;

    if (!validateCsrf(c, csrfToken)) {
        const newCsrf = generateCsrfToken();
        c.header('Set-Cookie', setCsrfCookie(newCsrf));
        return c.html(renderLogin('Invalid CSRF token.', '', newCsrf));
    }

    if (!username || !password) {
        const newCsrf = generateCsrfToken();
        c.header('Set-Cookie', setCsrfCookie(newCsrf));
        return c.html(renderLogin('Please fill in all fields.', '', newCsrf));
    }

    const user = await db.prepare('SELECT id, username, password_hash FROM users WHERE username = ?').bind(username).first<{ id: number, username: string, password_hash: string }>();
    if (!user) {
        const newCsrf = generateCsrfToken();
        c.header('Set-Cookie', setCsrfCookie(newCsrf));
        return c.html(renderLogin('Invalid username or password.', '', newCsrf));
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
        const newCsrf = generateCsrfToken();
        c.header('Set-Cookie', setCsrfCookie(newCsrf));
        return c.html(renderLogin('Invalid username or password.', '', newCsrf));
    }

    const token = await createSessionToken(user.id, user.username, c.env.JWT_SECRET_KEY);
    return new Response(null, {
        status: 302,
        headers: {
            'Location': '/admin/projects',
            'Set-Cookie': setSessionCookie(token)
        }
    });
});

authApp.get('/register', (c) => {
    if (c.env.ALLOW_REGISTRATION !== 'true') {
        return c.redirect('/login');
    }
    const csrfToken = generateCsrfToken();
    c.header('Set-Cookie', setCsrfCookie(csrfToken));
    return c.html(renderRegister('', csrfToken));
});

authApp.post('/register', async (c) => {
    if (c.env.ALLOW_REGISTRATION !== 'true') {
        return c.redirect('/login');
    }
    const db = c.env.DB;
    const form = await parseForm(c);
    const { username, password, confirm_password, invite_code, csrfToken } = form;

    if (!validateCsrf(c, csrfToken)) {
        const newCsrf = generateCsrfToken();
        c.header('Set-Cookie', setCsrfCookie(newCsrf));
        return c.html(renderRegister('Invalid CSRF token.', newCsrf));
    }

    if (invite_code !== c.env.INVITE_CODE) {
        const newCsrf = generateCsrfToken();
        c.header('Set-Cookie', setCsrfCookie(newCsrf));
        return c.html(renderRegister('Invalid invite code.', newCsrf));
    }

    if (!username || !password || !confirm_password) {
        const newCsrf = generateCsrfToken();
        c.header('Set-Cookie', setCsrfCookie(newCsrf));
        return c.html(renderRegister('Please fill in all fields.', newCsrf));
    }
    if (password.length < 6) {
        const newCsrf = generateCsrfToken();
        c.header('Set-Cookie', setCsrfCookie(newCsrf));
        return c.html(renderRegister('Password must be at least 6 characters.', newCsrf));
    }
    if (password !== confirm_password) {
        const newCsrf = generateCsrfToken();
        c.header('Set-Cookie', setCsrfCookie(newCsrf));
        return c.html(renderRegister('Passwords do not match.', newCsrf));
    }

    const existing = await db.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
    if (existing) {
        const newCsrf = generateCsrfToken();
        c.header('Set-Cookie', setCsrfCookie(newCsrf));
        return c.html(renderRegister('Username already taken.', newCsrf));
    }

    const hash = await hashPassword(password);
    await db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').bind(username, hash).run();

    return c.html(renderLogin('', 'Account created! Please sign in.'));
});

authApp.post('/logout', async (c) => {
    const form = await parseForm(c);
    if (!validateCsrf(c, form.csrfToken)) {
        // CSRF validation for logout
        return c.redirect('/admin');
    }
    return new Response(null, {
        status: 302,
        headers: {
            'Location': '/login',
            'Set-Cookie': clearSessionCookie()
        }
    });
});

export default authApp;
