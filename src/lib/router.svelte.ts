function current(): string {
  return location.hash.replace(/^#/, '') || '/'
}

export const route = $state({ path: current() })

window.addEventListener('hashchange', () => {
  route.path = current()
  window.scrollTo(0, 0)
})

export function go(path: string) {
  location.hash = path
}

/** match('/deck/:id', '/deck/abc') → { id: 'abc' } */
export function match(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split('/').filter(Boolean)
  const a = path.split('?')[0].split('/').filter(Boolean)
  if (p.length !== a.length) return null
  const params: Record<string, string> = {}
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(':')) params[p[i].slice(1)] = decodeURIComponent(a[i])
    else if (p[i] !== a[i]) return null
  }
  return params
}
