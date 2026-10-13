import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname } from 'path'
import type { Category, Framework, Project, ProjectRuntimeStats } from '../shared/types'
import { CATEGORIES, FRAMEWORKS, normalizeCategory } from '../shared/types'

const SEPARATOR = '_'.repeat(51)
const KNOWN_FRAMEWORKS = new Set<string>(FRAMEWORKS)
const KNOWN_FIELDS = new Set(['app', 'port', 'path', 'framework', 'category', 'status', 'start', 'url', 'note'])

/**
 * Everything below this line is StarLaunch's; everything above it is kept
 * byte-for-byte when the registry is regenerated, so a hand-maintained
 * header (port blocks, reserved ports, instructions) survives auto-update.
 */
export const GENERATED_MARKER = 'StarLaunch-generated entries below. Everything under this line is rewritten automatically; edit only above it.'

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function block(fields: [string, string][]): string {
  return fields.map(([label, value]) => `${label}:\n${value}`).join('\n\n')
}

/**
 * Renders StarLaunch's part of the registry as plain, human-readable text —
 * the format both humans and other tools/AI assistants are expected to read,
 * so it favors clarity over compactness. Projects are grouped under
 * `== CATEGORY ==` headings, which parseRegistry reads back as categories.
 */
export function generateRegistry(
  projects: Project[],
  getStats: (id: string) => ProjectRuntimeStats
): string {
  const header = `${GENERATED_MARKER}\n\nStarLaunch Project Registry\nGenerated ${new Date().toLocaleString()}\n`

  if (projects.length === 0) {
    return `${SEPARATOR}\n\n${header}\nNo projects registered yet.\n\n${SEPARATOR}\n`
  }

  const groups = CATEGORIES.map((category) => ({
    category,
    projects: projects.filter((p) => p.category === category).sort((a, b) => a.name.localeCompare(b.name))
  })).filter((g) => g.projects.length > 0)

  const sections = groups.map(({ category, projects: inGroup }) => {
    const entries = inGroup.map((project) => {
      const stats = getStats(project.id)
      const port = stats.port ?? project.port
      return block([
        ['App', project.name],
        ['Port', port != null ? String(port) : 'Not configured'],
        ['Path', project.directory],
        ['Framework', project.framework],
        ['Category', project.category],
        ['Status', capitalize(stats.status ?? 'stopped')],
        ['Start', project.command],
        ['URL', port != null ? `http://localhost:${port}` : '—']
      ])
    })
    return [`== ${category.toUpperCase()} ==`, ...entries].join(`\n\n${SEPARATOR}\n\n`)
  })

  return `${SEPARATOR}\n\n${header}\n${SEPARATOR}\n\n${sections.join(`\n\n${SEPARATOR}\n\n`)}\n\n${SEPARATOR}\n`
}

/**
 * The part of an existing registry file that regeneration must keep:
 * - a file that already has the marker keeps everything above it;
 * - a hand-made file keeps everything before its first entry or section heading;
 * - a file written by an older StarLaunch (no marker, its own title) keeps nothing.
 */
export function extractPreservedHeader(existing: string): string {
  const markerAt = existing.indexOf(GENERATED_MARKER)
  if (markerAt !== -1) {
    const beforeMarker = existing.slice(0, markerAt)
    // Drop the separator line StarLaunch writes directly above the marker.
    return beforeMarker.replace(/\s*_{5,}\s*$/, '').trimEnd()
  }

  if (/^\s*_{5,}\s*StarLaunch Project Registry/.test(existing)) return ''

  const lines = existing.split(/\r?\n/)
  const firstEntry = lines.findIndex((l) => /^\s*App:/i.test(l) || /^\s*==.+==\s*$/.test(l))
  if (firstEntry === -1) return existing.trimEnd()

  let cut = firstEntry
  while (cut > 0 && !/^\s*_{5,}\s*$/.test(lines[cut - 1])) cut--
  return lines
    .slice(0, Math.max(0, cut - 1))
    .join('\n')
    .trimEnd()
}

export function writeRegistry(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true })
  const existing = existsSync(path) ? readFileSync(path, 'utf-8') : ''
  const header = existing ? extractPreservedHeader(existing) : ''
  writeFileSync(path, header ? `${header}\n\n${content}` : content, 'utf-8')
}

export interface RegistryEntry {
  name: string
  directory: string
  port?: number
  framework?: Framework
  category: Category
  command?: string
}

/**
 * Tolerant parser for registry files. Accepts both layouts —
 * `Label:` with the value on the next line (StarLaunch's own format) and
 * `Label: value` on one line (older hand-made registries) — and reads
 * `== SECTION ==` headings as the category of the entries that follow.
 * An externally maintained registry may only have a subset of fields
 * (commonly just App/Port/Path), and StarLaunch should still be able to use it.
 */
export function parseRegistry(content: string): RegistryEntry[] {
  const blocks = content
    .split(/^\s*_{5,}\s*$/m)
    .map((b) => b.trim())
    .filter(Boolean)

  const entries: RegistryEntry[] = []
  let section: string | undefined

  for (const raw of blocks) {
    const lines = raw.split(/\r?\n/).map((l) => l.trim())
    const data: Record<string, string> = {}
    let pendingKey: string | null = null

    for (const line of lines) {
      if (!line) continue

      const heading = line.match(/^==\s*(.+?)\s*==$/)
      if (heading) {
        // "APPS (3000)" → "APPS"
        section = heading[1].replace(/\s*\(.*\)\s*$/, '')
        pendingKey = null
        continue
      }

      const bareKey = line.match(/^([A-Za-z][A-Za-z ]*):$/)
      if (bareKey) {
        pendingKey = bareKey[1].trim().toLowerCase()
        continue
      }

      const inlineField = line.match(/^([A-Za-z][A-Za-z ]*):\s+(.+)$/)
      if (inlineField && KNOWN_FIELDS.has(inlineField[1].trim().toLowerCase())) {
        const key = inlineField[1].trim().toLowerCase()
        if (data[key] === undefined) data[key] = inlineField[2].trim()
        pendingKey = null
        continue
      }

      if (pendingKey && data[pendingKey] === undefined) {
        data[pendingKey] = line
        pendingKey = null
      }
    }

    if (!data.app || !data.path) continue

    const port = data.port && /^\d+$/.test(data.port) ? Number(data.port) : undefined
    // Old one-line registries wrote "Start: npm run dev  (http://localhost:3035)".
    const command = data.start?.replace(/\s*\(https?:\/\/[^)]*\)\s*$/, '').trim()

    entries.push({
      name: data.app,
      directory: data.path,
      port,
      framework: KNOWN_FRAMEWORKS.has(data.framework) ? (data.framework as Framework) : undefined,
      category: normalizeCategory(data.category ?? section, port),
      command: command || undefined
    })
  }

  return entries
}

export function readRegistry(path: string): RegistryEntry[] {
  if (!existsSync(path)) return []
  return parseRegistry(readFileSync(path, 'utf-8'))
}
