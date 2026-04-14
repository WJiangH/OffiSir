import React, { useMemo, useState } from 'react'
import { X } from 'lucide-react'

function parseTurns(rawText, fallbackStart = 2) {
  const text = (rawText || '').replace(/\r\n/g, '\n').trim()
  if (!text) return []

  // Pattern: "## Turn 5" / "Turn 5:" / "Turn 5 -" / "Turn 5\n"
  const labelRe = /(?:^|\n)\s*(?:##\s*)?Turn\s+(\d+)\s*[:\-]?\s*/gi
  const labelMatches = [...text.matchAll(labelRe)]

  if (labelMatches.length > 0) {
    const out = []
    for (let i = 0; i < labelMatches.length; i++) {
      const m = labelMatches[i]
      const num = parseInt(m[1], 10)
      const bodyStart = m.index + m[0].length
      const bodyEnd = i + 1 < labelMatches.length ? labelMatches[i + 1].index : text.length
      const body = text.slice(bodyStart, bodyEnd).trim()
      if (body) out.push({ number: num, text: body })
    }
    if (out.length > 0) return out
  }

  // Fallback: blank-line-separated paragraphs, auto-numbered from fallbackStart.
  const paragraphs = text.split(/\n\s*\n+/).map((p) => p.trim()).filter(Boolean)
  if (paragraphs.length > 1) {
    return paragraphs.map((p, i) => ({ number: fallbackStart + i, text: p }))
  }

  // Single block — one turn.
  return [{ number: fallbackStart, text }]
}

export default function PasteTurnsModal({ defaultStart = 2, onCancel, onApply }) {
  const [raw, setRaw] = useState('')
  const [start, setStart] = useState(defaultStart)

  const preview = useMemo(() => parseTurns(raw, Number(start) || 2), [raw, start])

  const submit = (e) => {
    e?.preventDefault()
    if (preview.length === 0) return
    onApply(preview)
  }

  return (
    <div className="save-task-backdrop" onClick={onCancel}>
      <form
        className="save-task-modal paste-turns-modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <div className="save-task-header">
          <h3>Paste turns</h3>
          <button className="save-task-close" onClick={onCancel} type="button" title="Close">
            <X size={16} />
          </button>
        </div>

        <p className="paste-turns-hint">
          Paste turn content. If your text has "Turn N" labels, turn numbers are
          read from them. Otherwise blank-line-separated blocks become turns starting at
          the number below.
        </p>

        <label className="save-task-field paste-turns-start-field">
          <span>Start turn # (if no labels)</span>
          <input
            className="save-task-input"
            min="1"
            onChange={(e) => setStart(e.target.value)}
            type="number"
            value={start}
          />
        </label>

        <label className="save-task-field">
          <span>Turn text</span>
          <textarea
            autoFocus
            className="save-task-textarea paste-turns-textarea"
            onChange={(e) => setRaw(e.target.value)}
            placeholder={`Paste like:\n\n## Turn 2\nFirst fix here\n\n## Turn 3\nSecond fix here\n\n…or plain paragraphs separated by blank lines.`}
            rows={10}
            value={raw}
          />
        </label>

        <div className="paste-turns-preview">
          {preview.length > 0
            ? `${preview.length} turn${preview.length === 1 ? '' : 's'} detected · Turn ${preview[0].number} – Turn ${preview[preview.length - 1].number}`
            : 'Nothing parsed yet.'}
        </div>

        <div className="save-task-actions">
          <button className="save-task-cancel" onClick={onCancel} type="button">Cancel</button>
          <button className="save-task-submit" disabled={preview.length === 0} type="submit">
            Load turns
          </button>
        </div>
      </form>
    </div>
  )
}
