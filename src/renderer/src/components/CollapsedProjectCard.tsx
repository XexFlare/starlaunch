import { motion } from 'framer-motion'
import { Star, Play, Square, Loader2 } from 'lucide-react'
import type { Project } from '@shared/types'
import { useAppStore } from '../store/useAppStore'
import { STATUS_META } from '../lib/status'

interface Props {
  project: Project
  onExpand: () => void
}

/**
 * The launcher-mode rendering of a project — everything except the essentials
 * is hidden here; the full detail view is ProjectRow, reused unmodified when
 * a project is expanded (see ProjectList).
 */
export default function CollapsedProjectCard({ project, onExpand }: Props): JSX.Element {
  const stats = useAppStore((s) => s.stats[project.id])
  const startProject = useAppStore((s) => s.startProject)
  const stopProject = useAppStore((s) => s.stopProject)
  const toggleFavorite = useAppStore((s) => s.toggleFavorite)

  const status = stats?.status ?? 'stopped'
  const meta = STATUS_META[status]
  const isRunning = status === 'running'
  const isBusy = status === 'starting' || status === 'stopping' || status === 'building'

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onExpand}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onExpand()
      }}
      className={`group glass-panel-light flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 transition-shadow ${
        isRunning ? meta.glow : ''
      }`}
    >
      <motion.span
        animate={{ x: [0, -4, 0] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
        className="shrink-0 select-none text-[13px] text-slate-500/60"
      >
        ‹
      </motion.span>

      <button
        title={project.favorite ? 'Unfavorite' : 'Favorite'}
        onClick={(e) => {
          e.stopPropagation()
          toggleFavorite(project.id)
        }}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:text-amber-400"
      >
        <Star
          size={13}
          fill={project.favorite ? 'currentColor' : 'none'}
          className={project.favorite ? 'text-amber-400' : ''}
        />
      </button>

      <span className="flex shrink-0 items-center justify-center">
        {isBusy ? (
          <Loader2 size={9} className={`animate-spin ${meta.text}`} />
        ) : (
          <span className={`block h-2 w-2 rounded-full ${meta.dot} ${meta.pulse ? 'animate-pulse-soft' : ''}`} />
        )}
      </span>

      <span className="min-w-0 flex-1">
        <p className="text-contrast truncate text-[13px] font-medium text-white">{project.name}</p>
        <span className="text-contrast flex items-center gap-1.5 text-[10.5px] text-slate-300">
          <span className="truncate">{isBusy ? `${meta.label}…` : meta.label}</span>
        </span>
      </span>

      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[9px] font-semibold text-slate-200">
        {project.framework.slice(0, 2)}
      </span>

      {isRunning || isBusy ? (
        <button
          disabled={isBusy}
          onClick={(e) => {
            e.stopPropagation()
            stopProject(project.id)
          }}
          className="ml-0.5 flex h-7 shrink-0 items-center gap-1 rounded-md bg-status-stopped/10 px-2.5 text-[11.5px] font-medium text-status-stopped transition hover:bg-status-stopped/20 active:scale-95 disabled:opacity-50"
        >
          <Square size={11} fill="currentColor" />
          Stop
        </button>
      ) : (
        <button
          onClick={(e) => {
            e.stopPropagation()
            startProject(project.id)
          }}
          className="ml-0.5 flex h-7 shrink-0 items-center gap-1 rounded-md bg-status-running/10 px-2.5 text-[11.5px] font-medium text-status-running transition hover:bg-status-running/20 active:scale-95"
        >
          <Play size={11} fill="currentColor" />
          Start
        </button>
      )}
    </div>
  )
}
