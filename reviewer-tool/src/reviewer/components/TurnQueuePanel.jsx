import React from 'react'
import { Copy, Download, SplitSquareVertical } from 'lucide-react'
import { STRICT_RULES, STRICT_TURN_COUNT } from '../constants'

export default function TurnQueuePanel({
  turns,
  strictMode,
  onStrictModeChange,
  startTurn,
  onStartTurnChange,
  exportFormat,
  onExportFormatChange,
  exportText,
  onBuildTurns,
  onClearTurns,
  onCopyExport,
  onDownloadExport,
  validation,
}) {
  const filledTurnCount = turns.filter((turn) => turn.items.length > 0).length
  const hasErrors = validation.errors.length > 0

  return (
    <section className="reviewer-panel reviewer-right-panel">
      <div className="reviewer-panel-header">
        <div>
          <h2>Turn queue builder</h2>
          <p>Build a strict 20-turn export from the current selection</p>
        </div>
        <span className="reviewer-count-pill">{filledTurnCount}/{STRICT_TURN_COUNT} filled</span>
      </div>

      <div className="reviewer-toolbar reviewer-toolbar--wrap">
        <label className="reviewer-checkbox">
          <input checked={strictMode} onChange={(event) => onStrictModeChange(event.target.checked)} type="checkbox" />
          Strict mode
        </label>

        <label className="reviewer-turn-field reviewer-turn-field--inline">
          <span>Start at</span>
          <input min="2" onChange={(event) => onStartTurnChange(Number(event.target.value) || 2)} type="number" value={startTurn} />
        </label>

        <button className="reviewer-primary-button" onClick={onBuildTurns} type="button">
          <SplitSquareVertical size={14} />
          Build 20 turns
        </button>

        <button className="reviewer-secondary-button" onClick={onClearTurns} type="button">
          Clear export
        </button>
      </div>

      <div className="reviewer-rule-strip">
        {STRICT_RULES.map((rule) => (
          <span key={rule} className="reviewer-tag reviewer-tag--rule">
            {rule}
          </span>
        ))}
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

      <div className="reviewer-toolbar reviewer-toolbar--wrap">
        <select className="reviewer-select" onChange={(event) => onExportFormatChange(event.target.value)} value={exportFormat}>
          <option value="markdown">Markdown export</option>
          <option value="plain">Plain text export</option>
        </select>
      </div>

      <textarea
        className="reviewer-export-preview"
        placeholder="Build 20 turns to generate export text"
        readOnly
        value={exportText}
      />

      <div className="reviewer-toolbar reviewer-toolbar--footer reviewer-toolbar--wrap">
        <button
          className="reviewer-secondary-button"
          disabled={hasErrors || !exportText}
          onClick={onCopyExport}
          type="button"
        >
          <Copy size={14} />
          Copy
        </button>

        <button
          className="reviewer-secondary-button"
          disabled={hasErrors || !exportText}
          onClick={onDownloadExport}
          type="button"
        >
          <Download size={14} />
          Download
        </button>
      </div>
    </section>
  )
}
