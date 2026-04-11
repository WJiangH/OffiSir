import React from 'react'

const VAR_REGEX = /\{([^}]+)\}/g

export function parsePromptVars(text) {
  const parts = []
  let lastIndex = 0
  let match

  VAR_REGEX.lastIndex = 0
  while ((match = VAR_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, match.index) })
    }
    parts.push({ type: 'var', value: match[1] })
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) })
  }

  return parts
}

export function stripVarBraces(text) {
  return text.replace(VAR_REGEX, '$1')
}

export default function PromptText({ text }) {
  const parts = parsePromptVars(text)

  if (parts.length === 1 && parts[0].type === 'text') {
    return <span>{text}</span>
  }

  return (
    <span>
      {parts.map((part, index) => (
        part.type === 'var'
          ? <span key={index} className="reviewer-var-pill">{part.value}</span>
          : <span key={index}>{part.value}</span>
      ))}
    </span>
  )
}
