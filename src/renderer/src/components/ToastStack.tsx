import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, Info, XCircle } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'

const ICONS = {
  success: <CheckCircle2 size={15} className="text-status-running" />,
  error: <XCircle size={15} className="text-status-stopped" />,
  info: <Info size={15} className="text-nebula-blue" />
}

export default function ToastStack(): JSX.Element {
  const toasts = useAppStore((s) => s.toasts)
  const dismissToast = useAppStore((s) => s.dismissToast)

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex flex-col gap-2">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ duration: 0.2 }}
            onClick={() => dismissToast(toast.id)}
            className="glass-panel-solid pointer-events-auto flex max-w-sm items-start gap-2 rounded-lg px-3.5 py-2.5 text-[12.5px] text-slate-200 shadow-glow"
          >
            <span className="mt-0.5 shrink-0">{ICONS[toast.kind]}</span>
            <span>
              {toast.title && <span className="block font-medium text-white">{toast.title}</span>}
              <span className="block text-slate-300">{toast.message}</span>
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
