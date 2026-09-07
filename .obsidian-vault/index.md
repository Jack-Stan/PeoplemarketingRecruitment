# CRM Project Vault

This vault is the single source of truth for **where the CRM project is right now**, shared between:
- **Stan** (humans reading in Obsidian)
- **Claude Code** (reading from inside the repo on Windows)
- **Claude Desktop** (reading from the same folder via its own Obsidian vault mount)

Location: `C:\RFT\Projects\Personal\CRM\.obsidian-vault\` (in-repo so it's version-controlled).

---

## Folder map

```
.obsidian-vault/
├── index.md                       ← you are here
├── project-status.md              ← live state: what's built, what's blocked, what's next
├── links-to-FRD.md                ← quick map from FRD §21 MVP items → tickets
├── dev-plan.md                    ← original build sequence (historical)
├── gdpr-data-inventory.md         ← what personal data lives where, and the gaps
├── decisions/
│   ├── 001-three-roles-not-two.md ← why admin / team_manager / team_member
│   ├── 002-firebase-not-supabase.md
│   ├── 003-pink-placeholder-hex.md
│   ├── 004-shift-types.md         ← D2D / Straat / Event
│   ├── 005-users-employees-datamodel.md
│   ├── 006-firestore-roles-no-claims.md
│   ├── 007-employee-doc-id-must-be-uid.md ← 🔴 latent prod bug
│   ├── 008-self-service-shift-signup.md   ← employee-authored, not open slots
│   └── 009-coverage-viewer-teamleader-flag.md ← zone access via isTeamLeader flag, not a role
├── tickets/                           ← 00-04 ✅ done · 05 🔴 re-scope · 06 🟡 partial
│   ├── ticket-00-scaffold.md
│   ├── ticket-01-rbac.md
│   ├── ticket-02-employee-crud.md
│   ├── ticket-03-shift-create.md
│   ├── ticket-04-recruitment-crud.md
│   ├── ticket-05-recruitment-automation.md
│   └── ticket-06-dashboards-history.md
├── research/
│   ├── mcp-recommendations.md     ← Firebase + GitHub MCPs for Claude Desktop
│   ├── pink-hex-investigation.md
│   ├── 2026-09-01-app-review-and-briggs-gap.md ← full review + Briggs ("haggs") gap analysis
│   └── 2026-09-07-full-project-audit.md ← security · code · tests/tooling · docs/GDPR, top-10 ranked
├── session-prompts/               ← kickoff prompts for past working sessions
└── meetings/
    ├── 2026-08-24-stan-discovery.md
    ├── 2026-08-24-client-transcript-shifts-recruitment.md
    ├── 2026-08-24-whatsapp-michiel-preview-feedback.md
    └── 2026-08-25-client-callback-new-asks.md ← raw new asks, mostly need client clarification first
```

## How to use it

- **In Obsidian**: open the vault, browse the links above. Use `[[wikilinks]]` between notes.
- **In Claude Code**: from the repo root, the assistant can `Read` these files directly. Useful for picking up context after a session restart.
- **In Claude Desktop**: mount this folder as an Obsidian vault, then enable the MCP servers listed in `research/mcp-recommendations.md`. Claude can then read the vault AND act on the Firebase project / GitHub repo.

## Status (one-liner)

Live in prod, FRD §5–§19 shipped except §11/§17 period reporting. Current blockers, risks and open
client questions live in the **"Current state" block at the top of [[project-status]]** — that block
is the single source of truth; everything below it in that file is dated history. Latest full
assessment: [[2026-09-07-full-project-audit]].