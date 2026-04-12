import React, { useCallback, useRef, useState } from 'react'
import { parsePromptVars } from './PromptText'

function VarPill({ value, onChange }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef(null)

  const startEditing = (e) => {
    e?.stopPropagation()
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
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation()
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
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(text)
  const textareaRef = useRef(null)

  const startFullEdit = (e) => {
    e?.stopPropagation()
    setDraft(text)
    setEditing(true)
    requestAnimationFrame(() => {
      const el = textareaRef.current
      if (!el) return
      el.focus()
      el.selectionStart = el.selectionEnd = el.value.length
    })
  }

  const commit = () => {
    setEditing(false)
    const next = draft.trim()
    if (next && next !== text) {
      onTextChange(next)
    }
  }

  const cancel = () => {
    setEditing(false)
    setDraft(text)
  }

  const handleVarChange = useCallback((varIndex, newValue) => {
    let varCount = 0
    const newText = text.replace(/\{([^}]+)\}/g, (match, inner) => {
      const result = varCount === varIndex ? `{${newValue}}` : match
      varCount++
      return result
    })
    onTextChange(newText)
  }, [text, onTextChange])

  if (editing) {
    return (
      <textarea
        ref={textareaRef}
        className="reviewer-prompt-edit-textarea"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Escape') {
            e.preventDefault()
            cancel()
            return
          }
          if (e.key === 'Enter') {
            // Cmd/Ctrl+Enter inserts a newline; plain Enter commits.
            if (e.metaKey || e.ctrlKey) return
            e.preventDefault()
            commit()
          }
        }}
      />
    )
  }

  const parts = parsePromptVars(text)

  if (parts.every((p) => p.type === 'text')) {
    return (
      <span
        className="reviewer-prompt-editable-span"
        onClick={startFullEdit}
        title="Click to edit"
      >
        {text}
      </span>
    )
  }

  let varIdx = 0
  return (
    <span
      className="reviewer-prompt-editable-span"
      onClick={startFullEdit}
      title="Click the text to edit the whole prompt; click a pill to edit just that value"
    >
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
