/// <reference types="vite/client" />

import type { StarLaunchApi } from '../../preload/index'

declare global {
  interface Window {
    StarLaunch: StarLaunchApi
  }
}

export {}
