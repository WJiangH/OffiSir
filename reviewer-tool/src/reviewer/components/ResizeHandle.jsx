import React, { useCallback, useEffect, useRef } from 'react'

export default function ResizeHandle({ heightPercent, onHeightChange }) {
  const draggingRef = useRef(false)
  const containerRef = useRef(null)

  const onMouseDown = useCallback((e) => {
    e.preventDefault()
    draggingRef.current = true
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
  }, [])

  useEffect(() => {
    const onMove = (e) => {
      if (!draggingRef.current) return
      const rail = containerRef.current?.parentElement
      if (!rail) return
      const rect = rail.getBoundingClientRect()
      const y = e.clientY - rect.top
      // Convert to vh so clamp matches CSS constraints
      const vh = (y / window.innerHeight) * 100
      const pct = Math.min(Math.max(vh, 20), 35)
      onHeightChange(pct)
    }
    const onUp = () => {
      if (draggingRef.current) {
        draggingRef.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [onHeightChange])

  return (
    <div className="reviewer-resize-handle" ref={containerRef} onMouseDown={onMouseDown}>
      <div className="reviewer-resize-handle-bar" />
    </div>
  )
}
