import { useMemo } from 'react'
import { useAppStore } from '../store/useAppStore'

export default function CategoryFilter(): JSX.Element {
  const projects = useAppStore((s) => s.projects)
  const category = useAppStore((s) => s.category)
  const setCategory = useAppStore((s) => s.setCategory)

  const categories = useMemo(() => {
    const set = new Set(projects.map((p) => p.category))
    return Array.from(set)
  }, [projects])

  if (categories.length <= 1) return <></>

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-6">
      <button
        onClick={() => setCategory(null)}
        className={`rounded-full px-3 py-1 text-[11.5px] font-medium transition ${
          category === null ? 'bg-white/[0.12] text-white' : 'bg-white/[0.03] text-slate-400 hover:text-slate-200'
        }`}
      >
        All
      </button>
      {categories.map((c) => (
        <button
          key={c}
          onClick={() => setCategory(c)}
          className={`rounded-full px-3 py-1 text-[11.5px] font-medium transition ${
            category === c ? 'bg-white/[0.12] text-white' : 'bg-white/[0.03] text-slate-400 hover:text-slate-200'
          }`}
        >
          {c}
        </button>
      ))}
    </div>
  )
}
