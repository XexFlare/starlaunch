const FG_COLORS: Record<number, string> = {
  30: '#5b6472',
  31: '#f87171',
  32: '#34d399',
  33: '#fbbf24',
  34: '#60a5fa',
  35: '#c084fc',
  36: '#2dd4bf',
  37: '#e2e8f0',
  90: '#7c8798',
  91: '#fca5a5',
  92: '#6ee7b7',
  93: '#fde68a',
  94: '#93c5fd',
  95: '#d8b4fe',
  96: '#5eead4',
  97: '#f8fafc'
}

interface Segment {
  text: string
  color?: string
  bold?: boolean
  dim?: boolean
  italic?: boolean
}

const ANSI_RE = /\x1b\[([0-9;]*)m/g

export function parseAnsi(input: string): Segment[] {
  const segments: Segment[] = []
  let color: string | undefined
  let bold = false
  let dim = false
  let italic = false
  let lastIndex = 0
  let match: RegExpExecArray | null

  ANSI_RE.lastIndex = 0
  while ((match = ANSI_RE.exec(input))) {
    if (match.index > lastIndex) {
      const text = input.slice(lastIndex, match.index)
      if (text) segments.push({ text, color, bold, dim, italic })
    }
    const codes = match[1].split(';').filter(Boolean).map(Number)
    if (codes.length === 0) codes.push(0)
    for (const code of codes) {
      if (code === 0) {
        color = undefined
        bold = false
        dim = false
        italic = false
      } else if (code === 1) bold = true
      else if (code === 2) dim = true
      else if (code === 3) italic = true
      else if (code === 22) {
        bold = false
        dim = false
      } else if (code === 23) italic = false
      else if (code === 39) color = undefined
      else if (FG_COLORS[code]) color = FG_COLORS[code]
    }
    lastIndex = ANSI_RE.lastIndex
  }
  if (lastIndex < input.length) {
    segments.push({ text: input.slice(lastIndex), color, bold, dim, italic })
  }
  if (segments.length === 0) segments.push({ text: input })
  return segments
}

export function AnsiLine({ text }: { text: string }): JSX.Element {
  const segments = parseAnsi(text)
  return (
    <>
      {segments.map((seg, i) => (
        <span
          key={i}
          style={{
            color: seg.color,
            fontWeight: seg.bold ? 600 : 400,
            opacity: seg.dim ? 0.6 : 1,
            fontStyle: seg.italic ? 'italic' : 'normal'
          }}
        >
          {seg.text}
        </span>
      ))}
    </>
  )
}
