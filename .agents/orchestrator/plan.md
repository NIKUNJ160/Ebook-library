# LibraryHub Evaluation & Improvement Plan

## Overview
This plan outlines the milestones and subagent execution for evaluating and improving the LibraryHub application.

## Milestones

| # | Milestone | Key Deliverables | Status | Assigned |
|---|-----------|------------------|--------|----------|
| 1 | Server Startup & Screenshot Capture (R1) | Dev server verified/started, 4 browser screenshots captured & saved cleanly | IN_PROGRESS | TBD |
| 2 | Codebase Evaluation across 5 Lenses (R2) | Deep audit of `src/index.ts` and `public/css/app.css` across Visual Design, Code Quality, AI Features, Performance, Mobile Responsiveness | PLANNED | TBD |
| 3 | Top 5 Improvements Artifact (R3) | `top5_improvements.md` with 5 ranked suggestions, Before/After snippets/wireframes, Why, Effort | PLANNED | TBD |
| 4 | Implementation & Verification (R4) | Low/Medium effort suggestions implemented, `npx tsc --noEmit` passing, git commit `feat: teamwork review — apply low/medium effort improvements` | PLANNED | TBD |

## Execution Details

### Milestone 1: Server Startup & Screenshot Capture (R1)
- Subagent: `teamwork_preview_worker` or `teamwork_preview_explorer`
- Tasks:
  - Check if `http://127.0.0.1:8787` is responding. If not, start `npx wrangler dev` in background.
  - Capture 4 screenshots:
    1. Homepage desktop (1280x800) -> `screenshots/homepage_desktop.png`
    2. Homepage mobile (390x844) -> `screenshots/homepage_mobile.png`
    3. Item detail `/item/<slug>` desktop (1280x800) -> `screenshots/item_detail_desktop.png`
    4. Admin dashboard `/admin` desktop (1280x800) -> `screenshots/admin_dashboard_desktop.png`

### Milestone 2: Codebase Evaluation (R2)
- Subagent: `teamwork_preview_explorer`
- Tasks:
  - Analyze `src/index.ts` (~3200 lines) and `public/css/app.css`.
  - Evaluate across 5 lenses: Visual Design, Code Quality, AI Features, Performance, Mobile Responsiveness.

### Milestone 3: Top 5 Improvements Artifact (R3)
- Subagent: `teamwork_preview_worker`
- Tasks:
  - Synthesize recommendations into `top5_improvements.md` artifact.
  - Include 5 ranked items with Title, Why, Effort, Before code, After code/wireframe.
  - Reference captured screenshot paths.

### Milestone 4: Implementation & Verification (R4)
- Subagent: `teamwork_preview_worker`
- Tasks:
  - Implement all Low and Medium effort suggestions.
  - Leave TODO comments for High effort suggestions.
  - Run `npx tsc --noEmit`.
  - Commit changes with message `feat: teamwork review — apply low/medium effort improvements`.
