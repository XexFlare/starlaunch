import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'

export function Field({ label, children }: { label: string; children: ReactNode }): JSX.Element {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11.5px] font-medium uppercase tracking-wide text-slate-400">{label}</span>
      {children}
    </label>
  )
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>): JSX.Element {
  return (
    <input
      {...props}
      className={`h-9 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-[13px] text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-nebula-blue/40 focus:ring-2 focus:ring-nebula-blue/20 ${props.className ?? ''}`}
    />
  )
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>): JSX.Element {
  return (
    <select
      {...props}
      className={`h-9 w-full rounded-lg border border-white/[0.08] bg-space-800 px-3 text-[13px] text-slate-200 outline-none transition focus:border-nebula-blue/40 focus:ring-2 focus:ring-nebula-blue/20 ${props.className ?? ''}`}
    />
  )
}

export function Toggle({
  checked,
  onChange,
  label,
  description
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  description?: string
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 py-2 text-left"
    >
      <span>
        <span className="block text-[13px] text-slate-200">{label}</span>
        {description && <span className="block text-[11.5px] text-slate-500">{description}</span>}
      </span>
      <span
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-nebula-blue' : 'bg-white/[0.12]'
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </span>
    </button>
  )
}
