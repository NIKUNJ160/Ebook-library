import { Hono } from 'hono';
import type { Context } from 'hono';
import { renderPortfolio } from '../templates';
import type { Env, Variables, ProjectRow, SkillRow } from '../env';
import { generateCsrfToken, setCsrfCookie } from '../auth';

const publicApp = new Hono<{ Bindings: Env; Variables: Variables }>();

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

// Pinterest Verification
publicApp.get('/pinterest-12995.html', (c) => {
    return c.text('pinterest-site-verification=129956d073186271cd7fcf5315605557');
});

// Portfolio Home
publicApp.get('/', async (c) => {
    // Basic caching for public home route
    c.header('Cache-Control', 'public, max-age=60, s-maxage=300');

    const db = c.env.DB;
    const projectsResult = await db.prepare(
        'SELECT id, title, description, image_url, tags, project_url, repo_url FROM projects WHERE is_featured = 1 ORDER BY created_at DESC'
    ).all<ProjectRow>();
    const projects = projectsResult.results || [];

    const skillsResult = await db.prepare(
        'SELECT id, name, category, proficiency FROM skills ORDER BY category, proficiency DESC'
    ).all<SkillRow>();
    const allSkills = skillsResult.results || [];

    const skillsByCategory: Record<string, SkillRow[]> = {};
    for (const skill of allSkills) {
        if (!skillsByCategory[skill.category]) skillsByCategory[skill.category] = [];
        skillsByCategory[skill.category].push(skill);
    }

    const csrfToken = generateCsrfToken();
    c.header('Set-Cookie', setCsrfCookie(csrfToken));

    return c.html(renderPortfolio(projects, skillsByCategory, false, '', csrfToken));
});

// Contact Form Submission
publicApp.post('/contact', async (c) => {
    const db = c.env.DB;
    const form = await parseForm(c);
    const { name, email, message, csrfToken } = form;

    const cookieHeader = c.req.header('Cookie');
    const cookies = cookieHeader ? cookieHeader.split(';').map(c => c.trim()) : [];
    const csrfCookieStr = cookies.find(c => c.startsWith('csrf_token='));
    const expectedCsrf = csrfCookieStr ? csrfCookieStr.substring(csrfCookieStr.indexOf('=') + 1) : null;

    if (!expectedCsrf || csrfToken !== expectedCsrf) {
        return c.redirect('/?msg=Invalid+CSRF+token');
    }

    // Helper to render error
    const renderError = async (errorMsg: string) => {
        const projectsResult = await db.prepare('SELECT id, title, description, image_url, tags, project_url, repo_url FROM projects WHERE is_featured = 1 ORDER BY created_at DESC').all<ProjectRow>();
        const skillsResult = await db.prepare('SELECT id, name, category, proficiency FROM skills ORDER BY category, proficiency DESC').all<SkillRow>();
        const skillsByCategory: Record<string, SkillRow[]> = {};
        for (const s of (skillsResult.results || [])) {
            if (!skillsByCategory[s.category]) skillsByCategory[s.category] = [];
            skillsByCategory[s.category].push(s);
        }
        const newCsrf = generateCsrfToken();
        c.header('Set-Cookie', setCsrfCookie(newCsrf));
        return c.html(renderPortfolio(projectsResult.results || [], skillsByCategory, false, errorMsg, newCsrf));
    };

    if (!name || !email || !message || !name.trim() || !email.trim() || !message.trim()) {
        return renderError('Please fill in all fields.');
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return renderError('Please enter a valid email address.');
    }

    try {
        await db.prepare('INSERT INTO messages (name, email, message) VALUES (?, ?, ?)').bind(name, email, message).run();
        
        // Success
        const projectsResult = await db.prepare('SELECT id, title, description, image_url, tags, project_url, repo_url FROM projects WHERE is_featured = 1 ORDER BY created_at DESC').all<ProjectRow>();
        const skillsResult = await db.prepare('SELECT id, name, category, proficiency FROM skills ORDER BY category, proficiency DESC').all<SkillRow>();
        const skillsByCategory: Record<string, SkillRow[]> = {};
        for (const s of (skillsResult.results || [])) {
            if (!skillsByCategory[s.category]) skillsByCategory[s.category] = [];
            skillsByCategory[s.category].push(s);
        }
        const newCsrf = generateCsrfToken();
        c.header('Set-Cookie', setCsrfCookie(newCsrf));
        return c.html(renderPortfolio(projectsResult.results || [], skillsByCategory, true, '', newCsrf));
    } catch (e) {
        return renderError('Something went wrong. Please try again later.');
    }
});

export default publicApp;
