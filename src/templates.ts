import { html, raw } from 'hono/html';
import type { HtmlEscapedString } from 'hono/utils/html';
import type { ProjectRow, SkillRow, ServiceRow, MessageRow } from './env';

// ─── Base Layout ───

function baseHead(title: string, extraCss: any = ''): any {
    return html`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <meta name="description" content="Nikunj Pateliya - Web Designer & Full-Stack Developer portfolio">
    <link rel="icon" href="/favicon.png" type="image/png">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <meta name="p:domain_verify" content="129956d073186271cd7fcf5315605557">
    <link rel="stylesheet" href="/assets/css/style.css">
    ${extraCss}
</head>`;
}

// ─── Public Portfolio ───

type SkillsByCategory = Record<string, SkillRow[]>;

export function renderPortfolio(
    projects: ProjectRow[],
    skillsByCategory: SkillsByCategory,
    messageSent: boolean = false,
    errorMsg: string = '',
    csrfToken: string = ''
): any {
    const projectCards = projects.length > 0
        ? projects.map(p => {
            const tags = (p.tags || '').split(',').map(t => t.trim()).filter(Boolean);
            let imgUrl = p.image_url || 'assets/images/placeholder.jpg';
            if (imgUrl && !imgUrl.startsWith('http') && !imgUrl.startsWith('/')) {
                imgUrl = '/' + imgUrl;
            }
            return html`<article class="project-card">
            <img src="${imgUrl}" alt="${p.title}" class="project-thumb">
            <div class="project-content">
                <div class="project-tags">
                    ${tags.map(t => html`<span class="tag">${t}</span>`)}
                </div>
                <h3 class="project-title">${p.title}</h3>
                <p class="project-desc">${p.description}</p>
                <a href="${p.project_url || '#'}" class="project-link">
                    View Project <span>&rarr;</span>
                </a>
            </div>
        </article>`;
        })
        : html`<div class="project-card" style="grid-column: 1 / -1; text-align: center; padding: 4rem;">
        <h3 class="project-title">Work in Progress</h3>
        <p class="project-desc">Projects are currently being uploaded. Check back soon!</p>
      </div>`;

    const skillsHtml = Object.keys(skillsByCategory).length > 0
        ? Object.entries(skillsByCategory).map(([category, skills]) => html`
        <div class="skill-category">
            <h4 class="skill-heading">${category.charAt(0).toUpperCase() + category.slice(1)}</h4>
            <div class="skill-list">
                ${skills.map(s => html`<div class="skill-pill">${s.name}</div>`)}
            </div>
        </div>`)
        : html`<div class="skill-category">
        <h4 class="skill-heading">Frontend</h4>
        <div class="skill-list">
            <div class="skill-pill">HTML5</div><div class="skill-pill">CSS3</div>
            <div class="skill-pill">JavaScript</div><div class="skill-pill">React</div>
            <div class="skill-pill">Tailwind CSS</div>
        </div>
      </div>
      <div class="skill-category">
        <h4 class="skill-heading">Backend</h4>
        <div class="skill-list">
            <div class="skill-pill">PHP</div><div class="skill-pill">MySQL</div>
            <div class="skill-pill">Node.js</div><div class="skill-pill">Python</div>
        </div>
      </div>
      <div class="skill-category">
        <h4 class="skill-heading">Tools</h4>
        <div class="skill-list">
            <div class="skill-pill">Git</div><div class="skill-pill">Figma</div>
            <div class="skill-pill">VS Code</div>
        </div>
      </div>`;

    const successBanner = messageSent
        ? html`<div style="background: rgba(52, 211, 153, 0.1); color: var(--accent-color); padding: 1rem; border-radius: 8px; margin-bottom: 2rem; text-align: center; border: 1px solid rgba(52, 211, 153, 0.2);">
        Message sent successfully! I'll get back to you soon.
      </div>` : '';

    const errorBanner = errorMsg
        ? html`<div style="background: rgba(239, 68, 68, 0.1); color: #ef4444; padding: 1rem; border-radius: 8px; margin-bottom: 2rem; text-align: center; border: 1px solid rgba(239, 68, 68, 0.2);">
        ${errorMsg}
      </div>` : '';

    return html`${baseHead('Nikunj Pateliya | Web Designer & Full-Stack Developer')}
<body>
    <!-- Fixed Status Pill -->
    <div class="status-pill">
        <span>●</span> Open to Work
    </div>

    <!-- Navigation -->
    <nav class="glass main-nav">
        <div class="container nav-container">
            <a href="#" class="nav-logo">
                <img src="/assets/images/logo.jpg" alt="Nikunj Pateliya">
            </a>
            <div class="nav-links">
                <a href="#work">Work</a>
                <a href="#services">Services</a>
                <a href="#about">About</a>
                <a href="#contact" class="btn">Let's Talk</a>
            </div>
        </div>
    </nav>

    <!-- Hero Section -->
    <header class="hero-section">
        <div class="container">
            <h1 class="hero-title">
                Building <span style="color: var(--text-muted);">Digital</span><br>
                Experiences.
            </h1>
            <p class="hero-subtitle">
                I help brands and businesses stand out with high-end web design and full-stack development.
            </p>
            <div class="hero-actions">
                <a href="#work" class="btn">View My Work</a>
                <a href="#contact" class="btn btn-outline">Contact Me</a>
            </div>
        </div>
    </header>

    <!-- Project Showcase -->
    <section id="work" class="section">
        <div class="container">
            <h2 style="margin-bottom: 2rem; font-size: 2.5rem;">Selected Work</h2>
            <div class="bento-grid">
                ${projectCards}
            </div>
        </div>
    </section>

    <!-- Services Section -->
    <section id="services" class="section">
        <div class="container">
            <h2 style="margin-bottom: 2rem; font-size: 2.5rem;">Services</h2>
            <div class="services-grid">
                <div class="service-card">
                    <div class="service-icon">✦</div>
                    <h3 class="service-title">Web Design</h3>
                    <p class="service-desc">Crafting visually stunning, user-centric interfaces. From high-fidelity mockups to polished final designs that align with your brand identity.</p>
                </div>
                <div class="service-card">
                    <div class="service-icon">⚡</div>
                    <h3 class="service-title">Development</h3>
                    <p class="service-desc">Building robust, scalable web applications using modern stacks (PHP, React, Node.js). Fast, secure, and SEO-optimized.</p>
                </div>
                <div class="service-card">
                    <div class="service-icon">🚀</div>
                    <h3 class="service-title">SEO & Strategy</h3>
                    <p class="service-desc">Optimizing your digital presence for search engines and performance. Ensuring your site reaches the right audience effectively.</p>
                </div>
            </div>
        </div>
    </section>

    <!-- About & Skills Section -->
    <section id="about" class="section">
        <div class="container">
            <h2 style="margin-bottom: 3rem; font-size: 2.5rem;">About Me</h2>
            <div class="about-container">
                <div class="about-bio">
                    <p>I'm Nikunj Pateliya, a passionate Web Designer & Full-Stack Developer based in Gujarat. I specialize in bridging the gap between design and engineering, creating products that not only look great but perform flawlessly.</p>
                    <p>With a deep understanding of modern web technologies, I help startups and established businesses build their digital legacy. My approach is user-first, focusing on clean code, accessibility, and pixel-perfect design.</p>
                    <p>When I'm not coding, you can find me exploring new tech trends, contributing to open source, or gaming.</p>
                </div>
                <div class="skills-container">
                    ${skillsHtml}
                </div>
            </div>
        </div>
    </section>

    <!-- Contact Section -->
    <section id="contact" class="section" style="margin-bottom: 4rem;">
        <div class="container">
            <h2 style="margin-bottom: 1rem; font-size: 2.5rem; text-align: center;">Let's Work Together</h2>
            <p style="text-align: center; color: var(--text-secondary); margin-bottom: 3rem;">Have a project in mind? Send me a message and let's discuss.</p>

            <div class="contact-container">
                ${successBanner}
                ${errorBanner}

                <form method="POST" action="/contact">
                    ${csrfToken ? html`<input type="hidden" name="csrfToken" value="${csrfToken}">` : ''}
                    <div class="form-group">
                        <label for="name" class="form-label">Name</label>
                        <input type="text" id="name" name="name" class="form-control" required>
                    </div>
                    <div class="form-group">
                        <label for="email" class="form-label">Email</label>
                        <input type="email" id="email" name="email" class="form-control" required>
                    </div>
                    <div class="form-group">
                        <label for="message" class="form-label">Message</label>
                        <textarea id="message" name="message" class="form-control" required></textarea>
                    </div>
                    <button type="submit" class="btn" style="width: 100%;">Send Message</button>
                </form>

                <div class="contact-socials">
                    <a href="https://www.linkedin.com/in/nikunjpateliya1608" target="_blank" class="social-link" title="LinkedIn"><i class="fab fa-linkedin"></i></a>
                    <a href="https://github.com/NIKUNJ160" target="_blank" class="social-link" title="GitHub"><i class="fab fa-github"></i></a>
                    <a href="https://www.instagram.com/_nik__16/" target="_blank" class="social-link" title="Instagram"><i class="fab fa-instagram"></i></a>
                    <a href="https://wa.me/919328801435" target="_blank" class="social-link" title="WhatsApp"><i class="fab fa-whatsapp"></i></a>
                </div>
            </div>
        </div>
    </section>

    <!-- Floating Admin Button -->
    <a href="/admin" id="admin-fab" title="Admin Panel" style="position: fixed; bottom: 6rem; right: 2rem; width: 48px; height: 48px; border-radius: 50%; background: rgba(26,26,26,0.9); border: 1px solid rgba(255,255,255,0.1); backdrop-filter: blur(12px); display: flex; align-items: center; justify-content: center; font-size: 1.25rem; color: var(--text-secondary); z-index: 999; transition: all 0.2s ease; text-decoration: none; box-shadow: 0 4px 20px rgba(0,0,0,0.4);" onmouseover="this.style.color='var(--accent-color)';this.style.borderColor='var(--accent-color)';this.style.transform='scale(1.1)'" onmouseout="this.style.color='var(--text-secondary)';this.style.borderColor='rgba(255,255,255,0.1)';this.style.transform='scale(1)'"><i class="fas fa-cog"></i></a>

    <footer class="footer">
        <div class="container" style="display: flex; justify-content: space-between; align-items: center;">
            <span>&copy; ${new Date().getFullYear().toString()} Nikunj Pateliya. All rights reserved.</span>
            <a href="/admin" style="color: var(--text-muted); font-size: 0.85rem;">Admin Panel &rarr;</a>
        </div>
    </footer>

    <script src="/assets/js/main.js"></script>
</body>
</html>`;
}

// ─── Auth Pages ───

const authCss = html`<style>
    .auth-container { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 2rem; }
    .auth-card { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 24px; padding: 3rem; width: 100%; max-width: 420px; }
    .auth-card h1 { font-size: 1.75rem; margin-bottom: 0.5rem; }
    .auth-card p.subtitle { color: var(--text-secondary); margin-bottom: 2rem; font-size: 0.95rem; }
    .auth-card .form-group { margin-bottom: 1.25rem; }
    .auth-card .btn { width: 100%; margin-top: 0.5rem; }
    .auth-link { text-align: center; margin-top: 1.5rem; color: var(--text-secondary); font-size: 0.9rem; }
    .auth-link a { color: var(--accent-color); font-weight: 600; }
    .error-msg { background: rgba(239, 68, 68, 0.1); color: #ef4444; padding: 0.75rem 1rem; border-radius: 8px; margin-bottom: 1.5rem; font-size: 0.9rem; border: 1px solid rgba(239, 68, 68, 0.2); }
    .success-msg { background: rgba(52, 211, 153, 0.1); color: var(--accent-color); padding: 0.75rem 1rem; border-radius: 8px; margin-bottom: 1.5rem; font-size: 0.9rem; border: 1px solid rgba(52, 211, 153, 0.2); }
</style>`;

export function renderLogin(error: string = '', success: string = '', csrfToken: string = ''): any {
    return html`${baseHead('Login | Nikunj Pateliya', authCss)}
<body>
    <div class="auth-container">
        <div class="auth-card">
            <h1>Welcome Back</h1>
            <p class="subtitle">Sign in to manage your portfolio</p>
            ${error ? html`<div class="error-msg">${error}</div>` : ''}
            ${success ? html`<div class="success-msg">${success}</div>` : ''}
            <form method="POST" action="/login">
                ${csrfToken ? html`<input type="hidden" name="csrfToken" value="${csrfToken}">` : ''}
                <div class="form-group">
                    <label class="form-label">Username</label>
                    <input type="text" name="username" class="form-control" required autofocus>
                </div>
                <div class="form-group">
                    <label class="form-label">Password</label>
                    <input type="password" name="password" class="form-control" required>
                </div>
                <button type="submit" class="btn">Sign In</button>
            </form>
            <div class="auth-link">
                Don't have an account? <a href="/register">Register</a>
            </div>
            <div class="auth-link" style="margin-top: 0.75rem;">
                <a href="/" style="color: var(--text-secondary);">&larr; Back to Portfolio</a>
            </div>
        </div>
    </div>
</body>
</html>`;
}

export function renderRegister(error: string = '', csrfToken: string = ''): any {
    return html`${baseHead('Register | Nikunj Pateliya', authCss)}
<body>
    <div class="auth-container">
        <div class="auth-card">
            <h1>Create Account</h1>
            <p class="subtitle">Register to manage your portfolio</p>
            ${error ? html`<div class="error-msg">${error}</div>` : ''}
            <form method="POST" action="/register">
                ${csrfToken ? html`<input type="hidden" name="csrfToken" value="${csrfToken}">` : ''}
                <div class="form-group">
                    <label class="form-label">Username</label>
                    <input type="text" name="username" class="form-control" required autofocus minlength="3">
                </div>
                <div class="form-group">
                    <label class="form-label">Password</label>
                    <input type="password" name="password" class="form-control" required minlength="6">
                </div>
                <div class="form-group">
                    <label class="form-label">Confirm Password</label>
                    <input type="password" name="confirm_password" class="form-control" required minlength="6">
                </div>
                <div class="form-group">
                    <label class="form-label">Invite Code</label>
                    <input type="text" name="invite_code" class="form-control" required>
                </div>
                <button type="submit" class="btn">Create Account</button>
            </form>
            <div class="auth-link">
                Already have an account? <a href="/login">Sign In</a>
            </div>
            <div class="auth-link" style="margin-top: 0.75rem;">
                <a href="/" style="color: var(--text-secondary);">&larr; Back to Portfolio</a>
            </div>
        </div>
    </div>
</body>
</html>`;
}

// ─── Admin Pages ───

const adminCss = html`<style>
    .admin-layout { display: grid; grid-template-columns: 250px 1fr; min-height: 100vh; }
    .sidebar { background: var(--bg-card); border-right: 1px solid var(--border-color); padding: 2rem; display: flex; flex-direction: column; }
    .main-content { padding: 3rem; }
    .sidebar-menu { list-style: none; margin-top: 2rem; flex-grow: 1; }
    .sidebar-menu li { margin-bottom: 1rem; }
    .sidebar-menu a { display: block; padding: 10px 12px; border-radius: 8px; color: var(--text-secondary); font-weight: 500; }
    .sidebar-menu a:hover, .sidebar-menu a.active { background: rgba(255, 255, 255, 0.05); color: var(--text-primary); }
    .table-container { overflow-x: auto; background: var(--bg-card); border-radius: 12px; border: 1px solid var(--border-color); }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 16px; text-align: left; border-bottom: 1px solid var(--border-color); }
    th { font-weight: 600; color: var(--text-secondary); font-size: 0.9rem; }
    tr:last-child td { border-bottom: none; }
    .action-btn { padding: 6px 12px; border-radius: 6px; font-size: 0.85rem; font-weight: 500; margin-right: 8px; border: none; cursor: pointer; }
    .btn-edit { background: rgba(52, 211, 153, 0.1); color: var(--accent-color); }
    .btn-delete { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
    .form-inline { display: flex; gap: 1rem; margin-bottom: 2rem; background: var(--bg-card); padding: 1.5rem; border-radius: 12px; border: 1px solid var(--border-color); align-items: flex-end; flex-wrap: wrap; }
    .service-list { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); }
    .service-item { background: var(--bg-card); padding: 1.5rem; border-radius: 12px; border: 1px solid var(--border-color); position: relative; }
    .btn-del-abs { position: absolute; top: 1rem; right: 1rem; background: rgba(239, 68, 68, 0.1); color: #ef4444; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; }
    .skill-item { display: inline-flex; align-items: center; background: rgba(255,255,255,0.05); padding: 6px 12px; border-radius: 99px; margin: 5px; border: 1px solid var(--border-color); }
    .del-x { margin-left: 8px; color: #ef4444; font-weight: bold; cursor: pointer; border:none; background:none; font-size: 1.1rem; }
    .message-card { background: var(--bg-card); border: 1px solid var(--border-color); padding: 1.5rem; border-radius: 12px; margin-bottom: 1.5rem; }
    .message-header { display: flex; justify-content: space-between; margin-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 1rem; }
    .meta { color: var(--text-secondary); font-size: 0.9rem; }
    .status-new { color: var(--accent-color); font-weight: 600; }
    .btn-action { margin-left: 10px; font-size: 0.85rem; padding: 4px 10px; border-radius: 4px; border: none; cursor: pointer; }
    .btn-del { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
    .btn-read { background: rgba(52, 211, 153, 0.1); color: var(--accent-color); text-decoration: none; }
    .logout-btn { display: block; padding: 10px 12px; border-radius: 8px; color: #ef4444; font-weight: 500; background: rgba(239, 68, 68, 0.1); text-align: center; border: none; cursor: pointer; font-size: 0.95rem; width: 100%; font-family: inherit; }
    .alert-success { background: rgba(52, 211, 153, 0.1); color: var(--accent-color); padding: 1rem; border-radius: 8px; margin-bottom: 2rem; }
    @media (max-width: 768px) {
        .admin-layout { grid-template-columns: 1fr; }
        .sidebar { padding: 1rem; }
        .sidebar-menu { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 1rem; }
        .form-inline { flex-direction: column; }
    }
</style>`;

function adminSidebar(activePage: string, username: string, csrfToken: string = ''): any {
    return html`<aside class="sidebar">
    <h2 style="font-size: 1.25rem; margin-bottom: 0.5rem;">Admin Panel</h2>
    <p style="color: var(--text-secondary); font-size: 0.85rem;">Hi, ${username}</p>
    <ul class="sidebar-menu">
        <li><a href="/admin/projects" class="${activePage === 'projects' ? 'active' : ''}">Projects</a></li>
        <li><a href="/admin/skills" class="${activePage === 'skills' ? 'active' : ''}">Skills</a></li>
        <li><a href="/admin/services" class="${activePage === 'services' ? 'active' : ''}">Services</a></li>
        <li><a href="/admin/messages" class="${activePage === 'messages' ? 'active' : ''}">Messages</a></li>
    </ul>
    <form method="POST" action="/logout">
        ${csrfToken ? html`<input type="hidden" name="csrfToken" value="${csrfToken}">` : ''}
        <button type="submit" class="logout-btn">Logout</button>
    </form>
  </aside>`;
}

export function renderAdminProjects(projects: ProjectRow[], username: string, msg: string = '', csrfToken: string = ''): any {
    const rows = projects.length > 0
        ? projects.map(p => {
            let imgUrl = p.image_url || '';
            if (imgUrl && !imgUrl.startsWith('http') && !imgUrl.startsWith('/')) {
                imgUrl = '/' + imgUrl;
            }
            return html`<tr>
        <td><img src="${imgUrl}" alt="" style="width: 60px; height: 40px; object-fit: cover; border-radius: 4px;"></td>
        <td>${p.title}</td>
        <td>${p.tags}</td>
        <td>${p.is_featured ? 'Yes' : 'No'}</td>
        <td>
            <a href="/admin/projects/edit?id=${p.id}" class="action-btn btn-edit">Edit</a>
            <form method="POST" action="/admin/projects/delete" style="display: inline;" onsubmit="return confirm('Are you sure?');">
                <input type="hidden" name="id" value="${p.id}">
                ${csrfToken ? html`<input type="hidden" name="csrfToken" value="${csrfToken}">` : ''}
                <button type="submit" class="action-btn btn-delete">Delete</button>
            </form>
        </td>
      </tr>`;
        })
        : html`<tr><td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-secondary);">No projects found.</td></tr>`;

    return html`${baseHead('Manage Projects | Admin', adminCss)}
<body>
    <div class="admin-layout">
        ${adminSidebar('projects', username, csrfToken)}
        <main class="main-content">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <h1>Projects</h1>
                <a href="/admin/projects/edit" class="btn">Add New Project</a>
            </div>
            ${msg ? html`<div class="alert-success">${msg}</div>` : ''}
            <div class="table-container">
                <table>
                    <thead><tr><th>Image</th><th>Title</th><th>Tags</th><th>Featured</th><th>Actions</th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        </main>
    </div>
</body></html>`;
}

export function renderProjectForm(project: ProjectRow | null, username: string, csrfToken: string = ''): any {
    const isEdit = !!project;
    const title = isEdit ? 'Edit Project' : 'Add New Project';
    return html`${baseHead(`${title} | Admin`, adminCss)}
<body>
    <div class="admin-layout">
        ${adminSidebar('projects', username, csrfToken)}
        <main class="main-content" style="max-width: 1050px;">
            <h1 style="margin-bottom: 2rem;">${title}</h1>
            <form method="POST" action="/admin/projects/save" style="display: grid; gap: 1.5rem;">
                ${isEdit ? html`<input type="hidden" name="id" value="${project!.id}">` : ''}
                ${csrfToken ? html`<input type="hidden" name="csrfToken" value="${csrfToken}">` : ''}
                <div class="form-group">
                    <label class="form-label">Project Title</label>
                    <input type="text" name="title" class="form-control" required value="${project?.title || ''}">
                </div>
                <div class="form-group">
                    <label class="form-label">Description</label>
                    <textarea name="description" class="form-control" rows="5" required>${project?.description || ''}</textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">Tags (comma separated)</label>
                    <input type="text" name="tags" class="form-control" value="${project?.tags || ''}" placeholder="PHP, React, CSS">
                </div>
                <div class="form-group">
                    <label class="form-label">Image URL or Local Path</label>
                    <input type="text" name="image_url" class="form-control" value="${project?.image_url || ''}" placeholder="e.g. /assets/images/projects/photo.jpg or https://...">
                </div>
                <div class="form-group">
                    <label class="form-label">Project URL (Live Link)</label>
                    <input type="url" name="project_url" class="form-control" value="${project?.project_url || ''}">
                </div>
                <div class="form-group">
                    <label class="form-label">Repository URL (GitHub)</label>
                    <input type="url" name="repo_url" class="form-control" value="${project?.repo_url || ''}">
                </div>
                <div class="form-group">
                    <label class="form-label" style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                        <input type="checkbox" name="is_featured" ${project?.is_featured ? 'checked' : ''}>
                        Feature this project on homepage
                    </label>
                </div>
                <div style="display: flex; gap: 1rem;">
                    <button type="submit" class="btn">Save Project</button>
                    <a href="/admin/projects" class="btn btn-outline" style="border: 1px solid var(--border-color);">Cancel</a>
                </div>
            </form>
        </main>
    </div>
</body></html>`;
}

export function renderAdminSkills(skills: SkillRow[], username: string, csrfToken: string = ''): any {
    return html`${baseHead('Skills | Admin', adminCss)}
<body>
    <div class="admin-layout">
        ${adminSidebar('skills', username, csrfToken)}
        <main class="main-content">
            <h1 style="margin-bottom: 2rem;">Manage Skills</h1>
            <form method="POST" action="/admin/skills/add" class="form-inline">
                ${csrfToken ? html`<input type="hidden" name="csrfToken" value="${csrfToken}">` : ''}
                <div style="flex-grow: 1;">
                    <label class="form-label">Skill Name</label>
                    <input type="text" name="name" class="form-control" placeholder="e.g. React" required>
                </div>
                <div style="width: 200px;">
                    <label class="form-label">Category</label>
                    <select name="category" class="form-control" required style="height: 46px;">
                        <option value="frontend">Frontend</option>
                        <option value="backend">Backend</option>
                        <option value="tools">Tools</option>
                        <option value="other">Other</option>
                    </select>
                </div>
                <div style="width: 100px;">
                    <label class="form-label">Level %</label>
                    <input type="number" name="proficiency" class="form-control" value="80" min="0" max="100">
                </div>
                <button type="submit" class="btn">Add</button>
            </form>
            <h2 style="margin-bottom: 1rem; font-size: 1.25rem;">Current Skills</h2>
            <div>
                ${skills.map(s => html`
                    <form method="POST" action="/admin/skills/delete" style="display: inline;">
                        ${csrfToken ? html`<input type="hidden" name="csrfToken" value="${csrfToken}">` : ''}
                        <span class="skill-item">
                            ${s.name} (${s.category})
                            <input type="hidden" name="id" value="${s.id}">
                            <button type="submit" class="del-x" onclick="return confirm('Remove skill?');">&times;</button>
                        </span>
                    </form>
                `)}
            </div>
        </main>
    </div>
</body></html>`;
}

export function renderAdminServices(services: ServiceRow[], username: string, csrfToken: string = ''): any {
    return html`${baseHead('Services | Admin', adminCss)}
<body>
    <div class="admin-layout">
        ${adminSidebar('services', username, csrfToken)}
        <main class="main-content">
            <h1 style="margin-bottom: 2rem;">Manage Services</h1>
            <form method="POST" action="/admin/services/add" style="background: var(--bg-card); padding: 1.5rem; border-radius: 12px; border: 1px solid var(--border-color); margin-bottom: 2rem;">
                <h3 style="margin-bottom: 1rem; font-size: 1.1rem;">Add New Service</h3>
                ${csrfToken ? html`<input type="hidden" name="csrfToken" value="${csrfToken}">` : ''}
                <div style="display: grid; gap: 1rem;">
                    <div>
                        <label class="form-label">Title</label>
                        <input type="text" name="title" class="form-control" required>
                    </div>
                    <div>
                        <label class="form-label">Icon (Emoji or Class)</label>
                        <input type="text" name="icon" class="form-control" placeholder="✦" required>
                    </div>
                    <div>
                        <label class="form-label">Description</label>
                        <textarea name="description" class="form-control" rows="3" required></textarea>
                    </div>
                    <button type="submit" class="btn">Add Service</button>
                </div>
            </form>
            <h2 style="margin-bottom: 1rem; font-size: 1.25rem;">Current Services</h2>
            <div class="service-list">
                ${services.map(s => html`
                    <div class="service-item">
                        <div style="font-size: 2rem; margin-bottom: 0.5rem;">${s.icon}</div>
                        <h3 style="font-size: 1.1rem; margin-bottom: 0.5rem;">${s.title}</h3>
                        <p style="color: var(--text-secondary); font-size: 0.9rem;">${s.description}</p>
                        <form method="POST" action="/admin/services/delete" onsubmit="return confirm('Delete service?');">
                            ${csrfToken ? html`<input type="hidden" name="csrfToken" value="${csrfToken}">` : ''}
                            <input type="hidden" name="id" value="${s.id}">
                            <button type="submit" class="btn-del-abs">Delete</button>
                        </form>
                    </div>
                `)}
            </div>
        </main>
    </div>
</body></html>`;
}

export function renderAdminMessages(messages: MessageRow[], username: string, msg: string = '', csrfToken: string = ''): any {
    const formatDate = (d: string): string => {
        try {
            return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
        } catch { return d; }
    };

    return html`${baseHead('Messages | Admin', adminCss)}
<body>
    <div class="admin-layout">
        ${adminSidebar('messages', username, csrfToken)}
        <main class="main-content">
            <h1 style="margin-bottom: 2rem;">Inquiries</h1>
            ${msg ? html`<div class="alert-success">${msg}</div>` : ''}
            ${messages.length === 0
            ? html`<p style="color: var(--text-secondary);">No messages found.</p>`
            : messages.map(m => html`
                <div class="message-card">
                    <div class="message-header">
                        <div>
                            <strong style="font-size: 1.1rem; display: block;">${m.name}</strong>
                            <span class="meta">${m.email}</span>
                        </div>
                        <div style="text-align: right;">
                            <div class="meta" style="margin-bottom: 5px;">${formatDate(m.created_at)}</div>
                            ${m.status === 'new'
                    ? html`<span class="status-new">New</span>
                                 <form method="POST" action="/admin/messages/read" style="display: inline;">
                                     ${csrfToken ? html`<input type="hidden" name="csrfToken" value="${csrfToken}">` : ''}
                                     <input type="hidden" name="id" value="${m.id}">
                                     <button type="submit" class="btn-action btn-read">Mark Read</button>
                                 </form>`
                    : html`<span class="meta">Read</span>`}
                        </div>
                    </div>
                    <p style="color: var(--text-primary); white-space: pre-wrap;">${m.message}</p>
                    <form method="POST" action="/admin/messages/delete" style="margin-top: 1rem; text-align: right;" onsubmit="return confirm('Delete this message?');">
                        ${csrfToken ? html`<input type="hidden" name="csrfToken" value="${csrfToken}">` : ''}
                        <input type="hidden" name="id" value="${m.id}">
                        <button type="submit" class="btn-action btn-del">Delete</button>
                    </form>
                </div>
              `)}
        </main>
    </div>
</body></html>`;
}
