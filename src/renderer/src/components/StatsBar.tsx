import { useEffect, useMemo, useState } from 'react'
import { Activity, Cpu, MemoryStick, Timer } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { formatUptime } from '../lib/status'

function Tile({
  icon,
  label,
  value,
  accent
}: {
  icon: JSX.Element
  label: string
  value: string
  accent: string
}): JSX.Element {
  return (
    <div className="glass-panel flex flex-1 items-center gap-3 rounded-xl px-4 py-3">
      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${accent}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
        <p className="truncate text-[15px] font-semibold text-white tabular-nums">{value}</p>
      </div>
    </div>
  )
}

export default function StatsBar(): JSX.Element {
  const projects = useAppStore((s) => s.projects)
  const stats = useAppStore((s) => s.stats)
  const [, forceTick] = useState(0)

  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [])

  const { runningCount, totalRam, totalCpu, earliestStart, nodeProcesses } = useMemo(() => {
    let runningCount = 0
    let totalRam = 0
    let totalCpu = 0
    let earliestStart: number | undefined
    let nodeProcesses = 0

    for (const project of projects) {
      const s = stats[project.id]
      if (!s) continue
      if (s.status === 'running' || s.status === 'starting' || s.status === 'building') {
        runningCount += 1
        totalRam += s.memoryMB ?? 0
        totalCpu += s.cpu ?? 0
        if (s.pid) nodeProcesses += 1
        if (s.startedAt && (!earliestStart || s.startedAt < earliestStart)) earliestStart = s.startedAt
      }
    }
    return { runningCount, totalRam, totalCpu, earliestStart, nodeProcesses }
  }, [projects, stats])

  return (
    <div className="flex gap-3 px-6">
      <Tile
        icon={<Activity size={16} className="text-status-running" />}
        label="Running Projects"
        value={`${runningCount} / ${projects.length}`}
        accent="bg-status-running/10"
      />
      <Tile
        icon={<MemoryStick size={16} className="text-nebula-blue" />}
        label="RAM"
        value={`${totalRam.toFixed(0)} MB`}
        accent="bg-nebula-blue/10"
      />
      <Tile
        icon={<Cpu size={16} className="text-nebula-purple" />}
        label="CPU"
        value={`${totalCpu.toFixed(1)}%`}
        accent="bg-nebula-purple/10"
      />
      <Tile
        icon={<Activity size={16} className="text-nebula-teal" />}
        label="Node Processes"
        value={`${nodeProcesses}`}
        accent="bg-nebula-teal/10"
      />
      <Tile
        icon={<Timer size={16} className="text-slate-300" />}
        label="Fleet Uptime"
        value={formatUptime(earliestStart)}
        accent="bg-white/[0.06]"
      />
    </div>
  )
}
