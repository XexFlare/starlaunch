import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

interface Props {
  title: string
  subtitle?: string
  onClose: () => void
  children: React.ReactNode
  width?: string
}

export default function ModalShell({ title, subtitle, onClose, children, width = 'max-w-lg' }: Props): JSX.Element {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 flex items-center justify-center bg-space-950/60 backdrop-blur-sm"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose()
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className={`glass-panel-solid relative w-full ${width} rounded-2xl p-5`}
        >
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h2 className="text-[15px] font-semibold text-white">{title}</h2>
              {subtitle && <p className="mt-0.5 text-[12px] text-slate-400">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-white/[0.08] hover:text-white"
            >
              <X size={15} />
            </button>
          </div>
          {children}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
