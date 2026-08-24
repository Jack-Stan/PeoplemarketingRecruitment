# CRM Project Vault

This vault is the single source of truth for **where the CRM project is right now**, shared between:
- **Stan** (humans reading in Obsidian)
- **Claude Code** (reading from inside the repo on Windows)
- **Claude Desktop** (reading from the same folder via its own Obsidian vault mount)

Location: `C:\RFT\Projects\CRM\.obsidian-vault\` (in-repo so it's version-controlled).

---

## Folder map

```
.obsidian-vault/
├── index.md                       ← you are here
├── project-status.md              ← live state: what's built, what's blocked, what's next
├── links-to-FRD.md                ← quick map from FRD §21 MVP items → tickets
├── decisions/
│   ├── 001-three-roles-not-two.md ← why admin / team_manager / team_member
│   ├── 002-firebase-not-supabase.md
│   └── 003-pink-placeholder-hex.md
├── tickets/
│   ├── ticket-00-scaffold.md
│   ├── ticket-01-rbac.md
│   ├── ticket-02-employee-crud.md
│   └── ticket-03-shift-create.md
├── research/
│   ├── mcp-recommendations.md     ← Firebase + GitHub MCPs for Claude Desktop
│   └── pink-hex-investigation.md
└── meetings/
    └── 2026-08-24-stan-discovery.md
```

## How to use it

- **In Obsidian**: open the vault, browse the links above. Use `[[wikilinks]]` between notes.
- **In Claude Code**: from the repo root, the assistant can `Read` these files directly. Useful for picking up context after a session restart.
- **In Claude Desktop**: mount this folder as an Obsidian vault, then enable the MCP servers listed in `research/mcp-recommendations.md`. Claude can then read the vault AND act on the Firebase project / GitHub repo.

## Status (one-liner)

Phase 1 scaffold landed (`Ticket 00`). Next: hardening (Ticket 01), Employee CRUD (Ticket 02), Shifts (Ticket 03). See `project-status.md` for detail.