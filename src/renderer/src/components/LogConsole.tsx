import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronUp, ChevronDown, Search, Trash2, Terminal } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { AnsiLine } from '../lib/ansi'

export default function LogConsole(): JSX.Element {
  const logConsoleOpen = useAppStore((s) => s.logConsoleOpen)
  const activeLogProjectId = useAppStore((s) => s.activeLogProjectId)
  const toggleLogConsole = useAppStore((s) => s.toggleLogConsole)
  const projects = useAppStore((s) => s.projects)
  const logsByProject = useAppStore((s) => s.logsByProject)
  const clearLogs = useAppStore((s) => s.clearLogs)

  const [filter, setFilter] = useState('')
  const [autoScroll, setAutoScroll] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  const activeProject = projects.find((p) => p.id === activeLogProjectId) ?? projects[0]
  const lines = useMemo(
    () => (activeProject ? logsByProject[activeProject.id] ?? [] : []),
    [activeProject, logsByProject]
  )

  const filteredLines = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return lines
    return lines.filter((l) => l.text.toLowerCase().includes(q))
  }, [lines, filter])

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [filteredLines, autoScroll])

  function handleScroll(): void {
    const el = scrollRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    setAutoScroll(atBottom)
  }

  if (projects.length === 0) return <></>

  return (
    <div className="mx-6 mb-4 shrink-0 overflow-hidden rounded-xl">
      <div className="glass-panel-solid overflow-hidden rounded-xl">
        <button
          onClick={() => toggleLogConsole()}
          className="flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-white/[0.03]"
        >
          <Terminal size={13} className="text-slate-400" />
          <span className="text-[12px] font-medium text-slate-300">Logs</span>
          {activeProject && <span className="text-[11.5px] text-slate-500">— {activeProject.name}</span>}
          <span className="ml-auto">
            {logConsoleOpen ? (
              <ChevronDown size={14} className="text-slate-500" />
            ) : (
              <ChevronUp size={14} className="text-slate-500" />
            )}
          </span>
        </button>

        <AnimatePresence initial={false}>
          {logConsoleOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 230, opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="border-t border-white/[0.06]"
            >
              <div className="flex h-full flex-col">
                <div className="flex shrink-0 items-center gap-2 border-b border-white/[0.06] px-3 py-1.5">
                  <select
                    value={activeProject?.id ?? ''}
                    onChange={(e) => toggleLogConsole(e.target.value)}
                    className="h-7 rounded-md border border-white/[0.08] bg-white/[0.04] px-2 text-[12px] text-slate-200 outline-none"
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>

                  <div className="relative ml-2 w-56">
                    <Search
                      size={12}
                      className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500"
                    />
                    <input
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                      placeholder="Search logs…"
                      className="h-7 w-full rounded-md border border-white/[0.08] bg-white/[0.04] pl-7 pr-2 text-[12px] text-slate-200 outline-none placeholder:text-slate-500"
                    />
                  </div>

                  <div className="ml-auto flex items-center gap-1">
                    <button
                      onClick={() => activeProject && clearLogs(activeProject.id)}
                      title="Clear logs"
                      className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-white/[0.08] hover:text-white"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <div
                  ref={scrollRef}
                  onScroll={handleScroll}
                  className="flex-1 overflow-y-auto scrollbar-thin bg-black/30 px-3 py-2 font-mono text-[11.5px] leading-[1.55]"
                >
                  {filteredLines.length === 0 && (
                    <p className="pt-6 text-center text-slate-600">No log output yet.</p>
                  )}
                  {filteredLines.map((line) => (
                    <div
                      key={line.id}
                      className={`whitespace-pre-wrap break-all ${
                        line.stream === 'stderr'
                          ? 'text-status-stopped/90'
                          : line.stream === 'system'
                            ? 'text-nebula-blue/80'
                            : 'text-slate-300'
                      }`}
                    >
                      <span className="mr-2 select-none text-slate-600">
                        {new Date(line.timestamp).toLocaleTimeString()}
                      </span>
                      <AnsiLine text={line.text} />
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
