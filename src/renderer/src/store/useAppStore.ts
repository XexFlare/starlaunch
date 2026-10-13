import { create } from 'zustand'
import type {
  AppSettings,
  LogLine,
  Project,
  ProjectCreationInput,
  ProjectCreationResult,
  ProjectRuntimeStats,
  ProjectStatus
} from '@shared/types'
import { DEFAULT_SETTINGS } from '@shared/types'

export interface Toast {
  id: number
  message: string
  kind: 'success' | 'error' | 'info'
  title?: string
}

interface AppState {
  ready: boolean
  projects: Project[]
  stats: Record<string, ProjectRuntimeStats>
  settings: AppSettings
  searchQuery: string
  category: string | null
  addModalOpen: boolean
  createModalOpen: boolean
  creating: boolean
  createProgress: string[]
  settingsModalOpen: boolean
  logConsoleOpen: boolean
  activeLogProjectId: string | null
  logsByProject: Record<string, LogLine[]>
  toasts: Toast[]

  bootstrap: () => Promise<void>
  refreshProjects: () => Promise<void>
  setSearch: (q: string) => void
  setCategory: (c: string | null) => void
  openAddModal: () => void
  closeAddModal: () => void
  openCreateModal: () => void
  closeCreateModal: () => void
  openSettings: () => void
  closeSettings: () => void
  toggleLogConsole: (projectId?: string | null) => void

  addProject: (input: Omit<Project, 'id' | 'createdAt' | 'favorite'>) => Promise<void>
  createProject: (input: Omit<ProjectCreationInput, 'sessionId'>) => Promise<ProjectCreationResult>
  deleteProject: (id: string) => Promise<void>
  toggleFavorite: (id: string) => Promise<void>
  updateProject: (id: string, patch: Partial<Project>) => Promise<void>

  startProject: (id: string) => Promise<void>
  stopProject: (id: string) => Promise<void>
  restartProject: (id: string) => Promise<void>
  killProject: (id: string) => Promise<void>

  copyUrl: (port: number) => Promise<void>
  openInBrowser: (port: number) => Promise<void>

  updateSettings: (patch: Partial<AppSettings>) => Promise<void>

  clearLogs: (id: string) => Promise<void>
  pushToast: (message: string, kind?: Toast['kind'], title?: string) => void
  dismissToast: (id: number) => void
}

let toastSeq = 0
let listenersRegistered = false
let activeCreateSessionId: string | null = null

export const useAppStore = create<AppState>((set, get) => ({
  ready: false,
  projects: [],
  stats: {},
  settings: DEFAULT_SETTINGS,
  searchQuery: '',
  category: null,
  addModalOpen: false,
  createModalOpen: false,
  creating: false,
  createProgress: [],
  settingsModalOpen: false,
  logConsoleOpen: false,
  activeLogProjectId: null,
  logsByProject: {},
  toasts: [],

  bootstrap: async () => {
    const [projects, settings, stats] = await Promise.all([
      window.StarLaunch.projects.list(),
      window.StarLaunch.settings.get(),
      window.StarLaunch.stats.snapshot()
    ])
    set({ projects, settings, stats, ready: true })

    if (listenersRegistered) return
    listenersRegistered = true

    window.StarLaunch.onStatusChanged((id, status) => {
      set((state) => ({
        stats: {
          ...state.stats,
          [id]: { ...(state.stats[id] ?? { id }), id, status: status as ProjectStatus }
        }
      }))
    })

    window.StarLaunch.stats.onUpdate((incoming) => {
      set((state) => ({ stats: { ...state.stats, ...incoming } }))
    })

    window.StarLaunch.logs.onAppend((line) => {
      set((state) => {
        const existing = state.logsByProject[line.projectId] ?? []
        const next = [...existing, line]
        if (next.length > 3000) next.splice(0, next.length - 3000)
        return { logsByProject: { ...state.logsByProject, [line.projectId]: next } }
      })
    })

    window.StarLaunch.onLaunchNotice((_id, title, message) => {
      get().pushToast(message, 'info', title)
    })

    window.StarLaunch.projects.onRegistered((project) => {
      set((state) =>
        state.projects.some((p) => p.id === project.id) ? state : { projects: [...state.projects, project] }
      )
      get().pushToast(`${project.name} was registered by an AI assistant`, 'success', 'Project added')
    })

    window.StarLaunch.projects.onCreateProgress((sessionId, line) => {
      if (sessionId !== activeCreateSessionId) return
      set((state) => ({ createProgress: [...state.createProgress, line] }))
    })
  },

  refreshProjects: async () => {
    const projects = await window.StarLaunch.projects.list()
    set({ projects })
  },

  setSearch: (q) => set({ searchQuery: q }),
  setCategory: (c) => set({ category: c }),
  openAddModal: () => set({ addModalOpen: true }),
  closeAddModal: () => set({ addModalOpen: false }),
  openCreateModal: () => set({ createModalOpen: true, createProgress: [] }),
  closeCreateModal: () => {
    activeCreateSessionId = null
    set({ createModalOpen: false, creating: false, createProgress: [] })
  },
  openSettings: () => set({ settingsModalOpen: true }),
  closeSettings: () => set({ settingsModalOpen: false }),
  toggleLogConsole: (projectId) =>
    set((state) => {
      if (projectId) {
        if (!state.logsByProject[projectId]) {
          window.StarLaunch.logs.get(projectId).then((lines) => {
            set((s) => ({ logsByProject: { ...s.logsByProject, [projectId]: lines } }))
          })
        }
        return { logConsoleOpen: true, activeLogProjectId: projectId }
      }
      return { logConsoleOpen: !state.logConsoleOpen }
    }),

  addProject: async (input) => {
    const project = await window.StarLaunch.projects.add(input)
    set((state) => ({ projects: [...state.projects, project] }))
    get().pushToast(`${project.name} added`, 'success')
  },

  createProject: async (input) => {
    const sessionId = crypto.randomUUID()
    activeCreateSessionId = sessionId
    set({ creating: true, createProgress: [] })

    const result = await window.StarLaunch.projects.create({ ...input, sessionId })

    set({ creating: false })
    if (result.ok && result.project) {
      set((state) => ({ projects: [...state.projects, result.project as Project] }))
      get().pushToast(`${result.project.name} created`, 'success')
      for (const warning of result.warnings ?? []) get().pushToast(warning, 'info')
    } else {
      get().pushToast(result.error ?? 'Project creation failed', 'error')
    }
    return result
  },

  deleteProject: async (id) => {
    const project = get().projects.find((p) => p.id === id)
    await window.StarLaunch.projects.delete(id)
    set((state) => ({ projects: state.projects.filter((p) => p.id !== id) }))
    if (project) get().pushToast(`${project.name} removed`, 'info')
  },

  toggleFavorite: async (id) => {
    const updated = await window.StarLaunch.projects.toggleFavorite(id)
    if (!updated) return
    set((state) => ({ projects: state.projects.map((p) => (p.id === id ? updated : p)) }))
  },

  updateProject: async (id, patch) => {
    const updated = await window.StarLaunch.projects.update(id, patch)
    if (!updated) return
    set((state) => ({ projects: state.projects.map((p) => (p.id === id ? updated : p)) }))
    get().pushToast(`${updated.name} updated`, 'success')
  },

  startProject: async (id) => {
    const project = get().projects.find((p) => p.id === id)
    set((state) => ({ stats: { ...state.stats, [id]: { ...(state.stats[id] ?? { id }), id, status: 'starting' } } }))
    await window.StarLaunch.process.start(id)
    if (project) get().pushToast(`Starting ${project.name}…`, 'info')
  },

  stopProject: async (id) => {
    await window.StarLaunch.process.stop(id)
  },

  restartProject: async (id) => {
    const project = get().projects.find((p) => p.id === id)
    await window.StarLaunch.process.restart(id)
    if (project) get().pushToast(`Restarting ${project.name}…`, 'info')
  },

  killProject: async (id) => {
    await window.StarLaunch.process.kill(id)
  },

  copyUrl: async (port) => {
    const url = `http://localhost:${port}`
    await window.StarLaunch.clipboard.write(url)
    get().pushToast('URL copied to clipboard', 'success')
  },

  openInBrowser: async (port) => {
    await window.StarLaunch.shell.openExternal(`http://localhost:${port}`)
  },

  updateSettings: async (patch) => {
    const updated = await window.StarLaunch.settings.update(patch)
    set({ settings: updated })
  },

  clearLogs: async (id) => {
    await window.StarLaunch.logs.clear(id)
    set((state) => ({ logsByProject: { ...state.logsByProject, [id]: [] } }))
  },

  pushToast: (message, kind = 'info', title) => {
    const id = ++toastSeq
    set((state) => ({ toasts: [...state.toasts, { id, message, kind, title }] }))
    setTimeout(() => get().dismissToast(id), 3200)
  },

  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
}))
