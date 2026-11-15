import { useSyncExternalStore } from 'react'
import type { Window } from './frames'
export interface SharedImage { id: string; canvas: HTMLCanvasElement; window: Window; offset: number; visit: number; version: number }
let current: SharedImage | null = null
const listeners = new Set<() => void>()
export function publishImage(image: Omit<SharedImage, 'version'>) {
  current = { ...image, version: (current?.version ?? 0) + 1 }
  listeners.forEach(fn => fn())
}
export function clearImage(canvas: HTMLCanvasElement) {
  if (current?.canvas !== canvas) return
  current = null; listeners.forEach(fn => fn())
}
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } }
export const useSharedImage = () => useSyncExternalStore(subscribe, () => current)
