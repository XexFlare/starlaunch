import { app } from 'electron'
import { join } from 'path'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs'
import { randomUUID } from 'crypto'
import type { AppSettings, Project, StoreShape } from '../shared/types'
import { DEFAULT_SETTINGS, normalizeCategory } from '../shared/types'

const STORE_FILE = () => join(app.getPath('userData'), 'StarLaunch-store.json')

// StarLaunch was renamed from DevDock, which changes Electron's userData
// path. Pull any projects the user already configured under the old name
// forward, once, so the rename doesn't look like data loss.
const LEGACY_STORE_FILE = () => join(app.getPath('userData'), '..', 'devdock', 'devdock-store.json')

function migrateLegacyProjects(data: StoreShape): StoreShape {
  const legacyFile = LEGACY_STORE_FILE()
  if (!existsSync(legacyFile)) return { ...data, migratedLegacyStore: true }
  try {
    const legacy = JSON.parse(readFileSync(legacyFile, 'utf-8')) as Partial<StoreShape>
    const existingDirs = new Set(data.projects.map((p) => p.directory))
    const imported = (legacy.projects ?? []).filter((p) => !existingDirs.has(p.directory))
    return { ...data, projects: [...data.projects, ...imported], migratedLegacyStore: true }
  } catch {
    return { ...data, migratedLegacyStore: true }
  }
}

function readStore(): StoreShape {
  const file = STORE_FILE()
  let data: StoreShape
  if (!existsSync(file)) {
    data = { projects: [], settings: DEFAULT_SETTINGS, runningIds: [] }
  } else {
    try {
      const raw = readFileSync(file, 'utf-8')
      const parsed = JSON.parse(raw) as Partial<StoreShape>
      data = {
        // Older stores used industry categories; move them onto the port-block categories.
        projects: (parsed.projects ?? []).map((p) => ({ ...p, category: normalizeCategory(p.category, p.port) })),
        settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
        runningIds: parsed.runningIds ?? [],
        migratedLegacyStore: parsed.migratedLegacyStore ?? false
      }
    } catch {
      data = { projects: [], settings: DEFAULT_SETTINGS, runningIds: [] }
    }
  }

  if (!data.migratedLegacyStore) {
    data = migrateLegacyProjects(data)
    writeStore(data)
  }

  return data
}

function writeStore(data: StoreShape): void {
  const file = STORE_FILE()
  mkdirSync(join(file, '..'), { recursive: true })
  writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8')
}

class Store {
  private data: StoreShape

  constructor() {
    this.data = readStore()
  }

  private persist(): void {
    writeStore(this.data)
  }

  getProjects(): Project[] {
    return this.data.projects
  }

  getSettings(): AppSettings {
    return this.data.settings
  }

  updateSettings(patch: Partial<AppSettings>): AppSettings {
    this.data.settings = { ...this.data.settings, ...patch }
    this.persist()
    return this.data.settings
  }

  addProject(input: Omit<Project, 'id' | 'createdAt' | 'favorite'> & { favorite?: boolean }): Project {
    const project: Project = {
      id: randomUUID(),
      favorite: input.favorite ?? false,
      createdAt: Date.now(),
      ...input
    }
    this.data.projects.push(project)
    this.persist()
    return project
  }

  updateProject(id: string, patch: Partial<Project>): Project | undefined {
    const idx = this.data.projects.findIndex((p) => p.id === id)
    if (idx === -1) return undefined
    this.data.projects[idx] = { ...this.data.projects[idx], ...patch, id }
    this.persist()
    return this.data.projects[idx]
  }

  deleteProject(id: string): void {
    this.data.projects = this.data.projects.filter((p) => p.id !== id)
    this.persist()
  }

  toggleFavorite(id: string): Project | undefined {
    const p = this.data.projects.find((p) => p.id === id)
    if (!p) return undefined
    p.favorite = !p.favorite
    this.persist()
    return p
  }

  setRunningIds(ids: string[]): void {
    this.data.runningIds = ids
    this.persist()
  }

  getRunningIds(): string[] {
    return this.data.runningIds ?? []
  }
}

export const store = new Store()
