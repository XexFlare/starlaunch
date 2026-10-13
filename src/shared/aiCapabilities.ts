import type { LogLine, Project, ProjectRuntimeStats } from './types'

/**
 * The complete set of operations external AI integrations may perform.
 * This union is the security boundary: there is intentionally no
 * PROJECT_DELETE / PROJECT_REMOVE / PROJECT_UNREGISTER member. A capability
 * that doesn't exist in this type can never be requested, dispatched, or
 * exposed by any transport (HTTP, IPC, CLI, MCP, ...) — the restriction is
 * structural, not a runtime permission check that a bug could bypass.
 *
 * Deletion is only ever possible through the StarLaunch UI, after explicit
 * user confirmation (ConfigureProjectModal → Delete Project).
 */
export type AiCapability =
  | 'HEALTH_CHECK'
  | 'PROJECT_LIST'
  | 'PROJECT_READ'
  | 'PROJECT_REGISTER'
  | 'PROJECT_START'
  | 'PROJECT_STOP'
  | 'PROJECT_RESTART'
  | 'PROJECT_STATUS'
  | 'PROJECT_LOGS'
  | 'PROJECT_OPEN_URL'
  | 'PROJECT_COPY_URL'

export const AI_CAPABILITIES: AiCapability[] = [
  'HEALTH_CHECK',
  'PROJECT_LIST',
  'PROJECT_READ',
  'PROJECT_REGISTER',
  'PROJECT_START',
  'PROJECT_STOP',
  'PROJECT_RESTART',
  'PROJECT_STATUS',
  'PROJECT_LOGS',
  'PROJECT_OPEN_URL',
  'PROJECT_COPY_URL'
]

export interface AiHealthCheckResult {
  ok: true
  app: 'StarLaunch'
  version: string
  projectCount: number
  capabilities: AiCapability[]
}

/** Registering a project via the AI layer only records metadata for an
 *  existing directory — it mirrors the manual "Add Project" flow. It never
 *  scaffolds files; scaffolding (Create Project) is a StarLaunch-UI-only,
 *  human-initiated action. */
export interface AiRegisterProjectInput {
  name: string
  directory: string
  framework?: Project['framework']
  category?: Project['category']
  port?: number
  command?: string
}

export interface AiProjectSummary {
  project: Project
  stats: ProjectRuntimeStats
}

export interface AiLogsResult {
  projectId: string
  lines: LogLine[]
}
