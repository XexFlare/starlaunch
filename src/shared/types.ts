export type Framework = 'Vite' | 'React' | 'Next' | 'Express' | 'Node' | 'Empty' | 'Custom'

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun'

/** Mirrors the port blocks in the port registry plan (X:\Code\PORT_REGISTRY_PLAN.md). */
export type Category = 'Apps' | 'Tools' | 'Toys' | 'Customer Support AI Apps' | 'Websites' | 'Other'

export type ProjectStatus = 'stopped' | 'starting' | 'running' | 'building' | 'stopping' | 'error'

/**
 * Where a launch port came from:
 * - `project-config`: discovered inside the project's own files (env, vite.config, package.json scripts)
 * - `stored`: the port the user manually pinned in StarLaunch's project settings
 * - `auto-assigned`: neither of the above existed, so StarLaunch picked a free port
 */
export type PortSource = 'project-config' | 'stored' | 'auto-assigned'

export interface Project {
  id: string
  name: string
  directory: string
  /** Optional — a project without a pinned port is auto-detected/auto-assigned at launch time. */
  port?: number
  /**
   * Optional sub-folder (relative to `directory`, or absolute) whose config holds the port —
   * for monorepos where the start command runs at the root but vite.config/.env live in a package.
   */
  portConfigDirectory?: string
  command: string
  framework: Framework
  packageManager?: PackageManager
  category: Category
  favorite: boolean
  createdAt: number
}

export interface ProjectRuntimeStats {
  id: string
  status: ProjectStatus
  pid?: number
  startedAt?: number
  cpu?: number
  memoryMB?: number
  nodeVersion?: string
  url?: string
  lastError?: string
  /** The port actually in use for the current run — may differ from Project.port. */
  port?: number
  portSource?: PortSource
  portConflict?: boolean
}

export interface LogLine {
  id: number
  projectId: string
  stream: 'stdout' | 'stderr' | 'system'
  text: string
  timestamp: number
}

export interface AppSettings {
  defaultProjectRoot: string
  theme: 'nebula' | 'midnight' | 'aurora'
  backgroundIntensity: number
  animationsEnabled: boolean
  autoOpenBrowser: boolean
  rememberRunningApps: boolean
  launchAtStartup: boolean
  /** Add Project, registry Import and the AI API write CLAUDE.md + .starlaunch.json into the project. */
  writeAiFilesOnRegister: boolean
  registryEnabled: boolean
  registryPath: string
  aiIntegrationEnabled: boolean
  aiIntegrationPort: number
  aiIntegrationToken: string
}

export interface DetectedProject {
  name: string
  directory: string
  framework: Framework
  port: number
  command: string
}

export interface StoreShape {
  projects: Project[]
  settings: AppSettings
  runningIds?: string[]
  migratedLegacyStore?: boolean
}

export interface RegistryImportResult {
  imported: number
  skipped: number
  total: number
}

export interface RegistryGenerateResult {
  ok: boolean
  error?: string
}

/** Payload submitted by the Create Project wizard. */
export interface ProjectCreationInput {
  sessionId: string
  name: string
  parentFolder: string
  framework: Framework
  packageManager: PackageManager
  category: Category
  port?: number
  command: string
  createGitRepo: boolean
  openInVsCode: boolean
  launchAfterCreate: boolean
}

export interface ProjectCreationResult {
  ok: boolean
  project?: Project
  error?: string
  warnings?: string[]
}

export interface AiIntegrationStatus {
  running: boolean
  port: number
  enabled: boolean
  token: string
}

export interface AiFileGenerationResult {
  ok: boolean
  error?: string
}

export const DEFAULT_SETTINGS: AppSettings = {
  defaultProjectRoot: '',
  theme: 'nebula',
  backgroundIntensity: 0.8,
  animationsEnabled: true,
  autoOpenBrowser: false,
  rememberRunningApps: true,
  launchAtStartup: false,
  writeAiFilesOnRegister: true,
  registryEnabled: false,
  registryPath: '',
  aiIntegrationEnabled: false,
  aiIntegrationPort: 3003,
  aiIntegrationToken: ''
}

export const CATEGORIES: Category[] = ['Apps', 'Tools', 'Toys', 'Customer Support AI Apps', 'Websites', 'Other']

/** Port blocks from the port registry plan; a project's port tells us its category. */
const CATEGORY_PORT_BLOCKS: { from: number; to: number; category: Category }[] = [
  { from: 3000, to: 3099, category: 'Apps' },
  { from: 3200, to: 3299, category: 'Tools' },
  { from: 3300, to: 3599, category: 'Toys' },
  { from: 3700, to: 3799, category: 'Customer Support AI Apps' },
  { from: 5000, to: 5999, category: 'Websites' }
]

export function categoryForPort(port?: number): Category {
  if (port == null) return 'Other'
  return CATEGORY_PORT_BLOCKS.find((b) => port >= b.from && port <= b.to)?.category ?? 'Other'
}

/**
 * Accepts a category name in any casing (e.g. a registry section heading like
 * "APPS"); anything unrecognised, including the old industry categories,
 * falls back to the category of the project's port block.
 */
export function normalizeCategory(value: string | undefined, port?: number): Category {
  const match = CATEGORIES.find((c) => c.toLowerCase() === value?.trim().toLowerCase())
  return match && match !== 'Other' ? match : categoryForPort(port)
}

export const FRAMEWORKS: Framework[] = ['Vite', 'React', 'Next', 'Express', 'Node', 'Empty', 'Custom']

export const PACKAGE_MANAGERS: PackageManager[] = ['npm', 'pnpm', 'yarn', 'bun']
