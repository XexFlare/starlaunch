import { createServer } from 'net'
import { readFileSync } from 'fs'
import { join } from 'path'
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

/**
 * Searches the project's own files for a port it already declares — the only
 * source that counts as "the application's preferred port" per StarLaunch's
 * design philosophy of never overriding a project's own configuration.
 */
export function detectPreferredPort(directory: string): number | null {
  return detectFromEnvFiles(directory) ?? detectFromViteConfig(directory) ?? detectFromPackageScripts(directory)
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
  const detected = detectPreferredPort(project.directory)

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

function injectPortFlag(command: string, flag: string, port: number): string {
  if (command.includes(flag)) return command

  const isWrappedScript = /^(npm run|npm start|yarn|pnpm)\b/.test(command)
  const alreadyHasSeparator = / -- /.test(command)
  if (isWrappedScript && !alreadyHasSeparator) {
    return `${command} -- ${flag} ${port}`
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

  const command = matchFramework(project.framework, base, port)
  return { command, env }
}

function matchFramework(framework: Framework, command: string, port: number): string {
  switch (framework) {
    case 'Vite':
      return injectPortFlag(command, '--port', port)
    case 'Next':
      return injectPortFlag(command, '-p', port)
    default:
      return command
  }
}
