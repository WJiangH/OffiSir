import { useEffect, useState } from 'react'

function resolveFallback(fallback) {
  return typeof fallback === 'function' ? fallback() : fallback
}

export default function useSessionState(key, fallback) {
  const [state, setState] = useState(() => {
    try {
      const raw = sessionStorage.getItem(key)
      if (raw == null) return resolveFallback(fallback)
      return JSON.parse(raw)
    } catch {
      return resolveFallback(fallback)
    }
  })

  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(state))
    } catch {}
  }, [key, state])

  return [state, setState]
}
