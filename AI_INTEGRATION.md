# StarLaunch AI Integration — Architecture & API Reference

This document describes StarLaunch's AI Integration Layer: how external tools (Claude
Code, Cursor, Gemini CLI, MCP clients, or any future automation) can observe and control
projects StarLaunch manages, and — just as importantly — what they are structurally
prevented from doing.

## 1. Design principle

External integrations follow the **principle of least privilege**. They may read project
state, register new projects, and start/stop/restart processes. They can never delete,
remove, or unregister a project, and they can never change StarLaunch's own configuration.
Deletion is only possible from inside the StarLaunch UI, after explicit user confirmation.

This isn't an access-control rule layered on top of a more powerful API — the destructive
operations simply **do not exist** in the type or the server. See
[`src/shared/aiCapabilities.ts`](src/shared/aiCapabilities.ts): `AiCapability` has no
`PROJECT_DELETE` member, so there is nothing for any transport to expose, and no
capability check anyone could get wrong.

## 2. Architecture

```
                 ┌───────────────────────────────┐
                 │   AiIntegrationLayer            │   src/main/aiIntegrationLayer.ts
                 │   (one function per capability, │   — transport-independent
                 │   bound to store + processManager)
                 └───────────────┬─────────────────┘
                                 │ called by
                 ┌───────────────┴─────────────────┐
                 │        AiHttpServer              │   src/main/aiHttpServer.ts
                 │  loopback-only REST transport    │   — the one transport shipped today
                 └───────────────────────────────────┘

   Future transports (local IPC, a CLI, an MCP server, named pipes, WebSockets) would be
   additional thin files in this position — they call the same AiIntegrationLayer instance
   and need no changes to it or to the StarLaunch UI.
```

The StarLaunch renderer (the UI you click around in) does not talk to this layer at all —
it uses its own internal, contextBridge-scoped IPC. The AI Integration Layer exists purely
for processes *outside* the Electron app.

## 3. Enabling it

Off by default. Settings → AI Integration:

1. Toggle **Enable AI Integration API** on. A bearer token is generated automatically the
   first time you enable it.
2. Note the **port** (default `3003`) and copy the **token**.
3. Give the base URL (`http://127.0.0.1:<port>`) and token to the tool you're
   configuring. The token is never written into any project file — it only ever lives in
   StarLaunch's own settings and the Settings modal.

The server binds to `127.0.0.1` only. It is not reachable from other machines on your
network under any configuration.

## 4. Authentication

Every request except `GET /health` requires:

```
Authorization: Bearer <token>
```

Compared using a constant-time check. A missing or wrong token gets `401`.

## 5. Endpoints

| Capability | Method & path | Notes |
|---|---|---|
| `HEALTH_CHECK` | `GET /health` | Unauthenticated. Returns app name, version, project count, and the full capability list. |
| `PROJECT_LIST` | `GET /projects` | Every registered project + its live runtime stats. |
| `PROJECT_READ` | `GET /projects/:id` | 404 if the id doesn't exist. |
| `PROJECT_REGISTER` | `POST /projects` | Body: `{ name, directory, framework?, category?, port?, command? }`. Registers an **existing** directory — mirrors the UI's "Add Project." Never scaffolds a project; `directory` must already exist on disk. If *Write AI integration files* is on (the default), it writes `CLAUDE.md` (only if missing) and `.starlaunch.json` into the folder. |
| `PROJECT_START` | `POST /projects/:id/start` | Resolves the port (project config → pinned port → auto-assign) exactly like the UI's Start button. |
| `PROJECT_STOP` | `POST /projects/:id/stop` | Graceful `SIGTERM`, escalates to `SIGKILL` after 4s. |
| `PROJECT_RESTART` | `POST /projects/:id/restart` | Stop then start. |
| `PROJECT_STATUS` | `GET /projects/:id/status` | Status, pid, cpu, memory, uptime, resolved port. |
| `PROJECT_LOGS` | `GET /projects/:id/logs?limit=200` | Most recent `limit` lines (default 200). |
| `PROJECT_OPEN_URL` | `POST /projects/:id/open` | Opens `http://localhost:<port>` in the user's default browser. |
| `PROJECT_COPY_URL` | `POST /projects/:id/copy-url` | Writes the URL to the OS clipboard. |

All responses are JSON. Successful mutations return `{ ok: true }` (or the created/updated
resource); failures return `{ ok: false, error }` with an appropriate 4xx/5xx status.

There is no `DELETE` route anywhere in this server — not disabled, not unauthorized,
simply absent.

## 6. Example

```bash
curl http://127.0.0.1:3003/health

curl -H "Authorization: Bearer <token>" http://127.0.0.1:3003/projects

curl -X POST -H "Authorization: Bearer <token>" \
  http://127.0.0.1:3003/projects/<id>/start
```

## 7. What every StarLaunch-created project already knows

Projects created via **Create Project** get two files written automatically:

- **`CLAUDE.md`** — human-readable instructions telling an AI assistant working in that
  project's directory not to run `npm run dev`/`pnpm dev`/`yarn dev` directly, and to go
  through StarLaunch instead (register/start/stop/restart/status/logs — never delete).
  Written once; StarLaunch never overwrites it again, so you can edit it freely.
- **`.starlaunch.json`** — machine-readable metadata (id, name, framework, package
  manager, directory, port, startup command, category), versioned via a `schemaVersion`
  field. StarLaunch keeps this file in sync whenever the project's settings change in the
  UI, but only if the file already exists — it's never created outside of Create Project or
  an explicit "Generate AI Integration Files" click in Configure Project.

## 8. Future extension points (not implemented)

- Additional transports on top of the same `AiIntegrationLayer`: a named pipe for
  same-machine tools that prefer not to open a socket, an MCP server exposing the same
  capabilities as MCP tools, a CLI (`starlaunch-cli status <id>`).
- Per-token scoping (e.g. a read-only token vs. a start/stop token) if a future use case
  needs finer granularity than "all non-destructive capabilities."
- Structured/paginated log streaming (currently a flat recent-lines snapshot).
