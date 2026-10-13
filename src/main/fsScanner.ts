import { readdirSync, readFileSync, statSync } from 'fs'
import { join, basename } from 'path'
import type { DetectedProject, Framework } from '../shared/types'

const IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  '.next',
  '.turbo',
  '.cache',
  'coverage',
  '.vscode',
  '.idea'
])

const MAX_DEPTH = 5
const MAX_RESULTS = 200

function detectFramework(pkg: any): Framework {
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) }
  if (deps['next']) return 'Next'
  if (deps['vite']) return 'Vite'
  if (deps['react'] && !deps['vite'] && !deps['next']) return 'React'
  if (deps['express'] || deps['fastify'] || deps['koa']) return 'Node'
  return 'Custom'
}

function guessCommand(pkg: any): string {
  const scripts = pkg.scripts ?? {}
  if (scripts.dev) return 'npm run dev'
  if (scripts.start) return 'npm run start'
  if (scripts.serve) return 'npm run serve'
  return 'npm run dev'
}

function guessPort(pkg: any, framework: Framework): number {
  const scripts = JSON.stringify(pkg.scripts ?? {})
  const match = scripts.match(/(?:--port[= ]|PORT=)(\d{2,5})/)
  if (match) return Number(match[1])
  switch (framework) {
    case 'Next':
      return 3000
    case 'Vite':
      return 5173
    case 'React':
      return 3000
    default:
      return 4000
  }
}

export function scanDirectory(root: string): DetectedProject[] {
  const results: DetectedProject[] = []

  function walk(dir: string, depth: number): void {
    if (depth > MAX_DEPTH || results.length >= MAX_RESULTS) return
    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      return
    }

    if (entries.includes('package.json')) {
      try {
        const pkgPath = join(dir, 'package.json')
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
        const framework = detectFramework(pkg)
        results.push({
          name: pkg.name ?? basename(dir),
          directory: dir,
          framework,
          port: guessPort(pkg, framework),
          command: guessCommand(pkg)
        })
      } catch {
        // ignore unreadable/invalid package.json
      }
      return
    }

    for (const entry of entries) {
      if (IGNORE_DIRS.has(entry) || entry.startsWith('.')) continue
      const full = join(dir, entry)
      let stat
      try {
        stat = statSync(full)
      } catch {
        continue
      }
      if (stat.isDirectory()) {
        walk(full, depth + 1)
      }
      if (results.length >= MAX_RESULTS) return
    }
  }

  walk(root, 0)
  return results
}
