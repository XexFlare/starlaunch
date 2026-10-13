import { Telescope, Plus, Sparkles, Settings, Search } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import WindowControls from './WindowControls'

export default function Header(): JSX.Element {
  const searchQuery = useAppStore((s) => s.searchQuery)
  const setSearch = useAppStore((s) => s.setSearch)
  const openAddModal = useAppStore((s) => s.openAddModal)
  const openCreateModal = useAppStore((s) => s.openCreateModal)
  const openSettings = useAppStore((s) => s.openSettings)

  return (
    <header
      className="flex items-center gap-4 px-4 py-3"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div className="flex items-center gap-3 pl-2">
        <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-nebula-purple to-nebula-blue shadow-glow-purple">
          <Telescope size={19} className="text-white" strokeWidth={2.25} />
        </div>
        <div>
          <h1 className="text-[15px] font-semibold leading-tight tracking-tight text-white">StarLaunch</h1>
          <p className="text-[11px] leading-tight text-slate-400">Local Development Command Center</p>
        </div>
      </div>

      <div
        className="ml-4 flex flex-1 items-center"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <div className="relative w-full max-w-md">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={searchQuery}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects…"
            className="glass-panel h-9 w-full rounded-lg py-2 pl-9 pr-3 text-[13px] text-slate-200 placeholder:text-slate-500 outline-none transition focus:border-nebula-blue/40 focus:ring-2 focus:ring-nebula-blue/20"
          />
        </div>
      </div>

      <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button
          onClick={openCreateModal}
          className="glass-panel flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-[13px] font-medium text-slate-200 transition hover:bg-white/[0.08] hover:text-white active:scale-[0.97]"
        >
          <Sparkles size={15} strokeWidth={2.25} />
          Create Project
        </button>

        <button
          onClick={openAddModal}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-br from-nebula-purple to-nebula-blue px-3.5 text-[13px] font-medium text-white shadow-glow-purple transition hover:brightness-110 active:scale-[0.97]"
        >
          <Plus size={15} strokeWidth={2.5} />
          Add Project
        </button>

        <button
          onClick={openSettings}
          className="glass-panel flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 transition hover:text-white hover:bg-white/[0.08] active:scale-[0.95]"
          aria-label="Settings"
        >
          <Settings size={16} />
        </button>
      </div>

      <div className="ml-1 h-6 w-px bg-white/[0.08]" />

      <WindowControls />
    </header>
  )
}
