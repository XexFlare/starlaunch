import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import pidusage from 'pidusage'
import pidtree from 'pidtree'

export interface TreeUsage {
  /** Percent of one CPU core, summed over the tree (same scale pidusage uses). */
  cpu: number
  memoryBytes: number
}

const END_MARKER = '<<STARLAUNCH-END>>'
const QUERY_TIMEOUT_MS = 10000

// One line per process: pid,parentPid,workingSetBytes,cpuTime100ns
const CIM_QUERY =
  'Get-CimInstance Win32_Process -Property ProcessId,ParentProcessId,WorkingSetSize,KernelModeTime,UserModeTime | ' +
  'ForEach-Object { "$($_.ProcessId),$($_.ParentProcessId),$($_.WorkingSetSize),$($_.KernelModeTime + $_.UserModeTime)" }; ' +
  `'${END_MARKER}'`

interface ProcessRow {
  parent: number
  memoryBytes: number
  cpuTime100ns: number
}

/**
 * Windows process stats without WMIC. pidtree/pidusage shell out to `wmic`,
 * which new Windows 11 installs no longer ship, so both fail silently there.
 * Instead, one hidden PowerShell process is kept alive and asked for a CIM
 * snapshot of every process on each stats tick; CPU% comes from the change
 * in CPU time between two snapshots.
 */
class WindowsProcessStats {
  private shell?: ChildProcessWithoutNullStreams
  private buffer = ''
  private pending?: { resolve: (out: string) => void; reject: (err: Error) => void; timer: NodeJS.Timeout }
  private lastCpuTime = new Map<number, number>()
  private lastSampleAt = 0

  private ensureShell(): ChildProcessWithoutNullStreams {
    if (this.shell && this.shell.exitCode === null) return this.shell
    const shell = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', '-'], {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe']
    })
    shell.stdout.setEncoding('utf-8')
    shell.stdout.on('data', (chunk: string) => this.onData(chunk))
    shell.stderr.resume()
    shell.on('exit', () => {
      this.shell = undefined
      this.failPending(new Error('PowerShell exited'))
    })
    shell.on('error', (err) => this.failPending(err))
    this.shell = shell
    return shell
  }

  private onData(chunk: string): void {
    this.buffer += chunk
    const end = this.buffer.indexOf(END_MARKER)
    if (end === -1 || !this.pending) return
    const output = this.buffer.slice(0, end)
    this.buffer = this.buffer.slice(end + END_MARKER.length)
    const { resolve, timer } = this.pending
    clearTimeout(timer)
    this.pending = undefined
    resolve(output)
  }

  private failPending(err: Error): void {
    if (!this.pending) return
    const { reject, timer } = this.pending
    clearTimeout(timer)
    this.pending = undefined
    this.buffer = ''
    reject(err)
  }

  private query(): Promise<string> {
    if (this.pending) return Promise.reject(new Error('A stats query is already in flight'))
    const shell = this.ensureShell()
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.failPending(new Error('Stats query timed out'))
        this.dispose()
      }, QUERY_TIMEOUT_MS)
      this.pending = { resolve, reject, timer }
      shell.stdin.write(`${CIM_QUERY}\n`)
    })
  }

  async sample(rootPids: number[]): Promise<Map<number, TreeUsage>> {
    const output = await this.query()
    const now = Date.now()
    const elapsedMs = this.lastSampleAt ? now - this.lastSampleAt : 0

    const rows = new Map<number, ProcessRow>()
    const children = new Map<number, number[]>()
    for (const line of output.split(/\r?\n/)) {
      const [pid, parent, memory, cpuTime] = line.trim().split(',').map(Number)
      if (!Number.isFinite(pid) || !Number.isFinite(parent)) continue
      rows.set(pid, { parent, memoryBytes: memory || 0, cpuTime100ns: cpuTime || 0 })
      if (pid !== parent) {
        const siblings = children.get(parent) ?? []
        siblings.push(pid)
        children.set(parent, siblings)
      }
    }

    const nextCpuTime = new Map<number, number>()
    const result = new Map<number, TreeUsage>()
    for (const root of rootPids) {
      let cpu = 0
      let memoryBytes = 0
      const queue = rows.has(root) ? [root] : []
      const seen = new Set<number>()
      while (queue.length > 0) {
        const pid = queue.pop() as number
        if (seen.has(pid)) continue
        seen.add(pid)
        const row = rows.get(pid)
        if (!row) continue
        memoryBytes += row.memoryBytes
        const previous = this.lastCpuTime.get(pid)
        if (previous != null && elapsedMs > 0 && row.cpuTime100ns >= previous) {
          // 100ns units → ms, then as a percentage of the wall-clock interval
          cpu += ((row.cpuTime100ns - previous) / 10000 / elapsedMs) * 100
        }
        nextCpuTime.set(pid, row.cpuTime100ns)
        queue.push(...(children.get(pid) ?? []))
      }
      result.set(root, { cpu, memoryBytes })
    }

    this.lastCpuTime = nextCpuTime
    this.lastSampleAt = now
    return result
  }

  dispose(): void {
    this.shell?.kill()
    this.shell = undefined
    this.buffer = ''
  }
}

async function samplePosix(rootPids: number[]): Promise<Map<number, TreeUsage>> {
  const result = new Map<number, TreeUsage>()
  for (const root of rootPids) {
    try {
      const pids: number[] = await pidtree(root, { root: true }).catch(() => [root])
      const stats = await pidusage(pids)
      let cpu = 0
      let memoryBytes = 0
      for (const key of Object.keys(stats)) {
        const s = stats[key]
        if (!s) continue
        cpu += s.cpu ?? 0
        memoryBytes += s.memory ?? 0
      }
      result.set(root, { cpu, memoryBytes })
    } catch {
      // process may have just exited; skip it this tick
    }
  }
  return result
}

const windowsStats = process.platform === 'win32' ? new WindowsProcessStats() : null

/** CPU and memory for each root PID, summed across that process's whole tree. */
export function sampleProcessTrees(rootPids: number[]): Promise<Map<number, TreeUsage>> {
  return windowsStats ? windowsStats.sample(rootPids) : samplePosix(rootPids)
}

export function disposeProcessStats(): void {
  windowsStats?.dispose()
}
