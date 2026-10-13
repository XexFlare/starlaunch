export type Framework = 'Vite' | 'React' | 'Next' | 'Express' | 'Node' | 'Empty' | 'Custom'

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun'

export type Category =
  | 'Shipping'
  | 'Agriculture'
  | 'Manufacturing'
  | 'Games'
  | 'Finance'
  | 'Personal'
  | 'Development'
  | 'Other'

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
  registryEnabled: false,
  registryPath: '',
  aiIntegrationEnabled: false,
  aiIntegrationPort: 4317,
  aiIntegrationToken: ''
}

export const CATEGORIES: Category[] = [
  'Shipping',
  'Agriculture',
  'Manufacturing',
  'Games',
  'Finance',
  'Personal',
  'Development',
  'Other'
]

export const FRAMEWORKS: Framework[] = ['Vite', 'React', 'Next', 'Express', 'Node', 'Empty', 'Custom']

export const PACKAGE_MANAGERS: PackageManager[] = ['npm', 'pnpm', 'yarn', 'bun']
