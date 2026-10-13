import { useState } from 'react'
import { FolderOpen, Sparkles, Trash2 } from 'lucide-react'
import type { Category, Framework, PackageManager, Project } from '@shared/types'
import { CATEGORIES, FRAMEWORKS, PACKAGE_MANAGERS } from '@shared/types'
import { useAppStore } from '../store/useAppStore'
import ModalShell from './ModalShell'
import { Field, TextInput, Select } from './form'

export default function ConfigureProjectModal({
  project,
  onClose
}: {
  project: Project
  onClose: () => void
}): JSX.Element {
  const updateProject = useAppStore((s) => s.updateProject)
  const deleteProject = useAppStore((s) => s.deleteProject)
  const pushToast = useAppStore((s) => s.pushToast)

  const [name, setName] = useState(project.name)
  const [directory, setDirectory] = useState(project.directory)
  const [port, setPort] = useState<number | undefined>(project.port)
  const [portConfigDirectory, setPortConfigDirectory] = useState(project.portConfigDirectory ?? '')
  const [command, setCommand] = useState(project.command)
  const [framework, setFramework] = useState<Framework>(project.framework)
  const [packageManager, setPackageManager] = useState<PackageManager | ''>(project.packageManager ?? '')
  const [category, setCategory] = useState<Category>(project.category)
  const [generatingAiFiles, setGeneratingAiFiles] = useState(false)

  async function browseDirectory(): Promise<void> {
    const dir = await window.StarLaunch.dialog.pickDirectory()
    if (dir) setDirectory(dir)
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    await updateProject(project.id, {
      name: name.trim(),
      directory,
      port,
      portConfigDirectory: portConfigDirectory.trim() || undefined,
      command,
      framework,
      packageManager: packageManager || undefined,
      category
    })
    onClose()
  }

  async function handleDelete(): Promise<void> {
    await deleteProject(project.id)
    onClose()
  }

  async function handleGenerateAiFiles(): Promise<void> {
    setGeneratingAiFiles(true)
    try {
      const result = await window.StarLaunch.config.generateAiFiles(project.id)
      if (result.ok) pushToast('CLAUDE.md and .starlaunch.json written', 'success')
      else pushToast(result.error ?? 'Could not generate AI integration files', 'error')
    } finally {
      setGeneratingAiFiles(false)
    }
  }

  return (
    <ModalShell title="Configure Project" subtitle={project.name} onClose={onClose} width="max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="Project Name">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>

        <Field label="Directory">
          <div className="flex gap-2">
            <TextInput value={directory} onChange={(e) => setDirectory(e.target.value)} />
            <button
              type="button"
              onClick={browseDirectory}
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
            <TextInput value={command} onChange={(e) => setCommand(e.target.value)} />
          </Field>
        </div>

        <Field label="Port Config Folder (optional)">
          <TextInput
            value={portConfigDirectory}
            onChange={(e) => setPortConfigDirectory(e.target.value)}
            placeholder="e.g. apps/web (for monorepos; workspaces are detected automatically)"
          />
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Framework">
            <Select value={framework} onChange={(e) => setFramework(e.target.value as Framework)}>
              {FRAMEWORKS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Package Manager">
            <Select value={packageManager} onChange={(e) => setPackageManager(e.target.value as PackageManager)}>
              <option value="">Unspecified</option>
              {PACKAGE_MANAGERS.map((pm) => (
                <option key={pm} value={pm}>
                  {pm}
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

        <button
          type="button"
          onClick={handleGenerateAiFiles}
          disabled={generatingAiFiles}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-[12.5px] font-medium text-slate-200 transition hover:bg-white/[0.08] disabled:opacity-50"
        >
          <Sparkles size={13} />
          Generate AI Integration Files
        </button>

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={handleDelete}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12.5px] font-medium text-status-stopped/80 transition hover:bg-status-stopped/10 hover:text-status-stopped"
          >
            <Trash2 size={13} />
            Delete Project
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3.5 py-2 text-[13px] font-medium text-slate-400 transition hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-gradient-to-br from-nebula-purple to-nebula-blue px-4 py-2 text-[13px] font-medium text-white shadow-glow-purple transition hover:brightness-110 active:scale-[0.97]"
            >
              Save Changes
            </button>
          </div>
        </div>
      </form>
    </ModalShell>
  )
}
