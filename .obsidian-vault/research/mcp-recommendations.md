# MCP Server Recommendations — Stan's Claude Desktop

**Date:** 2026-08-24
**Purpose:** Help Stan develop the People Marketing CRM faster by giving Claude Desktop direct access to his Firebase project and GitHub repo.
**Scope:** Stan's development machine only. **These MCPs are NOT installed into the CRM app itself** — they're for Claude Desktop / Claude Code to use.

---

## TL;DR

| Need | Server | Install |
|---|---|---|
| Firebase (Firestore + Auth + Storage + CLI/Hosting) | **Official `firebase-tools@latest mcp`** | `npx -y firebase-tools@latest mcp` |
| GitHub (PR review, issues, repo ops) | **Official `@modelcontextprotocol/server-github`** | `docker run ghcr.io/github/github-mcp-server` |
| Read-only Firebase alternative (safer default) | **`firebase-mcp`** by s-h-u-h-a-r-i | `npx -y firebase-mcp` |

Start with **official Firebase** + **official GitHub**. Add the read-only alternative later if you want a safer default for unattended sessions.

---

## 1. Firebase MCP (recommended)

**Server:** Official Google `firebase-tools@latest mcp`
**Docs:** https://firebase.google.com/docs/ai-assistance/mcp-server
**Source:** https://github.com/firebase/firebase-tools/blob/main/src/mcp/README.md

Covers **everything** — Auth, Firestore, Storage, Hosting, Functions, Crashlytics, FCM, App Distribution, Realtime Database. Single install, single config block.

### Claude Desktop config

Edit `%APPDATA%\Claude\claude_desktop_config.json` (Windows) — Claude → Settings → Developer → Edit Config:

```json
{
  "mcpServers": {
    "firebase": {
      "command": "npx",
      "args": ["-y", "firebase-tools@latest", "mcp", "--dir", "C:/RFT/Projects/CRM", "--only", "auth,firestore,storage,hosting"]
    }
  }
}
```

- `--dir` pins the project context so Claude knows which Firebase project.
- `--only auth,firestore,storage,hosting` is the CRM-relevant subset. Drop later if you want all features.

### Auth model

Uses your existing Firebase CLI login (`firebase login`) or Application Default Credentials. No separate API key to manage.

### Tools unlocked

| Tool | Use |
|---|---|
| `auth_get_users` | Look up test users by email/UID |
| `auth_update_user` | Disable accounts, set custom claims, change passwords |
| `firestore_query_collection` | Browse/filter docs |
| `firestore_get_documents` | Read specific docs |
| `firestore_add_document` | Seed data |
| `firestore_list_collections` | Audit schema |
| `firestore_create_database` / `firestore_create_index` | Schema work |
| `storage_*` | File uploads, bucket inspection |

### Daily workflow example

> "List all employees in `/offices/office-main/employees` and tell me who has `isActive: false`."

> "Set custom claims on `admin@peoplemarketing.nl` to `{ role: 'Administrator', officeId: 'office-main', isTeamLeader: true }`."

> "Deploy only the updated `firestore.rules` and `firestore.indexes.json`."

### Gotchas

- **Writes are real.** Claude Desktop talking to your live Firebase project = real data changes. Pair with emulator (`firebase emulators:start`) when iterating, or use the read-only alternative below.
- The first call triggers a Firebase CLI re-auth check. Subsequent calls are cached.
- For multi-project setups, omit `--dir` and pass the project ID per-call instead.

---

## 2. GitHub MCP (recommended)

**Server:** Official `@modelcontextprotocol/server-github`
**Source:** https://github.com/modelcontextprotocol/servers (under `src/github`)
**Blog deep-dive:** https://github.blog/developer-skills/github/deep-dive-building-the-github-mcp-server/

PR review, issues, file reads, branching, comments — the canonical Anthropic+GitHub joint server.

### Claude Desktop config

```json
{
  "mcpServers": {
    "github": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "-e", "GITHUB_PERSONAL_ACCESS_TOKEN", "ghcr.io/github/github-mcp-server"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_REPLACE_WITH_YOUR_TOKEN"
      }
    }
  }
}
```

**Auth:** create a [fine-grained Personal Access Token](https://github.com/settings/personal-access-tokens) with `Contents: Read/Write`, `Pull Requests: Read/Write`, `Issues: Read/Write` scoped to `StanVerbruggen/CRM` (or whatever the repo is).

### Tools unlocked

- `get_pull_request`, `list_pull_requests`, `create_pull_request_review`
- `list_issues`, `create_issue`, `add_issue_comment`
- `get_file_contents`, `create_or_update_file`, `delete_file`
- `create_branch`, `push_files` (multi-file commits)
- `search_code`, `search_repositories`

### Daily workflow example

> "Open a PR for the employee CRUD feature branch and summarise the diff in the PR body."

> "Read all open issues assigned to me and triage them into P0/P1/P2 buckets."

> "Add a comment to PR #12 asking for clarification on the role check."

### Gotchas

- Docker required for the official image. Alternatively the npm version: `npx -y @modelcontextprotocol/server-github` (Node binary path).
- Token permissions are the security boundary — keep them scoped to the CRM repo.
- Local-only npm install requires the token in `env`, not in args (avoids it appearing in process listings).

---

## 3. firebase-mcp (read-only fallback) — when you want safer defaults

**Server:** `firebase-mcp` by s-h-u-h-a-r-i
**Source:** https://github.com/s-h-u-h-a-r-i/firebase-mcp
**npm:** https://www.npmjs.com/package/firebase-mcp

If you want Claude Desktop to **only read** from Firebase (no accidental writes during a long session), this is the better default. Use the official one for write operations.

### Config

```json
{
  "mcpServers": {
    "firebase-readonly": {
      "command": "npx",
      "args": ["-y", "firebase-mcp"]
    }
  }
}
```

### Tools (subset)

- 13 Firestore read operations: list, query, aggregate, collection-group queries, schema inference, distinct-value counts.
- 2 Auth operations: `get_user`, `list_users` (paginated).
- Multi-project support via `~/.config/firebase-mcp/firebase-mcp.json`.
- Glob-based allow/deny rules per Firestore path, evaluated *before* hitting the DB.

### When to use

- Long unattended sessions where you might forget Claude has write access.
- Auditing your schema without risk of mutation.

---

## Recommended install order

1. **Official Firebase** — biggest productivity unlock for day-to-day work.
2. **Official GitHub** — PR/issue workflow integration.
3. **(Optional) Read-only Firebase** — toggle on when you want safer defaults.

All three can run concurrently in the same `claude_desktop_config.json`.

---

## Sources

- [Firebase MCP server docs](https://firebase.google.com/docs/ai-assistance/mcp-server)
- [firebase-tools MCP source](https://github.com/firebase/firebase-tools/blob/main/src/mcp/README.md)
- [firebase-mcp (s-h-u-h-a-r-i)](https://github.com/s-h-u-h-a-r-i/firebase-mcp)
- [firebase-mcp on npm](https://www.npmjs.com/package/firebase-mcp)
- [Official MCP servers repo](https://github.com/modelcontextprotocol/servers)
- [GitHub blog: building the GitHub MCP server](https://github.blog/developer-skills/github/deep-dive-building-the-github-mcp-server/)
- [arXiv: GitHub MCP manual](https://arxiv.org/abs/2505.23390)
- [Official MCP Registry](https://registry.modelcontextprotocol.io/)
- [MCP Toplist (cross-registry aggregator)](https://mcptoplist.com/)