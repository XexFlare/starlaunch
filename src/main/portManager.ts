import { createServer } from 'net'
import { readdirSync, readFileSync } from 'fs'
import { isAbsolute, join, relative } from 'path'
import type { Framework, PortSource, Project } from '../shared/types'

const AUTO_ASSIGN_BASE_PORT = 3000
const ENV_FILES = ['.env.development.local', '.env.development', '.env.local', '.env']
const VITE_CONFIG_FILES = ['vite.config.ts', 'vite.config.js', 'vite.config.mjs', 'vite.config.cjs']

export interface PortResolution {
  port: number
  source: PortSource
  conflict: boolean
  preferredPort?: number
  message: string
}

export interface LaunchCommand {
  command: string
  env: Record<string, string>
}

function readFileSafe(path: string): string | null {
  try {
    return readFileSync(path, 'utf-8')
  } catch {
    return null
  }
}

function detectFromEnvFiles(directory: string): number | null {
  for (const file of ENV_FILES) {
    const content = readFileSafe(join(directory, file))
    if (!content) continue
    const match = content.match(/^\s*PORT\s*=\s*(\d{2,5})/m)
    if (match) return Number(match[1])
  }
  return null
}

function detectFromViteConfig(directory: string): number | null {
  for (const file of VITE_CONFIG_FILES) {
    const content = readFileSafe(join(directory, file))
    if (!content) continue
    const match = content.match(/server\s*:\s*\{[^}]*port\s*:\s*(\d{2,5})/)
    if (match) return Number(match[1])
  }
  return null
}

function detectFromPackageScripts(directory: string): number | null {
  const content = readFileSafe(join(directory, 'package.json'))
  if (!content) return null
  try {
    const pkg = JSON.parse(content)
    const scripts = JSON.stringify(pkg.scripts ?? {})
    const match = scripts.match(/(?:--port[= ]|-p[= ]|PORT=)(\d{2,5})/)
    return match ? Number(match[1]) : null
  } catch {
    return null
  }
}

function detectInDirectory(directory: string): number | null {
  return detectFromEnvFiles(directory) ?? detectFromViteConfig(directory) ?? detectFromPackageScripts(directory)
}

function readPackageJson(directory: string): any | null {
  const content = readFileSafe(join(directory, 'package.json'))
  if (!content) return null
  try {
    return JSON.parse(content)
  } catch {
    return null
  }
}

/** "npm run dev" → "dev", "npm start" → "start", "pnpm dev" → "dev". */
function scriptNameFromCommand(command: string): string | null {
  const match = command.trim().match(/^(?:npm|pnpm|yarn|bun)\s+(?:run(?:-script)?\s+)?([\w:.-]+)/)
  return match ? match[1] : null
}

/** Expands simple `workspaces` patterns ("apps/*", "packages/web") to folders. */
function workspaceDirectories(root: string, pkg: any): string[] {
  const patterns: unknown = Array.isArray(pkg?.workspaces) ? pkg.workspaces : pkg?.workspaces?.packages
  if (!Array.isArray(patterns)) return []
  const dirs: string[] = []
  for (const pattern of patterns) {
    if (typeof pattern !== 'string') continue
    if (pattern.endsWith('/*')) {
      const parent = join(root, pattern.slice(0, -2))
      try {
        for (const entry of readdirSync(parent, { withFileTypes: true })) {
          if (entry.isDirectory()) dirs.push(join(parent, entry.name))
        }
      } catch {
        // pattern points at a folder that doesn't exist (yet)
      }
    } else if (!pattern.includes('*')) {
      dirs.push(join(root, pattern))
    }
  }
  return dirs
}

export interface WorkspaceTarget {
  directory: string
  /** True when the root script forwards with `npm run … -w`, which needs a second `--` for extra flags. */
  npmDelegation: boolean
}

/**
 * In an npm-workspaces monorepo the root script usually just forwards to one
 * package (`"dev": "npm run dev -w @todomatrix/app"`), so the port lives in
 * that package's own config. Returns that package's folder, if any.
 */
export function findWorkspaceTarget(project: Project): WorkspaceTarget | null {
  const pkg = readPackageJson(project.directory)
  const scriptName = scriptNameFromCommand(project.command)
  const script: unknown = scriptName ? pkg?.scripts?.[scriptName] : undefined
  if (!pkg?.workspaces || typeof script !== 'string') return null

  const npmTarget = script.match(/\bnpm\s+run\S*\s+.*?(?:-w|--workspace)(?:=|\s+)(\S+)/)
  const pnpmTarget = script.match(/\bpnpm\s+.*?(?:-F|--filter)(?:=|\s+)(\S+)/)
  const target = (npmTarget ?? pnpmTarget)?.[1]?.replace(/^["']|["']$/g, '')
  if (!target) return null

  for (const dir of workspaceDirectories(project.directory, pkg)) {
    const name = readPackageJson(dir)?.name
    const relPath = relative(project.directory, dir).replace(/\\/g, '/')
    if (name === target || relPath === target.replace(/^\.\//, '')) {
      return { directory: dir, npmDelegation: npmTarget != null }
    }
  }
  return null
}

/**
 * The folders searched for a declared port, in order: the project's own
 * "port config folder" override, its root, then the workspace package its
 * start script forwards to.
 */
function portConfigDirectories(project: Project): string[] {
  const dirs: string[] = []
  const override = project.portConfigDirectory?.trim()
  if (override) dirs.push(isAbsolute(override) ? override : join(project.directory, override))
  dirs.push(project.directory)
  const workspace = findWorkspaceTarget(project)
  if (workspace) dirs.push(workspace.directory)
  return dirs
}

/**
 * Searches the project's own files for a port it already declares — the only
 * source that counts as "the application's preferred port" per StarLaunch's
 * design philosophy of never overriding a project's own configuration.
 */
export function detectPreferredPort(project: Project): number | null {
  for (const dir of portConfigDirectories(project)) {
    const port = detectInDirectory(dir)
    if (port != null) return port
  }
  return null
}

export function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const tester = createServer()
    tester.once('error', () => resolve(false))
    tester.once('listening', () => tester.close(() => resolve(true)))
    tester.listen(port, '127.0.0.1')
  })
}

export async function findAvailablePort(startPort: number, reserved: Set<number>): Promise<number> {
  let candidate = Math.max(1, startPort)
  while (candidate <= 65535) {
    if (!reserved.has(candidate) && (await isPortFree(candidate))) return candidate
    candidate++
  }
  throw new Error('No available port could be found')
}

/**
 * Decides which port a project should launch on, following this order:
 *  1. A port discovered inside the project's own config (env file, vite.config, package.json script)
 *  2. The port the user manually pinned on the project in StarLaunch
 *  3. A freshly auto-assigned free port
 * At every step the chosen port is checked against `reservedPorts` (ports already
 * claimed by other running StarLaunch projects this session) and the OS. If the
 * preferred port turns out to be busy, the next free port is chosen instead and
 * the conflict is reported rather than silently swallowed.
 */
export async function resolveLaunchPort(project: Project, reservedPorts: Set<number>): Promise<PortResolution> {
  const detected = detectPreferredPort(project)

  if (detected != null) {
    return resolvePreferred(detected, 'project-config', reservedPorts, `Using application's preferred port ${detected}.`)
  }

  if (project.port != null) {
    return resolvePreferred(project.port, 'stored', reservedPorts, `Using configured port ${project.port}.`)
  }

  const assigned = await findAvailablePort(AUTO_ASSIGN_BASE_PORT, reservedPorts)
  return {
    port: assigned,
    source: 'auto-assigned',
    conflict: false,
    message: `No preferred port found. Using port ${assigned}.`
  }
}

async function resolvePreferred(
  preferred: number,
  source: PortSource,
  reservedPorts: Set<number>,
  successMessage: string
): Promise<PortResolution> {
  const free = !reservedPorts.has(preferred) && (await isPortFree(preferred))
  if (free) {
    return { port: preferred, source, conflict: false, message: successMessage }
  }

  const assigned = await findAvailablePort(preferred + 1, reservedPorts)
  return {
    port: assigned,
    source,
    conflict: true,
    preferredPort: preferred,
    message: `Preferred port ${preferred} is already in use. Launching on ${assigned} instead.`
  }
}

function injectPortFlag(command: string, flag: string, port: number, npmDelegation: boolean): string {
  if (command.includes(flag)) return command

  const isWrappedScript = /^(npm run|npm start|yarn|pnpm)\b/.test(command)
  const alreadyHasSeparator = / -- /.test(command)
  if (isWrappedScript && !alreadyHasSeparator) {
    // When the root script is itself `npm run dev -w pkg`, a single `--` hands the flag
    // to that inner npm, which swallows it; the second `--` passes it on to the dev server.
    const separator = npmDelegation ? '-- --' : '--'
    return `${command} ${separator} ${flag} ${port}`
  }
  return `${command} ${flag} ${port}`
}

/**
 * Builds the concrete command line (and env) used to spawn a project on its
 * resolved port. Vite and Next understand CLI flags for this; everything else
 * (Node/Custom/React/CRA-style servers) falls back to the PORT env var, which
 * is the universal Node convention.
 */
export function buildLaunchCommand(project: Project, port: number): LaunchCommand {
  const env: Record<string, string> = { PORT: String(port) }
  const base = project.command.trim()

  const npmDelegation = /^npm\b/.test(base) && (findWorkspaceTarget(project)?.npmDelegation ?? false)
  const command = matchFramework(project.framework, base, port, npmDelegation)
  return { command, env }
}

function matchFramework(framework: Framework, command: string, port: number, npmDelegation: boolean): string {
  switch (framework) {
    case 'Vite':
      return injectPortFlag(command, '--port', port, npmDelegation)
    case 'Next':
      return injectPortFlag(command, '-p', port, npmDelegation)
    default:
      return command
  }
}
