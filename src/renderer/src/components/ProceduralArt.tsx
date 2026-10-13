interface Props {
  variant: 'violet-nebula' | 'teal-galaxy' | 'amber-deepfield'
}

const RECIPES: Record<Props['variant'], { background: string; stars: number }> = {
  'violet-nebula': {
    background:
      'radial-gradient(ellipse 70% 55% at 30% 35%, rgba(168,120,255,0.55) 0%, transparent 60%),' +
      'radial-gradient(ellipse 60% 50% at 70% 60%, rgba(96,70,200,0.45) 0%, transparent 65%),' +
      'radial-gradient(ellipse 90% 70% at 55% 80%, rgba(232,121,249,0.18) 0%, transparent 60%),' +
      'radial-gradient(ellipse 120% 100% at 50% 50%, #1a1030 0%, #060613 60%, #020207 100%)',
    stars: 90
  },
  'teal-galaxy': {
    background:
      'radial-gradient(ellipse 65% 50% at 60% 30%, rgba(94,234,212,0.4) 0%, transparent 60%),' +
      'radial-gradient(ellipse 70% 60% at 35% 65%, rgba(56,140,220,0.4) 0%, transparent 65%),' +
      'radial-gradient(ellipse 100% 80% at 50% 50%, rgba(20,60,90,0.35) 0%, transparent 70%),' +
      'radial-gradient(ellipse 120% 100% at 50% 50%, #071822 0%, #04101a 55%, #01060a 100%)',
    stars: 110
  },
  'amber-deepfield': {
    background:
      'radial-gradient(ellipse 55% 45% at 40% 40%, rgba(251,191,36,0.28) 0%, transparent 60%),' +
      'radial-gradient(ellipse 70% 55% at 65% 55%, rgba(244,114,182,0.22) 0%, transparent 65%),' +
      'radial-gradient(ellipse 100% 90% at 50% 50%, rgba(30,20,45,0.5) 0%, transparent 70%),' +
      'radial-gradient(ellipse 120% 100% at 50% 50%, #0b0714 0%, #05040c 55%, #020103 100%)',
    stars: 150
  }
}

function seededStars(count: number, seed: number): { x: number; y: number; r: number }[] {
  const stars: { x: number; y: number; r: number }[] = []
  let s = seed
  const rand = (): number => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
  for (let i = 0; i < count; i++) {
    stars.push({ x: rand() * 100, y: rand() * 100, r: rand() < 0.9 ? 0.8 : 1.6 })
  }
  return stars
}

export default function ProceduralArt({ variant }: Props): JSX.Element {
  const recipe = RECIPES[variant]
  const stars = seededStars(recipe.stars, variant.length * 97 + 13)

  return (
    <div className="absolute inset-0" style={{ background: recipe.background }}>
      <svg className="absolute inset-0 h-full w-full opacity-80">
        {stars.map((star, i) => (
          <circle key={i} cx={`${star.x}%`} cy={`${star.y}%`} r={star.r} fill="white" />
        ))}
      </svg>
      <div
        className="absolute inset-0 opacity-[0.05] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")"
        }}
      />
    </div>
  )
}
