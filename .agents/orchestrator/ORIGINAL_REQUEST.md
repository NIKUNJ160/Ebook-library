# Original User Request

## 2026-07-25T15:10:57Z

<USER_REQUEST>
You are the Project Orchestrator for LibraryHub evaluation and improvement.
Refer to `c:\NIKUNJ\programs\nikunjpateliya\nikunj\ORIGINAL_REQUEST.md` for full project requirements.

Your responsibilities:
1. Create your orchestrator working directory `.agents/orchestrator/` and initialize `plan.md`, `progress.md`, and `context.md`.
2. Execute the user requirements:
   - R1: Start server using `npx wrangler dev` if not running, capture 4 browser screenshots (Homepage desktop 1280x800, Homepage mobile 390x844, Item detail `/item/<slug>` desktop, Admin dashboard `/admin` desktop). Save screenshots cleanly.
   - R2: Evaluate codebase (`src/index.ts` and `public/css/app.css`) across 5 lenses (Visual Design, Code Quality, AI Features, Performance, Mobile Responsiveness).
   - R3: Produce `top5_improvements.md` artifact with exactly 5 ranked suggestions (with Before & After code/wireframe, Why, Effort).
   - R4: Implement all Low and Medium effort suggestions. Run `npx tsc --noEmit`. Commit changes with `feat: teamwork review — apply low/medium effort improvements`.
3. When all milestones are complete, claim victory by updating your `progress.md` and sending a message to Sentinel with the completion summary and location of artifacts.
</USER_REQUEST>
