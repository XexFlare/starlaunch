# StarLaunch — Intelligent Port Management & Registry Integration

**Implementation report** — architectural reference for the port management and registry
features added to StarLaunch. Written for a developer (human or AI) with no prior context
on this change.

---

## 1. Executive Summary

### What changed

StarLaunch gained two new capabilities:

1. **Intelligent port management.** Before launching a project, StarLaunch now discovers
   what port the project's *own* configuration prefers (env files, `vite.config`,
   `package.json` scripts), falls back to a manually pinned port if the project doesn't
   declare one, and only auto-assigns a free port as a last resort. If the chosen port is
   already occupied, StarLaunch reroutes to the next free port and tells the user exactly
   why. The resolved port is used to build a framework-aware launch command (`--port` for
   Vite, `-p` for Next, `PORT` env var universally).

2. **Optional external registry.** StarLaunch can maintain a plain-text, human- and
   AI-readable file describing every registered project (name, port, path, framework,
   category, status, start command, URL). The registry is opt-in, lives wherever the user
   points it, regenerates automatically on project/status changes when enabled, can be
   generated on demand, and can be imported from an existing file (StarLaunch-authored or
   hand-maintained) to bootstrap projects StarLaunch doesn't know about yet.

### Why it changed

Multiple StarLaunch-managed projects previously all launched with whatever port was typed
into the project's own StarLaunch settings (`Project.port`), with no verification that the
port was actually free, no way to know what the project's real dev-server config wanted,
and no way for other tools (including AI assistants working across a user's many local
projects) to see, at a glance, what was running where.

### Design philosophy

StarLaunch is an **orchestrator, not an authority**. It never rewrites a project's own
config files, and it never lets two projects silently collide on the same port. Every
launch decision — "why this port" — is surfaced to the user via a toast and the system log,
never made silently. The same philosophy applies to the registry: StarLaunch does not
assume ownership of the file. The user chooses whether it exists, where it lives, and
whether StarLaunch is even allowed to touch it.

This is implemented as an explicit priority order, checked at launch time, every time
(never cached, never assumed from a previous run):

```
1. Discover  — does the project's own configuration declare a port?
2. Respect   — if StarLaunch has a manually pinned port, use it.
3. Assist    — if neither exists, find a free port and say so.
4. Protect   — whatever port was chosen, verify it's actually free; reroute + explain if not.
5. Explain   — always tell the user which of the above happened, and why.
```

---

## 2. Port Management

All port logic lives in one new file: **`src/main/portManager.ts`**. It is a stateless
module of pure functions — no class, no persisted state — consistent with the instruction
that this logic must not live inside `ProcessManager`.

### 2.1 Discovery order

`resolveLaunchPort(project, reservedPorts)` is the single entry point. It walks this order
and stops at the first match:

| Step | Source | Function | Notes |
|---|---|---|---|
| 1 | Project's own env files | `detectFromEnvFiles` | Checks, in order: `.env.development.local`, `.env.development`, `.env.local`, `.env`, for a line matching `PORT=(\d+)`. This is checked first because an env file is usually the most explicit, most portable statement of "this app runs on port X" and applies across frameworks. |
| 2 | Vite config | `detectFromViteConfig` | Checks `vite.config.{ts,js,mjs,cjs}` for a `server: { ... port: N ... }` block via regex. Deliberately a regex scan, not a full AST parse — consistent with the existing heuristic style already used in `fsScanner.ts` for framework/port guessing. |
| 3 | `package.json` scripts | `detectFromPackageScripts` | Scans the `scripts` object (as JSON text) for `--port`, `-p`, or `PORT=` followed by a 2–5 digit number. Catches cases like `"dev": "vite --port 4001"` or `"dev": "PORT=4001 next dev"`. |
| 4 | StarLaunch's stored `Project.port` | — | Only consulted if steps 1–3 all come back empty. This is the port the user manually pinned via Add/Configure Project. Since `Project.port` is now optional (see §4), "nothing pinned" is a real, representable state. |
| 5 | Auto-assignment | `findAvailablePort` | Only reached if the project has no discoverable config *and* no manual override. Scans upward from port 3000 for the first port that is both not reserved by another running StarLaunch project and free at the OS level. |

`detectPreferredPort(directory)` bundles steps 1–3 and is exported separately in case a
future feature (e.g. a "detected port" hint in the Add Project form) wants to call it
without going through full resolution.

### 2.2 Conflict resolution

Regardless of *which* step produced a candidate port, that candidate is always verified
before being trusted:

```ts
const free = !reservedPorts.has(candidate) && await isPortFree(candidate)
```

- `reservedPorts` is a `Set<number>` built fresh on every launch from the ports currently
  held by other StarLaunch-managed running processes (`ProcessManager` computes this from
  its own `running` map — see §5). This catches races where two projects are starting in
  the same tick, before either has actually bound its port at the OS level.
- `isPortFree(port)` does a real OS-level check: it opens a `net.createServer()`, tries to
  `listen()` on `127.0.0.1:port`, and resolves `true`/`false` based on whether that
  succeeds. This catches ports held by anything else on the machine, not just other
  StarLaunch projects.

If the check fails, `findAvailablePort(candidate + 1, reservedPorts)` scans upward for the
next free port, and the resolution is flagged `conflict: true` with `preferredPort` set to
the original candidate, so the message can be specific:

> *"Preferred port 3039 is already in use. Launching on 3040 instead."*

If there was no preferred port at all (step 5), the message is phrased differently since
there's no "preferred" port to report a conflict against:

> *"No preferred port found. Using port 3042."*

If the preferred port (from any of steps 1–4) turned out to be free, the message simply
confirms the decision:

> *"Using application's preferred port 3039."* (steps 1–3)
> *"Using configured port 3000."* (step 4)

This mapping from `{source, conflict}` to message text lives entirely inside
`resolveLaunchPort`/`resolvePreferred` in `portManager.ts` — nothing downstream needs to
know the reasoning, only the final `message` string.

### 2.3 Launch command construction

`buildLaunchCommand(project, port)` — also in `portManager.ts` — turns a resolved port into
an actual spawnable command plus environment overlay:

```ts
{ command: string, env: Record<string, string> }
```

- `env.PORT` is **always** set to the resolved port. This is the universal Node/CRA/Next
  convention and costs nothing to set even when a CLI flag is also injected.
- Framework-specific CLI flag injection, via `injectPortFlag`:
  - **Vite** → appends `--port <port>`
  - **Next** → appends `-p <port>`
  - **React / Node / Custom** → no flag injected; these rely on `PORT` env var alone
    (matches Create React App and most bare Node server conventions).
- `injectPortFlag` is idempotent and respectful of user intent:
  - If the command **already contains** the flag (e.g. the user wrote
    `next dev -p 3001` by hand), nothing is injected — the explicit command wins.
  - If the command is an npm/yarn/pnpm wrapper (`npm run dev`, `yarn dev`, …) and doesn't
    already have a `--` separator, one is added so the flag reaches the underlying binary
    rather than being swallowed by the package manager:
    `npm run dev` + Vite → `npm run dev -- --port 3039`
    `npm run dev` + Next → `npm run dev -- -p 3039`
  - If the command is a direct binary invocation (`vite`, `next dev`), the flag is appended
    directly: `next dev -p 3039`.

### 2.4 How this differs from the previous implementation

| Before | After |
|---|---|
| `processManager.start()` spawned `project.command` verbatim, using `project.port` only to poll for readiness. | `processManager.start()` first calls `portManager.resolveLaunchPort()`, then `portManager.buildLaunchCommand()`, and spawns the *constructed* command with the resolved port injected into both the command line (where supported) and `env.PORT`. |
| `project.port` was a required field — every project had *some* number, real or guessed. | `project.port` is now optional. Absence is a legitimate, representable state ("no manual override"), not just an empty text field. |
| No verification a port was actually free before spawning — two projects configured with the same port would both try to bind it and one would fail with an opaque error in its own log. | Every launch verifies port availability against both other running StarLaunch projects and the OS before spawning, and reroutes proactively. |
| The port shown in the UI and used for "Open in Browser"/"Copy URL" was always `project.port`, even if the process silently failed to bind it or a future feature changed it at runtime. | The UI shows and acts on `ProjectRuntimeStats.port` — the actual port the current run is using — falling back to `project.port` only when the project isn't running. |
| Port readiness polling (`pollForPort`) connected to `project.port`. | Polling connects to `entry.port`, the resolved runtime port, which may differ from `project.port`. |

---

## 3. Registry System

All registry logic lives in one new file: **`src/main/registryService.ts`** — again a
stateless module, not a class, since it has no persisted state of its own (the file on disk
*is* the state, and StarLaunch treats it as external).

### 3.1 How it works

- **Generation**: `generateRegistry(projects, getStats)` renders every project as a
  block of `Label:\nValue` pairs (App, Port, Path, Framework, Category, Status, Start, URL),
  separated by a line of 51 underscores, matching the format given in the feature spec.
  `getStats` is passed in (rather than imported) so the function stays decoupled from
  `ProcessManager` — the caller (`main/index.ts`) supplies
  `(id) => processManager.getStats(id)`.
- **Writing**: `writeRegistry(path, content)` creates the parent directory if needed and
  writes the file with `fs.writeFileSync`. No ownership metadata, no lockfile, no schema
  version — it's just a text file the user (or another tool) can open in Notepad.
- **Parsing**: `parseRegistry(content)` splits the text on separator lines and, block by
  block, reads `Label:` lines followed by their value on the next non-blank line. It is
  deliberately tolerant: a block only needs `App:` and `Path:` to be usable — `Port`,
  `Framework`, `Category`, and `Start` are optional and fall back to sensible defaults
  during import. This is what lets StarLaunch read registries it didn't generate itself
  (see §3.6).
- **Reading**: `readRegistry(path)` is `parseRegistry` plus an existence check — returns
  `[]` if the file doesn't exist yet, rather than throwing.

### 3.2 Where registry files may be stored

Nowhere is hardcoded. `AppSettings.registryPath` is a free-text path the user sets via
Settings → Registry → **Browse…**, which opens a native save dialog
(`dialog.showSaveDialog`, defaulting to the current path or `StarLaunch-registry.txt`).
The user can also type/paste a path directly into the field. This satisfies "the user
chooses where the registry lives" — StarLaunch never picks a default location on its own
initiative (`registryPath` defaults to `''`, and generation is a no-op until it's set).

### 3.3 When the registry is regenerated

Only when `settings.registryEnabled` is `true` **and** `settings.registryPath` is non-empty.
When both hold, `regenerateRegistryIfEnabled()` (in `main/index.ts`) is called after:

- `PROJECT_ADD`, `PROJECT_UPDATE`, `PROJECT_DELETE`, `PROJECT_TOGGLE_FAVORITE` (any store
  mutation)
- Every `processManager` `status` event (so `Status:` in the file reflects
  running/stopped/error in near-real time)
- A successful `REGISTRY_IMPORT` (so newly imported projects appear immediately)

It is **not** hooked into the `stats-tick` event (CPU/memory polling, every 2.5s) — that
would mean a disk write every 2.5 seconds per running project for no benefit, since the
registry doesn't include live resource metrics.

**Generate Registry Now** (a manual Settings button) bypasses the `registryEnabled` check
entirely — it always writes, as long as a path is set, since this is imperative user intent,
not the automatic on-change behavior.

### 3.4 How importing works

Settings → Registry → **Import Existing Registry** opens a native open-file dialog scoped
to `.txt`, then calls `IPC.REGISTRY_IMPORT` with the chosen path. In `main/index.ts`:

```
1. readRegistry(path)                     — parse every block into a RegistryEntry
2. build a Set of normalized existing project directories
3. for each entry:
     if its directory already matches a known project → skip (counted, not overwritten)
     else → store.addProject({ name, directory, port, command, framework, category })
            with framework/category/command defaulted when the registry didn't specify them
4. regenerateRegistryIfEnabled()          — if enabled, the just-imported projects appear immediately
5. return { imported, skipped, total }    — surfaced as a toast in the renderer
```

Directory comparison (`normalizeDir`) lower-cases and strips trailing slashes so
`C:\Projects\Foo\` and `c:/projects/foo` are recognized as the same project — this matters
because hand-maintained registries won't always match StarLaunch's own path casing/style.

**Existing project metadata is never overwritten by import** — a match on directory means
"skip," full stop. This directly satisfies "Do not overwrite existing project metadata
unless appropriate," resolved conservatively: appropriate = never, for now (a merge/update
mode is a natural future extension — see §8).

### 3.5 How exporting works

"Exporting" and "generating" are the same operation — `generateRegistry` +
`writeRegistry` — there's no separate export format. The registry file *is* the export,
kept continuously in sync when enabled, or produced on demand via **Generate Registry Now**.

### 3.6 How StarLaunch respects externally maintained registry files

The parser (`parseRegistry`) only requires `App:` and `Path:` to recognize a block, and
ignores unrecognized labels rather than rejecting the whole file. A user's own hand-written
registry — even one with different field ordering, extra custom fields, or missing
Framework/Category/Start/Status/URL — imports cleanly; missing fields default to `'Custom'`
framework, `'Other'` category, and `'npm run dev'` command, which the user can then correct
via **Configure Project** exactly as they would for any auto-detected project. StarLaunch
never writes to a registry path unless the user has explicitly set one and (for automatic
regeneration) explicitly enabled it, so a manually maintained file is never overwritten
unless the user turns on the toggle and points StarLaunch at their file on purpose — at
which point StarLaunch becomes co-maintainer of that specific file by the user's own choice,
not by StarLaunch's default behavior.

---

## 4. Architecture Changes

### 4.1 New services

| File | Responsibility |
|---|---|
| `src/main/portManager.ts` | Preferred-port detection, OS-level availability checks, free-port search, framework-aware launch command construction. Pure functions, no state. |
| `src/main/registryService.ts` | Registry text generation, writing, parsing, reading. Pure functions, no state. |

### 4.2 Modified services

| File | What changed | Why |
|---|---|---|
| `src/main/processManager.ts` | `start()` is now `async`; it calls `portManager.resolveLaunchPort()` then `portManager.buildLaunchCommand()` before spawning. `RunningEntry` gained `port`, `portSource`, `portConflict`. `getStats()` returns those three fields plus a `url` built from the runtime port. `pollForPort()` now polls `entry.port` instead of `project.port`. Emits a new `launch-notice` event. | Port resolution/command construction must happen before every spawn, and the *actual* port in use for a run must be tracked per-run (it can legitimately differ from the project's configured port), not assumed to equal `project.port`. |
| `src/main/store.ts` | **Unchanged.** | Store persistence didn't need to change — `Project.port` being optional is a type-level change only; the JSON shape already tolerated missing/undefined fields. |
| `src/main/index.ts` | New IPC handlers (see §4.4), `regenerateRegistryIfEnabled()`/`writeRegistryNow()`/`normalizeDir()` helpers, registry-regen calls added after every project-mutation handler and inside the `processManager.on('status', …)` listener, new `processManager.on('launch-notice', …)` broadcast. | This file is StarLaunch's orchestration layer — it already wires `store` + `processManager` together, so it's the natural place to also wire in `registryService` without teaching either service about the other. |
| `src/preload/index.ts` | Added `registry.generate`/`registry.import`, `dialog.pickRegistryLocation`/`pickImportFile`, `onLaunchNotice`. | Renderer needs a typed, sandboxed surface for the new IPC channels, consistent with the existing `contextBridge` pattern. |

### 4.3 New types (`src/shared/types.ts`)

- `PortSource = 'project-config' | 'stored' | 'auto-assigned'` — tags *where* a resolved
  port came from; carried on `ProjectRuntimeStats` for potential future UI use (e.g. a
  badge showing "auto-assigned").
- `Project.port` changed from `number` to `port?: number` — see §2.4 and §6.
- `ProjectRuntimeStats` gained `port?`, `portSource?`, `portConflict?`.
- `AppSettings` gained `registryEnabled: boolean`, `registryPath: string` (defaults `false`,
  `''`).
- `RegistryImportResult { imported, skipped, total }` and
  `RegistryGenerateResult { ok, error? }` — typed IPC return shapes shared between main and
  renderer.

### 4.4 New IPC handlers (`src/shared/ipc-channels.ts` + `src/main/index.ts`)

| Channel | Direction | Purpose |
|---|---|---|
| `dialog:pick-registry-location` | renderer → main (invoke) | Native save dialog for choosing/typing the registry file path. |
| `dialog:pick-import-file` | renderer → main (invoke) | Native open dialog scoped to `.txt` for selecting a registry to import. |
| `registry:generate` | renderer → main (invoke) | Force-write the registry now, regardless of the enabled toggle. |
| `registry:import` | renderer → main (invoke) | Parse a registry file and create any StarLaunch projects it describes that don't already exist. |
| `project:launch-notice` | main → renderer (event) | Broadcasts `{ id, title, message }` whenever `ProcessManager` resolves a launch port, so the renderer can show a toast explaining the decision. |

### 4.5 Renderer changes

- **`src/renderer/src/store/useAppStore.ts`**:
  - `Toast` gained an optional `title` (used to show the project name above the message,
    matching the "ProjectName / reason" toast format from the spec).
  - `pushToast(message, kind, title?)` — extended, backward compatible (existing call sites
    with two args are untouched).
  - New `refreshProjects()` action — refetches the project list from main; used after a
    registry import adds projects the renderer doesn't know about yet.
  - `bootstrap()` now also subscribes to `window.StarLaunch.onLaunchNotice`, converting each
    notice into a toast.
- **`src/renderer/src/components/ToastStack.tsx`**: renders `toast.title` (bold, white) above
  `toast.message` when present; switched the toast's flex alignment from `items-center` to
  `items-start` to accommodate the now-optional two-line layout without changing the visual
  style for existing single-line toasts.
- **`src/renderer/src/components/ProjectRow.tsx`**: introduces `shownPort = stats?.port ??
  project.port`, used everywhere the row previously read `project.port` directly — the port
  label, the inline `localhost:PORT` pill, and the Open-in-Browser/Copy-URL button handlers.
  Shows `Auto` instead of a number when no port is configured and nothing is running yet.
- **`src/renderer/src/components/ConfigureProjectModal.tsx`** /
  **`AddProjectModal.tsx`**: the Port field is now optional — an empty field means "let
  StarLaunch figure it out," with a placeholder of `Auto-detect`. `AddProjectModal`'s
  manual-tab validation no longer requires a port.
- **`src/renderer/src/components/SettingsModal.tsx`**: new **Registry** section — Enable
  Registry toggle, Registry File Location field + Browse…, Generate Registry Now and Import
  Existing Registry buttons, built entirely from the existing `Field`/`TextInput`/`Toggle`
  primitives in `form.tsx` (no new form components were introduced).

### 4.6 Store (persistence) changes

None to the on-disk format or `src/main/store.ts` itself. `AppSettings` defaults
(`DEFAULT_SETTINGS`) gained `registryEnabled: false, registryPath: ''`, which existing store
files pick up automatically via `store.ts`'s existing `{ ...DEFAULT_SETTINGS, ...parsed }`
merge on read — no migration code was needed.

### 4.7 Settings changes

See §6 for the full settings table.

---

## 5. Launch Process

Complete sequence from clicking **Start** to the registry reflecting the new state:

```
User clicks Start (ProjectRow → useAppStore.startProject → IPC "process:start")
        │
        ▼
main/index.ts: PROCESS_START handler looks up the Project, calls processManager.start(project)
        │
        ▼
ProcessManager.start():
  1. Build `reservedPorts` from every currently-running project's entry.port
  2. await portManager.resolveLaunchPort(project, reservedPorts)
       a. detectPreferredPort(project.directory)   — env files → vite.config → package.json scripts
       b. if found:  check availability → use it, or reroute + flag conflict
       c. if not found and project.port is set:     check availability → use it, or reroute + flag conflict
       d. if neither: findAvailablePort(3000, reservedPorts)
     → returns { port, source, conflict, message }
        │
        ▼
  3. Guard: if another start() call already registered this project while we were
     awaiting step 2, bail out (prevents a double-spawn race)
        │
        ▼
  4. appendLog('system', resolution.message)  +  emit('launch-notice', id, name, message)
        │
        ▼
  5. portManager.buildLaunchCommand(project, resolution.port)
       → injects --port / -p for Vite/Next (respecting an already-explicit flag),
         always sets env.PORT
        │
        ▼
  6. appendLog('system', `$ <command>  (cwd: ...)`)
        │
        ▼
  7. spawn(command, { cwd, shell:true, env: {...process.env, FORCE_COLOR:'1', ...portEnv} })
        │
        ▼
  8. Store a RunningEntry { pid, port: resolution.port, portSource, portConflict, ... }
     setStatus('starting')  →  broadcast "project:status-changed"
        │
        ▼
  9. pollForPort(entry): repeatedly attempt a raw TCP connect to entry.port
     until it succeeds (→ setStatus('running')) or 30s elapse (→ assume running anyway)
        │
        ▼
 10. Renderer:
       - useAppStore's onStatusChanged listener updates stats[id].status
       - useAppStore's onLaunchNotice listener → pushToast(message, 'info', projectName)
       - ToastStack renders "ProjectName / <message>"
        │
        ▼
 11. main/index.ts: processManager.on('status', ...) listener fires on every transition
     (starting → running, etc.) → regenerateRegistryIfEnabled()
       → if Settings → Registry → Enable Registry is on and a path is set,
         registryService.generateRegistry() + writeRegistry() run, updating
         the Status:/Port:/URL: fields for this project in the registry file
```

Stopping, killing, and restarting a project are unchanged in shape (`treeKill` +
`SIGTERM`/`SIGKILL`, restart = stop-then-start), except restart now goes through the same
port-resolution path as a fresh start, so a restarted project re-checks for conflicts rather
than assuming its previous port is still valid.

---

## 6. Settings

All in `AppSettings` (`src/shared/types.ts`), surfaced in `SettingsModal.tsx`:

| Setting | Type | Default | Controls |
|---|---|---|---|
| `registryEnabled` | `boolean` | `false` | Whether StarLaunch automatically rewrites the registry file whenever a project is added, edited, deleted, favorited, or changes run status. When off, the file (if any) is left exactly as it is — StarLaunch will still read it if the user hits Import, but won't touch it otherwise. |
| `registryPath` | `string` | `''` | Absolute path to the registry text file. Empty means "no registry configured" — Generate Registry Now is disabled and automatic regeneration is a no-op until a path is set. Set by typing directly or via **Browse…** (native save dialog). |

No other settings were added — `Project.port` becoming optional is a schema change, not a
new *setting* (it's per-project data, edited in Add/Configure Project, not in the global
Settings modal).

---

## 7. User Experience

### Launching an existing, already-configured application

A Vite project with `server: { port: 5174 }` in `vite.config.ts`: pressing Start spawns
`npm run dev -- --port 5174` and shows *"Using application's preferred port 5174."* — the
same port shown in the row, in the log console, and usable via Copy URL/Open in Browser
immediately once the row shows **Running**.

### Launching an application with no configured port

A brand-new project added with the Port field left blank (`Auto-detect` placeholder):
pressing Start finds the first free port from 3000 upward and shows a toast:

```
ContainerLoadCalculatorX
No preferred port found. Using port 3042.
```

The row's Port label updates from `Auto` to `3042` once running.

### Launching when the preferred port is already occupied

Two projects both configured for port 3039 — the first one running holds it; starting the
second one detects the conflict and shows:

```
ShipFuelCalculatorX
Preferred port 3039 is already in use. Launching on 3040 instead.
```

The second project runs correctly on 3040; nothing about the first project's port,
process, or config is touched.

### Importing a registry

Settings → Registry → Import Existing Registry → pick `C:\X\Code\AppRegistry.txt` → a toast
reports how many projects were imported vs. already known
(`Imported 3 projects, skipped 2 already known`). Imported projects immediately appear in
the main project list — no restart required (`refreshProjects()` refetches from main).

### Exporting/generating a registry

Settings → Registry → toggle Enable Registry on, set a path via Browse…, click Generate
Registry Now → a toast confirms (`Registry file written`) and the file appears at the
chosen path, formatted per §3.1. From then on, every project change or run-status change
keeps it current automatically.

---

## 8. Future Extension Points

Documentation only — nothing below is implemented.

- **Additional framework detection**: `portManager.ts`'s `detectFromViteConfig` /
  `matchFramework` are the natural extension points for Next.js `next.config.js` port
  conventions, SvelteKit, Nuxt, Remix, or Astro-specific config file parsing, and for
  richer command injection (e.g. `--host`, HTTPS flags).
- **Registry formats**: `registryService.ts`'s `generateRegistry`/`parseRegistry` are
  isolated enough that a JSON or YAML registry format could be added as sibling functions
  without touching `ProcessManager` or IPC wiring — likely gated by a `registryFormat`
  setting.
- **AI integration**: the registry's plain-text, self-describing format was chosen
  specifically so an external AI assistant (or any script) can read a user's entire local
  dev environment without needing StarLaunch's internal APIs. A future step could add a
  machine-oriented sibling (e.g. `registry.json`) generated alongside the human-readable
  one for structured consumption.
- **Port allocation strategies**: `findAvailablePort` currently scans linearly from 3000.
  A future setting could offer a configurable base port, a per-category port range (e.g.
  Games always in 4000s), or a "sticky" strategy that remembers and prefers the last
  auto-assigned port for a project across restarts.
- **Merge-on-import**: registry import currently only creates missing projects and never
  touches existing ones (§3.4). A future "update existing projects from registry" mode
  could diff and selectively merge fields, with user confirmation per field.

---

## 9. File-by-File Summary

### Created

| File | Purpose |
|---|---|
| `src/main/portManager.ts` | Preferred-port detection, availability checking, free-port search, launch command construction. |
| `src/main/registryService.ts` | Registry generation, writing, parsing, reading. |
| `IMPLEMENTATION_REPORT.md` | This document. |

### Modified

| File | Change |
|---|---|
| `src/shared/types.ts` | Added `PortSource`; made `Project.port` optional; added `port`/`portSource`/`portConflict` to `ProjectRuntimeStats`; added `registryEnabled`/`registryPath` to `AppSettings` (+ defaults); added `RegistryImportResult`/`RegistryGenerateResult`. |
| `src/shared/ipc-channels.ts` | Added `DIALOG_PICK_REGISTRY_LOCATION`, `DIALOG_PICK_IMPORT_FILE`, `REGISTRY_GENERATE`, `REGISTRY_IMPORT`, `PROJECT_LAUNCH_NOTICE_EVENT`. |
| `src/main/processManager.ts` | `start()` made async and rebuilt around `portManager`; `RunningEntry`/`getStats()` carry runtime port info; `pollForPort()` uses the resolved port; emits `launch-notice`. |
| `src/main/index.ts` | New IPC handlers for dialogs/registry; `regenerateRegistryIfEnabled`/`writeRegistryNow`/`normalizeDir` helpers; registry-regen calls wired into project mutation handlers and the status listener; `launch-notice` broadcast wired to renderer. |
| `src/preload/index.ts` | Exposed `registry.generate`/`registry.import`, `dialog.pickRegistryLocation`/`pickImportFile`, `onLaunchNotice`. |
| `src/renderer/src/store/useAppStore.ts` | `Toast.title`; `pushToast` gained a `title` param; new `refreshProjects()`; `bootstrap()` subscribes to launch notices. |
| `src/renderer/src/components/ToastStack.tsx` | Renders an optional bold title above the toast message. |
| `src/renderer/src/components/ProjectRow.tsx` | Uses the resolved runtime port (`stats.port`) for display and actions, falling back to `project.port`; shows `Auto` when neither is set. |
| `src/renderer/src/components/ConfigureProjectModal.tsx` | Port field is optional (`Auto-detect` placeholder, clears to `undefined`). |
| `src/renderer/src/components/AddProjectModal.tsx` | Port field is optional in the manual-add form; validation no longer requires it. |
| `src/renderer/src/components/SettingsModal.tsx` | New Registry section (toggle, path field + Browse, Generate Now, Import Existing). |

### Deleted

None.

---

## 10. Final Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│ Main process                                                        │
│                                                                       │
│  index.ts  ── orchestrator: window, all IPC handlers, wiring        │
│    │                                                                  │
│    ├── store.ts ─────────── persisted Project[] + AppSettings       │
│    │                        (JSON file in userData)                  │
│    │                                                                  │
│    ├── processManager.ts ── owns the running-process lifecycle:     │
│    │     │                  spawn/stop/kill/restart, log capture,   │
│    │     │                  CPU/mem polling, port-readiness polling │
│    │     │                                                            │
│    │     └── calls into ──► portManager.ts (NEW)                    │
│    │                        pure functions: detect preferred port,   │
│    │                        check/find free ports, build the         │
│    │                        framework-aware launch command           │
│    │                                                                  │
│    ├── fsScanner.ts ──────── directory scan for Add-Project          │
│    │                          "Auto-Detect" tab (unchanged)          │
│    │                                                                  │
│    └── registryService.ts (NEW)                                     │
│          pure functions: render/parse the human-readable registry;  │
│          index.ts decides *when* to call them (on mutation, on      │
│          status change, or on demand) and *whether* (registryEnabled)│
└─────────────────────────────────────────────────────────────────────┘
                              │  IPC (contextBridge, sandboxed)
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Preload (index.ts) — typed window.StarLaunch surface:               │
│   projects / process / stats / logs / dialog / fs / settings /      │
│   registry (NEW) / shell / clipboard / window                       │
│   + push events: onStatusChanged, stats.onUpdate, logs.onAppend,    │
│                   onLaunchNotice (NEW)                                │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Renderer (React + Zustand)                                           │
│                                                                        │
│  useAppStore ── single source of truth: projects, live stats,       │
│                  settings, logs, toasts (now with title support)    │
│                                                                        │
│  App → Header, StatsBar, CategoryFilter, ProjectList → ProjectRow    │
│         (now shows the *resolved runtime port*, not just the        │
│          configured one) → LogConsole, ToastStack (now two-line)    │
│                                                                        │
│  Modals: AddProjectModal / ConfigureProjectModal (port now optional),│
│          SettingsModal (new Registry section)                        │
└─────────────────────────────────────────────────────────────────────┘
```

**Responsibility boundaries after this change:**

- **`ProcessManager`** still owns *when* a process runs, its logs, and its resource stats.
  It no longer decides *which port* or *what exact command* — those questions are
  delegated to `portManager` on every single launch.
- **`portManager`** knows everything about ports and commands; it knows nothing about
  running processes, logs, or the store. It is called, not consulted asynchronously via
  events — a plain async function call per launch.
- **`registryService`** knows everything about reading/writing the registry text format;
  it knows nothing about *when* to do so or whether it's enabled — that policy lives in
  `main/index.ts`, the same place that already decides when to persist to `store.ts`.
- **`store.ts`** is unchanged: still the only place that touches the persisted JSON file
  for projects/settings.
- The renderer's job is unchanged in kind: render whatever `useAppStore` holds, and call
  `window.StarLaunch.*` for anything that needs main-process access. It gained one new
  piece of state to render (toast titles) and one new source of truth to prefer over
  `Project.port` when present (`ProjectRuntimeStats.port`).

This keeps the same three-process, single-direction-of-truth shape the codebase already
had — no new architectural pattern was introduced, only two new focused services plumbed
through the existing IPC/store/Zustand pipeline.
