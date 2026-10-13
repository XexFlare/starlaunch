import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc-channels'
import type {
  AiFileGenerationResult,
  AiIntegrationStatus,
  AppSettings,
  LogLine,
  Project,
  ProjectCreationInput,
  ProjectCreationResult,
  ProjectRuntimeStats,
  RegistryGenerateResult,
  RegistryImportResult
} from '../shared/types'

const api = {
  projects: {
    list: (): Promise<Project[]> => ipcRenderer.invoke(IPC.PROJECTS_LIST),
    add: (input: Omit<Project, 'id' | 'createdAt' | 'favorite'>): Promise<Project> =>
      ipcRenderer.invoke(IPC.PROJECT_ADD, input),
    update: (id: string, patch: Partial<Project>): Promise<Project> =>
      ipcRenderer.invoke(IPC.PROJECT_UPDATE, id, patch),
    delete: (id: string): Promise<boolean> => ipcRenderer.invoke(IPC.PROJECT_DELETE, id),
    toggleFavorite: (id: string): Promise<Project> => ipcRenderer.invoke(IPC.PROJECT_TOGGLE_FAVORITE, id),
    create: (input: ProjectCreationInput): Promise<ProjectCreationResult> =>
      ipcRenderer.invoke(IPC.PROJECT_CREATE, input),
    onRegistered: (cb: (project: Project) => void) => {
      const listener = (_e: unknown, project: Project): void => cb(project)
      ipcRenderer.on(IPC.PROJECT_REGISTERED_EVENT, listener)
      return (): void => {
        ipcRenderer.removeListener(IPC.PROJECT_REGISTERED_EVENT, listener)
      }
    },
    onCreateProgress: (cb: (sessionId: string, line: string) => void) => {
      const listener = (_e: unknown, sessionId: string, line: string): void => cb(sessionId, line)
      ipcRenderer.on(IPC.PROJECT_CREATE_PROGRESS_EVENT, listener)
      return (): void => {
        ipcRenderer.removeListener(IPC.PROJECT_CREATE_PROGRESS_EVENT, listener)
      }
    }
  },
  process: {
    start: (id: string): Promise<boolean> => ipcRenderer.invoke(IPC.PROCESS_START, id),
    stop: (id: string): Promise<boolean> => ipcRenderer.invoke(IPC.PROCESS_STOP, id),
    restart: (id: string): Promise<boolean> => ipcRenderer.invoke(IPC.PROCESS_RESTART, id),
    kill: (id: string): Promise<boolean> => ipcRenderer.invoke(IPC.PROCESS_KILL, id)
  },
  stats: {
    snapshot: (): Promise<Record<string, ProjectRuntimeStats>> => ipcRenderer.invoke(IPC.STATS_SNAPSHOT),
    onUpdate: (cb: (stats: Record<string, ProjectRuntimeStats>) => void) => {
      const listener = (_e: unknown, stats: Record<string, ProjectRuntimeStats>): void => cb(stats)
      ipcRenderer.on(IPC.STATS_UPDATE_EVENT, listener)
      return (): void => {
        ipcRenderer.removeListener(IPC.STATS_UPDATE_EVENT, listener)
      }
    }
  },
  logs: {
    get: (id: string): Promise<LogLine[]> => ipcRenderer.invoke(IPC.LOGS_GET, id),
    clear: (id: string): Promise<boolean> => ipcRenderer.invoke(IPC.LOGS_CLEAR, id),
    onAppend: (cb: (line: LogLine) => void) => {
      const listener = (_e: unknown, line: LogLine): void => cb(line)
      ipcRenderer.on(IPC.LOGS_APPEND_EVENT, listener)
      return (): void => {
        ipcRenderer.removeListener(IPC.LOGS_APPEND_EVENT, listener)
      }
    }
  },
  onStatusChanged: (cb: (id: string, status: string) => void) => {
    const listener = (_e: unknown, id: string, status: string): void => cb(id, status)
    ipcRenderer.on(IPC.PROJECT_STATUS_EVENT, listener)
    return (): void => {
      ipcRenderer.removeListener(IPC.PROJECT_STATUS_EVENT, listener)
    }
  },
  onLaunchNotice: (cb: (id: string, title: string, message: string) => void) => {
    const listener = (_e: unknown, id: string, title: string, message: string): void => cb(id, title, message)
    ipcRenderer.on(IPC.PROJECT_LAUNCH_NOTICE_EVENT, listener)
    return (): void => {
      ipcRenderer.removeListener(IPC.PROJECT_LAUNCH_NOTICE_EVENT, listener)
    }
  },
  dialog: {
    pickDirectory: (): Promise<string | null> => ipcRenderer.invoke(IPC.DIALOG_PICK_DIRECTORY),
    pickRegistryLocation: (): Promise<string | null> => ipcRenderer.invoke(IPC.DIALOG_PICK_REGISTRY_LOCATION),
    pickImportFile: (): Promise<string | null> => ipcRenderer.invoke(IPC.DIALOG_PICK_IMPORT_FILE)
  },
  fs: {
    scanDirectory: (root: string) => ipcRenderer.invoke(IPC.FS_SCAN_DIRECTORY, root)
  },
  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke(IPC.SETTINGS_GET),
    update: (patch: Partial<AppSettings>): Promise<AppSettings> => ipcRenderer.invoke(IPC.SETTINGS_UPDATE, patch)
  },
  registry: {
    generate: (): Promise<RegistryGenerateResult> => ipcRenderer.invoke(IPC.REGISTRY_GENERATE),
    import: (path: string): Promise<RegistryImportResult> => ipcRenderer.invoke(IPC.REGISTRY_IMPORT, path)
  },
  config: {
    generateAiFiles: (id: string): Promise<AiFileGenerationResult> =>
      ipcRenderer.invoke(IPC.CONFIG_GENERATE_AI_FILES, id)
  },
  aiIntegration: {
    getStatus: (): Promise<AiIntegrationStatus> => ipcRenderer.invoke(IPC.AI_INTEGRATION_STATUS),
    regenerateToken: (): Promise<AppSettings> => ipcRenderer.invoke(IPC.AI_INTEGRATION_REGENERATE_TOKEN)
  },
  shell: {
    openExternal: (url: string): Promise<boolean> => ipcRenderer.invoke(IPC.SHELL_OPEN_EXTERNAL, url)
  },
  clipboard: {
    write: (text: string): Promise<boolean> => ipcRenderer.invoke(IPC.CLIPBOARD_WRITE, text)
  },
  window: {
    minimize: (): Promise<void> => ipcRenderer.invoke(IPC.WINDOW_MINIMIZE),
    toggleMaximize: (): Promise<void> => ipcRenderer.invoke(IPC.WINDOW_TOGGLE_MAXIMIZE),
    close: (): Promise<void> => ipcRenderer.invoke(IPC.WINDOW_CLOSE),
    onMaximizedChange: (cb: (maximized: boolean) => void) => {
      const listener = (_e: unknown, maximized: boolean): void => cb(maximized)
      ipcRenderer.on(IPC.WINDOW_MAXIMIZED_EVENT, listener)
      return (): void => {
        ipcRenderer.removeListener(IPC.WINDOW_MAXIMIZED_EVENT, listener)
      }
    }
  }
}

contextBridge.exposeInMainWorld('StarLaunch', api)

export type StarLaunchApi = typeof api
