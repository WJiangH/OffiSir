import { useEffect, useState } from 'react'

function resolveFallback(fallback) {
  return typeof fallback === 'function' ? fallback() : fallback
}

export default function usePersistentState(key, fallback) {
  const [state, setState] = useState(() => {
    try {
      const raw = localStorage.getItem(key)
      if (raw == null) return resolveFallback(fallback)
      return JSON.parse(raw)
    } catch {
      return resolveFallback(fallback)
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state))
    } catch {}
  }, [key, state])

  return [state, setState]
}
