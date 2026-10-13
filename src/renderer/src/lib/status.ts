import type { ProjectStatus } from '@shared/types'

export interface StatusMeta {
  label: string
  dot: string
  text: string
  glow: string
  pulse: boolean
}

export const STATUS_META: Record<ProjectStatus, StatusMeta> = {
  running: { label: 'Running', dot: 'bg-status-running', text: 'text-status-running', glow: 'shadow-glow-green', pulse: true },
  starting: { label: 'Starting', dot: 'bg-status-starting', text: 'text-status-starting', glow: 'shadow-glow-blue', pulse: true },
  building: { label: 'Building', dot: 'bg-status-building', text: 'text-status-building', glow: 'shadow-glow-blue', pulse: true },
  stopping: { label: 'Stopping', dot: 'bg-status-starting', text: 'text-status-starting', glow: '', pulse: true },
  stopped: { label: 'Stopped', dot: 'bg-status-stopped', text: 'text-status-stopped', glow: '', pulse: false },
  error: { label: 'Error', dot: 'bg-status-stopped', text: 'text-status-stopped', glow: '', pulse: false }
}

export function formatUptime(startedAt?: number): string {
  if (!startedAt) return '—'
  const ms = Date.now() - startedAt
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}
