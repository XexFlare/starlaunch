import { existsSync } from 'fs'
import { app, clipboard, shell } from 'electron'
import { store } from './store'
import { processManager } from './processManager'
import type { Project, ProjectRuntimeStats } from '../shared/types'
import { normalizeCategory } from '../shared/types'
import { AI_CAPABILITIES } from '../shared/aiCapabilities'
import type {
  AiHealthCheckResult,
  AiLogsResult,
  AiProjectSummary,
  AiRegisterProjectInput
} from '../shared/aiCapabilities'

export interface AiIntegrationHooks {
  /** Fired after a project is registered through the AI layer (not the scaffolding wizard). */
  onProjectRegistered?: (project: Project) => void
}

function findProject(id: string): Project | undefined {
  return store.getProjects().find((p) => p.id === id)
}

function summarize(project: Project): AiProjectSummary {
  return { project, stats: processManager.getStats(project.id) }
}

function resolveUrl(project: Project): string | null {
  const stats = processManager.getStats(project.id)
  const port = stats.port ?? project.port
  return port != null ? `http://localhost:${port}` : null
}

/**
 * The transport-independent core of StarLaunch's AI integration: one plain
 * function per capability in AiCapability. Any transport (HTTP, IPC, a future
 * CLI or MCP server) calls into the same instance, so every integration
 * automatically inherits the same behavior and the same missing capabilities
 * — there is no delete/remove/unregister function here to expose, by design.
 */
export function createAiIntegrationLayer(hooks: AiIntegrationHooks = {}) {
  return {
    healthCheck(): AiHealthCheckResult {
      return {
        ok: true,
        app: 'StarLaunch',
        version: app.getVersion(),
        projectCount: store.getProjects().length,
        capabilities: AI_CAPABILITIES
      }
    },

    listProjects(): AiProjectSummary[] {
      return store.getProjects().map(summarize)
    },

    readProject(id: string): AiProjectSummary | null {
      const project = findProject(id)
      return project ? summarize(project) : null
    },

    registerProject(input: AiRegisterProjectInput): Project {
      if (!input.directory || !existsSync(input.directory)) {
        throw new Error(`Directory does not exist: ${input.directory}`)
      }
      const project = store.addProject({
        name: input.name,
        directory: input.directory,
        framework: input.framework ?? 'Custom',
        category: normalizeCategory(input.category, input.port),
        port: input.port,
        command: input.command ?? 'npm run dev'
      })
      hooks.onProjectRegistered?.(project)
      return project
    },

    async startProject(id: string): Promise<boolean> {
      const project = findProject(id)
      if (!project) return false
      await processManager.start(project)
      return true
    },

    stopProject(id: string): boolean {
      if (!findProject(id)) return false
      processManager.stop(id)
      return true
    },

    restartProject(id: string): boolean {
      const project = findProject(id)
      if (!project) return false
      processManager.restart(project)
      return true
    },

    getStatus(id: string): ProjectRuntimeStats | null {
      return findProject(id) ? processManager.getStats(id) : null
    },

    getLogs(id: string, limit = 200): AiLogsResult | null {
      if (!findProject(id)) return null
      const lines = processManager.getLogs(id)
      return { projectId: id, lines: lines.slice(-Math.max(1, limit)) }
    },

    openUrl(id: string): boolean {
      const project = findProject(id)
      const url = project ? resolveUrl(project) : null
      if (!url) return false
      shell.openExternal(url)
      return true
    },

    copyUrl(id: string): boolean {
      const project = findProject(id)
      const url = project ? resolveUrl(project) : null
      if (!url) return false
      clipboard.writeText(url)
      return true
    }
  }
}

export type AiIntegrationLayer = ReturnType<typeof createAiIntegrationLayer>
