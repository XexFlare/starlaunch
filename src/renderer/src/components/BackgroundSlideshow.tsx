import { useEffect, useRef, useState } from 'react'
import { BACKGROUND_IMAGES, type BackgroundEntry } from '../lib/backgroundImages'
import ProceduralArt from './ProceduralArt'
import BackgroundCaption from './BackgroundCaption'

const HOLD_MS = 4 * 60 * 1000
const TRANSITION_MS = 52 * 1000
const KENBURNS_VARIANTS = ['kenburns-tl', 'kenburns-br', 'kenburns-tr', 'kenburns-bl']

function variantFor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0
  return KENBURNS_VARIANTS[Math.abs(hash) % KENBURNS_VARIANTS.length]
}

interface Props {
  intensity: number
  animate: boolean
}

export default function BackgroundSlideshow({ intensity, animate }: Props): JSX.Element {
  const [queue, setQueue] = useState<string[]>(() => BACKGROUND_IMAGES.map((b) => b.id))
  const [posIndex, setPosIndex] = useState(0)
  const [phase, setPhase] = useState<'hold' | 'transition'>('hold')
  const [restartToken, setRestartToken] = useState(0)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  const safeLen = Math.max(queue.length, 1)
  const currentId = queue[posIndex % safeLen]
  const nextId = queue[(posIndex + 1) % safeLen]
  const byId = (id: string): BackgroundEntry =>
    BACKGROUND_IMAGES.find((b) => b.id === id) ?? BACKGROUND_IMAGES[0]
  const current = byId(currentId)

  useEffect(() => {
    if (!animate) return undefined
    if (phase === 'hold') {
      timerRef.current = setTimeout(() => setPhase('transition'), HOLD_MS)
    } else {
      timerRef.current = setTimeout(() => {
        setPosIndex((i) => i + 1)
        setPhase('hold')
      }, TRANSITION_MS)
    }
    return () => clearTimeout(timerRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, animate, restartToken])

  function handleError(id: string): void {
    setQueue((prev) => (prev.length > 1 ? prev.filter((q) => q !== id) : prev))
  }

  function goTo(delta: number): void {
    clearTimeout(timerRef.current)
    setPosIndex((i) => (i + delta + safeLen) % safeLen)
    setPhase('hold')
    setRestartToken((n) => n + 1)
  }

  const showingNext = animate && phase === 'transition'
  const windowIds = currentId === nextId ? [currentId] : [currentId, nextId]

  return (
    <div
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-space-950"
      style={{ opacity: intensity }}
    >
      {windowIds.map((id) => (
        <Layer
          key={id}
          entry={byId(id)}
          animate={animate}
          opacity={id === currentId ? 1 : showingNext ? 1 : 0}
          onError={handleError}
        />
      ))}

      <div className="absolute inset-0 bg-gradient-to-b from-space-950/65 via-transparent to-space-950/55" />
      <div className="absolute inset-0 bg-gradient-to-r from-space-950/25 via-transparent to-space-950/25" />

      <div className="pointer-events-auto">
        <BackgroundCaption entry={current} onPrev={() => goTo(-1)} onNext={() => goTo(1)} />
      </div>
    </div>
  )
}

function Layer({
  entry,
  animate,
  opacity,
  onError
}: {
  entry: BackgroundEntry
  animate: boolean
  opacity: number
  onError: (id: string) => void
}): JSX.Element {
  return (
    <div
      className="absolute inset-0"
      style={{ opacity, transition: animate ? `opacity ${TRANSITION_MS}ms ease-in-out` : 'opacity 0.6s ease' }}
    >
      <div
        className={`absolute inset-0 ${animate ? `bg-kenburns ${variantFor(entry.id)}` : ''}`}
        style={{ filter: 'saturate(1.04) brightness(0.92) blur(0.4px)' }}
      >
        {entry.kind === 'photo' ? (
          <img
            src={entry.src}
            alt=""
            className="h-full w-full object-cover"
            draggable={false}
            onError={() => onError(entry.id)}
          />
        ) : (
          <ProceduralArt variant={entry.variant} />
        )}
      </div>
    </div>
  )
}
