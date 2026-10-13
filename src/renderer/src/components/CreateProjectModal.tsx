import { useEffect, useRef, useState } from 'react'
import { FolderOpen, Sparkles } from 'lucide-react'
import type { Category, Framework, PackageManager } from '@shared/types'
import { CATEGORIES, FRAMEWORKS, PACKAGE_MANAGERS } from '@shared/types'
import { useAppStore } from '../store/useAppStore'
import ModalShell from './ModalShell'
import { Field, TextInput, Select, Toggle } from './form'

function defaultCommandFor(pm: PackageManager): string {
  switch (pm) {
    case 'npm':
      return 'npm run dev'
    case 'pnpm':
      return 'pnpm dev'
    case 'yarn':
      return 'yarn dev'
    case 'bun':
      return 'bun dev'
  }
}

export default function CreateProjectModal(): JSX.Element {
  const closeCreateModal = useAppStore((s) => s.closeCreateModal)
  const createProject = useAppStore((s) => s.createProject)
  const creating = useAppStore((s) => s.creating)
  const createProgress = useAppStore((s) => s.createProgress)
  const settings = useAppStore((s) => s.settings)
  const pushToast = useAppStore((s) => s.pushToast)

  const [name, setName] = useState('')
  const [parentFolder, setParentFolder] = useState(settings.defaultProjectRoot)
  const [framework, setFramework] = useState<Framework>('React')
  const [packageManager, setPackageManager] = useState<PackageManager>('npm')
  const [category, setCategory] = useState<Category>('Development')
  const [port, setPort] = useState<number | undefined>(undefined)
  const [command, setCommand] = useState('npm run dev')
  const [commandTouched, setCommandTouched] = useState(false)
  const [createGitRepo, setCreateGitRepo] = useState(true)
  const [openInVsCode, setOpenInVsCode] = useState(false)
  const [launchAfterCreate, setLaunchAfterCreate] = useState(false)
  const [done, setDone] = useState(false)

  const progressRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!commandTouched) setCommand(defaultCommandFor(packageManager))
  }, [packageManager, commandTouched])

  useEffect(() => {
    if (progressRef.current) progressRef.current.scrollTop = progressRef.current.scrollHeight
  }, [createProgress])

  async function browseParentFolder(): Promise<void> {
    const dir = await window.StarLaunch.dialog.pickDirectory()
    if (dir) setParentFolder(dir)
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!name.trim() || !parentFolder.trim()) {
      pushToast('Project name and parent folder are required', 'error')
      return
    }
    setDone(false)
    const result = await createProject({
      name: name.trim(),
      parentFolder,
      framework,
      packageManager,
      category,
      port,
      command,
      createGitRepo,
      openInVsCode,
      launchAfterCreate
    })
    if (result.ok) {
      setDone(true)
    }
  }

  return (
    <ModalShell
      title="Create Project"
      subtitle="Scaffold a new project and register it with StarLaunch"
      onClose={creating ? () => undefined : closeCreateModal}
      width="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="Project Name">
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ShipDemurrageCalculatorX"
            disabled={creating}
            autoFocus
          />
        </Field>

        <Field label="Parent Folder">
          <div className="flex gap-2">
            <TextInput
              value={parentFolder}
              onChange={(e) => setParentFolder(e.target.value)}
              placeholder="D:/Projects"
              disabled={creating}
            />
            <button
              type="button"
              onClick={browseParentFolder}
              disabled={creating}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-[12.5px] text-slate-300 transition hover:bg-white/[0.08] disabled:opacity-50"
            >
              <FolderOpen size={14} />
              Browse…
            </button>
          </div>
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Framework">
            <Select value={framework} onChange={(e) => setFramework(e.target.value as Framework)} disabled={creating}>
              {FRAMEWORKS.map((f) => (
                <option key={f} value={f}>
                  {f === 'Next' ? 'Next.js' : f === 'Empty' ? 'Empty Project' : f}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Package Manager">
            <Select
              value={packageManager}
              onChange={(e) => setPackageManager(e.target.value as PackageManager)}
              disabled={creating}
            >
              {PACKAGE_MANAGERS.map((pm) => (
                <option key={pm} value={pm}>
                  {pm}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Category">
            <Select value={category} onChange={(e) => setCategory(e.target.value as Category)} disabled={creating}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Preferred Port">
            <TextInput
              type="number"
              value={port ?? ''}
              onChange={(e) => setPort(e.target.value === '' ? undefined : Number(e.target.value))}
              min={1}
              max={65535}
              placeholder="Auto-detect"
              disabled={creating}
            />
          </Field>
          <Field label="Startup Command">
            <TextInput
              value={command}
              onChange={(e) => {
                setCommand(e.target.value)
                setCommandTouched(true)
              }}
              disabled={creating}
            />
          </Field>
        </div>

        <div className="divide-y divide-white/[0.06] rounded-lg border border-white/[0.06] bg-white/[0.02] px-3">
          <Toggle
            label="Create Git Repository"
            description="Run git init in the new project"
            checked={createGitRepo}
            onChange={setCreateGitRepo}
          />
          <Toggle
            label="Open in VS Code after creation"
            description="Requires the 'code' command to be on your PATH"
            checked={openInVsCode}
            onChange={setOpenInVsCode}
          />
          <Toggle
            label="Launch project after creation"
            description="Start the dev server as soon as scaffolding finishes"
            checked={launchAfterCreate}
            onChange={setLaunchAfterCreate}
          />
        </div>

        {(creating || createProgress.length > 0) && (
          <div
            ref={progressRef}
            className="max-h-40 overflow-y-auto scrollbar-thin rounded-lg border border-white/[0.06] bg-black/30 px-3 py-2 font-mono text-[11.5px] leading-[1.55] text-slate-300"
          >
            {createProgress.map((line, i) => (
              <div key={i} className="whitespace-pre-wrap break-all">
                {line}
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={closeCreateModal}
            disabled={creating}
            className="rounded-lg px-3.5 py-2 text-[13px] font-medium text-slate-400 transition hover:text-white disabled:opacity-50"
          >
            {done ? 'Close' : 'Cancel'}
          </button>
          {!done && (
            <button
              type="submit"
              disabled={creating}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-nebula-purple to-nebula-blue px-4 py-2 text-[13px] font-medium text-white shadow-glow-purple transition hover:brightness-110 active:scale-[0.97] disabled:opacity-60"
            >
              <Sparkles size={14} />
              {creating ? 'Creating…' : 'Create'}
            </button>
          )}
        </div>
      </form>
    </ModalShell>
  )
}
