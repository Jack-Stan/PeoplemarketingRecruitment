# 2026-08-24 — Stan discovery session

## Participants

- Stan (developer + project lead)
- People Marketing client (via Stan's notes)

## What we covered

1. **FRD v0.1 walkthrough** — read the whole doc. Stan noted most open questions (§23) can be deferred; we work with the rest as-is.
2. **Stack pivot** — FRD said Vue 3 + Supabase + Postgres + Node. Stan opted for **Firebase** (already has `peoplemarketing-c5bfd` project created). See `decisions/002-firebase-not-supabase.md`.
3. **Role model** — FRD §5 listed Administrator + Employee only. Client clarified three roles:
   - `Administrator` (Big Boss — final approver, full access)
   - `TeamManager` (drafts + submits shifts for their squad)
   - `TeamMember` (read-only own shifts)
   - See `decisions/001-three-roles-not-two.md`.
4. **Brand colours** — pink/black/white. Exact pink hex pending. Placeholder `#EC4899` in use. See `decisions/003-pink-placeholder-hex.md`.
5. **Admin account** — Stan wants `admin@peoplemarketing.nl` / `admin123` for local development (created via `npm run seed`). Emulator-only guard prevents accidental prod use.
6. **Plan** — Ticket 0 (scaffold) shipped today. Tickets 1–3 planned.

## Decisions made

- ✅ Three roles (not two)
- ✅ Firebase (not Supabase)
- ✅ In-repo Obsidian vault for project state
- ✅ Dev plan refresh + MCP research for Stan's desktop (not for the CRM itself)

## Action items

- [ ] Stan: get exact pink hex from peoplemarketing.nl
- [ ] Stan: investigate why files are being overwritten externally between writes
- [ ] Stan: run `npm install` locally and report any errors
- [ ] Stan: confirm MVP priority order (employee CRUD first? Or shifts first?)
- [ ] Stan: get the current recruitment Google Doc from the client to confirm lead fields
- [ ] Claude Code: write MCP research notes to vault (in progress)
- [ ] Claude Code: refresh dev plan at `C:\Users\Stan.verbruggen\.claude\plans\lively-imagining-karp.md`