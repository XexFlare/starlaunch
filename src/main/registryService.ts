import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname } from 'path'
import type { Category, Framework, Project, ProjectRuntimeStats } from '../shared/types'
import { CATEGORIES, FRAMEWORKS } from '../shared/types'

const SEPARATOR = '_'.repeat(51)
const KNOWN_FRAMEWORKS = new Set<string>(FRAMEWORKS)
const KNOWN_CATEGORIES = new Set<string>(CATEGORIES)

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function block(fields: [string, string][]): string {
  return fields.map(([label, value]) => `${label}:\n${value}`).join('\n\n')
}

/**
 * Renders the registry as a plain, human-readable text file — this is the
 * format both humans and other tools/AI assistants are expected to read, so
 * it favors clarity over compactness (see block() output shape in the spec).
 */
export function generateRegistry(
  projects: Project[],
  getStats: (id: string) => ProjectRuntimeStats
): string {
  const header = `StarLaunch Project Registry\nGenerated ${new Date().toLocaleString()}\n`

  if (projects.length === 0) {
    return `${SEPARATOR}\n\n${header}\nNo projects registered yet.\n\n${SEPARATOR}\n`
  }

  const sections = projects.map((project) => {
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

  return `${SEPARATOR}\n\n${header}\n${SEPARATOR}\n\n${sections.join(`\n\n${SEPARATOR}\n\n`)}\n\n${SEPARATOR}\n`
}

export function writeRegistry(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content, 'utf-8')
}

export interface RegistryEntry {
  name: string
  directory: string
  port?: number
  framework?: Framework
  category?: Category
  command?: string
}

/**
 * Tolerant parser for the "Label:\nValue" block format. Deliberately loose:
 * an externally, hand-maintained registry may only have a subset of fields
 * (commonly just App/Port/Path), and StarLaunch should still be able to use it.
 */
export function parseRegistry(content: string): RegistryEntry[] {
  const blocks = content
    .split(/^_{5,}\s*$/m)
    .map((b) => b.trim())
    .filter(Boolean)

  const entries: RegistryEntry[] = []

  for (const raw of blocks) {
    const lines = raw.split(/\r?\n/).map((l) => l.trim())
    const data: Record<string, string> = {}
    let pendingKey: string | null = null

    for (const line of lines) {
      if (!line) continue
      const keyMatch = line.match(/^([A-Za-z][A-Za-z ]*):$/)
      if (keyMatch) {
        pendingKey = keyMatch[1].trim().toLowerCase()
        continue
      }
      if (pendingKey && data[pendingKey] === undefined) {
        data[pendingKey] = line
        pendingKey = null
      }
    }

    if (!data.app || !data.path) continue

    entries.push({
      name: data.app,
      directory: data.path,
      port: data.port && /^\d+$/.test(data.port) ? Number(data.port) : undefined,
      framework: KNOWN_FRAMEWORKS.has(data.framework) ? (data.framework as Framework) : undefined,
      category: KNOWN_CATEGORIES.has(data.category) ? (data.category as Category) : undefined,
      command: data.start
    })
  }

  return entries
}

export function readRegistry(path: string): RegistryEntry[] {
  if (!existsSync(path)) return []
  return parseRegistry(readFileSync(path, 'utf-8'))
}
