import { useEffect, useState } from 'react'
import { Copy, FolderOpen, RefreshCw, Upload } from 'lucide-react'
import type { AiIntegrationStatus } from '@shared/types'
import { useAppStore } from '../store/useAppStore'
import ModalShell from './ModalShell'
import { Field, TextInput, Select, Toggle } from './form'

export default function SettingsModal(): JSX.Element {
  const closeSettings = useAppStore((s) => s.closeSettings)
  const settings = useAppStore((s) => s.settings)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const pushToast = useAppStore((s) => s.pushToast)
  const refreshProjects = useAppStore((s) => s.refreshProjects)

  const [generating, setGenerating] = useState(false)
  const [importing, setImporting] = useState(false)
  const [aiStatus, setAiStatus] = useState<AiIntegrationStatus | null>(null)
  const [regeneratingToken, setRegeneratingToken] = useState(false)

  useEffect(() => {
    window.StarLaunch.aiIntegration.getStatus().then(setAiStatus)
  }, [settings.aiIntegrationEnabled, settings.aiIntegrationPort, settings.aiIntegrationToken])

  async function browseRoot(): Promise<void> {
    const dir = await window.StarLaunch.dialog.pickDirectory()
    if (dir) updateSettings({ defaultProjectRoot: dir })
  }

  async function browseRegistryLocation(): Promise<void> {
    const path = await window.StarLaunch.dialog.pickRegistryLocation()
    if (path) updateSettings({ registryPath: path })
  }

  async function generateRegistryNow(): Promise<void> {
    setGenerating(true)
    try {
      const result = await window.StarLaunch.registry.generate()
      if (result.ok) pushToast('Registry file written', 'success')
      else pushToast(result.error ?? 'Could not generate the registry', 'error')
    } finally {
      setGenerating(false)
    }
  }

  async function importRegistry(): Promise<void> {
    const path = await window.StarLaunch.dialog.pickImportFile()
    if (!path) return
    setImporting(true)
    try {
      const result = await window.StarLaunch.registry.import(path)
      await refreshProjects()
      const skippedNote = result.skipped > 0 ? `, skipped ${result.skipped} already known` : ''
      pushToast(`Imported ${result.imported} project${result.imported === 1 ? '' : 's'}${skippedNote}`, 'success')
    } finally {
      setImporting(false)
    }
  }

  async function copyToken(): Promise<void> {
    if (!settings.aiIntegrationToken) return
    await window.StarLaunch.clipboard.write(settings.aiIntegrationToken)
    pushToast('Token copied to clipboard', 'success')
  }

  async function regenerateToken(): Promise<void> {
    setRegeneratingToken(true)
    try {
      const updated = await window.StarLaunch.aiIntegration.regenerateToken()
      useAppStore.setState({ settings: updated })
      pushToast('New AI integration token generated', 'success')
    } finally {
      setRegeneratingToken(false)
    }
  }

  return (
    <ModalShell title="Settings" subtitle="Tune StarLaunch to your workflow" onClose={closeSettings} width="max-w-md">
      <div className="space-y-4">
        <Field label="Default Project Root">
          <div className="flex gap-2">
            <TextInput
              value={settings.defaultProjectRoot}
              onChange={(e) => updateSettings({ defaultProjectRoot: e.target.value })}
              placeholder="D:/Projects"
            />
            <button
              type="button"
              onClick={browseRoot}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-[12.5px] text-slate-300 transition hover:bg-white/[0.08]"
            >
              <FolderOpen size={14} />
              Browse…
            </button>
          </div>
        </Field>

        <Field label="Theme">
          <Select value={settings.theme} onChange={(e) => updateSettings({ theme: e.target.value as any })}>
            <option value="nebula">Nebula</option>
            <option value="midnight">Midnight</option>
            <option value="aurora">Aurora</option>
          </Select>
        </Field>

        <Field label={`Background Intensity — ${Math.round(settings.backgroundIntensity * 100)}%`}>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.backgroundIntensity}
            onChange={(e) => updateSettings({ backgroundIntensity: Number(e.target.value) })}
            className="w-full accent-nebula-blue"
          />
        </Field>

        <div className="divide-y divide-white/[0.06] rounded-lg border border-white/[0.06] bg-white/[0.02] px-3">
          <Toggle
            label="Animations"
            description="Drifting nebula, stars and motion effects"
            checked={settings.animationsEnabled}
            onChange={(v) => updateSettings({ animationsEnabled: v })}
          />
          <Toggle
            label="Auto-open browser"
            description="Open localhost automatically after a project starts"
            checked={settings.autoOpenBrowser}
            onChange={(v) => updateSettings({ autoOpenBrowser: v })}
          />
          <Toggle
            label="Remember running apps"
            description="Relaunch previously running projects on startup"
            checked={settings.rememberRunningApps}
            onChange={(v) => updateSettings({ rememberRunningApps: v })}
          />
          <Toggle
            label="Write AI integration files"
            description="Add Project, Import and the AI API write CLAUDE.md (if missing) and .starlaunch.json into the folder"
            checked={settings.writeAiFilesOnRegister}
            onChange={(v) => updateSettings({ writeAiFilesOnRegister: v })}
          />
          <Toggle
            label="Launch StarLaunch at startup"
            description="Start automatically when you log in"
            checked={settings.launchAtStartup}
            onChange={(v) => updateSettings({ launchAtStartup: v })}
          />
        </div>

        <div className="space-y-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
          <Toggle
            label="Enable Registry"
            description="Keep a human-readable file describing your local projects up to date"
            checked={settings.registryEnabled}
            onChange={(v) => updateSettings({ registryEnabled: v })}
          />

          <Field label="Registry File Location">
            <div className="flex gap-2">
              <TextInput
                value={settings.registryPath}
                onChange={(e) => updateSettings({ registryPath: e.target.value })}
                placeholder="D:/Projects/StarLaunch-registry.txt"
              />
              <button
                type="button"
                onClick={browseRegistryLocation}
                className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-[12.5px] text-slate-300 transition hover:bg-white/[0.08]"
              >
                <FolderOpen size={14} />
                Browse…
              </button>
            </div>
          </Field>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={generateRegistryNow}
              disabled={!settings.registryPath || generating}
              className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-[12.5px] font-medium text-slate-200 transition hover:bg-white/[0.08] disabled:opacity-50"
            >
              <RefreshCw size={13} className={generating ? 'animate-spin' : ''} />
              Generate Registry Now
            </button>
            <button
              type="button"
              onClick={importRegistry}
              disabled={importing}
              className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-[12.5px] font-medium text-slate-200 transition hover:bg-white/[0.08] disabled:opacity-50"
            >
              <Upload size={13} />
              Import Existing Registry
            </button>
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
          <Toggle
            label="Enable AI Integration API"
            description="Local, loopback-only REST API for AI assistants — read, register, start/stop/restart, logs. Never delete."
            checked={settings.aiIntegrationEnabled}
            onChange={(v) => updateSettings({ aiIntegrationEnabled: v })}
          />

          {settings.aiIntegrationEnabled && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Port">
                  <TextInput
                    type="number"
                    value={settings.aiIntegrationPort}
                    onChange={(e) => updateSettings({ aiIntegrationPort: Number(e.target.value) })}
                    min={1024}
                    max={65535}
                  />
                </Field>
                <Field label="Status">
                  <div className="flex h-9 items-center rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-[13px]">
                    {aiStatus?.running ? (
                      <span className="text-status-running">Running on 127.0.0.1:{aiStatus.port}</span>
                    ) : (
                      <span className="text-slate-500">Not running</span>
                    )}
                  </div>
                </Field>
              </div>

              <Field label="Bearer Token">
                <div className="flex gap-2">
                  <TextInput value={settings.aiIntegrationToken} readOnly className="font-mono text-[12px]" />
                  <button
                    type="button"
                    onClick={copyToken}
                    title="Copy token"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-slate-300 transition hover:bg-white/[0.08]"
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={regenerateToken}
                    disabled={regeneratingToken}
                    title="Regenerate token"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-slate-300 transition hover:bg-white/[0.08] disabled:opacity-50"
                  >
                    <RefreshCw size={14} className={regeneratingToken ? 'animate-spin' : ''} />
                  </button>
                </div>
              </Field>

              <p className="text-[11px] leading-relaxed text-slate-500">
                Give this token and port to an AI tool you trust — it grants read/register/start/stop/restart/logs
                access to every project registered here, but never delete or reconfigure access.
              </p>
            </>
          )}
        </div>
      </div>
    </ModalShell>
  )
}
