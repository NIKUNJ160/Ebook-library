import { Hono } from 'hono';
import type { Context } from 'hono';
import { authMiddleware, generateCsrfToken, setCsrfCookie, getCsrfCookie } from '../auth';
import { renderAdminProjects, renderProjectForm, renderAdminSkills, renderAdminServices, renderAdminMessages } from '../templates';
import type { Env, Variables, ProjectRow, SkillRow, ServiceRow, MessageRow } from '../env';

const adminApp = new Hono<{ Bindings: Env; Variables: Variables }>();

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

function setupCsrf(c: Context): string {
    const csrfToken = generateCsrfToken();
    c.header('Set-Cookie', setCsrfCookie(csrfToken));
    return csrfToken;
}

adminApp.use('/*', authMiddleware);

// Redirect /admin to /admin/projects
adminApp.get('/', (c) => c.redirect('/admin/projects'));

// --- Projects ---

adminApp.get('/projects', async (c) => {
    const db = c.env.DB;
    const user = c.get('user');
    const result = await db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all<ProjectRow>();
    const url = new URL(c.req.url);
    const msg = url.searchParams.get('msg') || '';
    const csrfToken = setupCsrf(c);
    return c.html(renderAdminProjects(result.results || [], user.username, msg, csrfToken));
});

adminApp.get('/projects/edit', async (c) => {
    const db = c.env.DB;
    const user = c.get('user');
    const url = new URL(c.req.url);
    const id = url.searchParams.get('id');
    let project: ProjectRow | null = null;
    if (id) {
        project = await db.prepare('SELECT * FROM projects WHERE id = ?').bind(id).first<ProjectRow>();
    }
    const csrfToken = setupCsrf(c);
    return c.html(renderProjectForm(project, user.username, csrfToken));
});

adminApp.post('/projects/save', async (c) => {
    const db = c.env.DB;
    const form = await parseForm(c);
    const { id, title, description, tags, image_url, project_url, repo_url, csrfToken } = form;
    
    if (!validateCsrf(c, csrfToken)) {
        return c.redirect('/admin/projects?msg=Invalid+CSRF+token');
    }

    const is_featured = form.is_featured ? 1 : 0;
    
    // URL Validation
    let normalizedImageUrl = image_url || '';
    if (normalizedImageUrl && !normalizedImageUrl.startsWith('http://') && !normalizedImageUrl.startsWith('https://') && !normalizedImageUrl.startsWith('/')) {
        normalizedImageUrl = '/' + normalizedImageUrl;
    }
    const isValidUrl = (u: string) => !u || u.startsWith('http://') || u.startsWith('https://') || u.startsWith('/');
    if (!isValidUrl(project_url) || !isValidUrl(repo_url)) {
        return c.redirect('/admin/projects?msg=Error:+Invalid+URL+format');
    }

    if (!title || !description || !title.trim() || !description.trim()) {
        return c.redirect('/admin/projects?msg=Error:+Title+and+Description+are+required');
    }

    try {
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
    } catch (e) {
        return c.redirect('/admin/projects?msg=Error:+Database+query+failed');
    }
});

adminApp.post('/projects/delete', async (c) => {
    const db = c.env.DB;
    const form = await parseForm(c);
    if (!validateCsrf(c, form.csrfToken)) {
        return c.redirect('/admin/projects?msg=Invalid+CSRF+token');
    }
    try {
        await db.prepare('DELETE FROM projects WHERE id = ?').bind(form.id).run();
        return c.redirect('/admin/projects?msg=Project+deleted');
    } catch (e) {
        return c.redirect('/admin/projects?msg=Error:+Deletion+failed');
    }
});

// --- Skills ---

adminApp.get('/skills', async (c) => {
    const db = c.env.DB;
    const user = c.get('user');
    const result = await db.prepare('SELECT * FROM skills ORDER BY category, proficiency DESC').all<SkillRow>();
    const csrfToken = setupCsrf(c);
    return c.html(renderAdminSkills(result.results || [], user.username, csrfToken));
});

adminApp.post('/skills/add', async (c) => {
    const db = c.env.DB;
    const form = await parseForm(c);
    const { name, category, csrfToken } = form;
    
    if (!validateCsrf(c, csrfToken)) {
        return c.redirect('/admin/skills?msg=Invalid+CSRF+token');
    }

    let proficiency = parseInt(form.proficiency);

    if (!name || !category || !name.trim()) {
        return c.redirect('/admin/skills?msg=Error:+Name+and+Category+are+required');
    }

    // Clamp proficiency to 0-100
    if (isNaN(proficiency)) proficiency = 80;
    proficiency = Math.max(0, Math.min(100, proficiency));

    try {
        await db.prepare('INSERT INTO skills (name, category, proficiency) VALUES (?, ?, ?)')
            .bind(name, category, proficiency).run();
        return c.redirect('/admin/skills');
    } catch (e) {
        return c.redirect('/admin/skills?msg=Error:+Database+query+failed');
    }
});

adminApp.post('/skills/delete', async (c) => {
    const db = c.env.DB;
    const form = await parseForm(c);
    if (!validateCsrf(c, form.csrfToken)) {
        return c.redirect('/admin/skills?msg=Invalid+CSRF+token');
    }
    try {
        await db.prepare('DELETE FROM skills WHERE id = ?').bind(form.id).run();
        return c.redirect('/admin/skills');
    } catch (e) {
        return c.redirect('/admin/skills?msg=Error:+Deletion+failed');
    }
});

// --- Services ---

adminApp.get('/services', async (c) => {
    const db = c.env.DB;
    const user = c.get('user');
    const result = await db.prepare('SELECT * FROM services ORDER BY created_at ASC').all<ServiceRow>();
    const csrfToken = setupCsrf(c);
    return c.html(renderAdminServices(result.results || [], user.username, csrfToken));
});

adminApp.post('/services/add', async (c) => {
    const db = c.env.DB;
    const form = await parseForm(c);
    const { title, description, icon, csrfToken } = form;

    if (!validateCsrf(c, csrfToken)) {
        return c.redirect('/admin/services?msg=Invalid+CSRF+token');
    }

    if (!title || !description || !icon || !title.trim() || !description.trim() || !icon.trim()) {
        return c.redirect('/admin/services?msg=Error:+All+fields+are+required');
    }

    try {
        await db.prepare('INSERT INTO services (title, description, icon) VALUES (?, ?, ?)')
            .bind(title, description, icon).run();
        return c.redirect('/admin/services');
    } catch (e) {
        return c.redirect('/admin/services?msg=Error:+Database+query+failed');
    }
});

adminApp.post('/services/delete', async (c) => {
    const db = c.env.DB;
    const form = await parseForm(c);
    if (!validateCsrf(c, form.csrfToken)) {
        return c.redirect('/admin/services?msg=Invalid+CSRF+token');
    }
    try {
        await db.prepare('DELETE FROM services WHERE id = ?').bind(form.id).run();
        return c.redirect('/admin/services');
    } catch (e) {
        return c.redirect('/admin/services?msg=Error:+Deletion+failed');
    }
});

// --- Messages ---

adminApp.get('/messages', async (c) => {
    const db = c.env.DB;
    const user = c.get('user');
    const result = await db.prepare('SELECT * FROM messages ORDER BY created_at DESC').all<MessageRow>();
    const url = new URL(c.req.url);
    const msg = url.searchParams.get('msg') || '';
    const csrfToken = setupCsrf(c);
    return c.html(renderAdminMessages(result.results || [], user.username, msg, csrfToken));
});

adminApp.post('/messages/read', async (c) => {
    const db = c.env.DB;
    const form = await parseForm(c);
    if (!validateCsrf(c, form.csrfToken)) {
        return c.redirect('/admin/messages?msg=Invalid+CSRF+token');
    }
    const id = form.id;
    if (id) {
        try {
            await db.prepare("UPDATE messages SET status = 'read' WHERE id = ?").bind(id).run();
        } catch (e) {
            return c.redirect('/admin/messages?msg=Error:+Query+failed');
        }
    }
    return c.redirect('/admin/messages');
});

adminApp.post('/messages/delete', async (c) => {
    const db = c.env.DB;
    const form = await parseForm(c);
    if (!validateCsrf(c, form.csrfToken)) {
        return c.redirect('/admin/messages?msg=Invalid+CSRF+token');
    }
    try {
        await db.prepare('DELETE FROM messages WHERE id = ?').bind(form.id).run();
        return c.redirect('/admin/messages?msg=Message+deleted');
    } catch (e) {
        return c.redirect('/admin/messages?msg=Error:+Deletion+failed');
    }
});

export default adminApp;
