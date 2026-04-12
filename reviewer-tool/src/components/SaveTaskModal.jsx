import React, { useState } from 'react'
import { X } from 'lucide-react'

export default function SaveTaskModal({ defaultName, onCancel, onSave }) {
  const [name, setName] = useState(defaultName || '')
  const [note, setNote] = useState('')

  const submit = (e) => {
    e?.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) return
    onSave({ name: trimmedName, note: note.trim() || null })
  }

  return (
    <div className="save-task-backdrop" onClick={onCancel}>
      <form
        className="save-task-modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <div className="save-task-header">
          <h3>Save as task</h3>
          <button className="save-task-close" onClick={onCancel} type="button" title="Close">
            <X size={16} />
          </button>
        </div>

        <label className="save-task-field">
          <span>Task name</span>
          <input
            autoFocus
            className="save-task-input"
            onChange={(e) => setName(e.target.value)}
            type="text"
            value={name}
          />
        </label>

        <label className="save-task-field">
          <span>Note (optional)</span>
          <textarea
            className="save-task-textarea"
            onChange={(e) => setNote(e.target.value)}
            placeholder="What is this task for? Any context worth remembering next time…"
            rows={4}
            value={note}
          />
        </label>

        <div className="save-task-actions">
          <button className="save-task-cancel" onClick={onCancel} type="button">Cancel</button>
          <button className="save-task-submit" disabled={!name.trim()} type="submit">Save</button>
        </div>
      </form>
    </div>
  )
}
