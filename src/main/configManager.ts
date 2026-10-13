import { existsSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { Project } from '../shared/types'

const STARLAUNCH_JSON_SCHEMA_VERSION = 1

function slugify(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}

function claudeMdPath(directory: string): string {
  return join(directory, 'CLAUDE.md')
}

function starlaunchJsonPath(directory: string): string {
  return join(directory, '.starlaunch.json')
}

/**
 * Renders the human-readable AI-assistant instructions written into every
 * project StarLaunch creates. This file is deliberately never rewritten
 * after its first write (see writeInitialAiFiles) — once created it belongs
 * to the project, and a user may customize it.
 */
export function generateClaudeMd(project: Project): string {
  const port = project.port != null ? String(project.port) : '(assigned automatically at launch)'

  return `# ${project.name} — Managed by StarLaunch

This project's development server is managed by **StarLaunch**, a local dev-server
command center running on this machine. Read this before running any commands.

## Do not automatically run

- \`npm run dev\`
- \`pnpm dev\`
- \`yarn dev\`
- any other direct invocation of this project's dev/start script

Running the dev server directly, outside StarLaunch, can create port conflicts and
duplicate processes StarLaunch doesn't know about.

## Instead

- If this project isn't registered yet, **register** it with StarLaunch.
- **Start** and **stop** the project through StarLaunch, not by spawning the command yourself.
- Read \`.starlaunch.json\` (next to this file) for this project's current metadata
  (port, framework, package manager, startup command).

## How to reach StarLaunch

If StarLaunch's AI Integration API is enabled (Settings → AI Integration in the
StarLaunch app), it exposes a local, loopback-only REST API secured by a bearer
token. Ask the user for the base URL and token if you need to call it directly —
never assume a token or port; StarLaunch does not print secrets into project files.

## Permitted operations

- Register Project
- Start Project
- Stop Project
- Restart Project
- Read Status
- Read Logs
- Open Project URL / Copy Project URL

## Prohibited operations

- Delete Project
- Remove Project
- Unregister Project
- Modify StarLaunch configuration without explicit user approval

These destructive/administrative actions do not exist in StarLaunch's external
API by design. They are only available from inside the StarLaunch application,
and only after the user explicitly confirms them there.

---
_Project metadata: framework \`${project.framework}\`, category \`${project.category}\`, configured port \`${port}\`._
`
}

/**
 * Renders the machine-readable project metadata file. Schema is versioned
 * so future StarLaunch releases (or external tools) can detect and migrate
 * older files rather than assuming a fixed shape forever.
 */
export function generateStarlaunchJson(project: Project): string {
  const payload = {
    schemaVersion: STARLAUNCH_JSON_SCHEMA_VERSION,
    id: slugify(project.name),
    name: project.name,
    framework: project.framework.toLowerCase(),
    packageManager: project.packageManager ?? null,
    directory: project.directory,
    port: project.port ?? null,
    startupCommand: project.command,
    category: project.category,
    managedBy: 'StarLaunch',
    generatedAt: new Date().toISOString()
  }
  return `${JSON.stringify(payload, null, 2)}\n`
}

/**
 * Writes both AI-integration files for a brand-new project. Called once,
 * right after a project is created/registered. CLAUDE.md is only written if
 * absent (never clobbers a file the user may have started editing);
 * .starlaunch.json is StarLaunch-owned metadata and is written unless
 * `skipStarlaunchJson` is set (used when the folder already belongs to
 * another registered project, whose file must not be overwritten).
 */
export function writeInitialAiFiles(project: Project, options: { skipStarlaunchJson?: boolean } = {}): void {
  try {
    if (!existsSync(claudeMdPath(project.directory))) {
      writeFileSync(claudeMdPath(project.directory), generateClaudeMd(project), 'utf-8')
    }
    if (options.skipStarlaunchJson) return
    writeFileSync(starlaunchJsonPath(project.directory), generateStarlaunchJson(project), 'utf-8')
  } catch {
    // The project's directory may be unavailable (removable drive, permissions, ...) —
    // this is a best-effort convenience file, not something worth failing registration over.
  }
}

/**
 * Keeps an already-existing .starlaunch.json fresh when a project's
 * StarLaunch metadata changes (port, command, category, ...). Silently does
 * nothing if the project never got the file (it was registered with
 * "Write AI integration files" turned off).
 */
export function syncStarlaunchJson(project: Project): void {
  try {
    if (existsSync(starlaunchJsonPath(project.directory))) {
      writeFileSync(starlaunchJsonPath(project.directory), generateStarlaunchJson(project), 'utf-8')
    }
  } catch {
    // Best-effort — see writeInitialAiFiles.
  }
}
