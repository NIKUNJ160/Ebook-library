import { Hono } from 'hono';
import type { Context } from 'hono';
import {
    hashPassword, verifyPassword,
    createSessionToken, getSessionCookie, setSessionCookie, clearSessionCookie,
    authMiddleware
} from './auth';
import {
    renderPortfolio, renderLogin, renderRegister,
    renderAdminProjects, renderProjectForm,
    renderAdminSkills, renderAdminServices, renderAdminMessages
} from './templates';
import type { Env, Variables, ProjectRow, SkillRow, ServiceRow, MessageRow } from './env';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Helper to parse form body
async function parseForm(c: Context): Promise<Record<string, any>> {
    const contentType = c.req.header('Content-Type') || '';
    if (contentType.includes('application/x-www-form-urlencoded')) {
        const text = await c.req.text();
        return Object.fromEntries(new URLSearchParams(text));
    }
    if (contentType.includes('multipart/form-data')) {
        const formData = await c.req.formData();
        const obj: Record<string, any> = {};
        for (const [key, value] of formData.entries()) {
            obj[key] = value;
        }
        return obj;
    }
    return {};
}

// ═══════════════════════════════════════
// PUBLIC ROUTES
// ═══════════════════════════════════════

// Pinterest Verification
app.get('/pinterest-12995.html', (c) => {
    return c.text('pinterest-site-verification=129956d073186271cd7fcf5315605557');
});

// Portfolio Home
app.get('/', async (c) => {
    const db = c.env.DB;
    const projectsResult = await db.prepare(
        'SELECT * FROM projects WHERE is_featured = 1 ORDER BY created_at DESC'
    ).all<ProjectRow>();
    const projects = projectsResult.results || [];

    const skillsResult = await db.prepare(
        'SELECT * FROM skills ORDER BY category, proficiency DESC'
    ).all<SkillRow>();
    const allSkills = skillsResult.results || [];

    const skillsByCategory: Record<string, SkillRow[]> = {};
    for (const skill of allSkills) {
        if (!skillsByCategory[skill.category]) skillsByCategory[skill.category] = [];
        skillsByCategory[skill.category].push(skill);
    }

    return c.html(renderPortfolio(projects, skillsByCategory));
});

// Contact Form Submission
app.post('/contact', async (c) => {
    const db = c.env.DB;
    const form = await parseForm(c);
    const { name, email, message, csrfToken } = form;

    if (csrfToken !== 'fixed-csrf-token-for-now') {
        return c.html(renderPortfolio([], {}, false, 'Invalid CSRF token.'));
    }

    if (!name || !email || !message || !name.trim() || !email.trim() || !message.trim()) {
        // Re-render with error
        const projectsResult = await db.prepare('SELECT * FROM projects WHERE is_featured = 1 ORDER BY created_at DESC').all<ProjectRow>();
        const skillsResult = await db.prepare('SELECT * FROM skills ORDER BY category, proficiency DESC').all<SkillRow>();
        const skillsByCategory: Record<string, SkillRow[]> = {};
        for (const s of (skillsResult.results || [])) {
            if (!skillsByCategory[s.category]) skillsByCategory[s.category] = [];
            skillsByCategory[s.category].push(s);
        }
        return c.html(renderPortfolio(projectsResult.results || [], skillsByCategory, false, 'Please fill in all fields.'));
    }

    try {
        await db.prepare('INSERT INTO messages (name, email, message) VALUES (?, ?, ?)').bind(name, email, message).run();
        // Re-render with success
        const projectsResult = await db.prepare('SELECT * FROM projects WHERE is_featured = 1 ORDER BY created_at DESC').all<ProjectRow>();
        const skillsResult = await db.prepare('SELECT * FROM skills ORDER BY category, proficiency DESC').all<SkillRow>();
        const skillsByCategory: Record<string, SkillRow[]> = {};
        for (const s of (skillsResult.results || [])) {
            if (!skillsByCategory[s.category]) skillsByCategory[s.category] = [];
            skillsByCategory[s.category].push(s);
        }
        return c.html(renderPortfolio(projectsResult.results || [], skillsByCategory, true));
    } catch (e) {
        const projectsResult = await db.prepare('SELECT * FROM projects WHERE is_featured = 1 ORDER BY created_at DESC').all<ProjectRow>();
        const skillsResult = await db.prepare('SELECT * FROM skills ORDER BY category, proficiency DESC').all<SkillRow>();
        const skillsByCategory: Record<string, SkillRow[]> = {};
        for (const s of (skillsResult.results || [])) {
            if (!skillsByCategory[s.category]) skillsByCategory[s.category] = [];
            skillsByCategory[s.category].push(s);
        }
        return c.html(renderPortfolio(projectsResult.results || [], skillsByCategory, false, 'Something went wrong. Please try again later.'));
    }
});

// ═══════════════════════════════════════
// AUTH ROUTES
// ═══════════════════════════════════════

app.get('/login', (c) => c.html(renderLogin()));

app.post('/login', async (c) => {
    const db = c.env.DB;
    const form = await parseForm(c);
    const { username, password } = form;

    if (!username || !password) {
        return c.html(renderLogin('Please fill in all fields.'));
    }

    const user = await db.prepare('SELECT * FROM users WHERE username = ?').bind(username).first<{ id: number, username: string, password_hash: string }>();
    if (!user) {
        return c.html(renderLogin('Invalid username or password.'));
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
        return c.html(renderLogin('Invalid username or password.'));
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

app.get('/register', (c) => {
    if (c.env.ALLOW_REGISTRATION !== 'true') {
        return c.redirect('/login');
    }
    return c.html(renderRegister());
});

app.post('/register', async (c) => {
    if (c.env.ALLOW_REGISTRATION !== 'true') {
        return c.redirect('/login');
    }
    const db = c.env.DB;
    const form = await parseForm(c);
    const { username, password, confirm_password, invite_code } = form;

    if (invite_code !== c.env.INVITE_CODE) {
        return c.html(renderRegister('Invalid invite code.'));
    }

    if (!username || !password || !confirm_password) {
        return c.html(renderRegister('Please fill in all fields.'));
    }
    if (password.length < 6) {
        return c.html(renderRegister('Password must be at least 6 characters.'));
    }
    if (password !== confirm_password) {
        return c.html(renderRegister('Passwords do not match.'));
    }

    const existing = await db.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
    if (existing) {
        return c.html(renderRegister('Username already taken.'));
    }

    const hash = await hashPassword(password);
    await db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').bind(username, hash).run();

    return c.html(renderLogin('', 'Account created! Please sign in.'));
});

app.post('/logout', (c) => {
    return new Response(null, {
        status: 302,
        headers: {
            'Location': '/login',
            'Set-Cookie': clearSessionCookie()
        }
    });
});

// ═══════════════════════════════════════
// ADMIN ROUTES (protected)
// ═══════════════════════════════════════

app.use('/admin/*', authMiddleware);

// Redirect /admin to /admin/projects
app.get('/admin', (c) => c.redirect('/admin/projects'));

// --- Projects ---

app.get('/admin/projects', async (c) => {
    const db = c.env.DB;
    const user = c.get('user');
    const result = await db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all<ProjectRow>();
    const url = new URL(c.req.url);
    const msg = url.searchParams.get('msg') || '';
    return c.html(renderAdminProjects(result.results || [], user.username, msg));
});

app.get('/admin/projects/edit', async (c) => {
    const db = c.env.DB;
    const user = c.get('user');
    const url = new URL(c.req.url);
    const id = url.searchParams.get('id');
    let project: ProjectRow | null = null;
    if (id) {
        project = await db.prepare('SELECT * FROM projects WHERE id = ?').bind(id).first<ProjectRow>();
    }
    return c.html(renderProjectForm(project, user.username));
});

app.post('/admin/projects/save', async (c) => {
    const db = c.env.DB;
    const form = await parseForm(c);
    const { id, title, description, tags, image_url, project_url, repo_url } = form;
    const is_featured = form.is_featured ? 1 : 0;
    let normalizedImageUrl = image_url || '';
    if (normalizedImageUrl && !normalizedImageUrl.startsWith('http') && !normalizedImageUrl.startsWith('/')) {
        normalizedImageUrl = '/' + normalizedImageUrl;
    }

    if (!title || !description || !title.trim() || !description.trim()) {
        return c.redirect('/admin/projects?msg=Error:+Title+and+Description+are+required');
    }

    if (id) {
        await db.prepare(
            'UPDATE projects SET title=?, description=?, tags=?, project_url=?, repo_url=?, image_url=?, is_featured=? WHERE id=?'
        ).bind(title, description, tags || '', project_url || '', repo_url || '', normalizedImageUrl, is_featured, id).run();
    } else {
        await db.prepare(
            'INSERT INTO projects (title, description, tags, project_url, repo_url, image_url, is_featured) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(title, description, tags || '', project_url || '', repo_url || '', normalizedImageUrl, is_featured).run();
    }

    return c.redirect('/admin/projects?msg=Project+saved+successfully');
});

app.post('/admin/projects/delete', async (c) => {
    const db = c.env.DB;
    const form = await parseForm(c);
    await db.prepare('DELETE FROM projects WHERE id = ?').bind(form.id).run();
    return c.redirect('/admin/projects?msg=Project+deleted');
});

// --- Skills ---

app.get('/admin/skills', async (c) => {
    const db = c.env.DB;
    const user = c.get('user');
    const result = await db.prepare('SELECT * FROM skills ORDER BY category, proficiency DESC').all<SkillRow>();
    return c.html(renderAdminSkills(result.results || [], user.username));
});

app.post('/admin/skills/add', async (c) => {
    const db = c.env.DB;
    const form = await parseForm(c);
    const { name, category } = form;
    let proficiency = parseInt(form.proficiency);

    if (!name || !category || !name.trim()) {
        return c.redirect('/admin/skills?msg=Error:+Name+and+Category+are+required');
    }

    // Clamp proficiency to 0-100
    if (isNaN(proficiency)) proficiency = 80;
    proficiency = Math.max(0, Math.min(100, proficiency));

    await db.prepare('INSERT INTO skills (name, category, proficiency) VALUES (?, ?, ?)')
        .bind(name, category, proficiency).run();
    return c.redirect('/admin/skills');
});

app.post('/admin/skills/delete', async (c) => {
    const db = c.env.DB;
    const form = await parseForm(c);
    await db.prepare('DELETE FROM skills WHERE id = ?').bind(form.id).run();
    return c.redirect('/admin/skills');
});

// --- Services ---

app.get('/admin/services', async (c) => {
    const db = c.env.DB;
    const user = c.get('user');
    const result = await db.prepare('SELECT * FROM services ORDER BY created_at ASC').all<ServiceRow>();
    return c.html(renderAdminServices(result.results || [], user.username));
});

app.post('/admin/services/add', async (c) => {
    const db = c.env.DB;
    const form = await parseForm(c);
    const { title, description, icon } = form;

    if (!title || !description || !icon || !title.trim() || !description.trim() || !icon.trim()) {
        return c.redirect('/admin/services?msg=Error:+All+fields+are+required');
    }

    await db.prepare('INSERT INTO services (title, description, icon) VALUES (?, ?, ?)')
        .bind(title, description, icon).run();
    return c.redirect('/admin/services');
});

app.post('/admin/services/delete', async (c) => {
    const db = c.env.DB;
    const form = await parseForm(c);
    await db.prepare('DELETE FROM services WHERE id = ?').bind(form.id).run();
    return c.redirect('/admin/services');
});

// --- Messages ---

app.get('/admin/messages', async (c) => {
    const db = c.env.DB;
    const user = c.get('user');
    const result = await db.prepare('SELECT * FROM messages ORDER BY created_at DESC').all<MessageRow>();
    const url = new URL(c.req.url);
    const msg = url.searchParams.get('msg') || '';
    return c.html(renderAdminMessages(result.results || [], user.username, msg));
});

app.post('/admin/messages/read', async (c) => {
    const db = c.env.DB;
    const form = await parseForm(c);
    const id = form.id;
    if (id) {
        await db.prepare("UPDATE messages SET status = 'read' WHERE id = ?").bind(id).run();
    }
    return c.redirect('/admin/messages');
});

app.post('/admin/messages/delete', async (c) => {
    const db = c.env.DB;
    const form = await parseForm(c);
    await db.prepare('DELETE FROM messages WHERE id = ?').bind(form.id).run();
    return c.redirect('/admin/messages?msg=Message+deleted');
});

export default app;
