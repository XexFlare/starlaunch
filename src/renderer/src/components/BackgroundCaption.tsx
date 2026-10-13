import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { BackgroundEntry } from '../lib/backgroundImages'

interface Props {
  entry: BackgroundEntry
  onPrev: () => void
  onNext: () => void
}

export default function BackgroundCaption({ entry, onPrev, onNext }: Props): JSX.Element {
  return (
    <div className="pointer-events-none fixed bottom-16 left-6 z-0 text-left">
      <AnimatePresence mode="wait">
        <motion.div
          key={entry.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        >
          <p className="text-[12px] font-medium tracking-wide text-white/70">{entry.title}</p>
          <p className="text-[10.5px] text-white/40">{entry.collection}</p>
        </motion.div>
      </AnimatePresence>

      <div className="pointer-events-auto mt-1.5 flex items-center gap-3">
        <button
          onClick={onPrev}
          aria-label="Previous image"
          className="text-white/35 transition hover:text-white/80 active:scale-90"
        >
          <ChevronLeft size={14} />
        </button>
        <button
          onClick={onNext}
          aria-label="Next image"
          className="text-white/35 transition hover:text-white/80 active:scale-90"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}
