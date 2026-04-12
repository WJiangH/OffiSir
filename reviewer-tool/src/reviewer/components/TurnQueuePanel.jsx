import React, { useMemo, useState } from 'react'
import { Copy, Save, SplitSquareVertical, Scissors } from 'lucide-react'

function EditableTurnText({ text, turnIndex, onCommit }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(text)

  const start = () => {
    setDraft(text)
    setEditing(true)
  }

  const commit = () => {
    setEditing(false)
    if (draft.trim() && draft !== text) {
      onCommit(turnIndex, draft)
    }
  }

  if (editing) {
    return (
      <textarea
        autoFocus
        className="reviewer-turn-edit"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setEditing(false)
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) commit()
        }}
      />
    )
  }

  return (
    <span className="reviewer-turn-line-text" onClick={start} title="Click to edit">
      {text}
    </span>
  )
}

export default function TurnQueuePanel({
  activeTaskId,
  turns,
  strictMode,
  onStrictModeChange,
  startTurn,
  onStartTurnChange,
  turnCount,
  endTurn,
  onEndTurnChange,
  minPerTurn,
  onMinPerTurnChange,
  maxPerTurn,
  onMaxPerTurnChange,
  exportFormat,
  onExportFormatChange,
  exportText,
  onBuildTurns,
  onClearTurns,
  onCopyExport,
  onCopyCurrentTurn,
  onHoverTurn,
  onRemoveRemainingTurns,
  onResetCopyProgress,
  onSaveAsTask,
  onUpdateActiveTask,
  onUpdateTurnText,
  copyPointer,
  hoveredInstanceIds,
  saveButtonRef,
  validation,
}) {
  const filledTurnCount = turns.filter((turn) => turn.items.length > 0).length
  const hasErrors = validation.errors.length > 0
  const hasTurns = turns.length > 0
  const isEditingTask = activeTaskId !== null
  const canRemoveRemaining = isEditingTask && copyPointer > 0 && copyPointer < turns.length

  const nextCopyTurn = useMemo(() => {
    for (let i = copyPointer; i < turns.length; i++) {
      if (turns[i].text) return i
    }
    return null
  }, [copyPointer, turns])

  const nextTurnLabel = nextCopyTurn !== null
    ? `Copy Turn ${startTurn + nextCopyTurn}`
    : 'All turns copied'

  const coloredTurns = useMemo(() => {
    if (!turns.length) return []
    return turns.map((turn, index) => {
      const itemIds = turn.items.map((i) => i.instanceId)
      const hovered = hoveredInstanceIds && itemIds.some((id) => hoveredInstanceIds.has(id))
      return {
        ...turn,
        turnNumber: startTurn + index,
        copied: index < copyPointer,
        hovered,
        originalIndex: index,
      }
    })
  }, [turns, copyPointer, startTurn, hoveredInstanceIds])

  return (
    <section className="reviewer-panel reviewer-right-panel">
      <div className="reviewer-panel-header">
        <div>
          <h2>Turn queue builder</h2>
        </div>
        <span className="reviewer-count-pill">{filledTurnCount}/{turnCount} filled</span>
      </div>

      <div className="reviewer-toolbar reviewer-toolbar--wrap">
        <label className="reviewer-turn-field reviewer-turn-field--inline">
          <span>Start</span>
          <input
            className="reviewer-num-xs"
            min="1"
            onChange={(event) => onStartTurnChange(Number(event.target.value) || 2)}
            type="number"
            value={startTurn}
          />
        </label>

        <label className="reviewer-turn-field reviewer-turn-field--inline">
          <span>End</span>
          <input
            className="reviewer-num-xs"
            min="1"
            onChange={(event) => {
              const v = Number(event.target.value) || startTurn
              onEndTurnChange(Math.max(v, startTurn))
            }}
            type="number"
            value={endTurn}
          />
        </label>

        <div className="reviewer-turn-field reviewer-turn-field--inline" title="Fixes per turn range (1-7)">
          <span>Fixes per turn</span>
          <span className="reviewer-minmax-label">min</span>
          <input
            className="reviewer-num-xs"
            min="1"
            max="7"
            onChange={(event) => {
              const v = Number(event.target.value) || 1
              const clamped = Math.min(Math.max(v, 1), 7)
              onMinPerTurnChange(Math.min(clamped, maxPerTurn))
            }}
            type="number"
            value={minPerTurn}
          />
          <span className="reviewer-minmax-label">max</span>
          <input
            className="reviewer-num-xs"
            min="1"
            max="7"
            onChange={(event) => {
              const v = Number(event.target.value) || 4
              const clamped = Math.min(Math.max(v, 1), 7)
              onMaxPerTurnChange(Math.max(clamped, minPerTurn))
            }}
            type="number"
            value={maxPerTurn}
          />
        </div>
      </div>

      <div className="reviewer-toolbar reviewer-toolbar--wrap">
        <button className="reviewer-primary-button" onClick={onBuildTurns} type="button">
          <SplitSquareVertical size={14} />
          Build {turnCount} turns
        </button>

        <button className="reviewer-danger-button" onClick={onClearTurns} type="button">
          Clear
        </button>
      </div>

      {(validation.errors.length > 0 || validation.warnings.length > 0) && (
        <div className="reviewer-validation-block">
          {validation.errors.length > 0 && (
            <div>
              <strong>Build blockers</strong>
              <ul className="reviewer-message-list reviewer-message-list--error">
                {validation.errors.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </div>
          )}

          {validation.warnings.length > 0 && (
            <div>
              <strong>Style warnings</strong>
              <ul className="reviewer-message-list reviewer-message-list--warning">
                {validation.warnings.slice(0, 8).map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {hasTurns && (
        <div className="reviewer-copy-turn-bar">
          <button
            className="reviewer-primary-button"
            disabled={nextCopyTurn === null}
            onClick={onCopyCurrentTurn}
            type="button"
          >
            <Copy size={14} />
            {nextTurnLabel}
          </button>
          {copyPointer > 0 && (
            <button className="reviewer-link-button" onClick={onResetCopyProgress} type="button">
              Reset progress
            </button>
          )}
          {canRemoveRemaining && (
            <button
              className="reviewer-secondary-button"
              onClick={onRemoveRemainingTurns}
              type="button"
              title="Delete un-copied turns and trim selected prompts to match"
            >
              <Scissors size={14} />
              Remove remaining turns
            </button>
          )}
        </div>
      )}

      <div className="reviewer-export-area">
        {coloredTurns.length > 0 ? (
          <div className="reviewer-turns-display">
            {coloredTurns.map((turn) => (
              <div
                key={turn.turn}
                className={[
                  'reviewer-turn-line',
                  turn.copied ? 'is-copied' : '',
                  !turn.text ? 'is-empty' : '',
                  turn.hovered ? 'is-linked' : '',
                ].join(' ')}
                onMouseEnter={() => turn.text && onHoverTurn && onHoverTurn(turn.originalIndex)}
                onMouseLeave={() => onHoverTurn && onHoverTurn(null)}
              >
                <span className="reviewer-turn-line-label">
                  {exportFormat === 'markdown' ? `## Turn ${turn.turnNumber}` : `Turn ${turn.turnNumber}`}
                </span>
                {turn.text && (
                  <EditableTurnText
                    text={turn.text}
                    turnIndex={turn.originalIndex}
                    onCommit={onUpdateTurnText}
                  />
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="reviewer-export-placeholder">
            Build turns to generate the export queue
          </div>
        )}
      </div>

      <div className="reviewer-toolbar reviewer-toolbar--footer reviewer-toolbar--wrap">
        <select className="reviewer-select" onChange={(event) => onExportFormatChange(event.target.value)} value={exportFormat}>
          <option value="markdown">Markdown</option>
          <option value="plain">Plain text</option>
        </select>

        <button
          className="reviewer-secondary-button"
          disabled={hasErrors || !exportText}
          onClick={onCopyExport}
          type="button"
        >
          <Copy size={14} />
          Copy all
        </button>

        {hasTurns && !isEditingTask && (
          <button
            ref={saveButtonRef}
            className="reviewer-primary-button"
            onClick={onSaveAsTask}
            type="button"
          >
            <Save size={14} />
            Save as Task
          </button>
        )}

        {isEditingTask && (
          <button
            className="reviewer-primary-button"
            onClick={onUpdateActiveTask}
            type="button"
          >
            <Save size={14} />
            Update Task
          </button>
        )}
      </div>
    </section>
  )
}
