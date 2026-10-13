export type BackgroundCollection =
  | 'James Webb Space Telescope'
  | 'Hubble Space Telescope'
  | 'NASA'
  | 'AI Astronomy'

export interface PhotoBackground {
  kind: 'photo'
  id: string
  title: string
  collection: BackgroundCollection
  credit: string
  src: string
}

export interface ProceduralBackground {
  kind: 'procedural'
  id: string
  title: string
  collection: BackgroundCollection
  credit: string
  variant: 'violet-nebula' | 'teal-galaxy' | 'amber-deepfield'
}

export type BackgroundEntry = PhotoBackground | ProceduralBackground

/**
 * Curated set of real, freely-licensed NASA / ESA imagery (verified live at
 * cdn.esawebb.org / cdn.esahubble.org / assets.science.nasa.gov), plus a
 * few generative "AI Astronomy" pieces for the fourth collection since no
 * real AI-generated astrophoto could be sourced with attribution.
 */
export const BACKGROUND_IMAGES: BackgroundEntry[] = [
  {
    kind: 'photo',
    id: 'weic2205a',
    title: 'Cosmic Cliffs',
    collection: 'James Webb Space Telescope',
    credit: 'NASA, ESA, CSA, STScI',
    src: 'https://cdn.esawebb.org/archives/images/wallpaper5/weic2205a.jpg'
  },
  {
    kind: 'photo',
    id: 'weic2216b',
    title: 'Pillars of Creation',
    collection: 'James Webb Space Telescope',
    credit: 'NASA, ESA, CSA, STScI',
    src: 'https://cdn.esawebb.org/archives/images/wallpaper5/weic2216b.jpg'
  },
  {
    kind: 'photo',
    id: 'weic2207b',
    title: 'Southern Ring Nebula',
    collection: 'James Webb Space Telescope',
    credit: 'NASA, ESA, CSA, STScI',
    src: 'https://cdn.esawebb.org/archives/images/wallpaper5/weic2207b.jpg'
  },
  {
    kind: 'photo',
    id: 'weic2208a',
    title: "Stephan's Quintet",
    collection: 'James Webb Space Telescope',
    credit: 'NASA, ESA, CSA, STScI',
    src: 'https://cdn.esawebb.org/archives/images/wallpaper5/weic2208a.jpg'
  },
  {
    kind: 'photo',
    id: 'heic1501a',
    title: 'Pillars of Creation',
    collection: 'Hubble Space Telescope',
    credit: 'NASA, ESA/Hubble and the Hubble Heritage Team',
    src: 'https://cdn.esahubble.org/archives/images/wallpaper_uhd/heic1501a.jpg'
  },
  {
    kind: 'photo',
    id: 'heic2506a',
    title: 'Sombrero Galaxy',
    collection: 'Hubble Space Telescope',
    credit: 'ESA/Hubble & NASA, K. Noll',
    src: 'https://cdn.esahubble.org/archives/images/wallpaper5/heic2506a.jpg'
  },
  {
    kind: 'photo',
    id: 'heic2507a',
    title: 'Eagle Nebula',
    collection: 'Hubble Space Telescope',
    credit: 'ESA/Hubble & NASA, K. Noll',
    src: 'https://cdn.esahubble.org/archives/images/wallpaper5/heic2507a.jpg'
  },
  {
    kind: 'photo',
    id: 'earthrise',
    title: 'Earthrise',
    collection: 'NASA',
    credit: 'NASA / Apollo 8 / William Anders',
    src: 'https://assets.science.nasa.gov/content/dam/science/psd/lunar-science/2023/09/apollo8_earthrise.jpg'
  },
  {
    kind: 'photo',
    id: 'cassini-saturn',
    title: 'Farewell to Saturn',
    collection: 'NASA',
    credit: 'NASA/JPL-Caltech/Space Science Institute',
    src: 'https://assets.science.nasa.gov/dynamicimage/assets/science/psd/solar/2023/06/PIA17218_MAIN-1280x720-1.jpg'
  },
  {
    kind: 'procedural',
    id: 'procedural-violet',
    title: 'Drifting Nebula',
    collection: 'AI Astronomy',
    credit: 'Generative Astronomy — StarLaunch',
    variant: 'violet-nebula'
  },
  {
    kind: 'procedural',
    id: 'procedural-teal',
    title: 'Silent Galaxy',
    collection: 'AI Astronomy',
    credit: 'Generative Astronomy — StarLaunch',
    variant: 'teal-galaxy'
  },
  {
    kind: 'procedural',
    id: 'procedural-amber',
    title: 'Deep Field',
    collection: 'AI Astronomy',
    credit: 'Generative Astronomy — StarLaunch',
    variant: 'amber-deepfield'
  }
]
