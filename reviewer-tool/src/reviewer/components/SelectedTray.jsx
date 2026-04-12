import React from 'react'
import { X, Lock } from 'lucide-react'
import EditablePromptText from './EditablePromptText'
import PromptText from './PromptText'

export default function SelectedTray({
  groupedSelections,
  selectedCount,
  hoveredInstanceIds,
  lockedItemIds,
  onDeduplicate,
  onClearSelected,
  onHoverItem,
  onClickItem,
  onRemoveItem,
  onUpdateItemText,
}) {
  return (
    <section className="reviewer-panel reviewer-right-panel">
      <div className="reviewer-panel-header">
        <div>
          <h2>Selected prompts</h2>
          <p>Click highlighted values to edit them</p>
        </div>
        <span className="reviewer-count-pill">{selectedCount}</span>
      </div>

      <div className="reviewer-toolbar reviewer-toolbar--summary">
        <button className="reviewer-secondary-button" onClick={onClearSelected} type="button">
          Clear all selected
        </button>
      </div>

      {groupedSelections.length === 0 ? (
        <div className="reviewer-empty-summary">
          Add prompts from the library to build the export queue
        </div>
      ) : (
        <div className="reviewer-summary-list">
          {groupedSelections.map((group) => (
            <section key={group.id} className="reviewer-summary-group">
              <div className="reviewer-summary-group-header">
                <h3>{group.label}</h3>
                <span className="reviewer-count-pill">{group.items.length}</span>
              </div>

              <ol className="reviewer-summary-ol">
                {group.items.map((item) => {
                  const isLocked = lockedItemIds?.has(item.instanceId)
                  const hasVars = /\{[^}]+\}/.test(item.promptText || '')
                  const isUnedited = !isLocked && hasVars && item.edited === false
                  const classes = [
                    isLocked ? 'is-locked' : '',
                    isUnedited ? 'is-unedited' : '',
                    hoveredInstanceIds?.has(item.instanceId) ? 'is-linked' : '',
                  ].filter(Boolean).join(' ')
                  return (
                    <li
                      key={item.instanceId}
                      className={classes}
                      onMouseEnter={() => onHoverItem && onHoverItem(item.instanceId)}
                      onMouseLeave={() => onHoverItem && onHoverItem(null)}
                      onClick={(e) => {
                        e.stopPropagation()
                        onClickItem && onClickItem(item.instanceId)
                      }}
                    >
                      <div className="reviewer-summary-item">
                        <div className="reviewer-summary-item-text">
                          {isLocked ? (
                            <PromptText text={item.promptText} />
                          ) : (
                            <EditablePromptText
                              text={item.promptText}
                              onTextChange={(newText) => onUpdateItemText(item.instanceId, newText)}
                            />
                          )}
                        </div>
                        {isLocked ? (
                          <span className="reviewer-summary-item-lock" title="Already copied — locked">
                            <Lock size={12} />
                          </span>
                        ) : (
                          <button
                            className="reviewer-summary-item-remove"
                            onClick={(e) => {
                              e.stopPropagation()
                              onRemoveItem && onRemoveItem(item.instanceId)
                            }}
                            title="Remove this prompt"
                            type="button"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ol>
            </section>
          ))}
        </div>
      )}
    </section>
  )
}
