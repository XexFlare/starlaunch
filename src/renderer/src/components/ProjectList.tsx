import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronRight, Rocket } from 'lucide-react'
import type { Project } from '@shared/types'
import { useAppStore } from '../store/useAppStore'
import ProjectRow from './ProjectRow'
import CollapsedProjectCard from './CollapsedProjectCard'
import ConfigureProjectModal from './ConfigureProjectModal'

export default function ProjectList(): JSX.Element {
  const projects = useAppStore((s) => s.projects)
  const searchQuery = useAppStore((s) => s.searchQuery)
  const category = useAppStore((s) => s.category)
  const openAddModal = useAppStore((s) => s.openAddModal)
  const [configuring, setConfiguring] = useState<Project | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return projects
      .filter((p) => (category ? p.category === category : true))
      .filter((p) => (q ? p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) : true))
      .sort((a, b) => {
        if (a.favorite !== b.favorite) return a.favorite ? -1 : 1
        return a.name.localeCompare(b.name)
      })
  }, [projects, searchQuery, category])

  if (projects.length === 0) {
    return (
      <div className="glass-panel flex flex-1 flex-col items-center justify-center gap-3 rounded-xl">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.05]">
          <Rocket size={20} className="text-slate-400" />
        </div>
        <p className="text-[13px] text-slate-400">No projects yet — add your first local dev server.</p>
        <button
          onClick={openAddModal}
          className="rounded-lg bg-gradient-to-br from-nebula-purple to-nebula-blue px-4 py-1.5 text-[13px] font-medium text-white shadow-glow-purple transition hover:brightness-110"
        >
          + Add Project
        </button>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin pr-1">
      <div className="flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {filtered.map((project) => {
            const isExpanded = project.id === expandedId
            return (
              <motion.div
                key={project.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{
                  layout: { duration: isExpanded ? 0.28 : 0.22, ease: [0.22, 1, 0.36, 1] },
                  opacity: { duration: 0.2 },
                  y: { duration: 0.2 }
                }}
                className={`relative ml-auto ${isExpanded ? 'w-[90%]' : 'w-[30%]'}`}
              >
                {isExpanded ? (
                  <>
                    <ProjectRow project={project} onConfigure={setConfiguring} onCollapse={() => setExpandedId(null)} />
                    <motion.button
                      onClick={() => setExpandedId(null)}
                      animate={{ x: [0, 5, 0] }}
                      transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                      className="absolute -left-1 top-1/2 flex -translate-x-full -translate-y-1/2 items-center gap-1 whitespace-nowrap text-[11px] text-slate-500/70 transition hover:text-slate-300"
                    >
                      <ChevronRight size={12} />
                      Collapse
                      <ChevronRight size={12} />
                    </motion.button>
                  </>
                ) : (
                  <CollapsedProjectCard project={project} onExpand={() => setExpandedId(project.id)} />
                )}
              </motion.div>
            )
          })}
        </AnimatePresence>
        {filtered.length === 0 && (
          <p className="py-8 text-center text-[13px] text-slate-500">No projects match your search.</p>
        )}
      </div>
      {configuring && <ConfigureProjectModal project={configuring} onClose={() => setConfiguring(null)} />}
    </div>
  )
}
