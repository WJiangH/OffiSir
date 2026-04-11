import React, { useCallback, useRef, useState } from 'react'
import { parsePromptVars } from './PromptText'

function VarPill({ value, onChange }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef(null)

  const startEditing = () => {
    setDraft(value)
    setEditing(true)
    requestAnimationFrame(() => inputRef.current?.select())
  }

  const commit = () => {
    setEditing(false)
    const trimmed = draft.trim()
    if (trimmed && trimmed !== value) {
      onChange(trimmed)
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="reviewer-var-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') setEditing(false)
        }}
        size={Math.max(draft.length, 3)}
      />
    )
  }

  return (
    <button
      type="button"
      className="reviewer-var-pill reviewer-var-pill--editable"
      onClick={startEditing}
      title="Click to edit value"
    >
      {value}
    </button>
  )
}

export default function EditablePromptText({ text, onTextChange }) {
  const parts = parsePromptVars(text)

  const handleVarChange = useCallback((varIndex, newValue) => {
    let varCount = 0
    const newText = text.replace(/\{([^}]+)\}/g, (match, inner) => {
      const result = varCount === varIndex ? `{${newValue}}` : match
      varCount++
      return result
    })
    onTextChange(newText)
  }, [text, onTextChange])

  if (parts.every((p) => p.type === 'text')) {
    return <span>{text}</span>
  }

  let varIdx = 0
  return (
    <span>
      {parts.map((part, index) => {
        if (part.type === 'var') {
          const currentIdx = varIdx++
          return (
            <VarPill
              key={`${index}-${part.value}`}
              value={part.value}
              onChange={(newVal) => handleVarChange(currentIdx, newVal)}
            />
          )
        }
        return <span key={index}>{part.value}</span>
      })}
    </span>
  )
}
