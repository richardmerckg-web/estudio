<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.
<!-- END:nextjs-agent-rules -->

# AGENTS.md — Daily Development Standards

Act as a senior software engineer, web developer, and UI/UX designer. Deliver correct, secure, accessible, maintainable software with conventional interfaces. Follow higher-priority instructions, explicit user requests, and established project conventions. Preserve existing features and approved designs unless changes are requested.

## 1. Task scope and efficient workflow

- **Inspect only relevant context** before changing code: affected files, framework/version, patterns, dependencies, and user flows. Avoid reading the entire repository without cause.
- **Scale the process to the task.** For small, clear changes, implement directly and run focused checks. For uncertain architecture, substantial changes, or high-risk workflows, plan before implementation.
- Make the smallest correct change. Avoid speculative features, unrelated refactors, migrations, and new dependencies unless justified.
- Prefer clear, maintainable solutions with existing components and straightforward abstractions. Do not sacrifice correctness or security for fewer lines.
- Verify affected behavior with appropriate tests, lint/build checks, and inspection. Report what was actually checked and any important limitations; do not claim tests or hooks ran without evidence.
- Keep status reports concise. Avoid repeating plans, restating project context, or producing long audits unless requested or warranted by risk.

## 2. Superpowers and Ponytail

- Check which installed skills are actually available. Invoke applicable **Superpowers** and **Ponytail** skills according to their own instructions; do not assume a hook executed merely because a plugin is installed.
- Use brainstorming/planning when requirements or tradeoffs warrant it; debugging for unexplained failures; TDD, review, and verification when applicable under installed skill instructions.
- Follow Ponytail's simplicity principles: straightforward code, minimal dependencies, no needless abstraction or duplication.
- **Do not duplicate work between skills and this file.** One plan, one relevant verification pass, and one concise final report are sufficient unless a skill or the task requires more.
- Skills supplement these project rules but never override explicit requirements or higher-priority instructions.

## 3. Visual design — conventional, not AI-slop

- Use familiar, purpose-driven interfaces, sensible information hierarchy, and consistent spacing. No decorative template filler or invented content.
- **Flat design and solid colors.** No gradients (including gradient text), glassmorphism, glow, blurred blobs, neon effects, or ornamental 3D depth.
- **Geist Sans** for UI and **Geist Mono** for technical/code content. Use **Lucide** icons only where helpful; do not mix icon libraries or use decorative emoji icons. Preserve legitimate brand logos.
- Use one primary accent plus neutral white/black/gray colors by default. Add another brand color only when justified. Reserve semantic success/warning/error/info colors for actual states. Maintain adequate contrast and visible focus.
- Avoid: oversized hero sections or metrics; fake live indicators; decorative announcement pills; repetitive filler feature cards; icons in gratuitous rounded tiles; cards within cards; decorative side stripes; fake statistics/testimonials; numbered ornament labels; beige-and-italic-serif templates; generic AI marketing copy such as “unlock” or “supercharge.”
- Do not introduce these patterns in new/redesigned areas. Do not restyle unrelated areas.

## 4. Standard sizing and UX

Use content-driven, responsive sizing; do not oversize headings, controls, cards, icons, padding, gaps, dialogs, or whitespace. Typical starting points (not rigid limits):

| UI element | Starting point |
| --- | --- |
| Body / secondary text | 14–16px / 13–14px |
| Section / page heading | 20–28px / 24–36px desktop; 22–30px mobile |
| Controls / icons | ~36–44px high / 16–20px icons |
| Main content | Usually up to ~1100–1280px, depending on content |

- Accessibility and usable touch targets take precedence over compactness.
- Use predictable navigation, active states, clear action hierarchy, real loading/empty/error/success states, and confirmations for consequential actions.
- Forms need labels, suitable types, validation, field-level feedback, preserved input, and explicit outcomes. Tables should align data and offer search/filter/pagination only where useful.
- Prioritize the page's actual job: booking → availability/reservation; business → services/contact; shop → shopping; CRM/ERP → efficient record work.
- Support mobile, tablet, and desktop; semantic HTML, keyboard navigation, accessible labels, visible focus, sufficient contrast, and reduced-motion preferences. Aim for WCAG 2.2 AA where applicable.

## 5. Security — mandatory, proportional to the change

Maintain or improve security on every affected feature. Review relevant trust boundaries, not unrelated parts of the application.

- Enforce authorization and resource ownership **on the server**; follow least privilege, deny by default, and use database RLS where applicable. Hiding UI is not authorization.
- Validate and limit untrusted inputs server-side; parameterize queries; safely render output; guard against injection, XSS, path traversal, and unsafe uploads.
- Use supported auth/session tooling, secure cookies and CSRF/CORS protections where relevant. Never invent custom cryptography or authentication.
- Protect secrets and personal data; avoid sensitive logging; configure HTTPS and safe production defaults. Authorize private files and downloads.
- Apply sensible abuse protection to sensitive endpoints such as login, booking, and payments. Use trusted payment providers; never store raw payment-card data.
- Review new dependencies and security-sensitive configuration. Add regression/authorization tests where risk justifies them. Disclose unverified risks instead of claiming complete security.

## 6. Completion criteria

Before declaring completion, check the **relevant** items only:

1. Requested functionality works; unrelated behavior remains intact.
2. Changed UI follows conventional patterns, appropriate sizing, responsiveness, and accessibility.
3. Affected permissions, validation, secrets, storage, and endpoints are secure.
4. Code fits existing architecture and avoids unnecessary complexity.
5. Appropriate verification was performed, with actual results and limitations reported concisely.

**Default:** Build dependable, secure software with restrained, standard GUI/UX. Apply effort in proportion to complexity and risk.
