import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Star,
  ExternalLink,
  Copy,
  RotateCw,
  Play,
  Square,
  Terminal,
  Settings2,
  Trash2,
  Loader2
} from 'lucide-react'
import type { Project } from '@shared/types'
import { useAppStore } from '../store/useAppStore'
import { STATUS_META, formatUptime } from '../lib/status'

interface Props {
  project: Project
  onConfigure: (project: Project) => void
  /** Called when the card body (not one of its buttons) is clicked. */
  onCollapse?: () => void
}

function IconButton({
  title,
  onClick,
  children,
  danger
}: {
  title: string
  onClick: () => void
  children: React.ReactNode
  danger?: boolean
}): JSX.Element {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-white/[0.08] active:scale-90 ${
        danger ? 'hover:text-status-stopped' : 'hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}

export default function ProjectRow({ project, onConfigure, onCollapse }: Props): JSX.Element {
  const stats = useAppStore((s) => s.stats[project.id])
  const startProject = useAppStore((s) => s.startProject)
  const stopProject = useAppStore((s) => s.stopProject)
  const restartProject = useAppStore((s) => s.restartProject)
  const deleteProject = useAppStore((s) => s.deleteProject)
  const toggleFavorite = useAppStore((s) => s.toggleFavorite)
  const copyUrl = useAppStore((s) => s.copyUrl)
  const openInBrowser = useAppStore((s) => s.openInBrowser)
  const toggleLogConsole = useAppStore((s) => s.toggleLogConsole)

  const status = stats?.status ?? 'stopped'
  const meta = STATUS_META[status]
  const isRunning = status === 'running'
  const isBusy = status === 'starting' || status === 'stopping' || status === 'building'
  const shownPort = stats?.port ?? project.port

  const [, forceTick] = useState(0)
  useEffect(() => {
    if (!stats?.startedAt) return
    const t = setInterval(() => forceTick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [stats?.startedAt])

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button, a, input')) return
        onCollapse?.()
      }}
      className={`group glass-panel-light flex items-center gap-3 rounded-xl px-3.5 py-2.5 transition-shadow ${
        isRunning ? meta.glow : ''
      } ${onCollapse ? 'cursor-pointer' : ''}`}
    >
      <button
        title={project.favorite ? 'Unfavorite' : 'Favorite'}
        onClick={() => toggleFavorite(project.id)}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:text-amber-400"
      >
        <Star size={14} fill={project.favorite ? 'currentColor' : 'none'} className={project.favorite ? 'text-amber-400' : ''} />
      </button>

      <div className="flex shrink-0 items-center justify-center">
        {isBusy ? (
          <Loader2 size={10} className={`animate-spin ${meta.text}`} />
        ) : (
          <span className={`block h-2.5 w-2.5 rounded-full ${meta.dot} ${meta.pulse ? 'animate-pulse-soft' : ''}`} />
        )}
      </div>

      <div className="min-w-[180px] flex-1 basis-[220px]">
        <p className="text-contrast truncate text-[13.5px] font-medium text-white">{project.name}</p>
        <div className="text-contrast flex items-center gap-1.5 text-[11px] text-slate-300">
          <span className="rounded bg-black/30 px-1.5 py-0.5">{project.category}</span>
          <span>{project.framework}</span>
        </div>
      </div>

      <div className="text-contrast hidden shrink-0 items-center gap-4 text-[12px] text-slate-300 sm:flex">
        <span className="tabular-nums">Port {shownPort ?? 'Auto'}</span>
        {isRunning && (
          <>
            <span className="tabular-nums">{(stats?.memoryMB ?? 0).toFixed(0)} MB</span>
            <span className="tabular-nums">{(stats?.cpu ?? 0).toFixed(1)}% CPU</span>
            <span className="tabular-nums">{formatUptime(stats?.startedAt)}</span>
          </>
        )}
        {!isRunning && !isBusy && <span className={meta.text}>{meta.label}</span>}
        {isBusy && <span className={meta.text}>{meta.label}…</span>}
      </div>

      {isRunning && shownPort != null && (
        <button
          onClick={() => copyUrl(shownPort)}
          className="text-contrast hidden shrink-0 items-center gap-1.5 rounded-md bg-black/30 px-2.5 py-1 font-mono text-[11.5px] text-slate-300 transition hover:text-white md:flex"
          title="Copy URL"
        >
          localhost:{shownPort}
        </button>
      )}

      <div className="ml-auto flex shrink-0 items-center gap-0.5">
        <IconButton title="Logs" onClick={() => toggleLogConsole(project.id)}>
          <Terminal size={14} />
        </IconButton>

        {isRunning && (
          <>
            {shownPort != null && (
              <>
                <IconButton title="Open in browser" onClick={() => openInBrowser(shownPort)}>
                  <ExternalLink size={14} />
                </IconButton>
                <IconButton title="Copy URL" onClick={() => copyUrl(shownPort)}>
                  <Copy size={14} />
                </IconButton>
              </>
            )}
            <IconButton title="Restart" onClick={() => restartProject(project.id)}>
              <RotateCw size={14} />
            </IconButton>
          </>
        )}

        <IconButton title="Configure" onClick={() => onConfigure(project)}>
          <Settings2 size={14} />
        </IconButton>
        <IconButton title="Delete" danger onClick={() => deleteProject(project.id)}>
          <Trash2 size={14} />
        </IconButton>

        {isRunning || isBusy ? (
          <button
            disabled={isBusy}
            onClick={() => stopProject(project.id)}
            className="ml-1 flex h-7 items-center gap-1.5 rounded-md bg-status-stopped/10 px-3 text-[12px] font-medium text-status-stopped transition hover:bg-status-stopped/20 active:scale-95 disabled:opacity-50"
          >
            <Square size={12} fill="currentColor" />
            Stop
          </button>
        ) : (
          <button
            onClick={() => startProject(project.id)}
            className="ml-1 flex h-7 items-center gap-1.5 rounded-md bg-status-running/10 px-3 text-[12px] font-medium text-status-running transition hover:bg-status-running/20 active:scale-95"
          >
            <Play size={12} fill="currentColor" />
            Start
          </button>
        )}
      </div>
    </motion.div>
  )
}
