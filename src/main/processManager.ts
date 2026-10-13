import { spawn, type ChildProcess, execFile } from 'child_process'
import { createConnection } from 'net'
import { EventEmitter } from 'events'
import treeKill from 'tree-kill'
import pidusage from 'pidusage'
import pidtree from 'pidtree'
import type { LogLine, PortSource, Project, ProjectRuntimeStats, ProjectStatus } from '../shared/types'
import { buildLaunchCommand, resolveLaunchPort } from './portManager'

const MAX_LOG_LINES = 3000
const STATS_INTERVAL_MS = 2500
const PORT_POLL_INTERVAL_MS = 500
const PORT_POLL_TIMEOUT_MS = 30000

interface RunningEntry {
  project: Project
  proc: ChildProcess
  pid: number
  port: number
  portSource: PortSource
  portConflict: boolean
  startedAt: number
  status: ProjectStatus
  cpu: number
  memoryMB: number
  portPollTimer?: NodeJS.Timeout
  lastError?: string
}

let cachedNodeVersion = ''
execFile('node', ['-v'], { shell: true }, (err, stdout) => {
  if (!err) cachedNodeVersion = stdout.trim()
})

class ProcessManager extends EventEmitter {
  private running = new Map<string, RunningEntry>()
  private logs = new Map<string, LogLine[]>()
  private logSeq = 0
  private statsTimer?: NodeJS.Timeout

  constructor() {
    super()
    this.statsTimer = setInterval(() => this.pollStats(), STATS_INTERVAL_MS)
  }

  isRunning(id: string): boolean {
    return this.running.has(id)
  }

  getStats(id: string): ProjectRuntimeStats {
    const entry = this.running.get(id)
    if (!entry) {
      return { id, status: 'stopped' }
    }
    return {
      id,
      status: entry.status,
      pid: entry.pid,
      startedAt: entry.startedAt,
      cpu: entry.cpu,
      memoryMB: entry.memoryMB,
      nodeVersion: cachedNodeVersion,
      url: `http://localhost:${entry.port}`,
      lastError: entry.lastError,
      port: entry.port,
      portSource: entry.portSource,
      portConflict: entry.portConflict
    }
  }

  getAllStats(): Record<string, ProjectRuntimeStats> {
    const out: Record<string, ProjectRuntimeStats> = {}
    for (const [id] of this.running) out[id] = this.getStats(id)
    return out
  }

  getLogs(id: string): LogLine[] {
    return this.logs.get(id) ?? []
  }

  clearLogs(id: string): void {
    this.logs.set(id, [])
  }

  private appendLog(id: string, stream: LogLine['stream'], text: string): void {
    const lines = this.logs.get(id) ?? []
    const entry: LogLine = { id: ++this.logSeq, projectId: id, stream, text, timestamp: Date.now() }
    lines.push(entry)
    if (lines.length > MAX_LOG_LINES) lines.splice(0, lines.length - MAX_LOG_LINES)
    this.logs.set(id, lines)
    this.emit('log', entry)
  }

  private setStatus(id: string, status: ProjectStatus, lastError?: string): void {
    const entry = this.running.get(id)
    if (entry) {
      entry.status = status
      if (lastError) entry.lastError = lastError
    }
    this.emit('status', id, status)
  }

  async start(project: Project): Promise<void> {
    if (this.running.has(project.id)) return

    const reservedPorts = new Set<number>()
    for (const [, running] of this.running) reservedPorts.add(running.port)

    let resolution
    try {
      resolution = await resolveLaunchPort(project, reservedPorts)
    } catch (err) {
      this.appendLog(project.id, 'system', `Port resolution failed: ${(err as Error).message}`)
      this.setStatus(project.id, 'error', 'Could not find an available port')
      return
    }

    // Another start() for the same project may have landed while we awaited port resolution.
    if (this.running.has(project.id)) return

    this.appendLog(project.id, 'system', resolution.message)
    this.emit('launch-notice', project.id, project.name, resolution.message)

    const { command, env } = buildLaunchCommand(project, resolution.port)
    this.appendLog(project.id, 'system', `$ ${command}  (cwd: ${project.directory})`)

    const child = spawn(command, {
      cwd: project.directory,
      shell: true,
      windowsHide: true,
      env: { ...process.env, FORCE_COLOR: '1', ...env }
    })

    if (!child.pid) {
      this.appendLog(project.id, 'system', 'Failed to start process — no PID returned.')
      this.setStatus(project.id, 'error', 'Failed to start process')
      return
    }

    const entry: RunningEntry = {
      project,
      proc: child,
      pid: child.pid,
      port: resolution.port,
      portSource: resolution.source,
      portConflict: resolution.conflict,
      startedAt: Date.now(),
      status: 'starting',
      cpu: 0,
      memoryMB: 0
    }
    this.running.set(project.id, entry)
    this.setStatus(project.id, 'starting')

    child.stdout?.on('data', (buf: Buffer) => {
      this.pushChunk(project.id, 'stdout', buf.toString())
    })
    child.stderr?.on('data', (buf: Buffer) => {
      this.pushChunk(project.id, 'stderr', buf.toString())
    })

    child.on('exit', (code, signal) => {
      const wasStopping = entry.status === 'stopping'
      this.appendLog(
        project.id,
        'system',
        `Process exited (code ${code ?? 'null'}${signal ? `, signal ${signal}` : ''})`
      )
      this.clearPortPoll(entry)
      this.running.delete(project.id)
      this.setStatus(project.id, wasStopping || code === 0 ? 'stopped' : 'error', code !== 0 ? `Exited with code ${code}` : undefined)
    })

    child.on('error', (err) => {
      this.appendLog(project.id, 'system', `Process error: ${err.message}`)
      this.setStatus(project.id, 'error', err.message)
    })

    this.pollForPort(entry)
  }

  private pushChunk(id: string, stream: 'stdout' | 'stderr', chunk: string): void {
    const text = chunk.replace(/\r\n/g, '\n')
    for (const rawLine of text.split('\n')) {
      if (rawLine.length === 0) continue
      this.appendLog(id, stream, rawLine)
    }
  }

  private pollForPort(entry: RunningEntry): void {
    const projectId = entry.project.id
    const start = Date.now()
    const attempt = (): void => {
      if (!this.running.has(projectId)) return
      const socket = createConnection({ port: entry.port, host: '127.0.0.1' })
      const cleanup = (): void => {
        socket.removeAllListeners()
        socket.destroy()
      }
      socket.once('connect', () => {
        cleanup()
        if (this.running.has(projectId)) {
          this.setStatus(projectId, 'running')
        }
      })
      socket.once('error', () => {
        cleanup()
        if (Date.now() - start > PORT_POLL_TIMEOUT_MS) {
          if (this.running.has(projectId) && entry.status === 'starting') {
            this.setStatus(projectId, 'running')
          }
          return
        }
        entry.portPollTimer = setTimeout(attempt, PORT_POLL_INTERVAL_MS)
      })
    }
    attempt()
  }

  private clearPortPoll(entry: RunningEntry): void {
    if (entry.portPollTimer) clearTimeout(entry.portPollTimer)
  }

  stop(id: string): void {
    const entry = this.running.get(id)
    if (!entry) return
    this.setStatus(id, 'stopping')
    this.clearPortPoll(entry)
    treeKill(entry.pid, 'SIGTERM', () => {
      // exit handler will finalize state; fall back to force kill if still alive after grace period
      setTimeout(() => {
        if (this.running.has(id)) {
          treeKill(entry.pid, 'SIGKILL')
        }
      }, 4000)
    })
  }

  kill(id: string): void {
    const entry = this.running.get(id)
    if (!entry) return
    this.setStatus(id, 'stopping')
    this.clearPortPoll(entry)
    treeKill(entry.pid, 'SIGKILL')
  }

  restart(project: Project): void {
    const entry = this.running.get(project.id)
    if (!entry) {
      this.start(project)
      return
    }
    const handler = (id: string, status: ProjectStatus): void => {
      if (id === project.id && status === 'stopped') {
        this.off('status', handler)
        this.start(project)
      }
    }
    this.on('status', handler)
    this.stop(project.id)
  }

  private async pollStats(): Promise<void> {
    if (this.running.size === 0) return
    for (const [id, entry] of this.running) {
      try {
        const pids: number[] = await pidtree(entry.pid, { root: true }).catch(() => [entry.pid])
        const stats = await pidusage(pids)
        let cpu = 0
        let mem = 0
        for (const key of Object.keys(stats)) {
          const s = stats[key]
          if (!s) continue
          cpu += s.cpu ?? 0
          mem += s.memory ?? 0
        }
        entry.cpu = Math.round(cpu * 10) / 10
        entry.memoryMB = Math.round((mem / (1024 * 1024)) * 10) / 10
      } catch {
        // process may have just exited; ignore this tick
      }
    }
    this.emit('stats-tick', this.getAllStats())
  }

  shutdownAll(): void {
    for (const [id] of this.running) {
      this.kill(id)
    }
  }
}

export const processManager = new ProcessManager()
