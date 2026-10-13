import { useEffect } from 'react'
import { useAppStore } from './store/useAppStore'
import BackgroundSlideshow from './components/BackgroundSlideshow'
import Header from './components/Header'
import StatsBar from './components/StatsBar'
import CategoryFilter from './components/CategoryFilter'
import ProjectList from './components/ProjectList'
import LogConsole from './components/LogConsole'
import AddProjectModal from './components/AddProjectModal'
import CreateProjectModal from './components/CreateProjectModal'
import SettingsModal from './components/SettingsModal'
import ToastStack from './components/ToastStack'

export default function App(): JSX.Element {
  const bootstrap = useAppStore((s) => s.bootstrap)
  const ready = useAppStore((s) => s.ready)
  const settings = useAppStore((s) => s.settings)
  const addModalOpen = useAppStore((s) => s.addModalOpen)
  const createModalOpen = useAppStore((s) => s.createModalOpen)
  const settingsModalOpen = useAppStore((s) => s.settingsModalOpen)

  useEffect(() => {
    bootstrap()
  }, [bootstrap])

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <BackgroundSlideshow intensity={settings.backgroundIntensity} animate={settings.animationsEnabled} />

      <div className="flex h-full flex-col">
        <Header />
        <StatsBar />
        <div className="h-3" />
        <CategoryFilter />
        <main className="flex min-h-0 flex-1 flex-col gap-3 px-6 py-3">
          {ready ? <ProjectList /> : <div className="flex-1" />}
        </main>
        <LogConsole />
      </div>

      {addModalOpen && <AddProjectModal />}
      {createModalOpen && <CreateProjectModal />}
      {settingsModalOpen && <SettingsModal />}
      <ToastStack />
    </div>
  )
}
