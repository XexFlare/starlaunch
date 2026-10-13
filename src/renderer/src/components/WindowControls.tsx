import { useEffect, useState } from 'react'
import { Minus, Square, Copy, X } from 'lucide-react'

export default function WindowControls(): JSX.Element {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    return window.StarLaunch.window.onMaximizedChange(setMaximized)
  }, [])

  return (
    <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
      <button
        onClick={() => window.StarLaunch.window.minimize()}
        className="flex h-8 w-9 items-center justify-center rounded-md text-slate-400 transition hover:bg-white/[0.08] hover:text-white"
        aria-label="Minimize"
      >
        <Minus size={14} />
      </button>
      <button
        onClick={() => window.StarLaunch.window.toggleMaximize()}
        className="flex h-8 w-9 items-center justify-center rounded-md text-slate-400 transition hover:bg-white/[0.08] hover:text-white"
        aria-label="Maximize"
      >
        {maximized ? <Copy size={12} /> : <Square size={12} />}
      </button>
      <button
        onClick={() => window.StarLaunch.window.close()}
        className="flex h-8 w-9 items-center justify-center rounded-md text-slate-400 transition hover:bg-status-stopped hover:text-white"
        aria-label="Close"
      >
        <X size={14} />
      </button>
    </div>
  )
}
