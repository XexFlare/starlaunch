import { app, shell, BrowserWindow, ipcMain, dialog, clipboard, Menu } from 'electron'
import { spawn } from 'child_process'
import { join, normalize } from 'path'
import { is } from '@electron-toolkit/utils'
import { IPC } from '../shared/ipc-channels'
import { store } from './store'
import { processManager } from './processManager'
import { scanDirectory } from './fsScanner'
import { generateRegistry, readRegistry, writeRegistry } from './registryService'
import { writeInitialAiFiles, syncStarlaunchJson } from './configManager'
import { scaffoldProject } from './projectCreator'
import { createAiIntegrationLayer } from './aiIntegrationLayer'
import { aiHttpServer, generateAiIntegrationToken } from './aiHttpServer'
import type {
  AppSettings,
  Project,
  ProjectCreationInput,
  ProjectCreationResult,
  RegistryGenerateResult,
  RegistryImportResult
} from '../shared/types'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1180,
    minHeight: 760,
    show: false,
    frame: false,
    backgroundColor: '#04050c',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  Menu.setApplicationMenu(null)

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('maximize', () => broadcast(IPC.WINDOW_MAXIMIZED_EVENT, true))
  mainWindow.on('unmaximize', () => broadcast(IPC.WINDOW_MAXIMIZED_EVENT, false))

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function broadcast(channel: string, ...args: unknown[]): void {
  mainWindow?.webContents.send(channel, ...args)
}

function normalizeDir(dir: string): string {
  return normalize(dir.trim()).replace(/[\\/]+$/, '').toLowerCase()
}

function writeRegistryNow(path: string): void {
  const content = generateRegistry(store.getProjects(), (id) => processManager.getStats(id))
  writeRegistry(path, content)
}

function regenerateRegistryIfEnabled(): void {
  const settings = store.getSettings()
  if (settings.registryEnabled && settings.registryPath) {
    writeRegistryNow(settings.registryPath)
  }
}

const aiIntegrationLayer = createAiIntegrationLayer({
  onProjectRegistered: () => regenerateRegistryIfEnabled()
})
aiHttpServer.bind(aiIntegrationLayer)

function registerIpc(): void {
  ipcMain.handle(IPC.PROJECTS_LIST, () => store.getProjects())

  ipcMain.handle(IPC.PROJECT_ADD, (_e, input: Omit<Project, 'id' | 'createdAt' | 'favorite'>) => {
    const project = store.addProject(input)
    regenerateRegistryIfEnabled()
    return project
  })

  ipcMain.handle(IPC.PROJECT_UPDATE, (_e, id: string, patch: Partial<Project>) => {
    const updated = store.updateProject(id, patch)
    if (updated) syncStarlaunchJson(updated)
    regenerateRegistryIfEnabled()
    return updated
  })

  ipcMain.handle(IPC.PROJECT_DELETE, (_e, id: string) => {
    if (processManager.isRunning(id)) processManager.kill(id)
    store.deleteProject(id)
    regenerateRegistryIfEnabled()
    return true
  })

  ipcMain.handle(IPC.PROJECT_TOGGLE_FAVORITE, (_e, id: string) => {
    const updated = store.toggleFavorite(id)
    regenerateRegistryIfEnabled()
    return updated
  })

  ipcMain.handle(IPC.PROCESS_START, (_e, id: string) => {
    const project = store.getProjects().find((p) => p.id === id)
    if (!project) return false
    processManager.start(project)
    return true
  })

  ipcMain.handle(IPC.PROCESS_STOP, (_e, id: string) => {
    processManager.stop(id)
    return true
  })

  ipcMain.handle(IPC.PROCESS_RESTART, (_e, id: string) => {
    const project = store.getProjects().find((p) => p.id === id)
    if (!project) return false
    processManager.restart(project)
    return true
  })

  ipcMain.handle(IPC.PROCESS_KILL, (_e, id: string) => {
    processManager.kill(id)
    return true
  })

  ipcMain.handle(IPC.STATS_SNAPSHOT, () => processManager.getAllStats())

  ipcMain.handle(IPC.LOGS_GET, (_e, id: string) => processManager.getLogs(id))
  ipcMain.handle(IPC.LOGS_CLEAR, (_e, id: string) => {
    processManager.clearLogs(id)
    return true
  })

  ipcMain.handle(IPC.DIALOG_PICK_DIRECTORY, async () => {
    if (!mainWindow) return null
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle(IPC.FS_SCAN_DIRECTORY, (_e, root: string) => {
    return scanDirectory(root)
  })

  ipcMain.handle(IPC.DIALOG_PICK_REGISTRY_LOCATION, async () => {
    if (!mainWindow) return null
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Choose Registry File Location',
      defaultPath: store.getSettings().registryPath || 'StarLaunch-registry.txt',
      filters: [{ name: 'Text Files', extensions: ['txt'] }],
      properties: ['createDirectory']
    })
    if (result.canceled || !result.filePath) return null
    return result.filePath
  })

  ipcMain.handle(IPC.DIALOG_PICK_IMPORT_FILE, async () => {
    if (!mainWindow) return null
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Import Registry File',
      filters: [{ name: 'Text Files', extensions: ['txt'] }],
      properties: ['openFile']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle(IPC.REGISTRY_GENERATE, (): RegistryGenerateResult => {
    const settings = store.getSettings()
    if (!settings.registryPath) return { ok: false, error: 'No registry file location is set.' }
    try {
      writeRegistryNow(settings.registryPath)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
  })

  ipcMain.handle(IPC.REGISTRY_IMPORT, (_e, path: string): RegistryImportResult => {
    const entries = readRegistry(path)
    const known = new Set(store.getProjects().map((p) => normalizeDir(p.directory)))

    let imported = 0
    let skipped = 0
    for (const entry of entries) {
      const key = normalizeDir(entry.directory)
      if (known.has(key)) {
        skipped++
        continue
      }
      store.addProject({
        name: entry.name,
        directory: entry.directory,
        port: entry.port,
        command: entry.command ?? 'npm run dev',
        framework: entry.framework ?? 'Custom',
        category: entry.category ?? 'Other'
      })
      known.add(key)
      imported++
    }

    regenerateRegistryIfEnabled()
    return { imported, skipped, total: entries.length }
  })

  ipcMain.handle(IPC.PROJECT_CREATE, async (_e, input: ProjectCreationInput): Promise<ProjectCreationResult> => {
    const warnings: string[] = []
    const onProgress = (line: string): void => broadcast(IPC.PROJECT_CREATE_PROGRESS_EVENT, input.sessionId, line)

    let scaffold: Awaited<ReturnType<typeof scaffoldProject>>
    try {
      scaffold = await scaffoldProject(input, onProgress)
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }

    const project = store.addProject({
      name: input.name.trim(),
      directory: scaffold.directory,
      port: input.port,
      command: input.command,
      framework: input.framework,
      packageManager: input.packageManager,
      category: input.category
    })

    writeInitialAiFiles(project)
    onProgress('Generated CLAUDE.md and .starlaunch.json.')
    regenerateRegistryIfEnabled()

    if (input.launchAfterCreate) {
      onProgress('Launching project...')
      processManager.start(project)
    }

    if (input.openInVsCode) {
      try {
        spawn('code', [project.directory], { shell: true, detached: true, stdio: 'ignore', windowsHide: true }).unref()
        onProgress('Opened in VS Code.')
      } catch (err) {
        warnings.push(`Could not open VS Code: ${(err as Error).message}`)
      }
    }

    return { ok: true, project, warnings: warnings.length > 0 ? warnings : undefined }
  })

  ipcMain.handle(IPC.CONFIG_GENERATE_AI_FILES, (_e, id: string) => {
    const project = store.getProjects().find((p) => p.id === id)
    if (!project) return { ok: false, error: 'Project not found' }
    writeInitialAiFiles(project)
    return { ok: true }
  })

  ipcMain.handle(IPC.AI_INTEGRATION_STATUS, () => {
    const settings = store.getSettings()
    return {
      ...aiHttpServer.getState(),
      enabled: settings.aiIntegrationEnabled,
      token: settings.aiIntegrationToken
    }
  })

  ipcMain.handle(IPC.AI_INTEGRATION_REGENERATE_TOKEN, () => {
    const token = generateAiIntegrationToken()
    const updated = store.updateSettings({ aiIntegrationToken: token })
    aiHttpServer.applySettings(updated)
    return updated
  })

  ipcMain.handle(IPC.SETTINGS_GET, () => store.getSettings())
  ipcMain.handle(IPC.SETTINGS_UPDATE, (_e, patch: Partial<AppSettings>) => {
    let merged = { ...patch }
    if (merged.aiIntegrationEnabled && !store.getSettings().aiIntegrationToken && !merged.aiIntegrationToken) {
      merged = { ...merged, aiIntegrationToken: generateAiIntegrationToken() }
    }
    const updated = store.updateSettings(merged)
    app.setLoginItemSettings({ openAtLogin: updated.launchAtStartup })
    aiHttpServer.applySettings(updated)
    return updated
  })

  ipcMain.handle(IPC.SHELL_OPEN_EXTERNAL, (_e, url: string) => {
    shell.openExternal(url)
    return true
  })

  ipcMain.handle(IPC.CLIPBOARD_WRITE, (_e, text: string) => {
    clipboard.writeText(text)
    return true
  })

  ipcMain.handle(IPC.WINDOW_MINIMIZE, () => mainWindow?.minimize())
  ipcMain.handle(IPC.WINDOW_TOGGLE_MAXIMIZE, () => {
    if (!mainWindow) return
    if (mainWindow.isMaximized()) mainWindow.unmaximize()
    else mainWindow.maximize()
  })
  ipcMain.handle(IPC.WINDOW_CLOSE, () => mainWindow?.close())

  processManager.on('log', (entry) => broadcast(IPC.LOGS_APPEND_EVENT, entry))
  processManager.on('status', (id, status) => {
    broadcast(IPC.PROJECT_STATUS_EVENT, id, status)
    const runningIds = store.getProjects().filter((p) => processManager.isRunning(p.id)).map((p) => p.id)
    store.setRunningIds(runningIds)
    regenerateRegistryIfEnabled()
  })
  processManager.on('stats-tick', (stats) => broadcast(IPC.STATS_UPDATE_EVENT, stats))
  processManager.on('launch-notice', (id, title, message) => {
    broadcast(IPC.PROJECT_LAUNCH_NOTICE_EVENT, id, title, message)
  })
}

app.whenReady().then(() => {
  registerIpc()
  createWindow()

  const settings = store.getSettings()
  app.setLoginItemSettings({ openAtLogin: settings.launchAtStartup })
  aiHttpServer.applySettings(settings)

  if (settings.rememberRunningApps) {
    const runningIds = store.getRunningIds()
    const projects = store.getProjects()
    for (const id of runningIds) {
      const project = projects.find((p) => p.id === id)
      if (project) processManager.start(project)
    }
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  processManager.shutdownAll()
  aiHttpServer.stop()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  processManager.shutdownAll()
  aiHttpServer.stop()
})
