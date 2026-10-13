import { useState } from 'react'
import { FolderOpen, ScanSearch, Check, Loader2 } from 'lucide-react'
import type { Category, DetectedProject, Framework } from '@shared/types'
import { CATEGORIES, FRAMEWORKS, categoryForPort } from '@shared/types'
import { useAppStore } from '../store/useAppStore'
import ModalShell from './ModalShell'
import { Field, TextInput, Select, Toggle } from './form'

type Tab = 'manual' | 'auto'

export default function AddProjectModal(): JSX.Element {
  const closeAddModal = useAppStore((s) => s.closeAddModal)
  const addProject = useAppStore((s) => s.addProject)
  const settings = useAppStore((s) => s.settings)
  const pushToast = useAppStore((s) => s.pushToast)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const existingProjects = useAppStore((s) => s.projects)

  const [tab, setTab] = useState<Tab>('manual')

  // manual form state
  const [name, setName] = useState('')
  const [directory, setDirectory] = useState('')
  const [port, setPort] = useState<number | undefined>(undefined)
  const [command, setCommand] = useState('npm run dev')
  const [framework, setFramework] = useState<Framework>('Vite')
  const [category, setCategory] = useState<Category>('Apps')

  // auto-detect state
  const [scanRoot, setScanRoot] = useState(settings.defaultProjectRoot)
  const [scanning, setScanning] = useState(false)
  const [detected, setDetected] = useState<DetectedProject[]>([])
  const [importedDirs, setImportedDirs] = useState<Set<string>>(new Set())

  async function browseDirectory(setter: (dir: string) => void): Promise<void> {
    const dir = await window.StarLaunch.dialog.pickDirectory()
    if (dir) setter(dir)
  }

  async function handleManualSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!name.trim() || !directory.trim()) {
      pushToast('Name and directory are required', 'error')
      return
    }
    await addProject({ name: name.trim(), directory, port, command, framework, category })
    closeAddModal()
  }

  async function runScan(): Promise<void> {
    if (!scanRoot) {
      pushToast('Choose a folder to scan first', 'error')
      return
    }
    setScanning(true)
    try {
      const results = await window.StarLaunch.fs.scanDirectory(scanRoot)
      setDetected(results)
      if (results.length === 0) pushToast('No package.json projects found', 'info')
    } finally {
      setScanning(false)
    }
  }

  async function importDetected(d: DetectedProject): Promise<void> {
    await addProject({
      name: d.name,
      directory: d.directory,
      port: d.port,
      command: d.command,
      framework: d.framework,
      category: categoryForPort(d.port)
    })
    setImportedDirs((prev) => new Set(prev).add(d.directory))
  }

  const alreadyKnownDirs = new Set(existingProjects.map((p) => p.directory))

  return (
    <ModalShell title="Add Project" subtitle="Register a local dev server with StarLaunch" onClose={closeAddModal} width="max-w-xl">
      <div className="mb-4 flex gap-1 rounded-lg bg-white/[0.04] p-1">
        {(['manual', 'auto'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md py-1.5 text-[12.5px] font-medium transition ${
              tab === t ? 'bg-white/[0.09] text-white shadow-glow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t === 'manual' ? 'Manual' : 'Auto-Detect'}
          </button>
        ))}
      </div>

      {tab === 'manual' ? (
        <form onSubmit={handleManualSubmit} className="space-y-3">
          <Field label="Project Name">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="ShipDemurrageCalculatorX" autoFocus />
          </Field>

          <Field label="Directory">
            <div className="flex gap-2">
              <TextInput value={directory} onChange={(e) => setDirectory(e.target.value)} placeholder="D:/Projects/MyApp" />
              <button
                type="button"
                onClick={() => browseDirectory(setDirectory)}
                className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-[12.5px] text-slate-300 transition hover:bg-white/[0.08]"
              >
                <FolderOpen size={14} />
                Browse…
              </button>
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Port">
              <TextInput
                type="number"
                value={port ?? ''}
                onChange={(e) => setPort(e.target.value === '' ? undefined : Number(e.target.value))}
                min={1}
                max={65535}
                placeholder="Auto-detect"
              />
            </Field>
            <Field label="Startup Command">
              <TextInput value={command} onChange={(e) => setCommand(e.target.value)} placeholder="npm run dev" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Framework">
              <Select value={framework} onChange={(e) => setFramework(e.target.value as Framework)}>
                {FRAMEWORKS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Category">
              <Select value={category} onChange={(e) => setCategory(e.target.value as Category)}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={closeAddModal}
              className="rounded-lg px-3.5 py-2 text-[13px] font-medium text-slate-400 transition hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-gradient-to-br from-nebula-purple to-nebula-blue px-4 py-2 text-[13px] font-medium text-white shadow-glow-purple transition hover:brightness-110 active:scale-[0.97]"
            >
              Add Project
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-3">
          <Field label="Directory to Scan">
            <div className="flex gap-2">
              <TextInput value={scanRoot} onChange={(e) => setScanRoot(e.target.value)} placeholder="D:/Projects" />
              <button
                type="button"
                onClick={() => browseDirectory(setScanRoot)}
                className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-[12.5px] text-slate-300 transition hover:bg-white/[0.08]"
              >
                <FolderOpen size={14} />
                Browse…
              </button>
              <button
                type="button"
                onClick={runScan}
                disabled={scanning}
                className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-gradient-to-br from-nebula-purple to-nebula-blue px-3.5 text-[12.5px] font-medium text-white shadow-glow-purple transition hover:brightness-110 disabled:opacity-60"
              >
                {scanning ? <Loader2 size={14} className="animate-spin" /> : <ScanSearch size={14} />}
                Scan
              </button>
            </div>
          </Field>

          <div className="max-h-[280px] space-y-1.5 overflow-y-auto scrollbar-thin pr-1">
            {detected.map((d) => {
              const imported = importedDirs.has(d.directory) || alreadyKnownDirs.has(d.directory)
              return (
                <div
                  key={d.directory}
                  className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-slate-100">{d.name}</p>
                    <p className="truncate text-[11px] text-slate-500">{d.directory}</p>
                  </div>
                  <span className="shrink-0 rounded bg-white/[0.06] px-1.5 py-0.5 text-[10.5px] text-slate-400">
                    {d.framework}
                  </span>
                  <span className="shrink-0 text-[11px] tabular-nums text-slate-500">:{d.port}</span>
                  <button
                    disabled={imported}
                    onClick={() => importDetected(d)}
                    className="flex h-7 shrink-0 items-center gap-1 rounded-md bg-nebula-blue/15 px-2.5 text-[11.5px] font-medium text-nebula-blue transition hover:bg-nebula-blue/25 disabled:bg-status-running/10 disabled:text-status-running"
                  >
                    {imported ? (
                      <>
                        <Check size={12} /> Imported
                      </>
                    ) : (
                      'Import'
                    )}
                  </button>
                </div>
              )
            })}
            {detected.length === 0 && !scanning && (
              <p className="py-6 text-center text-[12.5px] text-slate-500">
                Scan a folder to discover projects with a package.json.
              </p>
            )}
          </div>
        </div>
      )}

      <div className="mt-3 border-t border-white/[0.06] pt-1">
        <Toggle
          label="Write AI integration files"
          description="Adds CLAUDE.md (if missing) and .starlaunch.json so AI assistants know StarLaunch runs this project"
          checked={settings.writeAiFilesOnRegister}
          onChange={(v) => updateSettings({ writeAiFilesOnRegister: v })}
        />
      </div>
    </ModalShell>
  )
}
