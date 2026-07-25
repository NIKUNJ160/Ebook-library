# LibraryHub Branch Guide (`BRANCHES.md`)

This document details the isolated feature and fix branches created for the LibraryHub repository, along with their purpose, base commits, and cherry-picked history.

---

## 1. `feature/core-library`
- **Purpose**: Implements the core NatoManga website clone, D1 database schema, Hono TypeScript backend API, reader layout, and dashboard CRUD functionality.
- **Base Commit**: `ffba23e` (`ffba23e974b58c57d42bc4cd53d399c8b44321f3`) — `design: Redesign BookHaven dashboard, discover, and manga tab layout according to Natomanga style`
- **Cherry-picked Commits**:
  - `76b6847` (Cherry-picked as `85b0f41`) — `feat: full natomanga.com design clone from scratch`
  - `7f17cf5` (Cherry-picked as `b30e168`) — `feat: Implement seeded D1 database and Hono TS backend matching natomanga scroll reader with mobile layout overrides`
  - `c51587c` (Cherry-picked as `bf3f8aa`) — `feat: implement NatoManga layout, database schema, pagination, authentication, dashboard CRUD, and serialized chapters`

---

## 2. `feature/admin-and-uploads`
- **Purpose**: Adds administrative capabilities including dynamic manga categories, base64 cover image uploads, ZIP archive extraction, weekly chapter release scheduling, and the admin-cli management tool.
- **Base Commit**: `c51587c` (`c51587c53d1000b0eddc72e428aeaa225ec67ed8`) — `feat: implement NatoManga layout, database schema, pagination, authentication, dashboard CRUD, and serialized chapters`
- **Cherry-picked Commits**:
  - `f9e204a` (Cherry-picked as `6279fda`) — `feat: implement dynamic categories, base64 cover uploads, ZIP extraction, weekly chapters releases, and admin-cli CLI tool`

---

## 3. `fix/site-audit`
- **Purpose**: Addresses Ponytail audit recommendations by enforcing security headers, eliminating N+1 database queries, optimizing base64 handling, improving SEO metadata, accessibility, and UI font weights.
- **Base Commit**: `f9e204a` (`f9e204a8b792e3be85e135e69e71ecf94f9ee91b`) — `feat: implement dynamic categories, base64 cover uploads, ZIP extraction, weekly chapters releases, and admin-cli CLI tool`
- **Cherry-picked Commits**:
  - `0d6c7d0` (Cherry-picked as `21dd392`) — `fix: ponytail audit pass — security headers, eliminate N+1 queries, shorten fileToBase64, SEO meta/canonical/OG, dismissible banner, aria-labels, search label, onerror fallback, trim font weights`

---

## 4. `chore/deps-upgrade`
- **Purpose**: Upgrades project dependencies including Wrangler to 4.112 and @cloudflare/workers-types to v5, patching high-severity npm vulnerabilities.
- **Base Commit**: `0d6c7d0` (`0d6c7d0847fecab0cde101e405a9096706014e66`) — `fix: ponytail audit pass — security headers, eliminate N+1 queries, shorten fileToBase64, SEO meta/canonical/OG, dismissible banner, aria-labels, search label, onerror fallback, trim font weights`
- **Cherry-picked Commits**:
  - `daf67b4` (Cherry-picked as `5084d84`) — `chore: upgrade wrangler 4.67 → 4.112, workers-types 4 → 5, patch 1 high vuln`

---

## 5. `security/audit-fixes`
- **Purpose**: Resolves 9 security audit findings across critical, high, medium, and low severity classifications (C1/C2/L2/L3/H1/H2/H3/H4/M1/M2/M4).
- **Base Commit**: `daf67b4` (`daf67b43c683b5161b36fa89ce4b257be7556f8f`) — `chore: upgrade wrangler 4.67 → 4.112, workers-types 4 → 5, patch 1 high vuln`
- **Cherry-picked Commits**:
  - `fd32a55` (Cherry-picked as `48b8192`) — `security: fix all 9 audit findings (C1/C2/L2/L3/H1/H2/H3/H4/M1/M2/M4)`

---

## 6. `feature/teamwork-improvements`
- **Purpose**: Applies low and medium effort teamwork review suggestions, documentation enhancements, and agent state logging improvements across the repository.
- **Base Commit**: `fd32a55` (`fd32a5585098ffbeec9dc2a1feaa0ea2caecaa31`) — `security: fix all 9 audit findings (C1/C2/L2/L3/H1/H2/H3/H4/M1/M2/M4)`
- **Cherry-picked Commits**:
  - `20015f2` (Cherry-picked as `1fb1c1b`) — `feat: teamwork review — apply low/medium effort improvements`
