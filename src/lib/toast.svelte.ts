export const toasts = $state<{ id: number; text: string; tone: 'info' | 'error' }[]>([])
let seq = 0

export function toast(text: string, tone: 'info' | 'error' = 'info') {
  const id = ++seq
  toasts.push({ id, text, tone })
  setTimeout(() => {
    const i = toasts.findIndex((t) => t.id === id)
    if (i >= 0) toasts.splice(i, 1)
  }, tone === 'error' ? 4500 : 2500)
}

export function errorText(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message)
  return String(e)
}
